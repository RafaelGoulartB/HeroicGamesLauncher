import { addHandler } from 'backend/ipc'
import { logInfo, LogPrefix } from 'backend/logger'
import { refreshMissingLocalCovers } from './covers'
import {
  importPlayniteLibrary,
  mergePlayniteLibrary,
  previewPlayniteImport,
  previewPlayniteMerge
} from './import'
import { exportPlayniteLibrary } from './export'
import { refreshLocalInstallStates } from './install-state'
import { openSteamClientUri } from './steam'
import {
  clearCollectionGameArt,
  getAllCollectionArt,
  setCollectionGameArt,
  setCollectionGameArtFromUrl
} from './art'
import { searchCollectionWebImages } from './web-images'
import { cacheSteamHero, warmSteamHeroes } from './heroes'
import { getSteamAppDetails } from './steam-details'
import { initLocalArtProtocol } from './protocol'
import { maybeRunScheduledBackup, runCollectionBackup } from './backup'
import {
  getCollectionSettings,
  setCollectionBackupSettings,
  setCollectionUiSettings,
  setLudusaviSettings
} from './settings'
import { backupLudusaviForGame, detectLudusavi } from './ludusavi'
import {
  backfillMissingGameStatuses,
  ensureDefaultStatuses,
  deleteCompletionStatus,
  getCompletionStatuses,
  getLastPlayniteLibraryPath,
  reorderCompletionStatuses,
  setGameCompletionStatus,
  upsertCompletionStatus
} from './status'
import {
  getAllLocalGameMeta,
  getLocalGameMeta,
  getLocalSessions
} from './stores'

let registered = false

export function registerLocalLibraryIpc() {
  if (registered) return
  registered = true

  addHandler('previewPlayniteImport', (_e, args) => previewPlayniteImport(args))
  addHandler('importPlayniteLibrary', (_e, args) => importPlayniteLibrary(args))
  addHandler('mergePlayniteLibrary', () => mergePlayniteLibrary())
  addHandler('previewPlayniteMerge', () => previewPlayniteMerge())
  addHandler('exportPlayniteLibrary', (_e, targetPath) =>
    exportPlayniteLibrary(targetPath)
  )
  addHandler('getLastPlayniteLibraryPath', () => getLastPlayniteLibraryPath())
  addHandler('getLocalGameSessions', (_e, appName) => getLocalSessions(appName))
  addHandler('getLocalGameMeta', (_e, appName) => getLocalGameMeta(appName))
  addHandler('getAllLocalGameMeta', () => getAllLocalGameMeta())
  addHandler('getCompletionStatuses', () => getCompletionStatuses())
  addHandler('setGameCompletionStatus', (_e, args) => {
    setGameCompletionStatus(args.appName, args.statusId, {
      runner: args.runner,
      title: args.title,
      playniteId: args.playniteId
    })
    return getLocalGameMeta(args.appName)
  })
  addHandler('upsertCompletionStatus', (_e, status) =>
    upsertCompletionStatus(status)
  )
  addHandler('deleteCompletionStatus', (_e, id) => deleteCompletionStatus(id))
  addHandler('reorderCompletionStatuses', (_e, ids) =>
    reorderCompletionStatuses(ids)
  )
  addHandler('openSteamClientUri', (_e, args) =>
    openSteamClientUri(args.action, args.steamAppId)
  )
  addHandler('cacheSteamHero', (_e, steamAppId) => cacheSteamHero(steamAppId))
  addHandler('getSteamAppDetails', (_e, args) => getSteamAppDetails(args))
  addHandler('getAllCollectionArt', () => getAllCollectionArt())
  addHandler('setCollectionGameArt', (_e, args) => setCollectionGameArt(args))
  addHandler('searchCollectionWebImages', (_e, args) =>
    searchCollectionWebImages(args)
  )
  addHandler('setCollectionGameArtFromUrl', (_e, args) =>
    setCollectionGameArtFromUrl(args)
  )
  addHandler('clearCollectionGameArt', (_e, args) =>
    clearCollectionGameArt(args)
  )
  addHandler('getCollectionSettings', async () => {
    const settings = getCollectionSettings()
    const ludusaviDetected = await detectLudusavi(settings.ludusavi.binaryPath)
    return { ...settings, ludusaviDetected }
  })
  addHandler('setCollectionUiSettings', async (_e, args) => {
    const settings = setCollectionUiSettings(args)
    const ludusaviDetected = await detectLudusavi(settings.ludusavi.binaryPath)
    return { ...settings, ludusaviDetected }
  })
  addHandler('setCollectionBackupSettings', async (_e, args) => {
    const settings = setCollectionBackupSettings(args)
    const ludusaviDetected = await detectLudusavi(settings.ludusavi.binaryPath)
    return { ...settings, ludusaviDetected }
  })
  addHandler('runCollectionBackup', (_e, force) =>
    runCollectionBackup(Boolean(force))
  )
  addHandler('setLudusaviSettings', async (_e, args) => {
    const settings = setLudusaviSettings(args)
    const ludusaviDetected = await detectLudusavi(settings.ludusavi.binaryPath)
    return { ...settings, ludusaviDetected }
  })
  addHandler('runLudusaviBackup', (_e, args) =>
    backupLudusaviForGame({ ...args, reason: 'manual' })
  )
}

export async function initLocalLibrary() {
  registerLocalLibraryIpc()
  initLocalArtProtocol()
  logInfo(
    'Collection overlay: Ludusavi backup handler registered',
    LogPrefix.Backend
  )
  ensureDefaultStatuses()
  backfillMissingGameStatuses()
  await refreshLocalInstallStates()
  void refreshMissingLocalCovers()
  void warmSteamHeroes(
    Object.values(getAllLocalGameMeta())
      .map((meta) => meta.steamAppId)
      .filter((id): id is string => Boolean(id))
  )
  void maybeRunScheduledBackup()
}
