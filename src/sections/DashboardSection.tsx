import { type ComponentType, type PointerEvent, type SVGProps } from "react";
import { Card } from "../components/Card";
import type { Track } from "../types";
import { LibrarySection, type LibrarySectionProps } from "./LibrarySection";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type DashboardSectionProps = {
  libraryProps: LibrarySectionProps;
  activePlaylistEntries: Array<{ id: string; trackId: string }>;
  tracks: Track[];
  isDashboardDragging: boolean;
  dashboardDropArea: "none" | "dropzone" | "playlist";
  dashboardDropEntryId: string;
  draggingPlaylistEntryId: string;
  onPlaylistEntryPointerDown: (event: PointerEvent<HTMLElement>, entryId: string) => void;
  onPlaylistEntryClick: (track: Track) => void;
  onRemovePlaylistEntry: (entryId: string) => void;
  IconTrash: IconComponent;
  IconPlay: IconComponent;
};

export function DashboardSection({
  libraryProps,
  activePlaylistEntries,
  tracks,
  isDashboardDragging,
  dashboardDropArea,
  dashboardDropEntryId,
  draggingPlaylistEntryId,
  onPlaylistEntryPointerDown,
  onPlaylistEntryClick,
  onRemovePlaylistEntry,
  IconTrash,
  IconPlay,
}: DashboardSectionProps) {
  const showDropzone = activePlaylistEntries.length === 0;

  return (
    <main className="two-col">
      <div className="col col-left">
        <LibrarySection {...libraryProps} />
      </div>
      <div className="col col-right dashboard-playlist-column">
        <Card title="Playlist Editor" className="dashboard-playlist-card">
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
