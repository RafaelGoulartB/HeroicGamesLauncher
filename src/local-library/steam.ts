import { existsSync, readdirSync } from 'graceful-fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'
import type LogWriter from 'backend/logger/log_writer'
import { logInfo, LogPrefix } from 'backend/logger'
import { searchForExecutableOnPath } from 'backend/utils/os/path'
import type { GameInfo } from 'common/types'
import { getLocalGameMeta } from './stores'

const STEAM_INSTALL_CACHE_MS = 15_000
let installedSteamAppsCache: { at: number; ids: Set<string> } | null = null

export async function findSteamBinary(): Promise<string | null> {
  const candidates = ['steam', 'steam-runtime']
  for (const name of candidates) {
    const found = await searchForExecutableOnPath(name)
    if (found) return found
  }
  return null
}

export async function isSteamClientAvailable(): Promise<boolean> {
  return Boolean(await findSteamBinary())
}

export async function steamLibraryRoots(): Promise<string[]> {
  const { getSteamLibraries } = await import('backend/utils')
  const fromHeroic = await getSteamLibraries()
  const extras = [
    join(homedir(), '.steam', 'steam'),
    join(homedir(), '.local', 'share', 'Steam')
  ]
  return [...new Set([...fromHeroic, ...extras])].filter((path) =>
    existsSync(path)
  )
}

export async function getInstalledSteamAppIds(
  force = false
): Promise<Set<string>> {
  if (
    !force &&
    installedSteamAppsCache &&
    Date.now() - installedSteamAppsCache.at < STEAM_INSTALL_CACHE_MS
  ) {
    return installedSteamAppsCache.ids
  }

  const ids = new Set<string>()
  for (const library of await steamLibraryRoots()) {
    const steamapps = join(library, 'steamapps')
    if (!existsSync(steamapps)) continue
    try {
      for (const file of readdirSync(steamapps)) {
        const match = file.match(/^appmanifest_(\d+)\.acf$/i)
        if (match) ids.add(match[1])
      }
    } catch {
      // Unreadable library folder — skip
    }
  }

  installedSteamAppsCache = { at: Date.now(), ids }
  return ids
}

export async function isSteamAppInstalled(appId: string): Promise<boolean> {
  if (!appId) return false
  const ids = await getInstalledSteamAppIds()
  return ids.has(appId)
}

export async function getSteamLogFiles(): Promise<string[]> {
  const names = ['console_log.txt', 'console-linux.txt', 'console-windows.txt']
  const dirs = new Set<string>()
  for (const root of await steamLibraryRoots()) {
    dirs.add(join(root, 'logs'))
  }
  dirs.add(join(homedir(), '.steam', 'steam', 'logs'))
  dirs.add(join(homedir(), '.local', 'share', 'Steam', 'logs'))

  const files: string[] = []
  for (const dir of dirs) {
    for (const name of names) {
      const file = join(dir, name)
      if (existsSync(file)) files.push(file)
    }
  }
  return [...new Set(files)]
}

export function isSteamUriGame(appName: string): boolean {
  const meta = getLocalGameMeta(appName)
  return meta?.launchKind === 'steam-uri' && Boolean(meta.steamAppId)
}

export async function tryLaunchLocalGame(
  gameInfo: GameInfo,
  logWriter: LogWriter,
  extraArgs: string[] = []
): Promise<boolean | null> {
  const meta = getLocalGameMeta(gameInfo.app_name)
  if (!meta || meta.launchKind !== 'steam-uri' || !meta.steamAppId) {
    return null
  }

  const steamBin = await findSteamBinary()
  if (!steamBin) {
    await logWriter.logError('Steam client was not found on PATH')
    return false
  }

  const uri = `steam://rungameid/${meta.steamAppId}`
  logInfo(`Launching ${gameInfo.title} via ${uri}`, LogPrefix.Backend)

  const { callRunner } = await import('backend/launcher')
  const result = await callRunner(
    [uri, ...extraArgs],
    {
      name: 'sideload',
      logPrefix: LogPrefix.Sideload,
      bin: basename(steamBin),
      dir: dirname(steamBin)
    },
    {
      abortId: gameInfo.app_name,
      logWriters: [logWriter],
      logMessagePrefix: LogPrefix.Sideload
    }
  )

  if (result.error || result.abort) {
    return !result.error && !result.abort
  }

  const { sendGameStatusUpdate } = await import('backend/utils')
  sendGameStatusUpdate({
    appName: gameInfo.app_name,
    runner: 'sideload',
    status: 'playing'
  })

  const {
    createAbortController,
    deleteAbortController
  } = await import('backend/utils/aborthandler/aborthandler')
  const { waitForSteamSession } = await import('./playtime-watch')

  const abortController = createAbortController(gameInfo.app_name)
  try {
    await waitForSteamSession({
      appName: gameInfo.app_name,
      steamAppId: meta.steamAppId,
      signal: abortController.signal,
      title: gameInfo.title,
      logFiles: await getSteamLogFiles(),
      resolveLogFiles: getSteamLogFiles
    })
  } finally {
    deleteAbortController(gameInfo.app_name)
  }

  return true
}

export async function tryStopLocalGame(appName: string): Promise<boolean> {
  if (!isSteamUriGame(appName)) return false
  const { stopLocalPlaytimeWatch } = await import('./playtime-watch')
  stopLocalPlaytimeWatch(appName)
  return true
}
