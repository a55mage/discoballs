# MusicManager Web (nuova base)

Questa e la nuova versione web app, pensata per essere incapsulata come desktop app (consiglio: Tauri 2).

## Stack
- React + TypeScript + Vite
- Adapter layer per collegare backend desktop (scan file, tagging, ricerca online)

## Avvio
```bash
cd /Users/riccardomacis/Progetti/musicmanager/web
npm install
npm run dev
```

## Avvio desktop (Tauri)
```bash
cd /Users/riccardomacis/Progetti/musicmanager/web
npm install
npm run tauri:dev
```

## Stato attuale
- UI completa a 2 colonne con card
- Colonna sinistra:
  - card lista file
  - card dettaglio traccia editabile con copertina
- Colonna destra:
  - card ricerca online con query editabile (titolo/artista/album)
  - risultati in card selezionabili con preview copertina per risultato
- Backend desktop Tauri disponibile in `src-tauri`:
  - selezione cartella nativa
  - scansione file `.mp3`/`.flac`
  - ricerca online aggregata MusicBrainz + iTunes
  - salvataggio tag/coperina reale tramite bridge Python (mutagen)

## Nota importante
- In ambiente browser puro resta attivo il fallback `mockAdapter`.
