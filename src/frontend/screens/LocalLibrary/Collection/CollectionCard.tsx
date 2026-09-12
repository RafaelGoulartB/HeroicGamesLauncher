import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties
} from 'react'
import classNames from 'classnames'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Cancel,
  DeleteForever,
  Description,
  Download,
  Edit,
  Favorite,
  FavoriteBorder,
  List,
  OpenInNew,
  PlayArrow,
  PlaylistRemove,
  Settings,
  Upgrade,
  Visibility,
  VisibilityOff
} from '@mui/icons-material'
import type { FavouriteGame, GameInfo, HiddenGame, Runner } from 'common/types'
import type {
  CompletionStatus,
  LocalGameMeta
} from 'common/types/local-library'
import { CachedImage, SvgButton } from 'frontend/components/UI'
import UninstallModal from 'frontend/components/UI/UninstallModal'
import EditGameDialog from 'frontend/components/UI/EditGameDialog'
import ContextProvider from 'frontend/state/ContextProvider'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'
import { timestampStore } from 'frontend/helpers/electronStores'
import {
  getGameInfo,
  getProgress,
  install,
  launch,
  sendKill
} from 'frontend/helpers'
import { updateGame } from 'frontend/helpers/library'
import { hasProgress } from 'frontend/hooks/hasProgress'
import { hasStatus } from 'frontend/hooks/hasStatus'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import PlayIcon from 'frontend/assets/play-icon.svg?react'
import StopIconAlt from 'frontend/assets/stop-icon-alt.svg?react'
import DownIcon from 'frontend/assets/down-icon.svg?react'
import {
  getCardStatus,
  getImageFormatting
} from 'frontend/screens/Library/components/GameCard/constants'
import { formatPlaytimeMinutes } from './playtime'
import { STATUS_COLORS } from './statusColors'
import CollectionContextMenu from './CollectionContextMenu'
import './CollectionCard.css'

const storage: Storage = window.localStorage

type Props = {
  gameInfo: GameInfo
  meta?: LocalGameMeta
  statuses: CompletionStatus[]
  isRecent?: boolean
  onStatusChange: (statusId: string) => void
}

