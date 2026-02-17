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
  const [statusMessage, setStatusMessage] = useState("Pronto");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchAlbum, setSearchAlbum] = useState("");

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const selectedResult = onlineResults.find((r) => r.id === selectedResultId) ?? null;

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
    setStatusMessage("Scansione cartella in corso...");
    try {
      const result = await adapter.selectFolderAndScan();
      if (!result.folderPath) {
        setStatusMessage("Selezione cartella annullata");
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
      setStatusMessage(`Trovati ${result.tracks.length} file audio`);
    } catch (error) {
      setStatusMessage(`Errore scansione: ${String(error)}`);
    } finally {
      setIsLoadingScan(false);
    }
  }

  async function handleSearchOnline() {
    if (!selectedTrack) {
      return;
    }
    setIsLoadingSearch(true);
    setStatusMessage("Ricerca online in corso...");
    try {
      const result = await adapter.searchOnline({
        title: searchTitle,
        artist: searchArtist,
        album: searchAlbum,
      });
      setOnlineResults(result);
      setSelectedResultId("");
      setStatusMessage(
        `Ricerca: "${searchArtist} ${searchTitle} ${searchAlbum}". Risultati online: ${result.length}`
      );
    } catch (error) {
      setStatusMessage(`Errore ricerca online: ${String(error)}`);
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
      setStatusMessage("Tag salvati nella traccia");
    } catch (error) {
      setStatusMessage(`Errore salvataggio: ${String(error)}`);
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
    setStatusMessage("Risultato online applicato ai campi traccia");
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>MusicManager</h1>
          <p className="muted">{folderPath ? `Cartella: ${folderPath}` : "Nessuna cartella selezionata"}</p>
          <p className="muted">{statusMessage}</p>
        </div>
        <button onClick={handleScan} disabled={isLoadingScan}>
          {isLoadingScan ? "Scansione..." : "Seleziona cartella"}
        </button>
      </header>

      <main className="two-col">
        <div className="col">
          <Card title="File libreria">
            <input
              className="input"
              placeholder="Filtra file..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
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
                    <span>{track.title || "Senza titolo"}</span>
                    <small>{track.artist || "Artista sconosciuto"}</small>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Dettagli traccia">
            <div className="cover-wrap">
              {selectedTrack?.coverUrl ? (
                <img src={selectedTrack.coverUrl} alt="Copertina traccia" className="cover" />
              ) : (
                <div className="cover-placeholder">Nessuna copertina</div>
              )}
            </div>

            <div className="form-grid">
              <label>
                Titolo
                <input
                  className="input"
                  value={selectedTrack?.title ?? ""}
                  onChange={(e) => handleTrackFieldChange("title", e.target.value)}
                />
              </label>
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
              <label>
                Track #
                <input
                  className="input"
                  value={selectedTrack?.tracknumber ?? ""}
                  onChange={(e) => handleTrackFieldChange("tracknumber", e.target.value)}
                />
              </label>
              <label>
                Anno
                <input
                  className="input"
                  value={selectedTrack?.year ?? ""}
                  onChange={(e) => handleTrackFieldChange("year", e.target.value)}
                />
              </label>
              <label>
                Genere
                <input
                  className="input"
                  value={selectedTrack?.genre ?? ""}
                  onChange={(e) => handleTrackFieldChange("genre", e.target.value)}
                />
              </label>
            </div>

            <button onClick={handleSaveTrack} disabled={!selectedTrack}>
              Salva tag nella traccia
            </button>
          </Card>
        </div>

        <div className="col">
          <Card title="Ricerca online">
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

            <div className="cover-wrap">
              {selectedResult?.coverUrl ? (
                <img src={selectedResult.coverUrl} alt="Copertina risultato" className="cover" />
              ) : (
                <div className="cover-placeholder">Nessuna copertina risultato</div>
              )}
            </div>

            <div className="results-grid">
              {onlineResults.map((result) => (
                <article
                  key={result.id}
                  className={result.id === selectedResultId ? "result-card selected" : "result-card"}
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
                      <button onClick={() => setSelectedResultId(result.id)}>Seleziona</button>
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
