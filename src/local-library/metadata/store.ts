import Store from 'electron-store'
import type { CollectionGameMetadata } from 'common/types/local-library'
import { blankMetadata } from './blank'

type MetadataFile = {
  games: Record<string, CollectionGameMetadata>
}

const metadataFile = new Store<MetadataFile>({
  cwd: 'local_library',
  name: 'metadata',
  defaults: { games: {} }
})

export function metadataKey(runner: string, appName: string) {
  return `${runner}:${appName}`
}

export function getGameMetadata(
  runner: string,
  appName: string
): CollectionGameMetadata | undefined {
  return metadataFile.get('games')[metadataKey(runner, appName)]
}

export function getAllGameMetadata(): Record<string, CollectionGameMetadata> {
  return metadataFile.get('games')
}

export function upsertGameMetadata(metadata: CollectionGameMetadata) {
  const games = { ...metadataFile.get('games') }
  games[metadataKey(metadata.runner, metadata.appName)] = metadata
  metadataFile.set('games', games)
  return metadata
}

export function currentOrBlank(
  runner: string,
  appName: string
): CollectionGameMetadata {
  return getGameMetadata(runner, appName) ?? blankMetadata(appName, runner)
}
