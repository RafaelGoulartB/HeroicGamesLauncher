import { makeHandlerInvoker } from '../ipc'

export const localLibrary = {
  previewImport: makeHandlerInvoker('previewPlayniteImport'),
  importLibrary: makeHandlerInvoker('importPlayniteLibrary'),
  mergeLibrary: makeHandlerInvoker('mergePlayniteLibrary'),
  previewMerge: makeHandlerInvoker('previewPlayniteMerge'),
  exportLibrary: makeHandlerInvoker('exportPlayniteLibrary'),
  getLastLibraryPath: makeHandlerInvoker('getLastPlayniteLibraryPath'),
  getSessions: makeHandlerInvoker('getLocalGameSessions'),
  getMeta: makeHandlerInvoker('getLocalGameMeta'),
  getAllMeta: makeHandlerInvoker('getAllLocalGameMeta'),
  getStatuses: makeHandlerInvoker('getCompletionStatuses'),
  setStatus: makeHandlerInvoker('setGameCompletionStatus'),
  upsertStatus: makeHandlerInvoker('upsertCompletionStatus'),
  deleteStatus: makeHandlerInvoker('deleteCompletionStatus'),
  reorderStatuses: makeHandlerInvoker('reorderCompletionStatuses'),
  openSteamUri: makeHandlerInvoker('openSteamClientUri'),
  cacheSteamHero: makeHandlerInvoker('cacheSteamHero'),
  getAllCollectionArt: makeHandlerInvoker('getAllCollectionArt'),
  setGameArt: makeHandlerInvoker('setCollectionGameArt'),
  clearGameArt: makeHandlerInvoker('clearCollectionGameArt'),
  getSettings: makeHandlerInvoker('getCollectionSettings'),
  setBackupSettings: makeHandlerInvoker('setCollectionBackupSettings'),
  runBackup: makeHandlerInvoker('runCollectionBackup'),
  setLudusaviSettings: makeHandlerInvoker('setLudusaviSettings'),
  runLudusaviBackup: makeHandlerInvoker('runLudusaviBackup')
}
