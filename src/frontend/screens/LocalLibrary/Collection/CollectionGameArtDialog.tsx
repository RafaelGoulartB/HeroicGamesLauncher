import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameInfo, Runner } from 'common/types'
import type {
  CollectionArtKind,
  CollectionGameArt
} from 'common/types/local-library'
import { CachedImage } from 'frontend/components/UI'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader
} from 'frontend/components/UI/Dialog'
import './CollectionGameArtDialog.css'

type Props = {
  game: GameInfo
  title: string
  art?: CollectionGameArt
  defaultCover: string
  defaultHero?: string
  onChange: (art: CollectionGameArt) => void
  onClose: () => void
}

const IMAGE_FILTERS = [
  {
    name: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
  },
  { name: 'All', extensions: ['*'] }
]

export default function CollectionGameArtDialog({
  game,
  title,
  art,
  defaultCover,
  defaultHero,
  onChange,
  onClose
}: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<CollectionArtKind | 'clear' | null>(null)
  const [error, setError] = useState('')

  const coverSrc = art?.coverUrl || defaultCover
  const heroSrc = art?.heroUrl || defaultHero
  const runner: Runner = game.runner

  async function pick(kind: CollectionArtKind) {
    const path = await window.api.openDialog({
      buttonLabel: t('box.select.button', 'Select'),
      properties: ['openFile'],
      title: t('box.select.image', 'Select Image'),
      filters: IMAGE_FILTERS
    })
    if (!path) return
    setBusy(kind)
    setError('')
    try {
      const next = await window.api.localLibrary.setGameArt({
        appName: game.app_name,
        runner,
        kind,
        sourcePath: path
      })
      onChange(next)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  async function reset(kind: CollectionArtKind) {
    setBusy(kind)
    setError('')
    try {
      const next = await window.api.localLibrary.clearGameArt({
        appName: game.app_name,
        runner,
        kind
      })
      onChange(next)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      onClose={onClose}
      showCloseButton
      className="CollectionGameArtDialog"
    >
      <DialogHeader>
        {t('collection.gameArt.title', 'Game images')}
      </DialogHeader>
      <DialogContent className="CollectionGameArtDialog__content">
        <p className="CollectionGameArtDialog__help">
          {t(
            'collection.gameArt.help',
            'These images are used in Collection. Steam art stays cached; a custom file replaces it until you reset.'
          )}
        </p>
        <p className="CollectionGameArtDialog__game">{title}</p>

        <section className="CollectionGameArtDialog__slot">
          <div className="CollectionGameArtDialog__copy">
            <h4>{t('collection.gameArt.cover', 'Cover')}</h4>
            <p>
              {art?.coverUrl
                ? t('collection.gameArt.custom', 'Custom image')
                : t('collection.gameArt.default', 'Default')}
            </p>
            <div className="CollectionGameArtDialog__actions">
              <button
                type="button"
                className="button outline"
                disabled={Boolean(busy)}
                onClick={() => void pick('cover')}
              >
                {busy === 'cover'
                  ? t('collection.gameArt.saving', 'Saving…')
                  : t('collection.gameArt.change', 'Change')}
              </button>
              <button
                type="button"
                className="button outline"
                disabled={Boolean(busy) || !art?.coverUrl}
                onClick={() => void reset('cover')}
              >
                {t('collection.gameArt.reset', 'Reset')}
              </button>
            </div>
          </div>
          <div className="CollectionGameArtDialog__preview CollectionGameArtDialog__preview--cover">
            {coverSrc ? (
              <CachedImage src={coverSrc} alt="" />
            ) : (
              <span>{t('collection.gameArt.empty', 'No image')}</span>
            )}
          </div>
        </section>

        <section className="CollectionGameArtDialog__slot CollectionGameArtDialog__slot--hero">
          <div className="CollectionGameArtDialog__copy">
            <h4>{t('collection.gameArt.hero', 'Background')}</h4>
            <p>
              {art?.heroUrl
                ? t('collection.gameArt.custom', 'Custom image')
                : t('collection.gameArt.default', 'Default')}
            </p>
            <div className="CollectionGameArtDialog__actions">
              <button
                type="button"
                className="button outline"
                disabled={Boolean(busy)}
                onClick={() => void pick('hero')}
              >
                {busy === 'hero'
                  ? t('collection.gameArt.saving', 'Saving…')
                  : t('collection.gameArt.change', 'Change')}
              </button>
              <button
                type="button"
                className="button outline"
                disabled={Boolean(busy) || !art?.heroUrl}
                onClick={() => void reset('hero')}
              >
                {t('collection.gameArt.reset', 'Reset')}
              </button>
            </div>
          </div>
          <div className="CollectionGameArtDialog__preview CollectionGameArtDialog__preview--hero">
            {heroSrc ? (
              <CachedImage src={heroSrc} alt="" />
            ) : (
              <span>{t('collection.gameArt.empty', 'No image')}</span>
            )}
          </div>
        </section>

        {error && <p className="CollectionGameArtDialog__error">{error}</p>}
      </DialogContent>
      <DialogFooter>
        <button className="button is-primary" onClick={onClose}>
          {t('box.close', 'Close')}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