export default function CollectionCard({
  gameInfo: gameInfoFromProps,
  meta,
  statuses,
  isRecent = false,
  onStatusChange
}: Props) {
  const { t } = useTranslation('gamepage')
  const navigate = useNavigate()
  const {
    hiddenGames,
    favouriteGames,
    showDialogModal,
    connectivity,
    gameUpdates
  } = useContext(ContextProvider)
  const { openGameSettingsModal, openGameLogsModal, openGameCategoriesModal } =
    useGlobalState.keys(
      'openGameSettingsModal',
      'openGameLogsModal',
      'openGameCategoriesModal'
    )

  const [gameInfo, setGameInfo] = useState<GameInfo>(gameInfoFromProps)
  const [visible, setVisible] = useState(false)
  const [showUninstallModal, setShowUninstallModal] = useState(false)

  const {
    app_name: appName,
    runner,
    is_installed: isInstalled,
    install: gameInstallInfo
  } = { ...gameInfoFromProps }
  const title = gameInfoFromProps.overrides?.title || gameInfoFromProps.title
  const cover =
    gameInfoFromProps.overrides?.art_square ||
    gameInfoFromProps.art_square ||
    gameInfoFromProps.art_cover ||
    fallBackImage

  const currentStatusId = meta?.completionStatusId ?? 'not-played'
  const completion =
    statuses.find((item) => item.id === currentStatusId) ??
    statuses.find((item) => item.id === 'not-played')
  const isInstallable =
    gameInfo.installable === undefined || gameInfo.installable
  const [progress, previousProgress] = hasProgress(appName, runner)
  const { install_size: size = '0' } = { ...gameInstallInfo }
  const { status, folder } = hasStatus(gameInfo, size)
  const isBrowserGame = gameInfo.install.platform === 'Browser'
  const hasUpdate = Boolean(isInstalled && gameUpdates?.includes(appName))
  const {
    isInstalling,
    isUninstalling,
    isQueued,
    isPlaying,
    isUpdating,
    isLaunching
  } = getCardStatus(status, isInstalled, 'grid')
  const isTrackingTime = isPlaying || isLaunching
  const installingGrayscale = isInstalling
    ? `${125 - getProgress(progress)}%`
    : '100%'
  const [playedMinutes, setPlayedMinutes] = useState(
    () => timestampStore.get_nodefault(appName)?.totalPlayed
  )
  const [liveExtraMinutes, setLiveExtraMinutes] = useState(0)

  useEffect(() => {
    const callback = (e: CustomEvent<{ appNames: string[] }>) => {
      if (e.detail.appNames.includes(appName)) {
        setVisible(true)
      }
    }
    window.addEventListener('visible-cards', callback)
    return () => window.removeEventListener('visible-cards', callback)
  }, [appName])

  useEffect(() => {
    const updateInfo = async () => {
      const newInfo = await getGameInfo(appName, runner)
      if (newInfo) setGameInfo(newInfo)
    }
    void updateInfo()
    setPlayedMinutes(timestampStore.get_nodefault(appName)?.totalPlayed)
  }, [status, appName, runner, isTrackingTime])

  useEffect(() => {
    if (!isTrackingTime) {
      setLiveExtraMinutes(0)
      return
    }
    const startedAt = Date.now()
    const tick = () =>
      setLiveExtraMinutes(Math.floor((Date.now() - startedAt) / 60000))
    tick()
    const timer = window.setInterval(tick, 15000)
    return () => window.clearInterval(timer)
  }, [isTrackingTime, appName])

  const playtimeLabel = useMemo(
    () => formatPlaytimeMinutes((playedMinutes ?? 0) + liveExtraMinutes),
    [playedMinutes, liveExtraMinutes]
  )

  const isHiddenGame = Boolean(
    hiddenGames.list.find((game: HiddenGame) => game.appName === appName)
  )
  const isFavouriteGame = Boolean(
    favouriteGames.list.find((game: FavouriteGame) => game.appName === appName)
  )
  const isSideloaded = runner === 'sideload'

  const handleRemoveFromQueue = () => {
    window.api.removeFromDMQueue(appName)
  }

  async function handleUpdate() {
    if (gameInfo.runner !== 'sideload') {
      updateGame({ appName, runner, gameInfo })
    }
  }

  const handleEdit = () => {
    if (isSideloaded) {
      openInstallGameModal({ appName, runner, gameInfo })
      return
    }

    showDialogModal({
      showDialog: true,
      title: t('edit-game.title', 'Edit Game'),
      message: (
        <EditGameDialog
          gameInfo={gameInfo}
          backdropClick={() => showDialogModal({ showDialog: false })}
        />
      )
    })
  }

  async function handlePlay(playRunner: Runner) {
    if (!isInstalled && !isQueued && gameInfo.runner !== 'sideload') {
      return install({
        gameInfo,
        installPath: folder || 'default',
        isInstalling,
        previousProgress,
        progress,
        t,
        showDialogModal
      })
    }

    if (isPlaying || isUpdating) {
      return sendKill(appName, playRunner)
    }

    if (isQueued) {
      storage.removeItem(appName)
      return window.api.removeFromDMQueue(appName)
    }

    if (isInstalled) {
      const isOffline = connectivity.status !== 'online'
      await launch({
        appName,
        t,
        runner: playRunner,
        hasUpdate,
        showDialogModal,
        notPlayableOffline: isOffline && !gameInfo.canRunOffline
      })
    }
  }

  function hoverPlayButton() {
    if (!isInstallable) return null

    if (isPlaying || isUpdating) {
      return (
        <SvgButton
          className="collectionCard__playBtn cancel"
          title={`${t('label.playing.stop')} (${title})`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handlePlay(runner)
          }}
        >
          <StopIconAlt />
        </SvgButton>
      )
    }

    if (isInstalling) {
      return (
        <SvgButton
          className="collectionCard__playBtn cancel"
          title={`${t('button.cancel')} (${title})`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handlePlay(runner)
          }}
        >
          <StopIconAlt />
        </SvgButton>
      )
    }

    if (isInstalled) {
      return (
        <SvgButton
          className="collectionCard__playBtn play"
          title={`${t('label.playing.start')} (${title})`}
          disabled={isLaunching}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handlePlay(runner)
          }}
        >
          <PlayIcon />
        </SvgButton>
      )
    }

    if (!isQueued) {
      return (
        <SvgButton
          className="collectionCard__playBtn install"
          title={`${t('button.install')} (${title})`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openInstallGameModal({ appName, runner, gameInfo })
          }}
        >
          <DownIcon />
        </SvgButton>
      )
    }

    return null
  }

  if (!visible && !isTrackingTime) {
    return (
      <div
        className="collectionCard"
        data-app-name={appName}
        data-invisible="true"
      />
    )
  }

  return (
    <>
      {showUninstallModal && (
        <UninstallModal
          appName={appName}
          runner={runner}
          isDlc={Boolean(gameInfo.install.is_dlc)}
          onClose={() => setShowUninstallModal(false)}
        />
      )}
      <CollectionContextMenu
        statuses={statuses.map((item) => ({
          id: item.id,
          label: item.name,
          color: STATUS_COLORS[item.slug],
          selected: item.id === currentStatusId
        }))}
        onStatusChange={onStatusChange}
        items={[
          {
            label: t('button.queue.remove'),
            onclick: handleRemoveFromQueue,
            show: isQueued && !isInstalling,
            icon: <Cancel />
          },
          {
            label: t('label.playing.stop'),
            onclick: () => void handlePlay(runner),
            show: isPlaying,
            icon: <Cancel />
          },
          {
            label: t('label.playing.start'),
            onclick: () => void handlePlay(runner),
            show: isInstalled && !isPlaying && !isUpdating && !isQueued,
            icon: <PlayArrow />
          },
          {
            label: t('button.update', 'Update'),
            onclick: () => void handleUpdate(),
            show: hasUpdate && !isUpdating && !isQueued,
            icon: <Upgrade />
          },
          {
            label: t('button.install'),
            onclick: () => openInstallGameModal({ appName, runner, gameInfo }),
            show: !isInstalled && !isQueued && isInstallable,
            icon: <Download />
          },
          {
            label: t('button.cancel'),
            onclick: () => void handlePlay(runner),
            show: isInstalling || isUpdating,
            icon: <Cancel />
          },
          {
            label: t('button.details', 'Details'),
            onclick: () =>
              navigate(`/gamepage/${runner}/${appName}`, {
                state: { gameInfo, fromCollection: true }
              }),
            show: true,
            icon: <OpenInNew />
          },
          {
            label: t('submenu.settings', 'Settings'),
            onclick: () => openGameSettingsModal(gameInfo),
            show: isInstalled && !isUninstalling && !isBrowserGame,
            icon: <Settings />
          },
          {
            label: t('submenu.logs', 'Logs'),
            onclick: () => openGameLogsModal(gameInfo),
            show: isInstalled && !isUninstalling && !isBrowserGame,
            icon: <Description />
          },
          {
            label: isSideloaded
              ? t('button.sideload.edit', 'Edit App/Game')
              : t('edit-game.title', 'Edit Game'),
            onclick: handleEdit,
            show: true,
            icon: <Edit />
          },
          {
            label: t('button.hide_game', 'Hide Game'),
            onclick: () => hiddenGames.add(appName, title),
            show: !isHiddenGame,
            icon: <VisibilityOff />
          },
          {
            label: t('button.unhide_game', 'Unhide Game'),
            onclick: () => hiddenGames.remove(appName),
            show: isHiddenGame,
            icon: <Visibility />
          },
          {
            label: t('button.add_to_favourites', 'Add To Favourites'),
            onclick: () => favouriteGames.add(appName, title),
            show: !isFavouriteGame,
            icon: <Favorite />
          },
          {
            label: t('submenu.categories', 'Categories'),
            onclick: () => openGameCategoriesModal(gameInfo),
            show: true,
            icon: <List />
          },
          {
            label: t('button.remove_from_favourites', 'Remove From Favourites'),
            onclick: () => favouriteGames.remove(appName),
            show: isFavouriteGame,
            icon: <FavoriteBorder />
          },
          {
            label: t('button.remove_from_recent', 'Remove From Recent'),
            onclick: () => void window.api.removeRecentGame(appName),
            show: isRecent,
            icon: <PlaylistRemove />
          },
          {
            label: t('button.uninstall'),
            onclick: () => setShowUninstallModal(true),
            show: isInstalled && !isUpdating && !isPlaying,
            icon: <DeleteForever />
          }
        ]}
      >
        <div
          className={classNames('collectionCard', {
            installed: isInstalled,
            'is-playing': isTrackingTime
          })}
        >
          <Link
            className="collectionCard__link"
            to={`/gamepage/${runner}/${appName}`}
            state={{ gameInfo, fromCollection: true }}
            style={
              { '--installing-effect': installingGrayscale } as CSSProperties
            }
          >
            <CachedImage
              src={getImageFormatting(cover, runner)}
              className={classNames('collectionCard__image', {
                installed: isInstalled
              })}
              alt={title}
            />
            <span
              className={classNames('collectionCard__playtime', {
                'is-playing': isTrackingTime
              })}
              title={
                isTrackingTime
                  ? t('collection.tracking', 'Counting playtime')
                  : undefined
              }
            >
              {isTrackingTime && <span className="collectionCard__liveDot" />}
              {playtimeLabel}
            </span>
            {completion && (
              <span
                className="collectionCard__statusDot"
                style={{ background: STATUS_COLORS[completion.slug] }}
                title={completion.name}
              />
            )}
          </Link>
          <div className="collectionCard__bar">
            <span className="collectionCard__title">
              <span>{title}</span>
            </span>
            {hoverPlayButton()}
          </div>
        </div>
      </CollectionContextMenu>
    </>
  )
}
