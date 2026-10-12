# Manual regression checklist

Run in `npm run tauri:dev` (real backend) before merging any redesign phase.
Items marked (web) can also be checked with `npm run dev` + the mock adapter.

## Library
- [ ] Open folder via picker; tracks, cover art and counts appear
- [ ] Auto-open default folder on launch (setting on/off)
- [ ] Filter by text; sort by title / artist / release / added, both directions
- [ ] Compact list, card view, folder (file system) view, artists and albums browsing (web)
- [ ] Large library (1000+ tracks) scrolls smoothly (virtualization)

## Tagging
- [ ] Select a track: fields, cover, technical badge (format, bitrate, duration, size) (web)
- [ ] Edit title/artist/album/track/year/genre; unsaved indicator appears
- [ ] Save tags writes to the file (re-scan to confirm)
- [ ] Replace cover from file; remove cover; save with cover
- [ ] Rename preview follows the configured fields and separator
- [ ] Save & rename; rename only; selection follows the new path
- [ ] Open track in file manager

## Online search
- [ ] Search by title/artist/album; results from MusicBrainz and iTunes
- [ ] Best match flagged; results sorted by score/date
- [ ] Apply, apply cover only, apply & save from a result card
- [ ] Cancel a running search

## Playback
- [ ] Play/pause, next/prev, seek, volume, mute
- [ ] Shuffle and repeat-track
- [ ] Play from a library cover click; queue built from the library order
- [ ] Queue: history, upcoming, remove item, clear, "load more" pagination
- [ ] Synced lyrics follow playback; plain lyrics when unsynced; missing lyrics message
- [ ] Visualizer presets: Scope, Alchemy, XP Bars, Turntable
- [ ] Equalizer: presets, band changes, preamp, wet mix, create/rename/delete/save preset, reset
- [ ] Auto EQ by genre and genre mapping; startup EQ preset
- [ ] Audio error message when a file cannot be decoded

## Playlists
- [ ] Create, rename, delete; names stay unique
- [ ] Drag tracks from the library into the playlist; reorder by drag; remove
- [ ] Play playlist (with and without shuffle)
- [ ] Playlists survive an app restart

## Navidrome
- [ ] Save a server bookmark; connect; library loads
- [ ] Connect on open; delete bookmark
- [ ] Remote tracks play; remote covers load lazily

## Settings and persistence
- [ ] Light/dark mode persists
- [ ] Accent colors: add, edit, remove, reset, rotate on launch
- [ ] Startup screen setting is honored
- [ ] Player column visibility and visualizer preset persist
- [ ] External links (website, developer, donate) open in the browser
