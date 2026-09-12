import Store from 'electron-store'
import type {
  CollectionBackupInterval,
  CollectionBackupSettings,
  CollectionSettings,
  LudusaviBackupFormat,
  LudusaviCompression,
  LudusaviSettings
} from 'common/types/local-library'

type SettingsFile = {
  backup: CollectionBackupSettings
  ludusavi: LudusaviSettings
}

const settingsFile = new Store<SettingsFile>({
  cwd: 'local_library',
  name: 'settings',
  defaults: {
    backup: {
      folder: '',
      interval: 'weekly'
    },
    ludusavi: {
      enabled: false,
      useInstalledConfig: true,
      binaryPath: '',
      backupPath: '',
      format: 'zip',
      compression: 'deflate'
    }
  }
})

function fallbackBackup(): CollectionBackupSettings {
  return {
    folder: '',
    interval: 'weekly'
  }
}

function fallbackLudusavi(): LudusaviSettings {
  return {
    enabled: false,
    useInstalledConfig: true,
    binaryPath: '',
    backupPath: '',
    format: 'zip',
    compression: 'deflate'
  }
}

function asFormat(value?: string): LudusaviBackupFormat {
  return value === 'simple' ? 'simple' : 'zip'
}

function asCompression(value?: string): LudusaviCompression {
  return value === 'none' || value === 'bzip2' || value === 'zstd'
    ? value
    : 'deflate'
}

export function getCollectionSettings(): CollectionSettings {
  const backup = settingsFile.get('backup') ?? fallbackBackup()
  const ludusavi = settingsFile.get('ludusavi') ?? fallbackLudusavi()
  const interval: CollectionBackupInterval =
    backup.interval === 'daily' ||
    backup.interval === 'weekly' ||
    backup.interval === 'monthly'
      ? backup.interval
      : 'weekly'
  return {
    backup: {
      folder: backup.folder ?? '',
      interval,
      lastBackupAt: backup.lastBackupAt,
      lastBackupPath: backup.lastBackupPath,
      lastError: backup.lastError
    },
    ludusavi: {
      enabled: Boolean(ludusavi.enabled),
      useInstalledConfig: ludusavi.useInstalledConfig !== false,
      binaryPath: ludusavi.binaryPath ?? '',
      backupPath: ludusavi.backupPath ?? '',
      format: asFormat(ludusavi.format),
      compression: asCompression(ludusavi.compression),
      lastBackupAt: ludusavi.lastBackupAt,
      lastBackupGame: ludusavi.lastBackupGame,
      lastBackupPath: ludusavi.lastBackupPath,
      lastError: ludusavi.lastError
    }
  }
}

export function setCollectionBackupSettings(args: {
  folder: string
  interval: CollectionBackupInterval
}): CollectionSettings {
  const current = getCollectionSettings()
  settingsFile.set('backup', {
    ...current.backup,
    folder: args.folder.trim(),
    interval: args.interval
  })
  return getCollectionSettings()
}

export function setLudusaviSettings(
  args: Partial<
    Pick<
      LudusaviSettings,
      | 'enabled'
      | 'useInstalledConfig'
      | 'binaryPath'
      | 'backupPath'
      | 'format'
      | 'compression'
    >
  >
): CollectionSettings {
  const current = getCollectionSettings()
  settingsFile.set('ludusavi', {
    ...current.ludusavi,
    ...args,
    binaryPath: args.binaryPath?.trim() ?? current.ludusavi.binaryPath,
    backupPath: args.backupPath?.trim() ?? current.ludusavi.backupPath
  })
  return getCollectionSettings()
}

export function recordCollectionBackup(args: {
  at: string
  path?: string
  error?: string
}): CollectionSettings {
  const current = getCollectionSettings()
  settingsFile.set('backup', {
    ...current.backup,
    lastBackupAt: args.error ? current.backup.lastBackupAt : args.at,
    lastBackupPath: args.error ? current.backup.lastBackupPath : args.path,
    lastError: args.error
  })
  return getCollectionSettings()
}

export function recordLudusaviBackup(args: {
  at?: string
  game?: string
  path?: string
  error?: string
}): CollectionSettings {
  const current = getCollectionSettings()
  settingsFile.set('ludusavi', {
    ...current.ludusavi,
    lastBackupAt: args.error ? current.ludusavi.lastBackupAt : args.at,
    lastBackupGame: args.error ? current.ludusavi.lastBackupGame : args.game,
    lastBackupPath: args.error ? current.ludusavi.lastBackupPath : args.path,
    lastError: args.error
  })
  return getCollectionSettings()
}
