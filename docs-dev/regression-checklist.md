# Manual regression checklist (v2.0)

Run in `npm run tauri:dev` (real backend) before every release.
Items marked (web) can also be checked with `npm run dev` and the mock adapter.
Automated: `npm test`, `npx tsc --noEmit`, `cargo test` in `src-tauri/`.

## Shell and window
- [ ] The logo sits at the left of the top bar (no app name); clicking it rotates the accent (web)
- [ ] "Open folder" and "Connect server" are two buttons in the top bar and do what they say (web)
- [ ] The top bar, sidebar and player bar read as one frosted "C" around the content; no seams (web)
- [ ] macOS: traffic lights sit in the sidebar corner; the header drags the window; double-click toggles maximize
- [ ] Windows/Linux: the glass blur renders (WebView2 / WebKitGTK); text stays readable without it
- [ ] Minimum window size (900×600) keeps everything usable
- [ ] ⌘/Ctrl+K opens the command palette; commands, track search and Esc work (web)
- [ ] Light/dark toggle in the header persists; accent colors apply everywhere (web)
- [ ] Dynamic background follows the playing cover; off and intensity in Settings → Appearance (web)

## Library
- [ ] Open folder via picker; tracks, covers and counts appear
- [ ] Auto-open default folder on launch (setting on/off)
- [ ] Tabs Tracks / Albums / Artists / Folders and the filter box share one toolbar row (web)
- [ ] Three list styles (comfortable rows, compact rows, grid of covers); the choice persists (web)
- [ ] Table: sort by every column header, both directions; grid: sort from the toolbar select and arrow (web)
- [ ] Grid: hover play/select/favorite, arrow keys move by card, Enter plays, selection and inspector work (web)
- [ ] The sidebar Favorites shortcut shows a removable "Favorites" chip in the toolbar (web)
- [ ] Large library (1000+ tracks) scrolls smoothly; list density setting works
- [ ] Keyboard: arrows and PageUp/PageDown move the cursor, Shift extends, ⌘/Ctrl+A selects all, Enter plays, Home/End (web)
- [ ] Inspector: details, play, edit tags, queue, add to playlist, rating, favorite (web)
- [ ] Multi-select shows the batch editor; apply writes tags to every selected file; Undo reverts
- [ ] Auto-number tracks in the batch editor follows list order
- [ ] "Tags from file name…" previews every file, writes only what you confirm; Undo reverts
- [ ] "Match album online…": search, pick an edition, preview, apply; with and without "Replace covers"; Undo
- [ ] Review duplicates: suggested copy, "Select the others", "Not duplicates"; nothing is ever deleted

## Tag editor
- [ ] File list filters: All, Missing cover, Missing tags, Duplicates (with counts) and "Review duplicates…" (web)
- [ ] Select a file: fields, cover, technical badge (format, bitrate, duration, size) (web)
- [ ] Edit fields: changed fields are marked, the footer lists unsaved changes
- [ ] Save tags writes to the file (rescan to confirm); Revert discards the draft
- [ ] Replace cover from file; remove cover; save with cover
- [ ] Rename preview follows the configured fields and separator; Save & rename; Rename file only
- [ ] After a rename the selection, queue, playlists, favorites and history follow the new path
- [ ] "Fill from file name…" fills the draft without saving
- [ ] History dialog lists changes grouped by batch; undo of one entry and of a batch
- [ ] Undo toast appears after every save; "Undo last tag change" in the palette works
- [ ] Online search (MusicBrainz + iTunes): best match flagged, apply, cover only, apply & save, cancel

## Now Playing and playback
- [ ] Play/pause, next/previous, seek, volume, mute; shuffle and repeat
- [ ] Cover / Lyrics / Visualizer toggles combine freely; the choice persists
- [ ] Synced lyrics follow playback; plain lyrics when unsynced; missing-lyrics message
- [ ] Visualizer presets: Scope, Alchemy, XP Bars, Turntable
- [ ] Full window mode: Esc or the exit button returns; playback continues
- [ ] Queue panel: history, upcoming, remove, clear, load more
- [ ] Equalizer Studio: presets, bands, preamp, wet mix, create/rename/delete/save preset, reset
- [ ] Auto EQ by genre; genre mapping; startup EQ preset
- [ ] Normalize volume: tracks with ReplayGain tags play at similar loudness; off restores original
- [ ] Audio error message when a file cannot be decoded

## Playlists and favorites
- [ ] Create, rename, delete; names stay unique
- [ ] Drag tracks from the picker or library into a playlist; reorder by drag; remove
- [ ] Play playlist (in order and shuffled); a playlist survives restart
- [ ] Favorites playlist updates from the heart (library, player bar, palette); star ratings persist
- [ ] Missing tracks in a playlist are shown as such and can be removed

## Navidrome
- [ ] Save a server bookmark; connect; library loads; connect on open; delete bookmark
- [ ] Remote tracks play; remote covers load lazily; writing tags to remote tracks is refused politely

## Settings and persistence
- [ ] Start screen setting honored; every setting survives restart
- [ ] Accent colors: add, edit, remove, reset, rotate on launch
- [ ] External links (website, developer, donate) open in the browser
- [ ] Data from v1.x (`musicmanager-*` keys: playlists, accents, EQ presets, bookmarks) still loads

## Accessibility
- [ ] Everything reachable and operable by keyboard; focus ring always visible
- [ ] Screen reader names on icon buttons, grid rows, switches and dialogs
- [ ] OS "reduce motion" calms animations; contrast holds in light and dark (axe: 0 violations)
