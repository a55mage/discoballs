import { useState } from "react";
import { IconClose, IconHeart, IconPlay, IconPlus, IconQueue, IconTag } from "../../components/icons";
import { applyBatchEdit, describeBatchResult, type BatchPatch } from "../../actions/batchEdit";
import { undoLast, undoWithToast } from "../../actions/history";
import { clearSelection } from "../../actions/librarySelection";
import { searchOnlineForTrack } from "../../actions/library";
import { enqueueTrack, enqueueTracks, playFromLibraryCover } from "../../actions/playback";
import { albumIdsFor } from "../../domain/albumMatch";
import { getFormat, getTrackIssues } from "../../domain/libraryView";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useTrackTechnicalInfo } from "../../hooks/useTrackTechnicalInfo";
import { useVisibleTracks } from "../../hooks/useVisibleTracks";
import { useLibraryStore } from "../../store/libraryStore";
import { useLibraryViewStore } from "../../store/libraryViewStore";
import { usePlaylistStore } from "../../store/playlistStore";
import { useUiStore } from "../../store/uiStore";
import type { Track } from "../../types";
import { formatTrackTechnicalSummary } from "../../utils/appHelpers";
import { Badge, Button, Cover, Field, IconButton, Rating, Switch, TextInput } from "../../ui";

const BATCH_FIELDS: Array<{ key: keyof BatchPatch; label: string }> = [
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "year", label: "Year" },
  { key: "genre", label: "Genre" },
];

/** Right-hand panel of the Library: one track in detail, or batch editing for a selection. */
export function LibraryInspector() {
  const selectedIds = useLibraryViewStore((state) => state.selectedIds);
  const { tracks, visibleTracks, duplicateIds } = useVisibleTracks();
  const selected = selectedIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track));

  return (
    <aside className="db-glass db-pane--divider-left lib-inspector" aria-label="Track inspector">
      {selected.length === 0 ? (
        <div className="lib-inspector__empty">
          <p>Select a track to inspect it</p>
          <span>Tick several to edit them together.</span>
        </div>
      ) : selected.length === 1 ? (
        <SingleTrack track={selected[0]} issues={getTrackIssues(selected[0], duplicateIds)} visibleIds={visibleTracks.map((track) => track.id)} />
      ) : (
        <BatchEditor tracks={selected} />
      )}
    </aside>
  );
}

