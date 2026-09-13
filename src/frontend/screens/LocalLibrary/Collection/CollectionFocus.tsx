import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Close,
  Download,
  OpenInNew,
  PlayArrow,
  Stop
} from '@mui/icons-material'
import type {
  ExtraInfo,
  GameAchievement,
  GameInfo,
  WikiInfo
} from 'common/types'
import type {
  CompletionStatus,
  LocalGameMeta,
  LocalGameSource
} from 'common/types/local-library'
import { CachedImage } from 'frontend/components/UI'
import ContextProvider from 'frontend/state/ContextProvider'
import { timestampStore } from 'frontend/helpers/electronStores'
import { getGameInfo, install, launch, sendKill } from 'frontend/helpers'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'
import { hasProgress } from 'frontend/hooks/hasProgress'
import { hasStatus } from 'frontend/hooks/hasStatus'
import {
  getCardStatus,
  getImageFormatting
} from 'frontend/screens/Library/components/GameCard/constants'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import { formatPlaytimeMinutes } from './playtime'
import { STATUS_COLORS } from './statusColors'
import { openSteamStoreUri, steamAppIdFromMeta } from './steamActions'
import './CollectionFocus.css'

const SOURCE_LABELS: Record<LocalGameSource, string> = {
  steam: 'Steam',
  epic: 'Epic',
  gog: 'GOG',
  amazon: 'Amazon',
  xbox: 'Xbox',
  emulator: 'Emulator',
  manual: 'Local',
  other: 'Other'
}

type Props = {
  game: GameInfo | null
  meta?: LocalGameMeta
  statuses: CompletionStatus[]
  onClose: () => void
}

