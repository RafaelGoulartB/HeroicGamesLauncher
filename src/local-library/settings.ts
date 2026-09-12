import Store from 'electron-store'
import type {
  CollectionBackupInterval,
  CollectionBackupSettings,
  CollectionSettings
} from 'common/types/local-library'

type SettingsFile = CollectionSettings

const settingsFile = new Store<SettingsFile>({
  cwd: 'local_library',
  name: 'settings',
  defaults: {
    backup: {
      folder: '',
      interval: 'weekly'
    }
  }
})

function fallbackBackup(): CollectionBackupSettings {
  return {
    folder: '',
    interval: 'weekly'
  }
}

export function getCollectionSettings(): CollectionSettings {
  const backup = settingsFile.get('backup') ?? fallbackBackup()
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