function SingleTrack({ track, issues, visibleIds }: { track: Track; issues: string[]; visibleIds: string[] }) {
  const setActiveScreen = useUiStore((state) => state.setActiveScreen);
  const showToast = useUiStore((state) => state.showToast);
  const setFilenameTags = useUiStore((state) => state.setFilenameTags);
  const setAlbumMatch = useUiStore((state) => state.setAlbumMatch);
  const allTracks = useLibraryStore((state) => state.tracks);
  const appendTracks = usePlaylistStore((state) => state.appendTracks);
  const info = useTrackTechnicalInfo(track);
  const isFavorite = useFavoritesStore((state) => state.favorites.includes(track.id));
  const rating = useFavoritesStore((state) => state.ratings[track.id] ?? 0);
  const { toggleFavorite, setRating } = useFavoritesStore();
  const title = track.title || track.path.replace(/\\/g, "/").split("/").pop() || "Untitled";

  const facts: Array<[string, string]> = [
    ["Track", track.tracknumber || "—"],
    ["Year", track.year || "—"],
    ["Genre", track.genre || "—"],
    ["Format", info ? formatTrackTechnicalSummary(info) || getFormat(track) : getFormat(track) || "—"],
    ["File", track.path],
  ];

  return (
    <>
      <div className="lib-hero">
        <Cover src={track.coverUrl} radius={0} className="lib-hero__cover" alt={`Cover of ${track.album || title}`} />
        <div className="lib-hero__caption">
          <h2 className="db-text-display">{title}</h2>
          <p>{[track.artist || "Unknown artist", track.album || "Unknown album"].join(" · ")}</p>
        </div>
      </div>
      <div className="lib-inspector__body">
        <div className="lib-actions">
          <Button variant="primary" size="sm" icon={<IconPlay />} onClick={() => void playFromLibraryCover(track, visibleIds)}>Play</Button>
          <Button size="sm" icon={<IconTag />} onClick={() => setActiveScreen("tagging")}>Edit tags</Button>
          <Button
            size="sm"
            icon={<IconQueue />}
            onClick={() => {
              enqueueTrack(track.id);
              showToast("Added to the queue", "success");
            }}
          >
            Queue
          </Button>
          <Button
            size="sm"
            icon={<IconPlus />}
            onClick={() => {
              appendTracks([track.id]);
              showToast("Added to the active playlist", "success");
            }}
          >
            Playlist
          </Button>
          <Button size="sm" onClick={() => setFilenameTags({ ids: [track.id], mode: "write" })}>Tags from file name…</Button>
          <Button size="sm" onClick={() => setAlbumMatch({ ids: albumIdsFor(allTracks, [track.id]) })}>Match album online…</Button>
        </div>

        <div className="lib-rate">
          <Rating value={rating} label={`Rating of ${title}`} onChange={(value) => setRating(track.id, value)} />
          <IconButton label={isFavorite ? "Remove from favorites" : "Add to favorites"} active={isFavorite} onClick={() => toggleFavorite(track.id)} className="lib-rate__heart">
            <IconHeart />
          </IconButton>
        </div>

        {issues.length ? (
          <div className="lib-issues">
            <strong>Needs attention</strong>
            <div className="lib-issues__list">
              {issues.map((issue) => (
                <Badge key={issue} tone="warn">{issue}</Badge>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              block
              onClick={() => {
                searchOnlineForTrack(track);
                setActiveScreen("tagging");
              }}
            >
              Fix with online match
            </Button>
          </div>
        ) : null}

        <dl className="lib-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

function BatchEditor({ tracks }: { tracks: Track[] }) {
  const showToast = useUiStore((state) => state.showToast);
  const setFilenameTags = useUiStore((state) => state.setFilenameTags);
  const setAlbumMatch = useUiStore((state) => state.setAlbumMatch);
  const appendTracks = usePlaylistStore((state) => state.appendTracks);
  const [patch, setPatch] = useState<BatchPatch>({});
  const [autoNumber, setAutoNumber] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  const commonValue = (key: keyof BatchPatch): string => {
    const values = tracks.map((track) => track[key]);
    return values.every((value) => value === values[0]) ? values[0] : "";
  };
  const hasChanges = autoNumber || BATCH_FIELDS.some(({ key }) => (patch[key] ?? "").trim() !== "");

  async function apply() {
    setBusy({ done: 0, total: tracks.length });
    const result = await applyBatchEdit(
      tracks.map((track) => track.id),
      patch,
      { autoNumber, onProgress: (done, total) => setBusy({ done, total }) }
    );
    setBusy(null);
    setPatch({});
    setAutoNumber(false);
    const summary = describeBatchResult(result);
    showToast(summary.message, summary.tone, result.updated ? { label: "Undo", run: () => void undoWithToast(undoLast) } : undefined);
  }

  return (
    <div className="lib-inspector__body lib-inspector__body--padded">
      <div className="lib-batch__head">
        <h2 className="db-text-display">{tracks.length} tracks selected</h2>
        <IconButton label="Clear selection" size="sm" onClick={clearSelection}><IconClose /></IconButton>
      </div>
      <div className="lib-stack" aria-hidden="true">
        {tracks.slice(0, 5).map((track) => (
          <Cover key={track.id} size={52} radius={10} src={track.coverUrl} className="lib-stack__item" />
        ))}
      </div>
      <p className="lib-hint">Empty fields stay untouched.</p>
      <div className="lib-batch__fields">
        {BATCH_FIELDS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <TextInput
              value={patch[key] ?? ""}
              placeholder={commonValue(key) || "Mixed values"}
              disabled={busy !== null}
              onChange={(event) => setPatch((current) => ({ ...current, [key]: event.target.value }))}
            />
          </Field>
        ))}
      </div>
      <label className="lib-batch__switch">
        <span>
          <strong>Auto-number tracks</strong>
          <small>1…{tracks.length} in list order</small>
        </span>
        <Switch label="Auto-number tracks" checked={autoNumber} onChange={setAutoNumber} disabled={busy !== null} />
      </label>
      <Button variant="primary" block disabled={!hasChanges || busy !== null} onClick={() => void apply()}>
        {busy ? `Saving ${busy.done}/${busy.total}…` : `Apply to ${tracks.length} tracks`}
      </Button>
      <Button block disabled={busy !== null} onClick={() => setFilenameTags({ ids: tracks.map((track) => track.id), mode: "write" })}>
        Tags from file names…
      </Button>
      <Button block disabled={busy !== null} onClick={() => setAlbumMatch({ ids: tracks.map((track) => track.id) })}>
        Match album online…
      </Button>
      <Button
        block
        disabled={busy !== null}
        onClick={() => {
          enqueueTracks(tracks.map((track) => track.id));
          showToast(`${tracks.length} tracks added to the queue`, "success");
        }}
      >
        Add to queue
      </Button>
      <Button
        block
        disabled={busy !== null}
        onClick={() => {
          appendTracks(tracks.map((track) => track.id));
          showToast(`${tracks.length} tracks added to the active playlist`, "success");
        }}
      >
        Add to playlist
      </Button>
    </div>
  );
}
