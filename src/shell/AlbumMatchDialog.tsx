import { useEffect, useMemo, useState } from "react";
import { adapter } from "../api";
import { applyTrackEdits, describeBatchResult, type TrackEdit } from "../actions/batchEdit";
import { undoLast, undoWithToast } from "../actions/history";
import { buildAlbumPatch, describeRelease, guessAlbum, localTitle, matchTracksToRelease } from "../domain/albumMatch";
import { useLibraryStore } from "../store/libraryStore";
import { useUiStore } from "../store/uiStore";
import type { AlbumRelease, AlbumSummary, Track } from "../types";
import { formatError } from "../utils/common";
import { Badge, Button, Cover, Dialog, Field, Switch, TextInput } from "../ui";

/**
 * Matches the tracks of one album to a MusicBrainz release: search, pick the edition, review which file gets
 * which title, then write. Nothing is saved before "Apply".
 */
export function AlbumMatchDialog() {
  const { albumMatch, setAlbumMatch } = useUiStore();
  const open = albumMatch !== null;
  return (
    <Dialog open={open} onClose={() => setAlbumMatch(null)} title="Match album online" width={820}>
      {albumMatch ? <AlbumMatchBody key={albumMatch.ids.join("|")} ids={albumMatch.ids} onClose={() => setAlbumMatch(null)} /> : null}
    </Dialog>
  );
}

function AlbumMatchBody({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const library = useLibraryStore((state) => state.tracks);
  const showToast = useUiStore((state) => state.showToast);
  const tracks = useMemo(() => ids.map((id) => library.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)), [ids, library]);
  const guess = useMemo(() => guessAlbum(tracks), [tracks]);
  const [artist, setArtist] = useState(guess.artist);
  const [album, setAlbum] = useState(guess.album);
  const [candidates, setCandidates] = useState<AlbumSummary[] | null>(null);
  const [release, setRelease] = useState<AlbumRelease | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [setAlbumFields, setSetAlbumFields] = useState(true);
  const [replaceCovers, setReplaceCovers] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  async function search() {
    setLoading(true);
    setStatus("");
    setRelease(null);
    try {
      const found = await adapter.searchAlbums({ artist: artist.trim(), album: album.trim() });
      setCandidates(found);
      setStatus(found.length ? "" : "No album found. Try fewer words.");
    } catch (error) {
      setStatus(`Search error: ${formatError(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function choose(summary: AlbumSummary) {
    setLoading(true);
    setStatus("");
    try {
      setRelease(await adapter.getAlbumRelease(summary.id));
    } catch (error) {
      setStatus(`Could not load the album: ${formatError(error)}`);
    } finally {
      setLoading(false);
    }
  }

  // Search straight away when the tracks already say which album they are.
  useEffect(() => {
    if (guess.album) {
      void search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const match = useMemo(() => (release ? matchTracksToRelease(tracks, release) : null), [release, tracks]);
  const matched = match?.rows.filter((row) => row.releaseIndex !== null).length ?? 0;

  async function apply() {
    if (!release || !match) {
      return;
    }
    const edits: TrackEdit[] = [];
    for (const row of match.rows) {
      if (row.releaseIndex === null) {
        continue;
      }
      const edit: TrackEdit = { id: row.trackId, patch: buildAlbumPatch(release, release.tracks[row.releaseIndex], { setAlbumFields }) };
      if (replaceCovers && release.coverUrl) {
        edit.coverUrl = release.coverUrl;
      }
      edits.push(edit);
    }
    setBusy({ done: 0, total: edits.length });
    const result = await applyTrackEdits(edits, (done, total) => setBusy({ done, total }), "Album match");
    setBusy(null);
    const summary = describeBatchResult(result);
    showToast(
      summary.message,
      summary.tone,
      result.updated
        ? { label: "Undo", run: () => void undoWithToast(undoLast) }
        : undefined
    );
    onClose();
  }

  return (
    <div className="albm">
      <form
        className="albm__search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Field label="Artist"><TextInput value={artist} onChange={(event) => setArtist(event.target.value)} /></Field>
        <Field label="Album"><TextInput value={album} onChange={(event) => setAlbum(event.target.value)} /></Field>
        <Button type="submit" disabled={loading || !(artist.trim() || album.trim())}>{loading && !release ? "Searching…" : "Search"}</Button>
      </form>
      <p className="albm__hint">{tracks.length} {tracks.length === 1 ? "track" : "tracks"} selected. {status}</p>

      {!release && candidates?.length ? (
        <ul className="albm__candidates" aria-label="Albums found">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button type="button" onClick={() => void choose(candidate)} disabled={loading}>
                <span className="albm__title">{candidate.title}<small>{candidate.artist}</small></span>
                <span className="albm__meta">{describeRelease(candidate)}</span>
                <Badge tone="neutral">{candidate.trackCount} tracks</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {release && match ? (
        <>
          <div className="albm__release">
            <Cover size={64} radius={10} src={release.coverUrl} />
            <div>
              <h3>{release.title}</h3>
              <span>{release.artist}{release.date ? ` · ${release.date.slice(0, 4)}` : ""}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRelease(null)}>Choose another</Button>
          </div>
          <table className="albm__table">
            <thead>
              <tr><th>Your file</th><th>Becomes</th><th /></tr>
            </thead>
            <tbody>
              {match.rows.map((row) => {
                const track = tracks.find((item) => item.id === row.trackId)!;
                const remote = row.releaseIndex === null ? null : release.tracks[row.releaseIndex];
                return (
                  <tr key={row.trackId} className={remote ? undefined : "is-unmatched"}>
                    <td>{localTitle(track)}</td>
                    <td>{remote ? `${remote.number}. ${remote.title}` : "No match — left as is"}</td>
                    <td>{remote && row.confidence < 0.7 ? <Badge tone="neutral">Check</Badge> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {match.missing.length ? (
            <p className="albm__hint">Not in your selection: {match.missing.map((index) => release.tracks[index].title).join(", ")}.</p>
          ) : null}
          <div className="albm__options">
            <label><Switch label="Also set album and year" checked={setAlbumFields} onChange={setSetAlbumFields} /> Also set album and year</label>
            <label>
              <Switch label="Replace covers" checked={replaceCovers} onChange={setReplaceCovers} disabled={!release.coverUrl} /> Replace covers
              {!release.coverUrl ? " (none available)" : ""}
            </label>
          </div>
          <div className="albm__footer">
            <Button variant="primary" disabled={matched === 0 || busy !== null} onClick={() => void apply()}>
              {busy ? `Saving ${busy.done}/${busy.total}…` : `Apply to ${matched} ${matched === 1 ? "track" : "tracks"}`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
