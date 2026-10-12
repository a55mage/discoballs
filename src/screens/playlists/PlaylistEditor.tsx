import { type KeyboardEvent } from "react";
import { IconPlay, IconRename, IconShuffle, IconTrash } from "../../components/icons";
import { playPlaylist, playTrackFromPlaylist } from "../../actions/playback";
import type { useDashboardDrag } from "../../hooks/useDashboardDrag";
import { usePlaylistStore } from "../../store/playlistStore";
import type { Playlist } from "../../domain/playlist";
import type { Track } from "../../types";
import { Button, CoverMosaic, IconButton, TextInput, cx } from "../../ui";

type PlaylistEditorProps = {
  playlist: Playlist;
  trackById: Map<string, Track>;
  covers: Array<string | undefined>;
  drag: ReturnType<typeof useDashboardDrag>;
};

export function PlaylistEditor({ playlist, trackById, covers, drag }: PlaylistEditorProps) {
  const store = usePlaylistStore();
  const { isPlaylistRenaming, playlistNameDraft } = store;
  const playable = playlist.entries.filter((entry) => trackById.has(entry.trackId)).length;

  function onNameKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      store.confirmRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      store.setActivePlaylist(playlist.id);
    }
  }

  function move(entryId: string, direction: -1 | 1) {
    const index = playlist.entries.findIndex((entry) => entry.id === entryId);
    const target = playlist.entries[index + direction];
    if (!target) {
      return;
    }
    // The entry takes the position of its neighbour, which shifts that neighbour the other way.
    store.moveEntry(entryId, target.id);
  }

  return (
    <section className="pl-editor" aria-label={`Playlist ${playlist.name}`}>
      <header className="pl-hero">
        <CoverMosaic covers={covers} size={120} radius={16} />
        <div className="pl-hero__text">
          <span className="pl-hero__kicker">Playlist</span>
          {isPlaylistRenaming ? (
            <TextInput
              className="pl-hero__input"
              aria-label="Playlist name"
              autoFocus
              value={playlistNameDraft}
              onChange={(event) => store.setPlaylistNameDraft(event.target.value)}
              onKeyDown={onNameKey}
              onBlur={store.confirmRename}
            />
          ) : (
            <h2 className="db-text-display">{playlist.name}</h2>
          )}
          <span className="pl-hero__meta">{playlist.entries.length} {playlist.entries.length === 1 ? "track" : "tracks"}</span>
        </div>
        <div className="pl-hero__actions">
          <Button variant="primary" icon={<IconPlay />} disabled={playable === 0} onClick={() => void playPlaylist(playlist.id)}>Play</Button>
          <Button icon={<IconShuffle />} disabled={playable === 0} onClick={() => void playPlaylist(playlist.id, { shuffle: true })}>Shuffle</Button>
          <IconButton label="Rename playlist" onClick={store.renameButtonClick}><IconRename /></IconButton>
          <IconButton label="Delete playlist" onClick={store.deleteActivePlaylist}><IconTrash /></IconButton>
        </div>
      </header>

      <div className="pl-entries-wrap">
        {playlist.entries.length === 0 ? (
          <div
            className={cx("pl-dropzone", drag.isDragging && drag.dropArea === "dropzone" && "is-over")}
            data-playlist-dropzone="true"
          >
            {drag.isDragging ? "Release to add the track" : "Empty playlist. Drag tracks here or use “Add tracks”."}
          </div>
        ) : (
          <ol className={cx("pl-entries", drag.isDragging && drag.dropArea === "playlist" && "is-over")} data-playlist-list="true" aria-label="Tracks in this playlist">
            {playlist.entries.map((entry, index) => {
              const track = trackById.get(entry.trackId);
              const isDragged = drag.draggingPlaylistEntryId === entry.id;
              return (
                <li
                  key={entry.id}
                  data-playlist-entry-id={entry.id}
                  className={cx("pl-entry", isDragged && "is-dragging", drag.dropEntryId === entry.id && "is-drop-target", !track && "is-missing")}
                >
                  <button
                    type="button"
                    className="pl-entry__main"
                    onPointerDown={(event) => drag.onPlaylistEntryPointerDown(event, entry.id)}
                    onClick={() => {
                      if (drag.consumeSuppressedClick() || !track) {
                        return;
                      }
                      void playTrackFromPlaylist(track, playlist.id);
                    }}
                    aria-label={track ? `Play ${track.title || "track"}` : "Track missing from the library"}
                  >
                    <span className="pl-entry__grip" aria-hidden="true">⋮⋮</span>
                    <span className="pl-entry__index">{index + 1}</span>
                    {track ? (
                      <>
                        <CoverMosaic covers={[track.coverUrl]} size={40} radius={8} />
                        <span className="pl-entry__text">
                          <span className="pl-entry__title">{track.title || "Untitled"}</span>
                          <span className="pl-entry__artist">{track.artist || "Unknown artist"}</span>
                        </span>
                        <span className="pl-entry__album">{track.album}</span>
                      </>
                    ) : (
                      <span className="pl-entry__text">
                        <span className="pl-entry__title">Track not in the library</span>
                        <span className="pl-entry__artist">Open its folder again, or remove it.</span>
                      </span>
                    )}
                  </button>
                  <div className="pl-entry__actions">
                    <IconButton label="Move up" size="sm" disabled={index === 0} onClick={() => move(entry.id, -1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /></svg>
                    </IconButton>
                    <IconButton label="Move down" size="sm" disabled={index === playlist.entries.length - 1} onClick={() => move(entry.id, 1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l6 6 6-6" /></svg>
                    </IconButton>
                    <IconButton label="Remove from playlist" size="sm" onClick={() => store.removeEntry(entry.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