function toPlainText(value?: string) {
  if (!value) return ''
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatHours(value?: number) {
  if (!value) return ''
  const hours = Math.floor(value)
  const mins = Math.round((value - hours) * 60)
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatTimestamp(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
}

function libraryLabel(
  meta: LocalGameMeta | undefined,
  runner: GameInfo['runner'],
  fallback: string
) {
  if (meta?.source) return SOURCE_LABELS[meta.source]
  if (runner === 'legendary') return 'Epic'
  if (runner === 'gog') return 'GOG'
  if (runner === 'nile') return 'Amazon'
  return fallback
}

export default function CollectionFocus({
  game,
  meta,
  statuses,
  onClose
}: Props) {
  if (!game) {
    return <aside className="collectionFocus" aria-hidden />
  }

  return (
    <CollectionFocusPanel
      game={game}
      meta={meta}
      statuses={statuses}
      onClose={onClose}
    />
  )
}

function CollectionFocusPanel({
  game,
  meta,
  statuses,
  onClose
}: {
  game: GameInfo
  meta?: LocalGameMeta
  statuses: CompletionStatus[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { t: tGame } = useTranslation('gamepage')
  const navigate = useNavigate()
  const { showDialogModal, connectivity, gameUpdates } =
    useContext(ContextProvider)

  const [gameInfo, setGameInfo] = useState<GameInfo>(game)
  const [extraInfo, setExtraInfo] = useState<ExtraInfo | null>(
    game.extra ?? null
  )
  const [wikiInfo, setWikiInfo] = useState<WikiInfo | null>(null)
  const [achievements, setAchievements] = useState<GameAchievement[]>([])
  const [playedMinutes, setPlayedMinutes] = useState(
    () => timestampStore.get_nodefault(game.app_name)?.totalPlayed ?? 0
  )

  const { app_name: appName, runner, overrides } = game
  const title = overrides?.title || game.title
  const steamAppId = steamAppIdFromMeta(meta)

  useEffect(() => {
    setGameInfo(game)
    setExtraInfo(game.extra ?? null)
    setWikiInfo(null)
    setAchievements([])
    setPlayedMinutes(timestampStore.get_nodefault(appName)?.totalPlayed ?? 0)

    let cancelled = false
    const load = async () => {
      const [fresh, extra, wiki, nextAchievements] = await Promise.allSettled([
        getGameInfo(appName, runner),
        window.api.getExtraInfo(appName, runner),
        window.api.getWikiGameInfo(title, appName, runner),
        window.api.getAchievements(appName, runner)
      ])
      if (cancelled) return
      if (fresh.status === 'fulfilled' && fresh.value) {
        setGameInfo(fresh.value)
      }
      if (extra.status === 'fulfilled') setExtraInfo(extra.value)
      if (wiki.status === 'fulfilled') setWikiInfo(wiki.value)
      if (nextAchievements.status === 'fulfilled') {
        setAchievements(nextAchievements.value ?? [])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [appName, runner, title, game])

  const { status, folder } = hasStatus(gameInfo)
  const [progress, previousProgress] = hasProgress(appName, runner)
  const isInstalled = Boolean(gameInfo.is_installed)
  const { isInstalling, isPlaying, isUpdating, isQueued, isLaunching } =
    getCardStatus(status, isInstalled, 'grid')
  const isTrackingTime = isPlaying || isLaunching
  const hasUpdate = Boolean(isInstalled && gameUpdates?.includes(appName))

  useEffect(() => {
    setPlayedMinutes(timestampStore.get_nodefault(appName)?.totalPlayed ?? 0)
  }, [status, appName, isTrackingTime])

  const completion =
    statuses.find((item) => item.id === (meta?.completionStatusId ?? '')) ??
    statuses.find((item) => item.slug === 'not-played')

  const cover = getImageFormatting(
    gameInfo.overrides?.art_square ||
      gameInfo.art_square ||
      gameInfo.art_cover ||
      fallBackImage,
    runner
  )
  const description = toPlainText(
    extraInfo?.about?.shortDescription ||
      extraInfo?.about?.description ||
      gameInfo.description
  )
  const genres = (
    extraInfo?.genres ||
    gameInfo.extra?.genres ||
    wikiInfo?.pcgamingwiki?.genres ||
    []
  ).filter(Boolean)
  const releaseDate =
    extraInfo?.releaseDate ||
    wikiInfo?.pcgamingwiki?.releaseDate?.[0]?.replace(/^[^:]+:\s*/, '')
  const platform = gameInfo.install?.platform || 'PC'
  const sourceLabel = libraryLabel(
    meta,
    runner,
    t('collection.focus.local', 'Local')
  )
  const installPath =
    meta?.remappedExecutable ||
    meta?.windowsInstallDirectory ||
    gameInfo.install?.install_path ||
    gameInfo.folder_name
  const lastPlayed = formatTimestamp(
    timestampStore.get_nodefault(appName)?.lastPlayed
  )
  const howLong = wikiInfo?.howlongtobeat
  const unlockedCount = achievements.filter((item) => item.date_unlocked).length
  const sortedAchievements = useMemo(() => {
    const unlocked = achievements.filter((item) => item.date_unlocked)
    const locked = achievements.filter((item) => !item.date_unlocked)
    return [...unlocked, ...locked].slice(0, 8)
  }, [achievements])

  async function openSteamFromCollection() {
    if (!steamAppId) return
    const result = await openSteamStoreUri('install', steamAppId)
    if (result.ok) return
    showDialogModal({
      showDialog: true,
      type: 'ERROR',
      title: t('collection.steam.clientMissingTitle', 'Steam not found'),
      message: t(
        'collection.steam.clientMissing',
        'Steam was not found. Install or launch the Steam client, then try again.'
      )
    })
  }

  function handleInstall() {
    if (steamAppId) {
      void openSteamFromCollection()
      return
    }
    openInstallGameModal({ appName, runner, gameInfo })
  }

  async function handlePlay() {
    if (!isInstalled && !isQueued && gameInfo.runner !== 'sideload') {
      return install({
        gameInfo,
        installPath: folder || 'default',
        isInstalling,
        previousProgress,
        progress,
        t: tGame,
        showDialogModal
      })
    }
    if (isPlaying || isUpdating) {
      return sendKill(appName, runner)
    }
    if (isQueued) {
      return window.api.removeFromDMQueue(appName)
    }
    if (isInstalled) {
      const isOffline = connectivity.status !== 'online'
      await launch({
        appName,
        t: tGame,
        runner,
        hasUpdate,
        showDialogModal,
        notPlayableOffline: isOffline && !gameInfo.canRunOffline
      })
    }
  }

  function handlePrimary() {
    if (!isInstalled) {
      handleInstall()
      return
    }
    void handlePlay()
  }

  const primaryLabel = isPlaying
    ? tGame('label.playing.stop')
    : isLaunching
      ? tGame('label.launching', 'Launching')
      : isInstalled
        ? tGame('label.playing.start')
        : tGame('button.install')

  return (
    <aside className="collectionFocus">
      <div className="collectionFocus__tools">
        <button
          type="button"
          className="collectionFocus__iconBtn"
          title={tGame('button.details', 'Details')}
          onClick={() =>
            navigate(`/gamepage/${runner}/${appName}`, {
              state: { gameInfo, fromCollection: true }
            })
          }
        >
          <OpenInNew />
        </button>
        <button
          type="button"
          className="collectionFocus__iconBtn"
          title={t('box.close', 'Close')}
          onClick={onClose}
        >
          <Close />
        </button>
      </div>
      <div className="collectionFocus__inner">
        <header className="collectionFocus__header">
          <div className="collectionFocus__heading">
            <h2>{title}</h2>
            <p className="collectionFocus__meta">
              {[formatTimestamp(releaseDate), platform, ...genres.slice(0, 4)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <CachedImage src={cover} className="collectionFocus__cover" alt="" />
        </header>

        <div className="collectionFocus__body">
          <section className="collectionFocus__overview">
            <h3>{t('collection.focus.overview', 'Overview')}</h3>
            <p>
              {description ||
                tGame('generic.noDescription', 'No description available')}
            </p>
          </section>

          <div className="collectionFocus__aside">
            {achievements.length > 0 && (
              <section className="collectionFocus__panel">
                <h3>
                  {tGame('game.achievements', 'Achievements')}
                  <span>
                    {unlockedCount}/{achievements.length}
                  </span>
                </h3>
                <ul className="collectionFocus__achievements">
                  {sortedAchievements.map((item) => (
                    <li
                      key={item.achievement_id}
                      className={item.date_unlocked ? 'is-unlocked' : undefined}
                    >
                      <img
                        src={
                          item.date_unlocked
                            ? item.image_url_unlocked
                            : item.image_url_locked
                        }
                        alt=""
                      />
                      <span>{item.visible ? item.name : '???'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {howLong && (howLong.mainStory || howLong.mainExtra) && (
              <section className="collectionFocus__panel">
                <h3>{tGame('howLongToBeat', 'How Long To Beat')}</h3>
                <dl className="collectionFocus__hltb">
                  <div>
                    <dt>
                      {tGame('how-long-to-beat.main-story', 'Main Story')}
                    </dt>
                    <dd>{formatHours(howLong.mainStory)}</dd>
                  </div>
                  <div>
                    <dt>
                      {tGame(
                        'how-long-to-beat.main-plus-extras',
                        'Main + Extras'
                      )}
                    </dt>
                    <dd>{formatHours(howLong.mainExtra)}</dd>
                  </div>
                  <div>
                    <dt>
                      {tGame('how-long-to-beat.completionist', 'Completionist')}
                    </dt>
                    <dd>{formatHours(howLong.completionist)}</dd>
                  </div>
                </dl>
              </section>
            )}

            <section className="collectionFocus__panel">
              <h3>{t('collection.focus.details', 'Details')}</h3>
              <dl className="collectionFocus__facts">
                {completion && (
                  <div>
                    <dt>{t('collection.status.menu', 'Status')}</dt>
                    <dd>
                      <span
                        className="collectionFocus__dot"
                        style={{ background: STATUS_COLORS[completion.slug] }}
                      />
                      {completion.name}
                    </dd>
                  </div>
                )}
                {gameInfo.developer && (
                  <div>
                    <dt>{tGame('info.developer', 'Developer')}</dt>
                    <dd>{gameInfo.developer}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('collection.focus.library', 'Library')}</dt>
                  <dd>{sourceLabel}</dd>
                </div>
                <div>
                  <dt>{tGame('game.lastPlayed', 'Last Played')}</dt>
                  <dd>{lastPlayed || tGame('game.neverPlayed', 'Never')}</dd>
                </div>
                <div>
                  <dt>{t('collection.sort.playtime', 'Playtime')}</dt>
                  <dd>{formatPlaytimeMinutes(playedMinutes)}</dd>
                </div>
                {installPath && (
                  <div>
                    <dt>{tGame('info.path', 'Install Path')}</dt>
                    <dd title={installPath}>{installPath}</dd>
                  </div>
                )}
                {meta?.notes && (
                  <div>
                    <dt>{t('collection.focus.notes', 'Notes')}</dt>
                    <dd>{meta.notes}</dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        </div>
      </div>
      <footer className="collectionFocus__footer">
        <button
          type="button"
          className="collectionFocus__play"
          disabled={isLaunching}
          onClick={handlePrimary}
        >
          {isPlaying ? <Stop /> : isInstalled ? <PlayArrow /> : <Download />}
          {primaryLabel}
        </button>
      </footer>
    </aside>
  )
}
