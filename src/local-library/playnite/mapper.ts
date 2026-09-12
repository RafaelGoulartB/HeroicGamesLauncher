import type {
  LocalGameMeta,
  LocalGameSession,
  LocalGameSource,
  LocalLaunchKind,
  DriveRemap
} from 'common/types/local-library'
import type { GameInfo, InstallPlatform } from 'common/types'
import {
  AMAZON_PLUGIN_ID,
  EMPTY_GUID,
  EPIC_PLUGIN_ID,
  GOG_PLUGIN_ID,
  PlayniteEmulator,
  PlayniteGame,
  PlayniteGameAction,
  STEAM_PLUGIN_ID,
  XBOX_PLUGIN_ID
} from './reader'
import {
  expandPlayniteVariables,
  pathExists,
  remapWindowsPath
} from './path-remap'

export type MappedDestination =
  | 'sideload'
  | 'legendary'
  | 'gog'
  | 'nile'
  | 'skip'

export interface MappedPlayniteGame {
  meta: LocalGameMeta
  gameInfo?: GameInfo
  sessions: LocalGameSession[]
  destination: MappedDestination
  playtimeMinutes: number
  firstPlayed?: string
  lastPlayed?: string
}

function pluginSource(pluginId: string, isEmulator: boolean): LocalGameSource {
  if (isEmulator) return 'emulator'
  switch (pluginId) {
    case STEAM_PLUGIN_ID:
      return 'steam'
    case EPIC_PLUGIN_ID:
      return 'epic'
    case GOG_PLUGIN_ID:
      return 'gog'
    case AMAZON_PLUGIN_ID:
      return 'amazon'
    case XBOX_PLUGIN_ID:
      return 'xbox'
    case EMPTY_GUID:
      return 'manual'
    default:
      return 'other'
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function playAction(game: PlayniteGame): PlayniteGameAction | undefined {
  return (
    game.gameActions.find((action) => action.isPlayAction) ??
    game.gameActions[0]
  )
}

function isEmulated(game: PlayniteGame): boolean {
  return (
    game.roms.length > 0 || game.gameActions.some((action) => action.type === 2)
  )
}

function stableAppName(game: PlayniteGame, source: LocalGameSource): string {
  if (source === 'steam' && game.gameId) return `steam_${game.gameId}`
  return `playnite_${game.id}`
}

function pickPlatform(
  launchKind: LocalLaunchKind,
  executable?: string
): InstallPlatform {
  if (launchKind === 'steam-uri') return 'linux'
  if (launchKind === 'unavailable') return 'Windows'
  if (executable && !executable.toLowerCase().endsWith('.exe')) return 'linux'
  return 'Windows'
}

function resolveEmulatorLaunch(
  game: PlayniteGame,
  emulators: PlayniteEmulator[],
  driveMap: DriveRemap[]
): { executable?: string; args?: string; emulatorName?: string } {
  const action = playAction(game)
  const emulator = emulators.find((item) => item.id === action?.emulatorId)
  const profile =
    emulator?.profiles.find((item) => item.id === action?.emulatorProfileId) ??
    emulator?.profiles[0]

  const installDir = remapWindowsPath(emulator?.installDir, driveMap)
  const romPath = remapWindowsPath(game.roms[0]?.path, driveMap)
  const rawExe =
    profile?.executable ?? profile?.startupExecutable ?? emulator?.installDir
  const expandedExe = expandPlayniteVariables(rawExe, {
    InstallDir: installDir,
    EmulatorDir: installDir,
    ImagePath: romPath
  })
  const executable = remapWindowsPath(expandedExe, driveMap) ?? expandedExe

  const rawArgs = action?.overrideDefaultArgs
    ? action.arguments
    : [
        profile?.arguments ?? profile?.customArguments,
        action?.additionalArguments
      ]
        .filter(Boolean)
        .join(' ')

  const args = expandPlayniteVariables(rawArgs, {
    InstallDir: remapWindowsPath(game.installDirectory, driveMap),
    EmulatorDir: installDir,
    ImagePath: romPath,
    Name: game.name
  })

  return { executable, args, emulatorName: emulator?.name }
}

function resolveExecutableLaunch(
  game: PlayniteGame,
  driveMap: DriveRemap[]
): { executable?: string; args?: string } {
  const action = playAction(game)
  const installDir = remapWindowsPath(game.installDirectory, driveMap)
  const rawPath = expandPlayniteVariables(action?.path, {
    InstallDir: installDir,
    Name: game.name
  })
  const executable =
    remapWindowsPath(rawPath, driveMap) ??
    (rawPath?.startsWith('/') ? rawPath : undefined)

  const args = expandPlayniteVariables(action?.arguments, {
    InstallDir: installDir,
    Name: game.name
  })

  return { executable, args }
}

export function mapPlayniteGame(
  game: PlayniteGame,
  emulators: PlayniteEmulator[],
  sessions: LocalGameSession[],
  driveMap: DriveRemap[]
): MappedPlayniteGame {
  const emulated = isEmulated(game)
  const source = pluginSource(game.pluginId, emulated)
  const appName = stableAppName(game, source)
  const playtimeMinutes = Math.floor(game.playtimeSeconds / 60)
  const firstPlayed = sessions[0]?.startedAt ?? game.added ?? game.lastActivity
  const lastPlayed = game.lastActivity ?? sessions.at(-1)?.startedAt

  let destination: MappedDestination = 'sideload'
  let launchKind: LocalLaunchKind = 'executable'
  let executable: string | undefined
  let launcherArgs: string | undefined
  let emulatorName: string | undefined

  if (source === 'epic') {
    destination = 'legendary'
    launchKind = 'unavailable'
  } else if (source === 'gog') {
    destination = 'gog'
    launchKind = 'unavailable'
  } else if (source === 'steam' && game.gameId) {
    launchKind = 'steam-uri'
    launcherArgs = `steam://rungameid/${game.gameId}`
  } else if (source === 'xbox') {
    launchKind = 'unavailable'
  } else if (emulated) {
    launchKind = 'emulator'
    const resolved = resolveEmulatorLaunch(game, emulators, driveMap)
    executable = resolved.executable
    launcherArgs = resolved.args
    emulatorName = resolved.emulatorName
  } else {
    const resolved = resolveExecutableLaunch(game, driveMap)
    executable = resolved.executable
    launcherArgs = resolved.args
  }

  if (
    (launchKind === 'executable' || launchKind === 'emulator') &&
    !pathExists(executable)
  ) {
    executable = undefined
  }

  if (launchKind === 'emulator' && game.roms.length > 0) {
    const romOnDisk = game.roms.some((rom) =>
      pathExists(remapWindowsPath(rom.path, driveMap))
    )
    if (!romOnDisk) executable = undefined
  }

  const platform = pickPlatform(launchKind, executable)
  const isInstalled =
    (launchKind === 'executable' || launchKind === 'emulator') &&
    Boolean(executable)

  const meta: LocalGameMeta = {
    appName,
    runner: destination === 'sideload' ? 'sideload' : destination,
    playniteId: game.id,
    pluginId: game.pluginId,
    source,
    launchKind,
    steamAppId: source === 'steam' ? game.gameId : undefined,
    storeGameId: game.gameId,
    title: game.name,
    windowsInstallDirectory: game.installDirectory,
    windowsExecutable: playAction(game)?.path,
    remappedExecutable: executable,
    launcherArgs,
    roms: game.roms,
    emulatorName,
    notes: game.notes
  }

  const gameInfo: GameInfo | undefined =
    destination === 'sideload'
      ? {
          runner: 'sideload',
          app_name: appName,
          title: game.name,
          art_cover: '',
          art_square: '',
          developer: game.developers[0],
          description: game.notes,
          is_installed: isInstalled,
          canRunOffline: launchKind !== 'steam-uri',
          is_linux_native: platform === 'linux',
          folder_name: executable
            ? executable.replace(/\/[^/]+$/, '')
            : undefined,
          install: {
            executable: executable ?? '',
            platform,
            is_dlc: false
          }
        }
      : undefined

  return {
    meta,
    gameInfo,
    sessions,
    destination,
    playtimeMinutes,
    firstPlayed,
    lastPlayed
  }
}

export function playniteSessionsToLocal(
  playniteId: string,
  dumpSessions: Record<
    string,
    Array<{
      dateSession: string
      elapsedSeconds: number
      gameActionName?: string
    }>
  >
): LocalGameSession[] {
  const items = dumpSessions[playniteId] ?? []
  return items
    .map((item) => {
      const started = new Date(item.dateSession)
      const ended = new Date(started.getTime() + item.elapsedSeconds * 1000)
      return {
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        elapsedSeconds: item.elapsedSeconds,
        source: 'playnite' as const,
        gameActionName: item.gameActionName
      }
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}
