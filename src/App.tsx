import { type SVGProps, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./components/Card";
import { createAdapter } from "./api/tauriAdapter";
import { mockAdapter } from "./api/mockAdapter";
import type { OnlineMatch, RenameField, Track } from "./types";

const adapter = createAdapter(mockAdapter);
const RENAME_FIELD_OPTIONS: Array<{ key: RenameField; label: string }> = [
  { key: "tracknumber", label: "Numero traccia" },
  { key: "artist", label: "Artista" },
  { key: "album", label: "Album" },
  { key: "title", label: "Titolo" },
  { key: "year", label: "Anno" },
  { key: "genre", label: "Genere" },
];

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props} />
  );
}

const IconInfo = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconFolder = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </IconBase>
);

const IconSave = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h8V4" />
    <rect x="8" y="13" width="8" height="6" />
  </IconBase>
);

const IconRename = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </IconBase>
);

const IconSettings = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconSearch = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="6" />
    <line x1="16" y1="16" x2="21" y2="21" />
  </IconBase>
);

const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="5 12 10 17 19 8" />
  </IconBase>
);

const IconClose = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </IconBase>
);

const IconArrowUp = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="6 14 12 8 18 14" />
  </IconBase>
);

const IconArrowDown = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="6 10 12 16 18 10" />
  </IconBase>
);

const IconPlay = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="8 6 18 12 8 18" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconPause = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="7" y="6" width="4" height="12" fill="currentColor" stroke="none" />
    <rect x="13" y="6" width="4" height="12" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconPrev = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="7" y1="6" x2="7" y2="18" />
    <polygon points="17 6 9 12 17 18" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconNext = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="17" y1="6" x2="17" y2="18" />
    <polygon points="7 6 15 12 7 18" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconVolume = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="4 10 8 10 12 6 12 18 8 14 4 14" />
    <path d="M15 9a4 4 0 0 1 0 6" />
    <path d="M17.5 7a7 7 0 0 1 0 10" />
  </IconBase>
);

const IconMute = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="4 10 8 10 12 6 12 18 8 14 4 14" />
    <line x1="16" y1="9" x2="21" y2="15" />
    <line x1="21" y1="9" x2="16" y2="15" />
  </IconBase>
);

