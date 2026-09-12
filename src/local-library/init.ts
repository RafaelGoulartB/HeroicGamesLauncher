import { existsSync } from 'graceful-fs'
import { homedir } from 'os'
import { join } from 'path'
import { addHandler } from 'backend/ipc'
import { refreshMissingLocalCovers } from './covers'
import {
  importPlayniteLibrary,
  previewPlayniteImport,
  syncPlayniteCompletionStatuses
} from './import'
import { refreshLocalInstallStates } from './install-state'
import {
  backfillMissingGameStatuses,
  ensureDefaultStatuses,
  getCompletionStatuses,
  getLastPlayniteLibraryPath,
  setGameCompletionStatus,
  upsertCompletionStatus
} from './status'
import {
  getAllLocalGameMeta,
  getLocalGameMeta,
  getLocalSessions
} from './stores'

function findPlayniteLibrary(): string | undefined {
  const candidates = [
    getLastPlayniteLibraryPath(),
    join(process.cwd(), '..', 'playnite-database'),
    join(
      homedir(),
      'Documents/Projects/Personal/game-launcher/playnite-database'
    )
  ]
  return candidates.find(
    (path) => path && existsSync(join(path, 'games.db'))
  )
}

let registered = false

export function registerLocalLibraryIpc() {
  if (registered) return
  registered = true

  addHandler('previewPlayniteImport', (_e, args) => previewPlayniteImport(args))
  addHandler('importPlayniteLibrary', (_e, args) => importPlayniteLibrary(args))
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
}

export async function initLocalLibrary() {
  registerLocalLibraryIpc()
  ensureDefaultStatuses()
  const playniteLibrary = findPlayniteLibrary()
  if (playniteLibrary) {
    syncPlayniteCompletionStatuses(playniteLibrary)
  }
  backfillMissingGameStatuses()
  await refreshLocalInstallStates()
  void refreshMissingLocalCovers()
}
