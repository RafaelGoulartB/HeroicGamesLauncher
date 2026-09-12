import { useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dropdown from 'frontend/components/UI/Dropdown'
import ContextProvider from 'frontend/state/ContextProvider'
import ImportPlayniteDialog from 'frontend/screens/LocalLibrary/ImportPlayniteDialog'
import './PlayniteMenu.css'

type Props = {
  onLibraryChanged: () => void
}

export default function PlayniteMenu({ onLibraryChanged }: Props) {
  const { t } = useTranslation()
  const { showDialogModal, refreshLibrary } = useContext(ContextProvider)
  const [importOpen, setImportOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const [lastPath, setLastPath] = useState<string | undefined>()

  useEffect(() => {
    void window.api.localLibrary.getLastLibraryPath().then(setLastPath)
  }, [importOpen])

  async function handleMerge() {
    setMerging(true)
    try {
      const result = await window.api.localLibrary.mergeLibrary()
      await refreshLibrary({
        library: 'sideload',
        runInBackground: false
      })
      onLibraryChanged()
      const failed =
        result.errors.length > 0 && result.imported + result.updated === 0
      const errorText = result.errors.length
        ? `\n${result.errors.slice(0, 4).join('\n')}`
        : ''
      showDialogModal({
        showDialog: true,
        type: failed ? 'ERROR' : 'MESSAGE',
        title: t('collection.playnite.mergeTitle', 'Playnite merge'),
        message: failed
          ? result.errors.join('\n')
          : t(
              'collection.playnite.mergeDone',
              'Merged without overwriting your Heroic status. New games {{imported}}, updated {{updated}}, sessions {{sessions}}, skipped {{skipped}}.{{errors}}',
              {
                imported: result.imported,
                updated: result.updated,
                sessions: result.sessionsImported,
                skipped: result.skipped,
                errors: errorText
              }
            )
      })
    } catch (error) {
      showDialogModal({
        showDialog: true,
        type: 'ERROR',
        title: t('collection.playnite.mergeTitle', 'Playnite merge'),
        message: String(error)
      })
    } finally {
      setMerging(false)
    }
  }

  return (
    <>
      <Dropdown
        title={t('collection.playnite.menu', 'Playnite')}
        className="collectionPlayniteMenu"
        buttonClass="selectStyle"
        popUpOnHover
      >
        <button
          type="button"
          className="collectionPlayniteMenu__item"
          onClick={() => setImportOpen(true)}
        >
          {t('collection.playnite.import', 'Import library…')}
        </button>
        <button
          type="button"
          className="collectionPlayniteMenu__item"
          disabled={merging || !lastPath}
          title={
            lastPath ||
            t(
              'collection.playnite.needImport',
              'Import a library first to enable merge'
            )
          }
          onClick={() => void handleMerge()}
        >
          {merging
            ? t('collection.playnite.merging', 'Merging…')
            : t('collection.playnite.merge', 'Merge from Playnite')}
        </button>
      </Dropdown>
      {importOpen && (
        <ImportPlayniteDialog
          onClose={() => {
            setImportOpen(false)
            onLibraryChanged()
          }}
        />
      )}
    </>
  )
}
