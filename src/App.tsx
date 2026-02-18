import { useMemo, useState } from "react";
import { Card } from "./components/Card";
import { createAdapter } from "./api/tauriAdapter";
import { mockAdapter } from "./api/mockAdapter";
import type { OnlineMatch, Track } from "./types";

const adapter = createAdapter(mockAdapter);

export function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [onlineResults, setOnlineResults] = useState<OnlineMatch[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchStatus, setSearchStatus] = useState("Pronto");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchAlbum, setSearchAlbum] = useState("");

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const selectedResult = onlineResults.find((r) => r.id === selectedResultId) ?? null;
  const folderCount = useMemo(() => countFoldersAndSubfolders(tracks, folderPath), [tracks, folderPath]);
  const librarySummary = useMemo(() => {
    if (!tracks.length) {
      return "Nessun file audio";
    }
    return `Trovati ${tracks.length} file audio in ${folderCount} cartelle/sottocartelle`;
  }, [tracks.length, folderCount]);

  const filteredTracks = useMemo(() => {
    if (!query.trim()) {
      return tracks;
    }
    const q = query.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.path.toLowerCase().includes(q)
    );
  }, [tracks, query]);

  async function handleScan() {
    setIsLoadingScan(true);
    try {
      const result = await adapter.selectFolderAndScan();
      if (!result.folderPath) {
        return;
      }
      setFolderPath(result.folderPath);
      setTracks(result.tracks);
      setSelectedTrackId(result.tracks[0]?.id ?? "");
      const firstTrack = result.tracks[0];
      if (firstTrack) {
        setSearchTitle(firstTrack.title);
        setSearchArtist(firstTrack.artist);
        setSearchAlbum(firstTrack.album);
      }
      setOnlineResults([]);
      setSelectedResultId("");
      setSearchStatus("Pronto");
    } catch (error) {
      setSearchStatus(`Errore scansione: ${String(error)}`);
    } finally {
      setIsLoadingScan(false);
    }
  }

  async function handleSearchOnline() {
    if (!selectedTrack) {
      return;
    }
    setIsLoadingSearch(true);
    setSearchStatus("Ricerca online in corso...");
    try {
      const result = await adapter.searchOnline({
        title: searchTitle,
        artist: searchArtist,
        album: searchAlbum,
      });
      setOnlineResults(result);
      setSelectedResultId("");
      setSearchStatus(
        `Ricerca: "${searchArtist} ${searchTitle} ${searchAlbum}". Risultati online: ${result.length}`
      );
    } catch (error) {
      setSearchStatus(`Errore ricerca online: ${String(error)}`);
    } finally {
      setIsLoadingSearch(false);
    }
  }

  function handleTrackFieldChange(field: keyof Track, value: string) {
    if (!selectedTrack) {
      return;
    }
    setTracks((prev) =>
      prev.map((track) => (track.id === selectedTrack.id ? { ...track, [field]: value } : track))
    );
  }

  async function handleSaveTrack() {
    if (!selectedTrack) {
      return;
    }
    try {
      await adapter.saveTrack(
        selectedTrack.id,
        selectedTrack.path,
        {
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          album: selectedTrack.album,
          tracknumber: selectedTrack.tracknumber,
          year: selectedTrack.year,
          genre: selectedTrack.genre,
        },
        selectedResult?.coverUrl
      );
    } catch (error) {
      setSearchStatus(`Errore salvataggio: ${String(error)}`);
    }
  }

  function handleApplyOnlineResult() {
    if (!selectedTrack || !selectedResult) {
      return;
    }
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== selectedTrack.id) {
          return track;
        }
        return {
          ...track,
          title: selectedResult.title,
          artist: selectedResult.artist,
          album: selectedResult.album,
          tracknumber: selectedResult.tracknumber ?? track.tracknumber,
          year: selectedResult.date.slice(0, 4),
          coverUrl: selectedResult.coverUrl,
          hasCover: Boolean(selectedResult.coverUrl),
        };
      })
    );
    setSearchStatus("Risultato applicato. Salva la traccia per confermare le modifiche.");
  }

  function handleInfoClick() {
    window.alert(
      "MusicManager\n\nOrganizza MP3/FLAC, cerca metadati online (MusicBrainz + iTunes) e salva tag/copertina sulla traccia selezionata."
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>MusicManager</h1>
        <button className="ghost-button" onClick={handleInfoClick}>Info</button>
      </header>

      <main className="two-col">
        <div className="col col-left">
          <Card
            title="File libreria"
            className="library-card"
            headerCenter={
              <span className="library-path">{folderPath ? folderPath : "Nessuna cartella selezionata"}</span>
            }
            headerRight={
              <button onClick={handleScan} disabled={isLoadingScan}>
                {isLoadingScan ? "Scansione..." : "Seleziona cartella"}
              </button>
            }
          >
            <div className="library-filter-row">
              <input
                className="input"
                placeholder="Filtra file..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="library-summary">{librarySummary}</span>
            </div>
            <ul className="track-list">
              {filteredTracks.map((track) => (
                <li key={track.id}>
                  <button
                    className={track.id === selectedTrackId ? "track-item active" : "track-item"}
                    onClick={() => {
                      setSelectedTrackId(track.id);
                      setSearchTitle(track.title);
                      setSearchArtist(track.artist);
                      setSearchAlbum(track.album);
                    }}
                  >
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={`Cover ${track.album || track.title}`} className="track-thumb" />
                    ) : (
                      <div className="track-thumb-placeholder">♪</div>
                    )}
                    <span className="track-text">
                      <strong>{track.title || "Senza titolo"}</strong>
                      <small>{track.artist || "Artista sconosciuto"}</small>
                      <small className="muted">{track.album || "Album sconosciuto"}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Dettagli traccia" className="details-card">
            <div className="detail-layout">
              <div className="detail-cover-wrap">
                {selectedTrack?.coverUrl ? (
                  <img src={selectedTrack.coverUrl} alt="Copertina traccia" className="cover detail-cover" />
                ) : (
                  <div className="cover-placeholder detail-cover">Nessuna copertina</div>
                )}
              </div>

              <div className="detail-form">
                <label>
                  Titolo
                  <input
                    className="input"
                    value={selectedTrack?.title ?? ""}
                    onChange={(e) => handleTrackFieldChange("title", e.target.value)}
                  />
                </label>
                <div className="detail-row-two">
                  <label>
                    Artista
                    <input
                      className="input"
                      value={selectedTrack?.artist ?? ""}
                      onChange={(e) => handleTrackFieldChange("artist", e.target.value)}
                    />
                  </label>
                  <label>
                    Album
                    <input
                      className="input"
                      value={selectedTrack?.album ?? ""}
                      onChange={(e) => handleTrackFieldChange("album", e.target.value)}
                    />
                  </label>
                </div>
                <div className="short-fields">
                  <label>
                    Track #
                    <input
                      className="input input-short"
                      value={selectedTrack?.tracknumber ?? ""}
                      onChange={(e) => handleTrackFieldChange("tracknumber", e.target.value)}
                    />
                  </label>
                  <label>
                    Anno
                    <input
                      className="input input-short"
                      value={selectedTrack?.year ?? ""}
                      onChange={(e) => handleTrackFieldChange("year", e.target.value)}
                    />
                  </label>
                  <label>
                    Genere
                    <input
                      className="input input-short"
                      value={selectedTrack?.genre ?? ""}
                      onChange={(e) => handleTrackFieldChange("genre", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <button onClick={handleSaveTrack} disabled={!selectedTrack}>
              Salva tag nella traccia
            </button>
          </Card>
        </div>

        <div className="col col-right">
          <Card title="Ricerca online" className="search-card" headerRight={<span className="search-status">{searchStatus}</span>}>
            <div className="form-grid">
              <label>
                Titolo query
                <input className="input" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} />
              </label>
              <label>
                Artista query
                <input className="input" value={searchArtist} onChange={(e) => setSearchArtist(e.target.value)} />
              </label>
              <label>
                Album query
                <input className="input" value={searchAlbum} onChange={(e) => setSearchAlbum(e.target.value)} />
              </label>
            </div>
            <div className="actions-row">
              <button onClick={handleSearchOnline} disabled={!selectedTrack || isLoadingSearch}>
                {isLoadingSearch ? "Ricerca..." : "Cerca online"}
              </button>
              <button onClick={handleApplyOnlineResult} disabled={!selectedResult || !selectedTrack}>
                Applica risultato selezionato
              </button>
            </div>

            <div className="results-grid">
              {onlineResults.map((result) => (
                <article
                  key={result.id}
                  className={result.id === selectedResultId ? "result-card selected" : "result-card"}
                  onClick={() => setSelectedResultId(result.id)}
                >
                  <div className="result-row">
                    {result.coverUrl ? (
                      <img src={result.coverUrl} alt={`Copertina ${result.album}`} className="result-cover" />
                    ) : (
                      <div className="result-cover-placeholder">No cover</div>
                    )}
                    <div className="result-content">
                      <h3>{result.artist} - {result.title}</h3>
                      <p>Album: {result.album}</p>
                      <p>Data: {result.date || "n/d"}</p>
                      <p className="muted">Fonte: {result.source ?? "N/D"}</p>
                    </div>
                  </div>
                </article>
              ))}
              {!onlineResults.length && <p className="muted">Nessun risultato. Avvia la ricerca online.</p>}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function countFoldersAndSubfolders(items: Track[], rootPath: string): number {
  if (!items.length) {
    return 0;
  }

  const root = normalizePath(rootPath);
  const folders = new Set<string>();

  for (const track of items) {
    const normalizedTrackPath = normalizePath(track.path);
    const lastSlash = normalizedTrackPath.lastIndexOf("/");
    if (lastSlash <= 0) {
      continue;
    }

    const parent = normalizedTrackPath.slice(0, lastSlash);
    if (root && parent.startsWith(root)) {
      const relative = parent.slice(root.length).replace(/^\/+/, "");
      if (!relative) {
        continue;
      }

      const segments = relative.split("/").filter(Boolean);
      let composed = "";
      for (const segment of segments) {
        composed = composed ? `${composed}/${segment}` : segment;
        folders.add(composed);
      }
      continue;
    }

    folders.add(parent);
  }

  return folders.size;
}
