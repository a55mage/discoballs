import { useMemo } from "react";
import { IconPlaylist, IconPlus } from "../../components/icons";
import { useDashboardDrag } from "../../hooks/useDashboardDrag";
import { useLibraryStore } from "../../store/libraryStore";
import { usePlaylistStore } from "../../store/playlistStore";
import type { Playlist } from "../../domain/playlist";
import { Button, CoverMosaic, cx } from "../../ui";
import { PlaylistEditor } from "./PlaylistEditor";
import { TrackPicker } from "./TrackPicker";
import "./playlists.css";

export function PlaylistsScreen() {
  const { playlists, activePlaylistId, setActivePlaylist, createPlaylist } = usePlaylistStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const drag = useDashboardDrag("dashboard");
  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const active = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;

  const coversOf = (playlist: Playlist) => playlist.entries.map((entry) => trackById.get(entry.trackId)?.coverUrl);

  if (playlists.length === 0) {
    return (
      <div className="pl-empty">
        <div>
          <h2 className="db-text-display">No playlists yet</h2>
          <p>Group tracks into playlists, reorder them by dragging and play them in order or shuffled.</p>
          <Button variant="primary" size="lg" icon={<IconPlus />} onClick={createPlaylist}>Create a playlist</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-screen">
      <section className="pl-list db-glass db-pane--divider-right" aria-label="Playlists">
        <ul>
          {playlists.map((playlist) => {
            const isActive = playlist.id === activePlaylistId;
            return (
              <li key={playlist.id}>
                <button type="button" className={cx("pl-card", isActive && "is-active")} aria-current={isActive ? "true" : undefined} onClick={() => setActivePlaylist(playlist.id)}>
                  <CoverMosaic covers={coversOf(playlist)} size={52} radius={10} />
                  <span className="pl-card__text">
                    <span className="pl-card__name">{playlist.name}</span>
                    <span className="pl-card__meta">{playlist.entries.length} {playlist.entries.length === 1 ? "track" : "tracks"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Button block icon={<IconPlus />} onClick={createPlaylist}>New playlist</Button>
      </section>

      {active ? (
        <PlaylistEditor playlist={active} trackById={trackById} covers={coversOf(active)} drag={drag} />
      ) : (
        <div className="pl-empty"><div><IconPlaylist width={32} height={32} aria-hidden="true" /><p>Select a playlist.</p></div></div>
      )}

      <TrackPicker playlist={active} onTrackPointerDown={drag.onLibraryTrackPointerDown} draggingTrackId={drag.draggingTrackId} />
    </div>
  );
}
