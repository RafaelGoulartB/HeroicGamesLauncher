# Fork overlay — Playnite local library

This fork keeps Playnite import, local-session history, and Steam URI launch
out of Heroic's store architecture. The Local "store" is the existing
`sideload` runner (UI label: Local).

## New files (no upstream equivalent)

- `src/common/types/local-library.ts`
- `src/local-library/**`
- `src/preload/api/localLibrary.ts`
- `src/frontend/screens/LocalLibrary/**`

## Upstream hooks (keep these diffs small when merging)

| File                                                              | Change                                         |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| `src/common/types/ipc.ts`                                         | IPC methods for Playnite import / sessions     |
| `src/backend/storeManagers/sideload/library.ts`                   | `init()` / `refresh()` → local install state   |
| `src/backend/storeManagers/sideload/games.ts`                     | Steam URI availability + launch                |
| `src/backend/launcher.ts`                                         | `recordLocalSession()` after playtime          |
| `src/preload/api/index.ts`                                        | export `localLibrary`                          |
| `src/frontend/screens/Library/components/LibraryHeader/index.tsx` | Import Playnite button                         |
| `src/frontend/screens/Library/components/LibraryHeader/index.css` | button spacing                                 |
| `src/frontend/screens/Game/GamePage/index.tsx`                    | session history next to TimeContainer          |
| `src/frontend/components/UI/LibraryFilters/index.tsx`             | "Other" → "Local"                              |
| `electron.vite.config.ts`                                         | alias `local-library`                          |
| `src/frontend/App.tsx`                                            | Collection is index `/`; Library at `/library` |
| `src/frontend/components/UI/Sidebar/components/SidebarLinks/`     | Collection is home; Library at `/library`      |
| `src/frontend/components/UI/Sidebar/components/SidebarItem/`      | `end` so `/` does not stay active everywhere   |

Sidecar data lives in Electron stores `local_library/library` and
`local_library/sessions`, not in `GameInfo`.
