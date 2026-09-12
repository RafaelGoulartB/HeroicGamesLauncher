import { makeHandlerInvoker } from '../ipc'

export const localLibrary = {
  previewImport: makeHandlerInvoker('previewPlayniteImport'),
  importLibrary: makeHandlerInvoker('importPlayniteLibrary'),
  getSessions: makeHandlerInvoker('getLocalGameSessions'),
  getMeta: makeHandlerInvoker('getLocalGameMeta'),
  getAllMeta: makeHandlerInvoker('getAllLocalGameMeta'),
  getStatuses: makeHandlerInvoker('getCompletionStatuses'),
  setStatus: makeHandlerInvoker('setGameCompletionStatus'),
  upsertStatus: makeHandlerInvoker('upsertCompletionStatus')
}
