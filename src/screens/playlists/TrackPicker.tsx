import { type PointerEvent, useMemo, useRef, useState } from "react";
import { IconPlus, IconSearch } from "../../components/icons";
import { matchesQuery } from "../../domain/libraryView";
import { useVirtualList } from "../../hooks/useVirtualList";
import { useLibraryStore } from "../../store/libraryStore";
import { usePlaylistStore } from "../../store/playlistStore";
import type { Playlist } from "../../domain/playlist";
import type { Track } from "../../types";
import { Badge, Button, Cover, IconButton, TextInput, cx } from "../../ui";

const ROW_HEIGHT = 56;

type TrackPickerProps = {
  playlist: Playlist | null;
  onTrackPointerDown: (event: PointerEvent<HTMLElement>, track: Track) => void;
  draggingTrackId: string;
};

/** Library browser next to the playlist: add tracks with a click, or drag them into the list. */
export function TrackPicker({ playlist, onTrackPointerDown, draggingTrackId }: TrackPickerProps) {
  const tracks = useLibraryStore((state) => state.tracks);
  const insertTrack = usePlaylistStore((state) => state.insertTrack);
  const appendTracks = usePlaylistStore((state) => state.appendTracks);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const inPlaylist = useMemo(() => new Set(playlist?.entries.map((entry) => entry.trackId) ?? []), [playlist]);
  const matches = useMemo(() => tracks.filter((track) => matchesQuery(track, query)), [tracks, query]);
  const range = useVirtualList(scrollRef, matches.length, ROW_HEIGHT);
  const addable = matches.filter((track) => !inPlaylist.has(track.id));

  return (
    <aside className="pl-picker db-glass db-pane--divider-left" aria-label="Add tracks">
      <header className="pl-picker__head">
        <h2>Add tracks</h2>
        <label className="pl-picker__search">
          <IconSearch aria-hidden="true" />
          <TextInput placeholder="Search your library…" aria-label="Search tracks to add" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Button size="sm" block disabled={!playlist || addable.length === 0} onClick={() => appendTracks(addable.map((track) => track.id))}>
          Add {addable.length} {addable.length === 1 ? "track" : "tracks"}
        </Button>
      </header>
      <div ref={scrollRef} className="pl-picker__scroll">
        <ul style={{ paddingTop: range.offsetTop, paddingBottom: range.offsetBottom }}>
          {matches.slice(range.start, range.end).map((track) => {
            const added = inPlaylist.has(track.id);
            return (
              <li key={track.id}>
                <div
                  className={cx("pl-pick", draggingTrackId === track.id && "is-dragging")}
                  style={{ height: ROW_HEIGHT }}
                  onPointerDown={(event) => onTrackPointerDown(event, track)}
                >
                  <Cover size={40} radius={8} src={track.coverUrl} />
                  <span className="pl-pick__text">
                    <span className="pl-pick__title">{track.title || "Untitled"}</span>
                    <span className="pl-pick__artist">{track.artist || "Unknown artist"}</span>
                  </span>
                  {added ? <Badge tone="neutral">Added</Badge> : null}
                  <IconButton label={`Add ${track.title || "track"}`} size="sm" disabled={!playlist} onClick={() => insertTrack(track.id)}>
                    <IconPlus />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
        {matches.length === 0 ? <p className="pl-picker__empty">{tracks.length ? "No tracks match." : "Open a folder to add tracks."}</p> : null}
      </div>
    </aside>
  );
}
