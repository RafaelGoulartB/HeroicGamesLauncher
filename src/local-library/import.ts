import { existsSync } from 'graceful-fs'
import { join } from 'path'
import { GameConfig } from 'backend/game_config'
import { sendFrontendMessage } from 'backend/ipc'
import { logError, logInfo, LogPrefix } from 'backend/logger'
import { tsStore } from 'backend/constants/key_value_stores'
import { libraryStore as sideloadStore } from 'backend/storeManagers/sideload/electronStores'
import { libraryStore as legendaryStore } from 'backend/storeManagers/legendary/electronStores'
import { libraryStore as gogStore } from 'backend/storeManagers/gog/electronStores'
import type { GameInfo } from 'common/types'
import type {
  DriveRemap,
  PlayniteImportArgs,
  PlayniteImportPreview,
  PlayniteImportResult,
  PlaynitePreviewArgs
} from 'common/types/local-library'
import { fetchCoversForGame } from './covers'
import {
  mapPlayniteGame,
  MappedPlayniteGame,
  normalizeTitle,
  playniteSessionsToLocal
} from './playnite/mapper'
import { collectWindowsDrives } from './playnite/path-remap'
import { loadPlayniteLibrary, PlayniteGame } from './playnite/reader'
import {
  findMetaByPlayniteId,
  mergeLocalSessions,
  upsertLocalGameMeta
} from './stores'
import { findSteamBinary, isSteamAppInstalled } from './steam'

function upsertSideloadGame(game: GameInfo) {
  const current = sideloadStore.get('games', [])
  const index = current.findIndex((item) => item.app_name === game.app_name)
  if (index >= 0) {
    current[index] = { ...current[index], ...game }
  } else {
    current.push(game)
  }
  sideloadStore.set('games', current)
}

function storeGames(runner: 'legendary' | 'gog'): GameInfo[] {
  if (runner === 'legendary') {
    return legendaryStore.get('library', [])
  }
  return gogStore.get('games', [])
}

function matchStoreGame(
  mapped: MappedPlayniteGame,
  runner: 'legendary' | 'gog'
): GameInfo | undefined {
  const games = storeGames(runner)
  const storeId = mapped.meta.storeGameId
  if (storeId) {
    const byId = games.find(
      (game) => game.app_name.toLowerCase() === storeId.toLowerCase()
    )
    if (byId) return byId
  }
  const title = normalizeTitle(mapped.meta.title)
  return games.find((game) => normalizeTitle(game.title) === title)
}

function collectPaths(game: PlayniteGame): string[] {
  return [
    game.installDirectory,
    ...game.gameActions.map((action) => action.path),
    ...game.roms.map((rom) => rom.path)
  ].filter((item): item is string => Boolean(item))
}

function writePlaytime(
  appName: string,
  playtimeMinutes: number,
  firstPlayed?: string,
  lastPlayed?: string
) {
  const existing = tsStore.get_nodefault(appName)
  const totalPlayed = Math.max(existing?.totalPlayed ?? 0, playtimeMinutes)
  const first =
    [existing?.firstPlayed, firstPlayed]
      .filter((value): value is string => Boolean(value))
      .sort()[0] ??
    firstPlayed ??
    ''
  const last =
    [existing?.lastPlayed, lastPlayed]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ??
    lastPlayed ??
    ''

  tsStore.set(appName, {
    firstPlayed: first,
    lastPlayed: last,
    totalPlayed
  })
}

async function applyLauncherArgs(appName: string, launcherArgs?: string) {
  if (!launcherArgs) return
  const config = GameConfig.get(appName)
  const settings = await config.getSettings()
  config.config = { ...settings, launcherArgs }
  config.flush()
}

function destinationFor(
  mapped: MappedPlayniteGame
): PlayniteImportPreview['games'][number]['destination'] {
  if (mapped.destination === 'legendary') {
    return matchStoreGame(mapped, 'legendary') ? 'legendary' : 'skip'
  }
  if (mapped.destination === 'gog') {
    return matchStoreGame(mapped, 'gog') ? 'gog' : 'skip'
  }
  return mapped.destination
}

