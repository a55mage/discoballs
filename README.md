# DiscoBalls

DiscoBalls is an open-source desktop music metadata manager built with a modern web UI and a native Rust backend.

## Project Overview
DiscoBalls helps you manage local audio libraries (MP3/FLAC and other supported formats), search metadata online, and write tags plus cover art directly to files.

## Tech Stack
- Frontend: React + TypeScript + Vite
- Desktop shell: Tauri 2
- Native backend: Rust
- Audio metadata engine: `lofty` (Rust)
- Online metadata sources: MusicBrainz, iTunes
- Landing page: static HTML/CSS/JS in `docs/` for GitHub Pages

## Core App Functions
- Library scan:
  - Select a local music folder
  - Recursively scan supported audio files
  - Read and display existing tags and embedded cover art
- Track editing:
  - Edit title, artist, album, track number, year, genre
  - Save tags directly to the selected file
  - Save tags and optional cover art in one action
- Online lookup:
  - Search metadata by title/artist/album
  - Preview multiple online matches
  - Apply metadata to the selected track
  - Apply and save directly from each result card
- File renaming:
  - Rename using configurable field order
  - Custom separator support
  - Preview output filename before rename
- UI utilities:
  - Compact and card library views
  - Accent color cycling
  - Light/Dark mode toggle with persisted preference

## Repository Structure
- `src/`: React application
- `src-tauri/`: Tauri + Rust backend commands
- `docs/`: GitHub Pages landing and release download page

## Run Desktop (Tauri)
```bash
cd /Users/riccardomacis/Progetti/musicmanager/web
npm install
npm run tauri:dev
```

## Build
```bash
npm run build
npm run tauri:build
```

## Open Source
DiscoBalls is open-source. Contributions, issue reports, and feature suggestions are welcome.
