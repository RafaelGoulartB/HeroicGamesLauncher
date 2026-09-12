import { GlobalConfig } from 'backend/config'
import { logWarning, LogPrefix } from 'backend/logger'
import { decryptApiKey, isEncryptedValue } from 'backend/steamgrid/secureKey'
import { getGrids, getHeroes, searchGame } from 'backend/steamgrid/utils'
import { axiosClient } from 'backend/utils'
import type { GameInfo } from 'common/types'
import type { LocalGameMeta } from 'common/types/local-library'

function steamCdn(appId: string, file: string) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${file}`
}

function steamGridKey(): string {
  const stored = GlobalConfig.get().getSettings().steamGridDbApiKey ?? ''
  if (!stored) return ''
  return isEncryptedValue(stored) ? decryptApiKey(stored) : stored
}

async function coversFromSteamGrid(
  apiKey: string,
  sgdbId: number
): Promise<{ art_square?: string; art_cover?: string }> {
  const [grids, heroes] = await Promise.all([
    getGrids(apiKey, { gameId: sgdbId, dimensions: ['600x900'] }),
    getHeroes(apiKey, { gameId: sgdbId, dimensions: ['1600x650'] })
  ])
  return {
    art_square: grids[0]?.url,
    art_cover: heroes[0]?.url ?? grids[0]?.url
  }
}

async function steamGridIdFromSteamApp(
  apiKey: string,
  steamAppId: string
): Promise<number | undefined> {
  try {
    const response = await axiosClient.get<{
      success: boolean
      data?: { id: number }
    }>(`https://www.steamgriddb.com/api/v2/games/steam/${steamAppId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (response.data.success && response.data.data?.id) {
      return response.data.data.id
    }
  } catch (error) {
    logWarning(
      `SteamGridDB steam id lookup failed for ${steamAppId}: ${String(error)}`,
      LogPrefix.Backend
    )
  }
  return undefined
}

export async function fetchCoversForGame(
  meta: LocalGameMeta,
  gameInfo: GameInfo
): Promise<Pick<GameInfo, 'art_cover' | 'art_square'>> {
  if (meta.steamAppId) {
    const art_square = steamCdn(meta.steamAppId, 'library_600x900_2x.jpg')
    const art_cover = steamCdn(meta.steamAppId, 'header.jpg')
    const apiKey = steamGridKey()
    if (apiKey) {
      const sgdbId = await steamGridIdFromSteamApp(apiKey, meta.steamAppId)
      if (sgdbId) {
        const sgdb = await coversFromSteamGrid(apiKey, sgdbId)
        return {
          art_square: sgdb.art_square ?? art_square,
          art_cover: sgdb.art_cover ?? art_cover
        }
      }
    }
    return { art_square, art_cover }
  }

  const apiKey = steamGridKey()
  if (!apiKey) {
    return {
      art_cover: gameInfo.art_cover,
      art_square: gameInfo.art_square
    }
  }

  try {
    const results = await searchGame(apiKey, meta.title)
    if (!results[0]) {
      return {
        art_cover: gameInfo.art_cover,
        art_square: gameInfo.art_square
      }
    }
    const sgdb = await coversFromSteamGrid(apiKey, results[0].id)
    return {
      art_square: sgdb.art_square ?? gameInfo.art_square,
      art_cover: sgdb.art_cover ?? gameInfo.art_cover
    }
  } catch (error) {
    logWarning(
      `SteamGridDB search failed for ${meta.title}: ${String(error)}`,
      LogPrefix.Backend
    )
    return {
      art_cover: gameInfo.art_cover,
      art_square: gameInfo.art_square
    }
  }
}
