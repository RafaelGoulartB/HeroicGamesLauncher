import { makeHandlerInvoker } from '../ipc'

export const localLibrary = {
  previewImport: makeHandlerInvoker('previewPlayniteImport'),
  importLibrary: makeHandlerInvoker('importPlayniteLibrary'),
  getSessions: makeHandlerInvoker('getLocalGameSessions'),
  getMeta: makeHandlerInvoker('getLocalGameMeta')
}
