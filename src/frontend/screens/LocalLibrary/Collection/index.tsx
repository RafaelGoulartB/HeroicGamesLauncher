import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Menu, MenuOpen, Settings } from '@mui/icons-material'
import type { GameInfo } from 'common/types'
import type {
  CollectionGameArt,
  CompletionStatus,
  LocalGameMeta
} from 'common/types/local-library'
import ContextProvider from 'frontend/state/ContextProvider'
import { CachedImage } from 'frontend/components/UI'
import { configStore, timestampStore } from 'frontend/helpers/electronStores'
import CollectionCard from './CollectionCard'
import CollectionFocus from './CollectionFocus'
import CollectionSettingsDialog from './CollectionSettingsDialog'
import InstallFilterMenu, { type InstallFilter } from './InstallFilterMenu'
import PlayniteMenu from './PlayniteMenu'
import SortMenu, { type CollectionSort } from './SortMenu'
import StatusMenu from './StatusMenu'
import { STATUS_COLORS } from './statusColors'
import { collectionArtKey, collectionStageArt } from './steamArt'
import './index.css'

const INSTALL_FILTER_KEY = 'collection_install_filter'
const SORT_KEY = 'collection_sort'
const SIDEBAR_HIDDEN_KEY = 'collection_sidebar_hidden'
const COLLAPSED_GROUPS_KEY = 'collection_collapsed_groups'
const FOCUSED_GAME_KEY = 'collection_focused_game'
const UNKNOWN_GROUP_ID = 'ungrouped'
const storage: Storage = window.localStorage
const SIDEBAR_HIDDEN_CLASS = 'collectionSidebarHidden'

function slugForMeta(
  meta: LocalGameMeta | undefined,
  statuses: CompletionStatus[]
): string {
  if (meta?.completionStatusId) return meta.completionStatusId
  return (
    statuses.find((item) => item.slug === 'not-played')?.id ??
    statuses[0]?.id ??
    'not-played'
  )
}

function readInstallFilter(): InstallFilter {
  const stored = storage.getItem(INSTALL_FILTER_KEY)
  if (stored === 'installed' || stored === 'uninstalled' || stored === 'all') {
    return stored
  }
  return 'all'
}

function readSort(): CollectionSort {
  const stored = storage.getItem(SORT_KEY)
  if (stored === 'lastPlayed' || stored === 'playtime' || stored === 'title') {
    return stored
  }
  return 'title'
}

function readSidebarHidden(): boolean {
  return storage.getItem(SIDEBAR_HIDDEN_KEY) === '1'
}

function readFocusedKey(): string | null {
  const stored = storage.getItem(FOCUSED_GAME_KEY)
  return stored || null
}

function persistFocusedKey(key: string) {
  storage.setItem(FOCUSED_GAME_KEY, key)
}

function readCollapsedGroups(): Set<string> {
  try {
    const stored = storage.getItem(COLLAPSED_GROUPS_KEY)
    if (!stored) return new Set()
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter((item): item is string => typeof item === 'string')
    )
  } catch {
    return new Set()
  }
}

function applySidebarHidden(hidden: boolean) {
  document.getElementById('app')?.classList.toggle(SIDEBAR_HIDDEN_CLASS, hidden)
}

function gameKey(game: GameInfo) {
  return `${game.runner}_${game.app_name}`
}

function playtimeMinutes(appName: string): number {
  return timestampStore.get_nodefault(appName)?.totalPlayed ?? 0
}

function lastPlayedAt(appName: string): string {
  return timestampStore.get_nodefault(appName)?.lastPlayed ?? ''
}