export function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const [showRenameSettings, setShowRenameSettings] = useState(false);
  const [renameFields, setRenameFields] = useState<RenameField[]>(["tracknumber", "artist", "title"]);
  const [renameSeparator, setRenameSeparator] = useState(" - ");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioSrc, setAudioSrc] = useState("");
  const [audioError, setAudioError] = useState("");

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const selectedResult = onlineResults.find((r) => r.id === selectedResultId) ?? null;
  const selectedFileName = selectedTrack ? getFileName(selectedTrack.path) : "Nessun file";
  const folderCount = useMemo(() => countFoldersAndSubfolders(tracks, folderPath), [tracks, folderPath]);
  const librarySummary = useMemo(() => {
    if (!tracks.length) {
      return "Nessun file audio";
    }
    return `Trovati ${tracks.length} file audio in ${folderCount} cartelle/sottocartelle`;
  }, [tracks.length, folderCount]);
  const renamePreview = useMemo(() => {
    if (!selectedTrack) {
      return "";
    }
    return buildRenamePreview(selectedTrack, renameFields, renameSeparator);
  }, [selectedTrack, renameFields, renameSeparator]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setAudioError("Riproduzione non disponibile per questa traccia.");

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    let cancelled = false;
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const path = selectedTrack?.path;
    if (!path) {
      setAudioSrc("");
      setAudioError("");
      return;
    }

    (async () => {
      try {
        const src = await adapter.getAudioSource(path);
        if (cancelled) {
          return;
        }
        setAudioSrc(src);
        setAudioError(src ? "" : "Riproduzione non disponibile per questa traccia.");
      } catch {
        if (cancelled) {
          return;
        }
        setAudioSrc("");
        setAudioError("Riproduzione non disponibile per questa traccia.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTrack?.path]);

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
  const selectedTrackIndex = useMemo(
    () => filteredTracks.findIndex((t) => t.id === selectedTrackId),
    [filteredTracks, selectedTrackId]
  );

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
      const result = await adapter.saveTrack(
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
      updateTrackPathAfterSave(selectedTrack.id, result.path);
      setSearchStatus("Tag salvati nella traccia");
    } catch (error) {
      setSearchStatus(`Errore salvataggio: ${String(error)}`);
    }
  }

  async function handleSaveAndRenameTrack() {
    if (!selectedTrack) {
      return;
    }
    try {
      const result = await adapter.saveTrack(
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
        selectedResult?.coverUrl,
        {
          fields: renameFields,
          separator: renameSeparator,
        }
      );
      updateTrackPathAfterSave(selectedTrack.id, result.path);
      setSearchStatus("Tag salvati e file rinominato");
    } catch (error) {
      setSearchStatus(`Errore salvataggio/rinomina: ${String(error)}`);
    }
  }

  async function handleRenameOnlyTrack() {
    if (!selectedTrack) {
      return;
    }
    try {
      const result = await adapter.renameTrack(
        selectedTrack.path,
        {
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          album: selectedTrack.album,
          tracknumber: selectedTrack.tracknumber,
          year: selectedTrack.year,
          genre: selectedTrack.genre,
        },
        {
          fields: renameFields,
          separator: renameSeparator,
        }
      );
      updateTrackPathAfterSave(selectedTrack.id, result.path);
      setSearchStatus("File rinominato");
    } catch (error) {
      setSearchStatus(`Errore rinomina file: ${String(error)}`);
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

  async function handleTogglePlayPause() {
    const audio = audioRef.current;
    if (!audio || !audioSrc) {
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
      setAudioError("");
    } catch {
      setAudioError("Impossibile avviare la riproduzione in questo ambiente.");
      setIsPlaying(false);
    }
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = value;
    setCurrentTime(value);
  }

  function handlePrevTrack() {
    if (selectedTrackIndex <= 0) {
      return;
    }
    const prev = filteredTracks[selectedTrackIndex - 1];
    if (prev) {
      setSelectedTrackId(prev.id);
      setSearchTitle(prev.title);
      setSearchArtist(prev.artist);
      setSearchAlbum(prev.album);
    }
  }

  function handleNextTrack() {
    if (selectedTrackIndex < 0 || selectedTrackIndex >= filteredTracks.length - 1) {
      return;
    }
    const next = filteredTracks[selectedTrackIndex + 1];
    if (next) {
      setSelectedTrackId(next.id);
      setSearchTitle(next.title);
      setSearchArtist(next.artist);
      setSearchAlbum(next.album);
    }
  }

  function updateTrackPathAfterSave(currentId: string, newPath: string) {
    if (!newPath) {
      return;
    }

    setTracks((prev) =>
      prev.map((track) => (track.id === currentId ? { ...track, id: newPath, path: newPath } : track))
    );
    setSelectedTrackId(newPath);
  }

  function toggleRenameField(field: RenameField) {
    setRenameFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((f) => f !== field);
      }
      return [...prev, field];
    });
  }

  function moveRenameField(field: RenameField, direction: -1 | 1) {
    setRenameFields((prev) => {
      const index = prev.indexOf(field);
      if (index < 0) {
        return prev;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>MusicManager</h1>
        <div className="top-player">
          <audio ref={audioRef} src={audioSrc} preload="metadata" />
          <button className="ghost-button player-btn" onClick={handlePrevTrack} disabled={selectedTrackIndex <= 0}>
            <span className="btn-content"><IconPrev className="btn-icon" /></span>
          </button>
          <button className="player-btn" onClick={handleTogglePlayPause} disabled={!audioSrc}>
            <span className="btn-content">
              {isPlaying ? <IconPause className="btn-icon" /> : <IconPlay className="btn-icon" />}
            </span>
          </button>
          <button
            className="ghost-button player-btn"
            onClick={handleNextTrack}
            disabled={selectedTrackIndex < 0 || selectedTrackIndex >= filteredTracks.length - 1}
          >
            <span className="btn-content"><IconNext className="btn-icon" /></span>
          </button>
          <div className="player-progress">
            <span className="player-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0)}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              disabled={!audioSrc || duration <= 0}
            />
            <span className="player-time">{formatTime(duration)}</span>
          </div>
          <div className="player-volume">
            <button className="ghost-button player-btn" onClick={() => setIsMuted((v) => !v)}>
              <span className="btn-content">
                {isMuted || volume === 0 ? <IconMute className="btn-icon" /> : <IconVolume className="btn-icon" />}
              </span>
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>
          {audioError && <span className="player-error">{audioError}</span>}
        </div>
        <button className="ghost-button" onClick={handleInfoClick}>
          <span className="btn-content"><IconInfo className="btn-icon" />Info</span>
        </button>
      </header>

      <main className="two-col">
        <div className="col col-left">
          <Card
            title="File libreria"
            className="library-card"
            headerAfterTitle={
              <span className="library-path">{folderPath ? folderPath : "Nessuna cartella selezionata"}</span>
            }
            headerRight={
              <button onClick={handleScan} disabled={isLoadingScan}>
                <span className="btn-content"><IconFolder className="btn-icon" />{isLoadingScan ? "Scansione..." : "Seleziona cartella"}</span>
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

          <Card
            title="Dettagli traccia"
            className="details-card"
            headerAfterTitle={<span className="library-path">{selectedFileName}</span>}
          >
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
                  <div className="inline-action-slot">
                    <button onClick={handleSaveTrack} disabled={!selectedTrack}>
                      <span className="btn-content"><IconSave className="btn-icon" />Salva tag</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-actions">
              <button onClick={handleRenameOnlyTrack} disabled={!selectedTrack}>
                <span className="btn-content"><IconRename className="btn-icon" />Rinomina file</span>
              </button>
              <button onClick={handleSaveAndRenameTrack} disabled={!selectedTrack}>
                <span className="btn-content"><IconSave className="btn-icon" />Salva tag + rinomina file</span>
              </button>
              <button className="ghost-button" onClick={() => setShowRenameSettings(true)} disabled={!selectedTrack}>
                <span className="btn-content"><IconSettings className="btn-icon" />Impostazioni rinomina</span>
              </button>
            </div>

            <label className="rename-preview-field">
              Anteprima nome file rinominato
              <input className="input" readOnly value={renamePreview} />
            </label>
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
                <span className="btn-content"><IconSearch className="btn-icon" />{isLoadingSearch ? "Ricerca..." : "Cerca online"}</span>
              </button>
              <button onClick={handleApplyOnlineResult} disabled={!selectedResult || !selectedTrack}>
                <span className="btn-content"><IconCheck className="btn-icon" />Applica risultato selezionato</span>
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

      {showRenameSettings && (
        <div className="modal-backdrop" onClick={() => setShowRenameSettings(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Impostazioni rinomina file</h3>
              <button className="ghost-button" onClick={() => setShowRenameSettings(false)}>
                <span className="btn-content"><IconClose className="btn-icon" />Chiudi</span>
              </button>
            </div>
            <p className="muted compact">Scegli campi, ordine e divisore per il nome file finale.</p>

            <div className="rename-fields">
              {renameFields.map((field) => (
                <div key={field} className="rename-field-row">
                  <label className="rename-field-check">{renameFieldLabel(field)}</label>
                  <div className="rename-field-controls">
                    <button className="ghost-button" onClick={() => moveRenameField(field, -1)}>
                      <span className="btn-content"><IconArrowUp className="btn-icon" />Su</span>
                    </button>
                    <button className="ghost-button" onClick={() => moveRenameField(field, 1)}>
                      <span className="btn-content"><IconArrowDown className="btn-icon" />Giù</span>
                    </button>
                    <button className="ghost-button" onClick={() => toggleRenameField(field)} disabled={renameFields.length <= 1}>
                      <span className="btn-content"><IconClose className="btn-icon" />Rimuovi</span>
                    </button>
                  </div>
                </div>
              ))}
              {RENAME_FIELD_OPTIONS.filter((opt) => !renameFields.includes(opt.key)).map((opt) => (
                <div key={opt.key} className="rename-field-row">
                  <label className="rename-field-check">{opt.label}</label>
                  <div className="rename-field-controls">
                    <button className="ghost-button" onClick={() => toggleRenameField(opt.key)}>
                      <span className="btn-content"><IconCheck className="btn-icon" />Aggiungi</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <label>
              Divisore
              <input className="input input-short" value={renameSeparator} onChange={(e) => setRenameSeparator(e.target.value)} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return normalized;
  }
  return normalized.slice(index + 1);
}

function buildRenamePreview(track: Track, fields: RenameField[], separator: string): string {
  const fieldMap: Record<RenameField, string> = {
    tracknumber: track.tracknumber,
    artist: track.artist,
    album: track.album,
    title: track.title,
    year: track.year,
    genre: track.genre,
  };

  const parts = fields
    .map((field) => sanitizeFilePart((fieldMap[field] || "").trim()))
    .filter(Boolean);
  const ext = getExtension(track.path);
  if (!parts.length) {
    return getFileName(track.path);
  }
  return `${parts.join(separator || " - ")}${ext}`;
}

function getExtension(path: string): string {
  const file = getFileName(path);
  const index = file.lastIndexOf(".");
  if (index < 0) {
    return "";
  }
  return file.slice(index);
}

function sanitizeFilePart(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.replace(/[.\s]+$/g, "");
}

function renameFieldLabel(field: RenameField): string {
  const found = RENAME_FIELD_OPTIONS.find((f) => f.key === field);
  return found?.label ?? field;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
