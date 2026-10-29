# Manual regression checklist (v2.0)

Run in `npm run tauri:dev` (real backend) before every release.
Items marked (web) can also be checked with `npm run dev` and the mock adapter.
Automated: `npm test`, `npx tsc --noEmit`, `cargo test` in `src-tauri/`.

## Shell and window
- [ ] The logo sits right next to the section title in the top bar (app name, no section title); clicking it rotates the accent (web)
- [ ] "Open folder" and "Connect server" are two buttons in the top bar and do what they say (web)
- [ ] Once a server is connected, the server button shows its name and a green dot; a local folder resets it (web)
- [ ] The sidebar collapses to icons (button at its foot, or the palette) and the choice persists; playlists keep their covers (web)
- [ ] Below 960px the sidebar is always icons-only and its toggle is hidden (web)
- [ ] The top bar, sidebar and player bar read as one frosted "C" around the content; no seams (web)
- [ ] macOS: traffic lights sit on the header row, centred on it, before the logo; the header drags the window; double-click toggles maximize
- [ ] Windows/Linux: the glass blur renders (WebView2 / WebKitGTK); text stays readable without it
- [ ] Minimum window size (900×600) keeps everything usable
- [ ] ⌘/Ctrl+K opens the command palette; commands, track search and Esc work (web)
- [ ] Light/dark toggle in the header persists; accent colors apply everywhere (web)
- [ ] Dynamic background follows the playing cover; off and intensity in Settings → Appearance (web)

## Media keys and system controls
- [ ] macOS: play/pause, next and previous keys (and AirPods / Control Center) control the app even when it is in the background; Now Playing shows title, artist, album and position
- [ ] Windows: the media keys work; the Windows media flyout shows the track
- [ ] One key press never toggles twice

## Start
- [ ] The app opens on the Library (after updating, once, even if the Tag Editor was saved); Settings → Start on still works

## Library
- [ ] Open folder via picker; tracks, covers and counts appear
- [ ] Auto-open default folder on launch (setting on/off)
- [ ] The view switch and the filter box share one toolbar row (web)
- [ ] Two list styles (list, grid of covers); the choice persists (web)
- [ ] Table: sort by every column header, both directions; both styles also sort from the toolbar select and arrow (web)
- [ ] The zoom-out / zoom-in buttons resize rows (list) or covers (grid), switch off at their limits, and persist; the smallest rows drop the artist line (web)
- [ ] Tracks / Albums / Artists / Folders are icon buttons with tooltips and accessible names (web)
- [ ] "Added" column shows the file creation date (server date for Navidrome); sorting by it starts newest first
- [ ] Grid: hover play/select/favorite, arrow keys move by card, Enter plays, selection and inspector work (web)
- [ ] The sidebar Favorites shortcut shows a removable "Favorites" chip in the toolbar (web)
- [ ] Large library (1000+ tracks) scrolls smoothly; list density setting works
- [ ] Keyboard: arrows and PageUp/PageDown move the cursor, Shift extends, ⌘/Ctrl+A selects all, Enter plays, Home/End (web)
- [ ] Inspector: details, play, edit tags, queue, add to playlist, favorite; no star rating (web)
- [ ] Multi-select shows the batch editor; apply writes tags to every selected file; Undo reverts
- [ ] Auto-number tracks in the batch editor follows list order
- [ ] "Tags from file name…" previews every file, writes only what you confirm; Undo reverts
- [ ] "Match album online…": search, pick an edition, preview, apply; with and without "Replace covers"; Undo
- [ ] Review duplicates: suggested copy, "Select the others", "Not duplicates"; nothing is ever deleted

- [ ] Tag Editor: the file list sorts by Folder, Recently added, Title or Artist; the choice persists
- [ ] Tag Editor: the play button on a file's cover plays it (queue = the list as shown) and pauses the one playing
- [ ] Command palette: choosing a track plays it right away
## Tag editor
- [ ] File list search (title, artist, album, file name) and the "Ignore other formats" switch: FLAC+MP3 of one song stop counting as duplicates (also in the review dialog)
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
- [ ] Synced lyrics: the current line is the largest; changing line glides up without lines overlapping; another track jumps straight to its line
- [ ] Cover / Lyrics / Visualizer toggles combine freely; the choice persists
- [ ] Synced lyrics follow playback; plain lyrics when unsynced; missing-lyrics message
- [ ] Visualizer dropdown: Wave, Radial, Spectrum, Ridges, Bloom, Tunnel, Turntable; no card around them; they idle gently before playback and react to music
- [ ] Visualizer colours come from the cover (accent shades when the cover is dull, missing or a remote Navidrome cover); beats flash Spectrum, Radial, Bloom and Tunnel
- [ ] Visualizers read well in light and dark mode
- [ ] The visualizer fills the free space (the whole stage when shown alone) and its edges fade out, with no hard cut
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

## Beatmap lab (hidden)
- [ ] Not in the sidebar; the command palette opens it when the search contains "beatmap"
- [ ] Opening the lab analyses the playing or selected track; a second visit or a restart loads it from the cache
- [ ] Local MP3, M4A, FLAC, OGG and WAV files analyse; Navidrome songs too (downloaded as MP3)
- [ ] Clicks on beats land on the pulse of rhythmic music; low / mid / high onsets follow kick, snare and hats
- [ ] Zoom, wheel scroll, overview click and click-to-seek work; the view follows playback

## Navidrome
- [ ] Save a server bookmark; connect; library loads; connect on open; delete bookmark
- [ ] The first connection after launching the app succeeds (connection errors are retried twice; wrong credentials are not)
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
