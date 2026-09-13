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

| File                                                          | Change                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/common/types/ipc.ts`                                     | IPC methods for Playnite, Steam URI, Collection backup, Steam details, Collection art |
| `src/backend/storeManagers/sideload/library.ts`               | `init()` / `refresh()` → local install state                                          |
| `src/backend/storeManagers/sideload/games.ts`                 | Steam URI launch, wait for game, stop PID                                             |
| `src/backend/launcher.ts`                                     | `recordLocalSession()` / Ludusavi backup after play                                   |
| `src/preload/api/index.ts`                                    | export `localLibrary`                                                                 |
| `src/frontend/screens/Game/GamePage/index.tsx`                | session history next to TimeContainer                                                 |
| `src/frontend/components/UI/LibraryFilters/index.tsx`         | "Other" → "Local"                                                                     |
| `electron.vite.config.ts`                                     | alias `local-library`                                                                 |
| `src/backend/main.ts`                                         | `registerLocalArtScheme()` / `initLocalArtProtocol()` next to image cache             |
| `src/frontend/App.tsx`                                        | Collection is index `/`; Library at `/library`                                        |
| `src/frontend/components/UI/Sidebar/components/SidebarLinks/` | Collection is home; Library at `/library`                                             |
| `src/frontend/components/UI/Sidebar/components/SidebarItem/`  | `end` so `/` does not stay active everywhere                                          |

Sidecar data lives in Electron stores `local_library/library` and
`local_library/sessions`, not in `GameInfo`. Steam Collection heroes are
copied to `local_library/heroes/{steamAppId}.jpg` and served to the UI via
`localart://` (HTTP origins cannot load `file://`). Steam store descriptions
are cached in `local_library/steam-details`. Custom Collection art
overrides live in `local_library/art` and `local_library/art.json`.

Collection Install/Uninstall for Steam titles (`launchKind: steam-uri`)
opens the Steam client (`steam://install/<id>` / `steam://uninstall/<id>`)
from overlay code. Official Library, UninstallModal, and sideload uninstall
are unchanged.

Collection settings (gear on the Collection header) store backup folder,
schedule, and Ludusavi options in `local_library/settings.json`. On boot, a
filtered copy of `~/.config/heroic` is written to `heroic-YYYY-MM-DD` when due.
If Ludusavi auto-backup is on, saves are backed up after a game closes.
