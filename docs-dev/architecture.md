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
