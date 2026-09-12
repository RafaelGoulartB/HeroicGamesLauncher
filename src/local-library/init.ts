import { addHandler } from 'backend/ipc'
import { refreshMissingLocalCovers } from './covers'
import {
  importPlayniteLibrary,
  mergePlayniteLibrary,
  previewPlayniteImport
} from './import'
import { refreshLocalInstallStates } from './install-state'
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
}

export async function initLocalLibrary() {
  registerLocalLibraryIpc()
  ensureDefaultStatuses()
  backfillMissingGameStatuses()
  await refreshLocalInstallStates()
  void refreshMissingLocalCovers()
}
