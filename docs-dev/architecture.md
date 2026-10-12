# Frontend architecture

State lives in small Zustand stores, behaviour in plain action functions, and React-only
side effects in hooks. Components (`sections/`) only render and call into these layers.

```
src/
  store/      Zustand stores (state + persistence). No React components.
  actions/    Functions that coordinate stores and the backend adapter (`getState()` based).
  hooks/      React hooks for effects that need the component lifecycle.
  domain/     Pure functions and constants (no I/O, easy to unit test).
  api/        Backend adapter: Tauri bridge in the app, mock adapter in a plain browser.
  audio/      The single <audio> element reference.
  utils/      Helpers (formatting, lyrics, Web Audio graph).
  sections/   Current UI sections (to be replaced by the redesigned screens).
```

## Stores

| Store | Holds | Persisted in localStorage |
|-------|-------|---------------------------|
| `settingsStore` | theme, accents, startup screen, default folder, rename pattern, player layout, audio flags | yes (same keys as v1.x) |
| `playlistStore` | playlists, active playlist, rename draft | yes |
| `equalizerStore` | presets, current EQ values, genre → preset map | yes |
| `navidromeStore` | server form, bookmarks, connection status | bookmarks |
| `libraryStore` | tracks, folder, selected track, scan flag | snapshot via `useLibrarySession` |
| `tagEditorStore` | draft track, online search state | no |
| `playerStore` | playback track, queue, history, clock, volume, audio status | shuffle, repeat |
| `uiStore` | active screen, modals | no |

Every store exposes React-like setters (`setX(value | updater)`) and keeps the localStorage keys of
the previous versions, so existing user data keeps working. Rules of thumb:

- A store never imports another store's *actions* at module load; cross-store calls happen inside
  functions through `useXStore.getState()`.
- Persistence is a `subscribe` at the bottom of the store file: it writes only what changed.
- Tests stub `window.localStorage` and re-import the store (`vi.resetModules()`), see `src/__tests__`.

## Actions

- `actions/library.ts`: `selectTrack`, `applyLoadedLibrary`, scan, open folder.
- `actions/playback.ts`: sessions, play/pause, next/previous, queue editing, volume, seek.
- `actions/tagEditor.ts`: draft edits, save, save & rename, apply online results, cover handling.
- `actions/onlineSearch.ts`: cancellable online search.
- `actions/navidrome.ts`: connect, bookmarks.

## Hooks

- `usePlaybackEngine`: wires the `<audio>` element, volume, EQ graph, source loading, autoplay and queue upkeep.
- `useLibrarySession`: snapshot restore/persist, auto-open default folder, startup Navidrome connection, remote covers.
- `useAutoEqualizer`, `useLyrics`, `useTrackTechnicalInfo`, `usePlaybackQueueView`, `useTagDraftSync`,
  `useDashboardDrag`, `useLibraryView`.

## Working without Tauri

`npm run dev` serves the UI in a normal browser with `api/mockAdapter` (sample tracks, a synthesized
tone for playback). Use it for UI work; use `npm run tauri:dev` before merging.

## Design system (`src/ui`)

- `tokens.css`: CSS custom properties (`--db-*`) for color, type, spacing, radii and motion. Light/dark
  comes from `data-theme` on `<html>`, the accent from `--db-accent`; both are mirrored from the
  settings store by `useApplyTheme()`. Fonts (Manrope, Syne) are bundled with the app via
  `@fontsource-variable`, so the desktop app never needs the network for them.
- `ui.css` + `components/`: `Button`, `IconButton`, `Chip`, `Segmented`, `ToggleGroup`, `Switch`, `Field`,
  `TextInput`, `Select`, `Slider`, `Badge`, `Cover`, `Pane`. All classes are prefixed `db-` so they
  coexist with the legacy `styles.css` until the screens are migrated.
- Accessibility is part of the components: icon buttons require a `label`, switches/radios/toggles use the
  right ARIA roles and states, focus rings use the accent, inputs are labelled by nesting in `Field`.
- Living reference: run `npm run dev` and open `http://localhost:5173/#styleguide` (dev builds only).
- Import from `src/ui` only (`import { Button } from "../ui"`), never from the component files.

## App shell (`src/shell`)

`AppShell` is the window frame: sidebar, header and player bar form one frosted "C" (a single
`db-glass` layer behind them) around the rounded content window, over a backdrop tinted by the current
cover. The screen is passed as `children`; an optional `inspector` slot sits inside the content window.

- `Sidebar`, `Header`, `PlayerBar`: read the stores directly; only `onTogglePlayPause` is passed in because the
  queue starts from the library list as filtered on screen.
- `Backdrop`: blurred cover with a crossfade between tracks; **Settings → Appearance** has the on/off switch
  and the 0–100 intensity (`dynamicBackground`, `backgroundIntensity` in `settingsStore`).
- `CommandPalette`: ⌘K / Ctrl+K (`useShellShortcuts`), combobox/listbox semantics, screens + commands + tracks.
- Immersive mode (`uiStore.isImmersive`): hides sidebar, header and player bar; the `<audio>` element stays mounted.
- `LegacyToolbar`: controls of the old screens (player layout, playlist actions, app links). Temporary; it goes
  away as each screen is redesigned.
- Window chrome: on macOS the Tauri window uses `titleBarStyle: Overlay` (see `tauri.conf.json`), the sidebar leaves
  room for the traffic lights and the header is a drag region (`core:window:allow-start-dragging`).
  Windows and Linux keep their native title bar.
