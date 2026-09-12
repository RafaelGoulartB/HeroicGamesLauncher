import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CollectionBackupInterval,
  CollectionSettings
} from 'common/types/local-library'
import { PathSelectionBox, SelectField } from 'frontend/components/UI'
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
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    const next = await window.api.localLibrary.getSettings()
    setSettings(next)
    setFolder(next.backup.folder)
    setInterval(next.backup.interval)
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
          {message && <p className="CollectionSettingsDialog__ok">{message}</p>}
          {(error || (!message && settings?.backup.lastError)) && (
            <p className="CollectionSettingsDialog__error">
              {error || settings?.backup.lastError}
            </p>
          )}
        </section>
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