export function previewPlayniteImport(
  args: PlaynitePreviewArgs
): PlayniteImportPreview {
  const libraryPath = args.libraryPath
  if (!existsSync(join(libraryPath, 'games.db'))) {
    return {
      libraryPath,
      playniteRoot: libraryPath,
      gameCount: 0,
      sessionFileCount: 0,
      detectedDrives: [],
      games: [],
      counts: {
        steam: 0,
        emulator: 0,
        manual: 0,
        xbox: 0,
        amazon: 0,
        other: 0,
        epicMatch: 0,
        gogMatch: 0,
        skippedStore: 0
      },
      errors: ['games.db was not found in the selected folder']
    }
  }

  const dump = loadPlayniteLibrary(libraryPath)
  const games: PlayniteImportPreview['games'] = []
  const counts: PlayniteImportPreview['counts'] = {
    steam: 0,
    emulator: 0,
    manual: 0,
    xbox: 0,
    amazon: 0,
    other: 0,
    epicMatch: 0,
    gogMatch: 0,
    skippedStore: 0
  }

  for (const game of dump.games) {
    const sessions = playniteSessionsToLocal(game.id, dump.sessionsByGameId)
    const mapped = mapPlayniteGame(game, dump.emulators, sessions, [])
    const destination = destinationFor(mapped)

    if (mapped.meta.source === 'steam') counts.steam += 1
    else if (mapped.meta.source === 'emulator') counts.emulator += 1
    else if (mapped.meta.source === 'manual') counts.manual += 1
    else if (mapped.meta.source === 'xbox') counts.xbox += 1
    else if (mapped.meta.source === 'amazon') counts.amazon += 1
    else if (mapped.meta.source === 'epic' && destination === 'legendary')
      counts.epicMatch += 1
    else if (mapped.meta.source === 'gog' && destination === 'gog')
      counts.gogMatch += 1
    else if (destination === 'skip') counts.skippedStore += 1
    else counts.other += 1

    games.push({
      playniteId: game.id,
      title: game.name,
      source: mapped.meta.source,
      destination,
      playtimeMinutes: mapped.playtimeMinutes,
      sessionCount: sessions.length,
      alreadyImported: Boolean(findMetaByPlayniteId(game.id)),
      matchedAppName:
        destination === 'legendary'
          ? matchStoreGame(mapped, 'legendary')?.app_name
          : destination === 'gog'
            ? matchStoreGame(mapped, 'gog')?.app_name
            : mapped.meta.appName
    })
  }

  return {
    libraryPath: dump.libraryPath,
    playniteRoot: dump.playniteRoot,
    gameCount: dump.games.length,
    sessionFileCount: Object.keys(dump.sessionsByGameId).length,
    detectedDrives: collectWindowsDrives(dump.games.flatMap(collectPaths)),
    games,
    counts,
    errors: []
  }
}

export async function importPlayniteLibrary(
  args: PlayniteImportArgs
): Promise<PlayniteImportResult> {
  const result: PlayniteImportResult = {
    imported: 0,
    updated: 0,
    matchedStore: 0,
    skipped: 0,
    coversFetched: 0,
    sessionsImported: 0,
    errors: []
  }

  const dump = loadPlayniteLibrary(args.libraryPath)
  const driveMap: DriveRemap[] = args.driveMap ?? []
  const steamBin = await findSteamBinary()

  logInfo(
    `Importing Playnite library from ${args.libraryPath} (${dump.games.length} games)`,
    LogPrefix.Backend
  )

  for (const game of dump.games) {
    try {
      const sessions = playniteSessionsToLocal(game.id, dump.sessionsByGameId)
      const mapped = mapPlayniteGame(game, dump.emulators, sessions, driveMap)
      const destination = destinationFor(mapped)
      const existed = Boolean(findMetaByPlayniteId(game.id))

      if (destination === 'skip') {
        result.skipped += 1
        continue
      }

      if (destination === 'legendary' || destination === 'gog') {
        const matched = matchStoreGame(mapped, destination)
        if (!matched) {
          result.skipped += 1
          continue
        }
        mapped.meta.appName = matched.app_name
        mapped.meta.runner = destination
        upsertLocalGameMeta(mapped.meta)
        writePlaytime(
          matched.app_name,
          mapped.playtimeMinutes,
          mapped.firstPlayed,
          mapped.lastPlayed
        )
        mergeLocalSessions(matched.app_name, mapped.sessions)
        result.sessionsImported += mapped.sessions.length
        result.matchedStore += 1
        continue
      }

      if (!mapped.gameInfo) {
        result.skipped += 1
        continue
      }

      if (mapped.meta.launchKind === 'steam-uri') {
        const steamInstalled = mapped.meta.steamAppId
          ? await isSteamAppInstalled(mapped.meta.steamAppId)
          : false
        mapped.gameInfo.is_installed = steamInstalled
        mapped.gameInfo.is_linux_native = true
        mapped.gameInfo.install.executable = steamInstalled
          ? (steamBin ?? 'steam')
          : ''
      }

      if (args.fetchCovers !== false) {
        const covers = await fetchCoversForGame(mapped.meta, mapped.gameInfo)
        if (covers.art_cover || covers.art_square) {
          mapped.gameInfo = { ...mapped.gameInfo, ...covers }
          result.coversFetched += 1
        }
      }

      upsertSideloadGame(mapped.gameInfo)
      upsertLocalGameMeta(mapped.meta)
      writePlaytime(
        mapped.meta.appName,
        mapped.playtimeMinutes,
        mapped.firstPlayed,
        mapped.lastPlayed
      )
      mergeLocalSessions(mapped.meta.appName, mapped.sessions)
      await applyLauncherArgs(mapped.meta.appName, mapped.meta.launcherArgs)
      result.sessionsImported += mapped.sessions.length
      if (existed) result.updated += 1
      else result.imported += 1
    } catch (error) {
      const message = `Failed to import ${game.name}: ${String(error)}`
      logError(message, LogPrefix.Backend)
      result.errors.push(message)
    }
  }

  sendFrontendMessage('refreshLibrary', 'sideload')
  return result
}
