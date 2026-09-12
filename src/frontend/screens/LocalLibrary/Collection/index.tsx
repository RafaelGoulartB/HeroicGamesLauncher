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
import {
  faBorderAll,
  faHardDrive as hardDriveSolid
} from '@fortawesome/free-solid-svg-icons'
import { faHardDrive as hardDriveLight } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { GameInfo } from 'common/types'
import type {
  CompletionStatus,
  CompletionStatusSlug,
  LocalGameMeta
} from 'common/types/local-library'
import ContextProvider from 'frontend/state/ContextProvider'
import { ToggleSwitch } from 'frontend/components/UI'
import SearchBar from 'frontend/components/UI/SearchBar'
import FormControl from 'frontend/components/UI/FormControl'
import { configStore } from 'frontend/helpers/electronStores'
import CollectionCard from './CollectionCard'
import PlayniteMenu from './PlayniteMenu'
import { STATUS_COLORS } from './statusColors'
import './index.css'

type InstallFilter = 'all' | 'installed' | 'uninstalled'

const INSTALL_FILTER_KEY = 'collection_install_filter'
const storage: Storage = window.localStorage

function slugForMeta(
  meta: LocalGameMeta | undefined,
  statuses: CompletionStatus[]
): string {
  if (meta?.completionStatusId) return meta.completionStatusId
  return statuses.find((item) => item.slug === 'not-played')?.id ?? 'not-played'
}

function readInstallFilter(): InstallFilter {
  const stored = storage.getItem(INSTALL_FILTER_KEY)
  if (stored === 'installed' || stored === 'uninstalled' || stored === 'all') {
    return stored
  }
  return 'all'
}

export default function Collection() {
  const { t } = useTranslation()
  const { epic, gog, amazon, zoom, sideloadedLibrary, allTilesInColor } =
    useContext(ContextProvider)
  const [search, setSearch] = useState('')
  const [installFilter, setInstallFilter] =
    useState<InstallFilter>(readInstallFilter)
  const [statuses, setStatuses] = useState<CompletionStatus[]>([])
  const [metas, setMetas] = useState<Record<string, LocalGameMeta>>({})
  const [groupByStatus, setGroupByStatus] = useState(true)
  const [newStatusName, setNewStatusName] = useState('')
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

  async function reload() {
    const [nextStatuses, nextMetas] = await Promise.all([
      window.api.localLibrary.getStatuses(),
      window.api.localLibrary.getAllMeta()
    ])
    setStatuses(nextStatuses)
    setMetas(nextMetas)
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    const loadRecent = () => {
      const recent = configStore.get('games.recent', [])
      setRecentAppNames(new Set(recent.map((game) => game.appName)))
    }
    loadRecent()
    const removeListener = window.api.handleRecentGamesChanged(loadRecent)
    return () => removeListener()
  }, [])

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
    return unique.sort((a, b) => a.title.localeCompare(b.title))
  }, [
    sideloadedLibrary,
    epic.library,
    gog.library,
    amazon.library,
    zoom.library
  ])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return games.filter((game) => {
      if (query && !game.title.toLowerCase().includes(query)) return false
      if (installFilter === 'installed') return game.is_installed
      if (installFilter === 'uninstalled') return !game.is_installed
      return true
    })
  }, [games, search, installFilter])

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

    return () => observer.disconnect()
  }, [filtered, groupByStatus, statuses, metas])

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

  async function handleAddStatus() {
    const name = newStatusName.trim()
    if (!name) return
    const id = `custom_${Date.now()}`
    const next = await window.api.localLibrary.upsertStatus({
      id,
      name,
      slug: 'custom' as CompletionStatusSlug,
      sortOrder: 100 + statuses.length
    })
    setStatuses(next)
    setNewStatusName('')
  }

  function renderCards(list: GameInfo[]) {
    return list.map((game) => (
      <CollectionCard
        key={`${game.runner}_${game.app_name}`}
        gameInfo={game}
        meta={metas[game.app_name]}
        statuses={statuses}
        isRecent={recentAppNames.has(game.app_name)}
        onStatusChange={(statusId) => handleStatusChange(game, statusId)}
      />
    ))
  }

  return (
    <div className={classNames('collection', { allTilesInColor })}>
      <header className="collection__header">
        <h5 className="collection__title">
          {t('collection.title', 'Collection')}
          <span className="collection__count">{filtered.length}</span>
        </h5>
        <div className="collection__controls">
          <div className="collection__search">
            <SearchBar
              onInputChanged={handleSearch}
              value={search}
              placeholder={t('search', 'Search for Games')}
            />
          </div>
          <FormControl segmented small>
            <button
              className={classNames('FormControl__button', {
                active: installFilter === 'all'
              })}
              title={t('collection.filter.all', 'All games')}
              onClick={() => handleInstallFilter('all')}
            >
              <FontAwesomeIcon
                className="FormControl__segmentedFaIcon"
                icon={faBorderAll}
              />
            </button>
            <button
              className={classNames('FormControl__button', {
                active: installFilter === 'installed'
              })}
              title={t('collection.filter.installed', 'Installed')}
              onClick={() => handleInstallFilter('installed')}
            >
              <FontAwesomeIcon
                className="FormControl__segmentedFaIcon"
                icon={hardDriveSolid}
              />
            </button>
            <button
              className={classNames('FormControl__button', {
                active: installFilter === 'uninstalled'
              })}
              title={t(
                'collection.filter.uninstalled',
                'Not installed / Uninstalled'
              )}
              onClick={() => handleInstallFilter('uninstalled')}
            >
              <FontAwesomeIcon
                className="FormControl__segmentedFaIcon"
                icon={hardDriveLight}
              />
            </button>
          </FormControl>
          <ToggleSwitch
            htmlId="collection-group-status"
            value={groupByStatus}
            handleChange={() => setGroupByStatus((value) => !value)}
            title={t('collection.group', 'Group by status')}
          />
          <PlayniteMenu onLibraryChanged={() => void reload()} />
          <div className="collection__addStatus">
            <input
              value={newStatusName}
              onChange={(event) => setNewStatusName(event.target.value)}
              placeholder={t('collection.newStatus', 'New status')}
            />
            <button className="button" onClick={() => void handleAddStatus()}>
              {t('collection.addStatus', 'Add')}
            </button>
          </div>
        </div>
      </header>

      <div className="collection__body" ref={listRef}>
        {groupByStatus ? (
          statuses.map((status) => {
            const list = grouped.buckets.get(status.id) ?? []
            if (!list.length) return null
            return (
              <section key={status.id} className="collection__group">
                <h5>
                  <span
                    className="collection__dot"
                    style={{
                      background: STATUS_COLORS[status.slug]
                    }}
                  />
                  {status.name}
                  <span className="collection__count">{list.length}</span>
                </h5>
                <div className="collection__grid">{renderCards(list)}</div>
              </section>
            )
          })
        ) : (
          <div className="collection__grid">{renderCards(filtered)}</div>
        )}
        {groupByStatus && grouped.unknown.length > 0 && (
          <section className="collection__group">
            <h5>
              {t('collection.ungrouped', 'Other')}
              <span className="collection__count">
                {grouped.unknown.length}
              </span>
            </h5>
            <div className="collection__grid">
              {renderCards(grouped.unknown)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
