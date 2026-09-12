import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ImportPlayniteDialog from 'frontend/screens/LocalLibrary/ImportPlayniteDialog'

function ImportPlayniteButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="sideloadGameButton"
        onClick={() => setOpen(true)}
        data-tour="library-import-playnite"
      >
        {t('localLibrary.import.button', 'Import Playnite')}
      </button>
      {open && <ImportPlayniteDialog onClose={() => setOpen(false)} />}
    </>
  )
}

export default ImportPlayniteButton
