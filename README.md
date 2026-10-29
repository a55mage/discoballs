# DiscoBalls

DiscoBalls is an open-source desktop music metadata manager built with a modern web UI and a native Rust backend.

## Project Overview
DiscoBalls helps you manage local audio libraries (MP3/FLAC and other supported formats), search metadata online, and write tags plus cover art directly to files.

## Tech Stack
- Frontend: React + TypeScript + Vite
- Desktop shell: Tauri 2
- Native backend: Rust
- Audio metadata engine: `lofty` (Rust)
- State: Zustand; design system in `src/ui`
- Tests: Vitest + Testing Library (frontend), `cargo test` (backend)
- Online metadata sources: MusicBrainz, iTunes
- Website: static HTML/CSS/JS on the `gh-pages` branch (GitHub Pages)

## Core App Functions
- Library:
  - Scan a local folder recursively; read tags, embedded covers and technical info
  - Browse by tracks, albums, artists or folders; a list or a grid of covers with zoom; sort (also by date added), filter, favorites and star ratings
  - Library health filters: missing cover, missing tags, duplicates (reviewed, never deleted)
- Tagging:
  - Edit title, artist, album, track number, year, genre and cover art; save to the file
  - Batch edit many tracks, read tags from file names, auto-number tracks
  - Online lookup (MusicBrainz, iTunes) per track, or match a whole album to a MusicBrainz release
  - Every change is recorded; undo a single edit or a whole batch
  - Rename files with configurable field order and separator, with a live preview
  - File list sorted by folder, recently added, title or artist
- Playback:
  - Now Playing with cover, synced lyrics and seven visualizers coloured by the cover, alone or combined, plus a full-window mode
  - Media keys and system controls (macOS Now Playing, Windows media flyout)
  - Queue, playlists with drag-and-drop, Equalizer Studio, Auto EQ by genre, ReplayGain volume normalization
  - Navidrome (Subsonic) servers
- Interface:
  - One frosted frame (sidebar, header, player bar) around the content, light and dark themes, a sidebar that collapses to icons
  - Dynamic background tinted by the current cover (optional), accent palette, command palette (Cmd/Ctrl+K)

## Repository Structure
- `src/`: React application
- `src-tauri/`: Tauri + Rust backend commands
- `RELEASE_NOTES.md`: text of the next GitHub release
- `gh-pages` branch: the website (landing and download page)
- `docs-dev/`: architecture notes and the manual regression checklist

## Run Desktop (Tauri)
```bash
npm install
npm run tauri:dev
```

## Test
```bash
npm test
npx tsc --noEmit
(cd src-tauri && cargo test)
```

## Build
```bash
npm run build
npm run tauri:build
```

## Release on GitHub
1. Bump versions consistently:
   - `package.json` / `package-lock.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
   - any user-visible version string in the UI (the app reads it from `package.json`)
2. Write the release text in `RELEASE_NOTES.md`, then push changes to `main`.
3. Create and push a tag in `vX.Y.Z` format (example: `v2.0.0`):
```bash
git tag v2.0.0
git push origin v2.0.0
```
4. GitHub Action `.github/workflows/tauri-build.yml` will:
   - build bundles for macOS, Windows, Linux
   - verify tag matches app version
   - upload artifacts and attach bundles to the GitHub Release
5. On the `gh-pages` branch, update the version badge and download links in `index.html`, then push it.

## Open Source
DiscoBalls is open-source. Contributions, issue reports, and feature suggestions are welcome.