export default function Collection() {
  const { t } = useTranslation()
  const { epic, gog, amazon, zoom, sideloadedLibrary, allTilesInColor } =
    useContext(ContextProvider)
  const [search, setSearch] = useState('')
  const [installFilter, setInstallFilter] =
    useState<InstallFilter>(readInstallFilter)
  const [sort, setSort] = useState<CollectionSort>(readSort)
  const [statuses, setStatuses] = useState<CompletionStatus[]>([])
  const [metas, setMetas] = useState<Record<string, LocalGameMeta>>({})
  const [groupByStatus, setGroupByStatus] = useState(true)
  const [collapsedGroups, setCollapsedGroups] =
    useState<Set<string>>(readCollapsedGroups)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [greyUninstalledGames, setGreyUninstalledGames] = useState(true)
  const [sidebarHidden, setSidebarHidden] = useState(readSidebarHidden)
  const [focusedKey, setFocusedKey] = useState<string | null>(readFocusedKey)
  const [heroCache, setHeroCache] = useState<Record<string, string>>({})
  const [collectionArt, setCollectionArt] = useState<
    Record<string, CollectionGameArt>
  >({})
  const [recentAppNames, setRecentAppNames] = useState<Set<string>>(
    () => new Set()
  )
  const listRef = useRef<HTMLDivElement | null>(null)

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
  }, [])

  function handleInstallFilter(next: InstallFilter) {
    storage.setItem(INSTALL_FILTER_KEY, next)
    setInstallFilter(next)
  }

  function handleSort(next: CollectionSort) {
    storage.setItem(SORT_KEY, next)
    setSort(next)
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      storage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  async function reload() {
    const [nextStatuses, nextMetas, nextArt, nextSettings] = await Promise.all([
      window.api.localLibrary.getStatuses(),
      window.api.localLibrary.getAllMeta(),
      window.api.localLibrary.getAllCollectionArt(),
      window.api.localLibrary.getSettings()
    ])
    setStatuses(nextStatuses)
    setMetas(nextMetas)
    setCollectionArt(nextArt)
    setGreyUninstalledGames(nextSettings.greyUninstalledGames !== false)
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    applySidebarHidden(sidebarHidden)
    return () => applySidebarHidden(false)
  }, [sidebarHidden])

  function handleSidebarToggle() {
    const next = !sidebarHidden
    storage.setItem(SIDEBAR_HIDDEN_KEY, next ? '1' : '0')
    setSidebarHidden(next)
  }

  useEffect(() => {
    const loadRecent = () => {
      const recent = configStore.get('games.recent', [])
      setRecentAppNames(new Set(recent.map((game) => game.appName)))
    }
    loadRecent()
    const removeListener = window.api.handleRecentGamesChanged(loadRecent)
    return () => removeListener()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (settingsOpen) return
        setFocusedKey(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen])

  const games = useMemo(() => {
    const all: GameInfo[] = [
      ...sideloadedLibrary,
      ...epic.library,
      ...gog.library,
      ...amazon.library,
      ...zoom.library
    ]
    const seen = new Set<string>()
    const unique: GameInfo[] = []
    for (const game of all) {
      if (game.install?.is_dlc) continue
      const key = `${game.runner}_${game.app_name}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(game)
    }
    return unique
  }, [
    sideloadedLibrary,
    epic.library,
    gog.library,
    amazon.library,
    zoom.library
  ])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const next = games.filter((game) => {
      if (query && !game.title.toLowerCase().includes(query)) return false
      if (installFilter === 'installed') return game.is_installed
      if (installFilter === 'uninstalled') return !game.is_installed
      return true
    })

    return next.sort((a, b) => {
      if (sort === 'playtime') {
        const delta = playtimeMinutes(b.app_name) - playtimeMinutes(a.app_name)
        if (delta) return delta
      }
      if (sort === 'lastPlayed') {
        const aLast = lastPlayedAt(a.app_name)
        const bLast = lastPlayedAt(b.app_name)
        if (aLast || bLast) {
          if (!aLast) return 1
          if (!bLast) return -1
          const delta = bLast.localeCompare(aLast)
          if (delta) return delta
        }
      }
      return a.title.localeCompare(b.title)
    })
  }, [games, search, installFilter, sort])

  const grouped = useMemo(() => {
    const buckets = new Map<string, GameInfo[]>()
    for (const status of statuses) {
      buckets.set(status.id, [])
    }
    const unknown: GameInfo[] = []
    for (const game of filtered) {
      const statusId = slugForMeta(metas[game.app_name], statuses)
      const bucket = buckets.get(statusId)
      if (bucket) bucket.push(game)
      else unknown.push(game)
    }
    return { buckets, unknown }
  }, [filtered, metas, statuses])

  const focusedGame = useMemo(() => {
    if (!focusedKey) return null
    return games.find((game) => gameKey(game) === focusedKey) ?? null
  }, [focusedKey, games])

  const paintedGame = focusedGame
  const paintedMeta = paintedGame ? metas[paintedGame.app_name] : undefined
  const paintedArt = paintedGame
    ? collectionStageArt(
        paintedGame,
        paintedMeta,
        paintedMeta?.steamAppId ? heroCache[paintedMeta.steamAppId] : undefined,
        collectionArt[
          collectionArtKey(paintedGame.runner, paintedGame.app_name)
        ]?.heroUrl
      )
    : null

  useEffect(() => {
    const steamAppId = paintedMeta?.steamAppId
    if (!steamAppId) return
    const cacheHero = window.api.localLibrary.cacheSteamHero
    if (typeof cacheHero !== 'function') return
    let cancelled = false
    void cacheHero(steamAppId).then((result) => {
      if (cancelled || !result?.url) return
      setHeroCache((current) =>
        current[steamAppId] === result.url
          ? current
          : { ...current, [steamAppId]: result.url }
      )
    })
    return () => {
      cancelled = true
    }
  }, [paintedMeta?.steamAppId])

  useEffect(() => {
    if (!filtered.length) return
    const observer = new IntersectionObserver(
      (entries, current) => {
        const entered: string[] = []
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0) {
            entered.push(
              (entry.target as HTMLDivElement).dataset.appName as string
            )
            current.unobserve(entry.target)
          }
        })
        if (entered.length) {
          window.dispatchEvent(
            new CustomEvent('visible-cards', { detail: { appNames: entered } })
          )
        }
      },
      { rootMargin: '500px', threshold: 0 }
    )

    listRef.current
      ?.querySelectorAll('[data-invisible]')
      .forEach((card) => observer.observe(card))

    const frame = window.requestAnimationFrame(() => {
      listRef.current
        ?.querySelectorAll('[data-invisible]')
        .forEach((card) => observer.observe(card))
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [
    filtered,
    groupByStatus,
    statuses,
    metas,
    sort,
    focusedKey,
    collapsedGroups
  ])

  useEffect(() => {
    if (!focusedKey) return
    const timer = window.setTimeout(() => {
      listRef.current
        ?.querySelector('.collectionCard.is-focused')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 240)
    return () => window.clearTimeout(timer)
  }, [focusedKey, filtered])

  async function handleStatusChange(game: GameInfo, statusId: string) {
    const next = await window.api.localLibrary.setStatus({
      appName: game.app_name,
      statusId,
      runner: game.runner === 'zoom' ? 'sideload' : game.runner,
      title: game.title,
      playniteId: metas[game.app_name]?.playniteId
    })
    if (next) {
      setMetas((current) => ({ ...current, [game.app_name]: next }))
    }
  }

  function renderCards(list: GameInfo[]) {
    return list.map((game) => (
      <CollectionCard
        key={gameKey(game)}
        gameInfo={game}
        meta={metas[game.app_name]}
        collectionArt={
          collectionArt[collectionArtKey(game.runner, game.app_name)]
        }
        statuses={statuses}
        isRecent={recentAppNames.has(game.app_name)}
        isFocused={focusedKey === gameKey(game)}
        onSelect={() => {
          const key = gameKey(game)
          persistFocusedKey(key)
          setFocusedKey(key)
        }}
        onStatusChange={(statusId) => handleStatusChange(game, statusId)}
      />
    ))
  }

  return (
    <div
      className={classNames('collection collection--focused', {
        allTilesInColor,
        'collection--greyUninstalled': greyUninstalledGames
      })}
    >
      {paintedArt && (
        <div className="collection__stage" aria-hidden>
          <CachedImage
            key={paintedArt.src}
            src={paintedArt.src}
            fallback={paintedArt.fallback}
            className="collection__stageArt"
            alt=""
          />
          <div className="collection__stageScrim" />
        </div>
      )}
      <header className="collection__header">
        <div className="collection__toolbarLeft">
          <button
            type="button"
            className="collection__toolBtn"
            title={
              sidebarHidden
                ? t('collection.showSidebar', 'Show sidebar')
                : t('collection.hideSidebar', 'Hide sidebar')
            }
            aria-label={
              sidebarHidden
                ? t('collection.showSidebar', 'Show sidebar')
                : t('collection.hideSidebar', 'Hide sidebar')
            }
            aria-pressed={sidebarHidden}
            onClick={handleSidebarToggle}
          >
            {sidebarHidden ? <Menu /> : <MenuOpen />}
          </button>
          <InstallFilterMenu
            value={installFilter}
            onChange={handleInstallFilter}
          />
        </div>
        <div className="collection__toolbarCenter">
          <label className="collection__search">
            <FontAwesomeIcon
              className="collection__searchIcon"
              icon={faSearch}
            />
            <input
              id="search"
              className="collection__searchInput"
              data-testid="searchInput"
              aria-label={t('search', 'Search for Games')}
              placeholder={t('search', 'Search for Games')}
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
            />
          </label>
          <SortMenu value={sort} onChange={handleSort} />
          <StatusMenu
            groupByStatus={groupByStatus}
            onGroupByStatusChange={setGroupByStatus}
            onStatusesChanged={() => void reload()}
          />
        </div>
        <div className="collection__toolbarRight">
          <PlayniteMenu onLibraryChanged={() => void reload()} />
          <button
            type="button"
            className="collection__toolBtn"
            title={t('collection.settings.title', 'Collection settings')}
            aria-label={t('collection.settings.title', 'Collection settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
          </button>
        </div>
      </header>

      <div className="collection__workspace">
        <div className="collection__list" ref={listRef}>
          {groupByStatus ? (
            statuses.map((status) => {
              const list = grouped.buckets.get(status.id) ?? []
              if (!list.length) return null
              return (
                <section
                  key={status.id}
                  className={classNames('collection__group', {
                    'is-collapsed': collapsedGroups.has(status.id)
                  })}
                >
                  <button
                    type="button"
                    className="collection__groupToggle"
                    aria-expanded={!collapsedGroups.has(status.id)}
                    onClick={() => toggleGroup(status.id)}
                  >
                    <span
                      className="collection__dot"
                      style={{
                        background: STATUS_COLORS[status.slug]
                      }}
                    />
                    {status.name}
                    <span className="collection__count">{list.length}</span>
                  </button>
                  <div className="collection__grid">{renderCards(list)}</div>
                </section>
              )
            })
          ) : (
            <div className="collection__grid">{renderCards(filtered)}</div>
          )}
          {groupByStatus && grouped.unknown.length > 0 && (
            <section
              className={classNames('collection__group', {
                'is-collapsed': collapsedGroups.has(UNKNOWN_GROUP_ID)
              })}
            >
              <button
                type="button"
                className="collection__groupToggle"
                aria-expanded={!collapsedGroups.has(UNKNOWN_GROUP_ID)}
                onClick={() => toggleGroup(UNKNOWN_GROUP_ID)}
              >
                {t('collection.ungrouped', 'Other')}
                <span className="collection__count">
                  {grouped.unknown.length}
                </span>
              </button>
              <div className="collection__grid">
                {renderCards(grouped.unknown)}
              </div>
            </section>
          )}
        </div>
        <CollectionFocus
          game={paintedGame}
          meta={paintedGame ? metas[paintedGame.app_name] : undefined}
          collectionArt={
            paintedGame
              ? collectionArt[
                  collectionArtKey(paintedGame.runner, paintedGame.app_name)
                ]
              : undefined
          }
          cachedHeroUrl={
            paintedMeta?.steamAppId
              ? heroCache[paintedMeta.steamAppId]
              : undefined
          }
          statuses={statuses}
          onArtChange={(next) => {
            if (!paintedGame) return
            const key = collectionArtKey(
              paintedGame.runner,
              paintedGame.app_name
            )
            setCollectionArt((current) => {
              if (!next.coverUrl && !next.heroUrl) {
                const rest = { ...current }
                delete rest[key]
                return rest
              }
              return { ...current, [key]: next }
            })
          }}
          onClose={() => setFocusedKey(null)}
        />
      </div>
      {settingsOpen && (
        <CollectionSettingsDialog
          onClose={() => setSettingsOpen(false)}
          onSettingsChange={(next) => {
            setGreyUninstalledGames(next.greyUninstalledGames !== false)
          }}
        />
      )}
    </div>
  )
}
