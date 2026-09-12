import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CollectionBackupInterval,
  CollectionSettings,
  LudusaviBackupFormat,
  LudusaviCompression
} from 'common/types/local-library'
import {
  PathSelectionBox,
  SelectField,
  ToggleSwitch
} from 'frontend/components/UI'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader
} from 'frontend/components/UI/Dialog'
import { MenuItem } from '@mui/material'
import './CollectionSettingsDialog.css'

type Props = {
  onClose: () => void
}

function formatBackupTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export default function CollectionSettingsDialog({ onClose }: Props) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<CollectionSettings | null>(null)
  const [folder, setFolder] = useState('')
  const [interval, setInterval] = useState<CollectionBackupInterval>('weekly')
  const [ludusaviEnabled, setLudusaviEnabled] = useState(false)
  const [useInstalledConfig, setUseInstalledConfig] = useState(true)
  const [ludusaviBinary, setLudusaviBinary] = useState('')
  const [ludusaviFolder, setLudusaviFolder] = useState('')
  const [ludusaviFormat, setLudusaviFormat] =
    useState<LudusaviBackupFormat>('zip')
  const [ludusaviCompression, setLudusaviCompression] =
    useState<LudusaviCompression>('deflate')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    const next = await window.api.localLibrary.getSettings()
    setSettings(next)
    setFolder(next.backup.folder)
    setInterval(next.backup.interval)
    setLudusaviEnabled(next.ludusavi.enabled)
    setUseInstalledConfig(next.ludusavi.useInstalledConfig)
    setLudusaviBinary(next.ludusavi.binaryPath)
    setLudusaviFolder(next.ludusavi.backupPath)
    setLudusaviFormat(next.ludusavi.format)
    setLudusaviCompression(next.ludusavi.compression)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function persist(nextFolder = folder, nextInterval = interval) {
    setSaving(true)
    setError('')
    try {
      const next = await window.api.localLibrary.setBackupSettings({
        folder: nextFolder,
        interval: nextInterval
      })
      setSettings(next)
      setFolder(next.backup.folder)
      setInterval(next.backup.interval)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function persistLudusavi(
    patch: Parameters<typeof window.api.localLibrary.setLudusaviSettings>[0]
  ) {
    setSaving(true)
    setError('')
    try {
      const next = await window.api.localLibrary.setLudusaviSettings(patch)
      setSettings(next)
      setLudusaviEnabled(next.ludusavi.enabled)
      setUseInstalledConfig(next.ludusavi.useInstalledConfig)
      setLudusaviBinary(next.ludusavi.binaryPath)
      setLudusaviFolder(next.ludusavi.backupPath)
      setLudusaviFormat(next.ludusavi.format)
      setLudusaviCompression(next.ludusavi.compression)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleBackupNow() {
    setRunning(true)
    setError('')
    setMessage('')
    try {
      if (
        folder !== settings?.backup.folder ||
        interval !== settings.backup.interval
      ) {
        await persist()
      }
      const result = await window.api.localLibrary.runBackup(true)
      await reload()
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.ran && result.path) {
        setMessage(
          t('collection.settings.backupDone', 'Backup saved to {{path}}', {
            path: result.path
          })
        )
        return
      }
      setMessage(
        t('collection.settings.backupSkipped', 'Backup is already up to date.')
      )
    } catch (err) {
      setError(String(err))
    } finally {
      setRunning(false)
    }
  }

  const lastBackup = settings?.backup.lastBackupAt
    ? formatBackupTime(settings.backup.lastBackupAt)
    : t('collection.settings.backupNever', 'Never')
  const lastSaveBackup = settings?.ludusavi.lastBackupAt
    ? formatBackupTime(settings.ludusavi.lastBackupAt)
    : t('collection.settings.backupNever', 'Never')
  const detected = settings?.ludusaviDetected
  const overridesLocked = useInstalledConfig && Boolean(detected?.configPath)

  return (
    <Dialog
      onClose={onClose}
      showCloseButton
      className="CollectionSettingsDialog"
    >
      <DialogHeader>
        {t('collection.settings.title', 'Collection settings')}
      </DialogHeader>
      <DialogContent className="CollectionSettingsDialog__content">
        <section className="CollectionSettingsDialog__section">
          <h4>{t('collection.settings.backup', 'Backup')}</h4>
          <p>
            {t(
              'collection.settings.backupHelp',
              'Copies Heroic config (Collection, playtime, statuses, Local games, logins) into the folder below. Installed games are not included. Cache and Wine tools are skipped. A dated folder is created when Heroic Local opens, if the schedule is due.'
            )}
          </p>
          <PathSelectionBox
            htmlId="collection-backup-folder"
            type="directory"
            path={folder}
            onPathChange={(next) => {
              setFolder(next)
              void persist(next, interval)
            }}
            label={t('collection.settings.backupFolder', 'Backup folder')}
            pathDialogTitle={t(
              'collection.settings.backupFolder',
              'Backup folder'
            )}
          />
          <SelectField
            htmlId="collection-backup-interval"
            label={t('collection.settings.backupInterval', 'How often')}
            value={interval}
            disabled={saving || running}
            onChange={(event) => {
              const next = event.target.value as CollectionBackupInterval
              setInterval(next)
              void persist(folder, next)
            }}
          >
            <MenuItem value="daily">
              {t('collection.settings.backupDaily', 'Once a day')}
            </MenuItem>
            <MenuItem value="weekly">
              {t('collection.settings.backupWeekly', 'Once a week')}
            </MenuItem>
            <MenuItem value="monthly">
              {t('collection.settings.backupMonthly', 'Once a month')}
            </MenuItem>
          </SelectField>
          <p className="CollectionSettingsDialog__meta">
            {t('collection.settings.lastBackup', 'Last backup')}: {lastBackup}
            {settings?.backup.lastBackupPath
              ? ` · ${settings.backup.lastBackupPath}`
              : ''}
          </p>
        </section>

        <section className="CollectionSettingsDialog__section">
          <h4>{t('collection.settings.ludusavi', 'Ludusavi save backup')}</h4>
          <p>
            {t(
              'collection.settings.ludusaviHelp',
              'When enabled, Heroic Local backs up the game save with Ludusavi after you close a game. Right-click a Collection card to back up that game now.'
            )}
          </p>
          <ToggleSwitch
            htmlId="collection-ludusavi-enabled"
            value={ludusaviEnabled}
            disabled={saving}
            handleChange={() => {
              const next = !ludusaviEnabled
              setLudusaviEnabled(next)
              void persistLudusavi({ enabled: next })
            }}
            title={t(
              'collection.settings.ludusaviEnabled',
              'Back up saves when a game closes'
            )}
          />
          {detected ? (
            <p className="CollectionSettingsDialog__meta">
              {t(
                'collection.settings.ludusaviDetected',
                'Found Ludusavi {{version}} at {{binary}}. Backups go to {{path}} ({{format}}{{compression}}).',
                {
                  version: detected.version || '',
                  binary: detected.binary,
                  path:
                    detected.backupPath ||
                    t('collection.settings.unknown', 'unknown'),
                  format: detected.format || 'simple',
                  compression:
                    detected.format === 'zip' && detected.compression
                      ? ` / ${detected.compression}`
                      : ''
                }
              )}
            </p>
          ) : (
            <p className="CollectionSettingsDialog__meta">
              {t(
                'collection.settings.ludusaviMissing',
                'Ludusavi was not found automatically. Set the binary and backup folder below.'
              )}
            </p>
          )}
          <ToggleSwitch
            htmlId="collection-ludusavi-use-config"
            value={useInstalledConfig}
            disabled={saving || !detected?.configPath}
            handleChange={() => {
              const next = !useInstalledConfig
              setUseInstalledConfig(next)
              void persistLudusavi({ useInstalledConfig: next })
            }}
            title={t(
              'collection.settings.ludusaviUseConfig',
              'Use installed Ludusavi settings (path, zip, compression)'
            )}
          />
          <PathSelectionBox
            htmlId="collection-ludusavi-binary"
            type="file"
            path={ludusaviBinary}
            disabled={saving}
            onPathChange={(next) => {
              setLudusaviBinary(next)
              void persistLudusavi({ binaryPath: next })
            }}
            label={t('collection.settings.ludusaviBinary', 'Ludusavi binary')}
            pathDialogTitle={t(
              'collection.settings.ludusaviBinary',
              'Ludusavi binary'
            )}
            placeholder={detected?.binary}
          />
          <PathSelectionBox
            htmlId="collection-ludusavi-folder"
            type="directory"
            path={ludusaviFolder}
            disabled={saving || overridesLocked}
            onPathChange={(next) => {
              setLudusaviFolder(next)
              void persistLudusavi({ backupPath: next })
            }}
            label={t(
              'collection.settings.ludusaviFolder',
              'Save backup folder'
            )}
            pathDialogTitle={t(
              'collection.settings.ludusaviFolder',
              'Save backup folder'
            )}
            placeholder={detected?.backupPath}
          />
          <SelectField
            htmlId="collection-ludusavi-format"
            label={t('collection.settings.ludusaviFormat', 'Backup format')}
            value={ludusaviFormat}
            disabled={saving || overridesLocked}
            onChange={(event) => {
              const next = event.target.value as LudusaviBackupFormat
              setLudusaviFormat(next)
              void persistLudusavi({ format: next })
            }}
          >
            <MenuItem value="zip">
              {t('collection.settings.ludusaviZip', 'Zip')}
            </MenuItem>
            <MenuItem value="simple">
              {t('collection.settings.ludusaviSimple', 'Simple folder')}
            </MenuItem>
          </SelectField>
          <SelectField
            htmlId="collection-ludusavi-compression"
            label={t(
              'collection.settings.ludusaviCompression',
              'Zip compression'
            )}
            value={ludusaviCompression}
            disabled={saving || overridesLocked || ludusaviFormat !== 'zip'}
            onChange={(event) => {
              const next = event.target.value as LudusaviCompression
              setLudusaviCompression(next)
              void persistLudusavi({ compression: next })
            }}
          >
            <MenuItem value="none">
              {t('collection.settings.ludusaviNone', 'None')}
            </MenuItem>
            <MenuItem value="deflate">Deflate</MenuItem>
            <MenuItem value="bzip2">Bzip2</MenuItem>
            <MenuItem value="zstd">Zstd</MenuItem>
          </SelectField>
          <p className="CollectionSettingsDialog__meta">
            {t('collection.settings.lastSaveBackup', 'Last save backup')}:{' '}
            {lastSaveBackup}
            {settings?.ludusavi.lastBackupGame
              ? ` · ${settings.ludusavi.lastBackupGame}`
              : ''}
            {settings?.ludusavi.lastBackupPath
              ? ` · ${settings.ludusavi.lastBackupPath}`
              : ''}
          </p>
        </section>

        {message && <p className="CollectionSettingsDialog__ok">{message}</p>}
        {(error ||
          (!message &&
            (settings?.backup.lastError || settings?.ludusavi.lastError))) && (
          <p className="CollectionSettingsDialog__error">
            {error ||
              settings?.backup.lastError ||
              settings?.ludusavi.lastError}
          </p>
        )}
      </DialogContent>
      <DialogFooter>
        <button
          className="button is-primary"
          disabled={running || saving || !folder.trim()}
          onClick={() => void handleBackupNow()}
        >
          {running
            ? t('collection.settings.backupRunning', 'Backing up…')
            : t('collection.settings.backupNow', 'Backup now')}
        </button>
        <button className="button outline" onClick={onClose}>
          {t('box.close', 'Close')}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
