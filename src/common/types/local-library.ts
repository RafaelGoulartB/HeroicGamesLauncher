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

export type CompletionStatusSlug =
  | 'playing'
  | 'plan-to-play'
  | 'on-hold'
  | 'played'
  | 'endless'
  | 'beaten'
  | 'completed'
  | 'abandoned'
  | 'not-played'
  | 'custom'

export interface CompletionStatus {
  id: string
  name: string
  slug: CompletionStatusSlug
  sortOrder: number
  playniteId?: string
  playniteIds?: string[]
}

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
  completionStatusId?: string
  playniteCompletionStatusId?: string
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
  mergeExisting?: boolean
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

export interface PlayniteMergePreviewItem {
  title: string
  playniteId: string
  heroicMinutes?: number
  playniteMinutes?: number
  heroicStatus?: string
  playniteStatus?: string
}

export interface PlayniteMergePreview {
  libraryPath: string
  newGames: PlayniteMergePreviewItem[]
  playtimeUpdates: PlayniteMergePreviewItem[]
  statusFromPlaynite: PlayniteMergePreviewItem[]
  statusConflicts: PlayniteMergePreviewItem[]
  newSessions: number
  unchanged: number
  skipped: number
  errors: string[]
}

export interface PlayniteExportGame {
  playniteId: string
  heroicAppName: string
  steamAppId?: string
  storeGameId?: string
  title: string
  source: LocalGameSource
  playtimeMinutes: number
  playtimeSeconds: number
  firstPlayed?: string
  lastPlayed?: string
  completionStatus: {
    id: string
    name: string
    slug: CompletionStatusSlug
    playniteId?: string
  }
  lastPlayniteCompletionStatusId?: string
  sessions: LocalGameSession[]
}

export interface PlayniteExportFile {
  format: 'heroic-playnite-export'
  version: 1
  exportedAt: string
  comment: string
  statuses: CompletionStatus[]
  games: PlayniteExportGame[]
}

export interface PlayniteExportResult {
  path: string
  gameCount: number
}

export type SteamClientUriAction = 'install' | 'uninstall'

export type SteamClientUriResult = { ok: true } | { ok: false; error: string }
