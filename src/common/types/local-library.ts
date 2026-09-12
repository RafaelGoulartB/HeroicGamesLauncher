export type LocalLaunchKind =
  | 'steam-uri'
  | 'executable'
  | 'emulator'
  | 'unavailable'

export type LocalGameSource =
  | 'steam'
  | 'epic'
  | 'gog'
  | 'amazon'
  | 'xbox'
  | 'emulator'
  | 'manual'
  | 'other'

export type LocalSessionSource = 'playnite' | 'heroic'

export interface LocalGameRom {
  name?: string
  path: string
}

export interface LocalGameMeta {
  appName: string
  runner: 'sideload' | 'legendary' | 'gog' | 'nile'
  playniteId: string
  pluginId?: string
  source: LocalGameSource
  launchKind: LocalLaunchKind
  steamAppId?: string
  storeGameId?: string
  title: string
  windowsInstallDirectory?: string
  windowsExecutable?: string
  remappedExecutable?: string
  launcherArgs?: string
  roms?: LocalGameRom[]
  emulatorName?: string
  notes?: string
}

export interface LocalGameSession {
  startedAt: string
  endedAt: string
  elapsedSeconds: number
  source: LocalSessionSource
  gameActionName?: string
}

export interface DriveRemap {
  windowsRoot: string
  linuxPath: string
}

export interface PlaynitePreviewArgs {
  libraryPath: string
}

export interface PlaynitePreviewGame {
  playniteId: string
  title: string
  source: LocalGameSource
  destination: 'sideload' | 'legendary' | 'gog' | 'nile' | 'skip'
  playtimeMinutes: number
  sessionCount: number
  alreadyImported: boolean
  matchedAppName?: string
}

export interface PlayniteImportPreview {
  libraryPath: string
  playniteRoot: string
  gameCount: number
  sessionFileCount: number
  detectedDrives: string[]
  games: PlaynitePreviewGame[]
  counts: {
    steam: number
    emulator: number
    manual: number
    xbox: number
    amazon: number
    other: number
    epicMatch: number
    gogMatch: number
    skippedStore: number
  }
  errors: string[]
}

export interface PlayniteImportArgs {
  libraryPath: string
  driveMap: DriveRemap[]
  fetchCovers?: boolean
}

export interface PlayniteImportResult {
  imported: number
  updated: number
  matchedStore: number
  skipped: number
  coversFetched: number
  sessionsImported: number
  errors: string[]
}
