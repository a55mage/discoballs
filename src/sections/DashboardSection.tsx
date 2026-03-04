import { type ComponentType, type KeyboardEvent, type PointerEvent, type SVGProps } from "react";
import { Card } from "../components/Card";
import type { Track } from "../types";
import { LibrarySection, type LibrarySectionProps } from "./LibrarySection";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type DashboardSectionProps = {
  activePlaylistId: string;
  isPlaylistRenaming: boolean;
  libraryProps: LibrarySectionProps;
  playlistNameDraft: string;
  playlists: Array<{ id: string; name: string }>;
  hasActivePlaylist: boolean;
  canPlayActivePlaylist: boolean;
  activePlaylistEntries: Array<{ id: string; trackId: string }>;
  tracks: Track[];
  isDashboardDragging: boolean;
  dashboardDropArea: "none" | "dropzone" | "playlist";
  dashboardDropEntryId: string;
  draggingPlaylistEntryId: string;
  onActivePlaylistChange: (playlistId: string) => void;
  onPlaylistDraftChange: (value: string) => void;
  onCreatePlaylist: () => void;
  onRenamePlaylist: () => void;
  onPlaylistRenameInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onDeletePlaylist: () => void;
  onPlayActivePlaylist: () => void;
  onPlaylistEntryPointerDown: (event: PointerEvent<HTMLElement>, entryId: string) => void;
  onPlaylistEntryClick: (track: Track) => void;
  onRemovePlaylistEntry: (entryId: string) => void;
  IconPlus: IconComponent;
  IconRename: IconComponent;
  IconTrash: IconComponent;
  IconPlay: IconComponent;
};

export function DashboardSection({
  activePlaylistId,
  isPlaylistRenaming,
  libraryProps,
  playlistNameDraft,
  playlists,
  hasActivePlaylist,
  canPlayActivePlaylist,
  activePlaylistEntries,
  tracks,
  isDashboardDragging,
  dashboardDropArea,
  dashboardDropEntryId,
  draggingPlaylistEntryId,
  onActivePlaylistChange,
  onPlaylistDraftChange,
  onCreatePlaylist,
  onRenamePlaylist,
  onPlaylistRenameInputKeyDown,
  onDeletePlaylist,
  onPlayActivePlaylist,
  onPlaylistEntryPointerDown,
  onPlaylistEntryClick,
  onRemovePlaylistEntry,
  IconPlus,
  IconRename,
  IconTrash,
  IconPlay,
}: DashboardSectionProps) {
  const showDropzone = activePlaylistEntries.length === 0;

  const playlistToolbar = (
    <div className="playlist-toolbar">
      {isPlaylistRenaming ? (
        <input
          className="input playlist-control"
          value={playlistNameDraft}
          onChange={(event) => onPlaylistDraftChange(event.target.value)}
          onKeyDown={onPlaylistRenameInputKeyDown}
          placeholder="Playlist name"
          aria-label="Playlist name"
          autoFocus
        />
      ) : (
        <select
          className="input playlist-control"
          value={activePlaylistId}
          onChange={(event) => onActivePlaylistChange(event.target.value)}
          disabled={!playlists.length}
          aria-label="Select playlist"
          title="Select playlist"
        >
          {!playlists.length && <option value="">No playlists available</option>}
          {playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
          ))}
        </select>
      )}
      <button className="ghost-button" onClick={onCreatePlaylist} title="Create playlist" aria-label="Create playlist">
        <span className="btn-content"><IconPlus className="btn-icon" /></span>
      </button>
      <button
        className="ghost-button"
        onClick={onRenamePlaylist}
        disabled={!hasActivePlaylist}
        title={isPlaylistRenaming ? "Confirm rename" : "Rename playlist"}
        aria-label={isPlaylistRenaming ? "Confirm rename" : "Rename playlist"}
      >
        <span className="btn-content"><IconRename className="btn-icon" /></span>
      </button>
      <button className="ghost-button" onClick={onDeletePlaylist} disabled={!hasActivePlaylist} title="Delete playlist" aria-label="Delete playlist">
        <span className="btn-content"><IconTrash className="btn-icon" /></span>
      </button>
      <button className="ghost-button" onClick={onPlayActivePlaylist} disabled={!canPlayActivePlaylist} title="Play playlist" aria-label="Play playlist">
        <span className="btn-content"><IconPlay className="btn-icon" /></span>
      </button>
    </div>
  );

  return (
    <main className="two-col">
      <div className="col col-left">
        <LibrarySection {...libraryProps} />
      </div>
      <div className="col col-right">
        <Card title="Playlist Editor" headerRight={playlistToolbar}>
          {showDropzone && (
            <div
              className={
                isDashboardDragging && dashboardDropArea === "dropzone"
                  ? "playlist-dropzone is-dragging"
                  : "playlist-dropzone"
              }
              data-playlist-dropzone="true"
            >
              {isDashboardDragging
                ? "Release here to add/reorder tracks"
                : "Drag tracks from Library and drop them here"}
            </div>
          )}

          <ul
            className={
              isDashboardDragging && dashboardDropArea === "playlist"
                ? "playlist-list is-dragging"
                : "playlist-list"
            }
            data-playlist-list="true"
          >
            {activePlaylistEntries.map((entry) => {
              const track = tracks.find((item) => item.id === entry.trackId);
              if (!track) {
                return null;
              }
              return (
                <li key={entry.id}>
                  <div
                    className={
                      draggingPlaylistEntryId === entry.id
                        ? "playlist-item dragging"
                        : dashboardDropEntryId === entry.id
                          ? "playlist-item drop-target"
                          : "playlist-item"
                    }
                    data-playlist-entry-id={entry.id}
                  >
                    <button
                      type="button"
                      className="playlist-item-main"
                      onPointerDown={(event) => {
                        onPlaylistEntryPointerDown(event, entry.id);
                      }}
                      onClick={() => {
                        onPlaylistEntryClick(track);
                      }}
                    >
                      <span className="playlist-item-drag" aria-hidden="true">::</span>
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt="" className="playlist-item-cover" />
                      ) : (
                        <span className="playlist-item-cover placeholder" aria-hidden="true">♪</span>
                      )}
                      <span className="playlist-item-text">
                        <strong>{track.title || "Untitled"}</strong>
                        <small>{track.artist || "Unknown artist"}</small>
                      </span>
                    </button>
                    <span className="playlist-item-actions">
                      <button
                        type="button"
                        className="ghost-button mini-icon"
                        onClick={() => {
                          onPlaylistEntryClick(track);
                        }}
                        title="Play track"
                        aria-label="Play track"
                      >
                        <IconPlay className="btn-icon" />
                      </button>
                      <button
                        type="button"
                        className="ghost-button mini-icon"
                        onClick={() => {
                          onRemovePlaylistEntry(entry.id);
                        }}
                        title="Remove from playlist"
                        aria-label="Remove from playlist"
                      >
                        <IconTrash className="btn-icon" />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </main>
  );
}
