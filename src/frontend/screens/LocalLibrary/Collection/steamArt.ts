import type { GameInfo } from 'common/types'
import type {
  CollectionGameArt,
  LocalGameMeta
} from 'common/types/local-library'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import { getImageFormatting } from 'frontend/screens/Library/components/GameCard/constants'

export function collectionArtKey(runner: string, appName: string) {
  return `${runner}:${appName}`
}

function isLocalSrc(src: string) {
  return (
    src.startsWith('file:') ||
    src.startsWith('localart:') ||
    src.startsWith('/')
  )
}

export function collectionCoverSrc(
  game: GameInfo,
  art?: CollectionGameArt
): string {
  if (art?.coverUrl) return art.coverUrl
  const raw =
    game.overrides?.art_square ||
    game.art_square ||
    game.art_cover ||
    fallBackImage
  if (isLocalSrc(raw)) return raw
  return getImageFormatting(raw, game.runner)
}

export function collectionStageArt(
  game: GameInfo,
  _meta?: LocalGameMeta,
  cachedHeroUrl?: string,
  customHeroUrl?: string
): { src: string; fallback?: string } | null {
  if (customHeroUrl) {
    return { src: customHeroUrl }
  }

  if (cachedHeroUrl) {
    return { src: cachedHeroUrl }
  }

  const src =
    game.art_background ||
    game.overrides?.art_cover ||
    game.art_cover ||
    game.art_square
  if (!src) return null
  return { src }
}
