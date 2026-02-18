# MusicManager Web

Repository app + landing nella stessa codebase.

## App desktop/web
Stack:
- React + TypeScript + Vite
- Tauri 2 (`src-tauri`)
- Motore metadata/covers nativo in Rust (`lofty`), senza dipendenze Python per l'utente finale

Avvio web:
```bash
cd /Users/riccardomacis/Progetti/musicmanager/web
npm install
npm run dev
```

Avvio desktop (Tauri):
```bash
cd /Users/riccardomacis/Progetti/musicmanager/web
npm install
npm run tauri:dev
```

## Landing GitHub Pages
Landing statica per download release in:
- `/Users/riccardomacis/Progetti/musicmanager/web/docs/index.html`

File:
- `docs/index.html`
- `docs/styles.css`
- `docs/script.js`

Configurazione GitHub Pages (su questa repo):
1. apri `Settings > Pages`
2. in `Build and deployment`, seleziona `Deploy from a branch`
3. scegli branch `main` (o default) e cartella `/docs`
4. salva e usa l'URL Pages generato

Nota:
- su `*.github.io` la landing rileva automaticamente `owner/repo`
- con dominio custom, imposta manualmente lo slug in `docs/script.js`
