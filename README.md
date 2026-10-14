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
- Landing page: static HTML/CSS/JS in `docs/` for GitHub Pages

## Core App Functions
- Library:
  - Scan a local folder recursively; read tags, embedded covers and technical info
  - Browse by tracks, albums, artists or folders; list, compact list or a grid of covers; sort, filter, favorites and star ratings
  - Library health filters: missing cover, missing tags, duplicates (reviewed, never deleted)
- Tagging:
  - Edit title, artist, album, track number, year, genre and cover art; save to the file
  - Batch edit many tracks, read tags from file names, auto-number tracks
  - Online lookup (MusicBrainz, iTunes) per track, or match a whole album to a MusicBrainz release
  - Every change is recorded; undo a single edit or a whole batch
  - Rename files with configurable field order and separator, with a live preview
- Playback:
  - Now Playing with cover, lyrics and visualizer, alone or combined, plus a full-window mode
  - Queue, playlists with drag-and-drop, Equalizer Studio, Auto EQ by genre, ReplayGain volume normalization
  - Navidrome (Subsonic) servers
- Interface:
  - One frosted frame (sidebar, header, player bar) around the content, light and dark themes
  - Dynamic background tinted by the current cover (optional), accent palette, command palette (Cmd/Ctrl+K)

## Repository Structure
- `src/`: React application
- `src-tauri/`: Tauri + Rust backend commands
- `docs/`: GitHub Pages landing and release download page
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
   - any user-visible version string in UI/docs
2. Push changes to `main`.
3. Create and push a tag in `vX.Y.Z` format (example: `v2.0.0`):
```bash
git tag v2.0.0
git push origin v2.0.0
```
4. GitHub Action `.github/workflows/tauri-build.yml` will:
   - build bundles for macOS, Windows, Linux
   - verify tag matches app version
   - upload artifacts and attach bundles to the GitHub Release
5. Update `docs/index.html` download links to the new release assets.

## Open Source
DiscoBalls is open-source. Contributions, issue reports, and feature suggestions are welcome.
