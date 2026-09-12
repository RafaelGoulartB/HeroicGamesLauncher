import { sendFrontendMessage } from 'backend/ipc'
import { logInfo, LogPrefix } from 'backend/logger'
import { libraryStore as sideloadStore } from 'backend/storeManagers/sideload/electronStores'
import type { GameInfo } from 'common/types'
import type { LocalGameMeta } from 'common/types/local-library'
import { pathExists } from './playnite/path-remap'
import { findSteamBinary, getInstalledSteamAppIds } from './steam'
import { getLocalGameMeta } from './stores'

function nextInstallState(
  game: GameInfo,
  meta: LocalGameMeta,
  installedSteam: Set<string>,
  steamBin: string | null
): { is_installed: boolean; executable: string } {
  if (meta.launchKind === 'steam-uri') {
    const installed = Boolean(
      meta.steamAppId && installedSteam.has(meta.steamAppId)
    )
    return {
      is_installed: installed,
      executable: installed ? (steamBin ?? 'steam') : ''
    }
  }

  if (meta.launchKind === 'executable' || meta.launchKind === 'emulator') {
    const executable = pathExists(meta.remappedExecutable)
      ? meta.remappedExecutable!
      : ''
    return {
      is_installed: Boolean(executable),
      executable
    }
  }

  return { is_installed: false, executable: game.install.executable ?? '' }
}

export async function refreshLocalInstallStates(): Promise<void> {
  const games = sideloadStore.get('games', [])
  const installedSteam = await getInstalledSteamAppIds(true)
  const steamBin = await findSteamBinary()
  let changed = 0

  for (const game of games) {
    const meta = getLocalGameMeta(game.app_name)
    if (!meta) continue

    const next = nextInstallState(game, meta, installedSteam, steamBin)
    if (
      next.is_installed === game.is_installed &&
      next.executable === (game.install.executable ?? '')
    ) {
      continue
    }

    game.is_installed = next.is_installed
    game.install = { ...game.install, executable: next.executable }
    changed += 1
  }

  if (!changed) return

  sideloadStore.set('games', games)
  logInfo(
    `Updated install state for ${changed} local game(s)`,
    LogPrefix.Backend
  )
  sendFrontendMessage('refreshLibrary', 'sideload')
}
