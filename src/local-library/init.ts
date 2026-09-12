import { addHandler } from 'backend/ipc'
import { importPlayniteLibrary, previewPlayniteImport } from './import'
import { refreshLocalInstallStates } from './install-state'
import { getLocalGameMeta, getLocalSessions } from './stores'

let registered = false

export function registerLocalLibraryIpc() {
  if (registered) return
  registered = true

  addHandler('previewPlayniteImport', (_e, args) => previewPlayniteImport(args))
  addHandler('importPlayniteLibrary', (_e, args) => importPlayniteLibrary(args))
  addHandler('getLocalGameSessions', (_e, appName) => getLocalSessions(appName))
  addHandler('getLocalGameMeta', (_e, appName) => getLocalGameMeta(appName))
}

export async function initLocalLibrary() {
  registerLocalLibraryIpc()
  await refreshLocalInstallStates()
}
