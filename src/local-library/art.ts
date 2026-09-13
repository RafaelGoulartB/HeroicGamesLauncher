import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'graceful-fs'
import { basename, extname, join, relative, resolve, sep } from 'path'
import { fileURLToPath } from 'url'
import { app } from 'electron'
import Store from 'electron-store'
import type { Runner } from 'common/types'
import type {
  CollectionArtKind,
  CollectionGameArt
} from 'common/types/local-library'
import { logWarning, LogPrefix } from 'backend/logger'
import { localArtFilePath, localArtUrl } from './protocol'

type ArtFile = {
  games: Record<string, CollectionGameArt>
}

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'])

const artFile = new Store<ArtFile>({
  cwd: 'local_library',
  name: 'art',
  defaults: { games: {} }
})

export function collectionArtKey(runner: string, appName: string) {
  return `${runner}:${appName}`
}

function artRoot() {
  return join(app.getPath('userData'), 'local_library', 'art')
}

function folderName(runner: string, appName: string) {
  return `${runner}_${appName}`.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

function fileFromUrl(url?: string) {
  if (!url) return undefined
  if (url.startsWith('localart:')) {
    return localArtFilePath(url) ?? undefined
  }
  if (url.startsWith('file:')) {
    try {
      return fileURLToPath(url)
    } catch {
      return undefined
    }
  }
  return undefined
}

function displayUrl(filePath: string) {
  const root = resolve(artRoot())
  const target = resolve(filePath)
  const rel = relative(root, target)
  if (!rel || rel.startsWith('..') || rel.startsWith(sep)) {
    return localArtUrl('art', basename(filePath))
  }
  return localArtUrl('art', ...rel.split(sep))
}

function isManaged(filePath: string) {
  const root = resolve(artRoot())
  const target = resolve(filePath)
  return target === root || target.startsWith(root + sep)
}

function removeManaged(url?: string) {
  const filePath = fileFromUrl(url)
  if (!filePath || !isManaged(filePath) || !existsSync(filePath)) return
  try {
    unlinkSync(filePath)
  } catch (error) {
    logWarning(
      `Could not remove Collection art ${filePath}: ${String(error)}`,
      LogPrefix.Backend
    )
  }
}

function hydrate(art?: CollectionGameArt): CollectionGameArt {
  if (!art) return {}
  const next: CollectionGameArt = {}
  if (art.coverUrl) {
    const path = fileFromUrl(art.coverUrl)
    if (path && existsSync(path)) next.coverUrl = displayUrl(path)
  }
  if (art.heroUrl) {
    const path = fileFromUrl(art.heroUrl)
    if (path && existsSync(path)) next.heroUrl = displayUrl(path)
  }
  return next
}

export function getAllCollectionArt(): Record<string, CollectionGameArt> {
  const games = artFile.get('games')
  const next: Record<string, CollectionGameArt> = {}
  for (const [key, art] of Object.entries(games)) {
    next[key] = hydrate(art)
  }
  return next
}

export function getCollectionGameArt(
  runner: string,
  appName: string
): CollectionGameArt {
  return hydrate(artFile.get('games')[collectionArtKey(runner, appName)])
}

function writeArt(
  runner: string,
  appName: string,
  art: CollectionGameArt
): CollectionGameArt {
  const key = collectionArtKey(runner, appName)
  const games = { ...artFile.get('games') }
  const cleaned = hydrate(art)
  if (!cleaned.coverUrl && !cleaned.heroUrl) delete games[key]
  else games[key] = cleaned
  artFile.set('games', games)
  return cleaned
}

export function setCollectionGameArt(args: {
  appName: string
  runner: Runner
  kind: CollectionArtKind
  sourcePath: string
}): CollectionGameArt {
  const { appName, runner, kind, sourcePath } = args
  const ext = extname(sourcePath).replace('.', '').toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported image type: ${ext || 'unknown'}`)
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`Image not found: ${sourcePath}`)
  }

  const dir = join(artRoot(), folderName(runner, appName))
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `${kind}-${Date.now()}.${ext}`)
  copyFileSync(sourcePath, dest)

  const current = getCollectionGameArt(runner, appName)
  if (kind === 'cover') {
    removeManaged(current.coverUrl)
    current.coverUrl = displayUrl(dest)
  } else {
    removeManaged(current.heroUrl)
    current.heroUrl = displayUrl(dest)
  }
  return writeArt(runner, appName, current)
}

export function clearCollectionGameArt(args: {
  appName: string
  runner: Runner
  kind: CollectionArtKind
}): CollectionGameArt {
  const current = getCollectionGameArt(args.runner, args.appName)
  if (args.kind === 'cover') {
    removeManaged(current.coverUrl)
    delete current.coverUrl
  } else {
    removeManaged(current.heroUrl)
    delete current.heroUrl
  }
  return writeArt(args.runner, args.appName, current)
}
