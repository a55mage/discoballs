import { type ComponentType, type MouseEvent, type RefObject, type SVGProps, type UIEvent } from "react";
import { Card } from "../components/Card";
import type { Track } from "../types";

type LibraryViewMode = "card" | "compact";
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type VirtualTrackWindow = {
  visibleTracks: Track[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
};

type LibrarySectionProps = {
  folderPath: string;
  isLoadingScan: boolean;
  onScan: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  libraryViewMode: LibraryViewMode;
  onLibraryViewModeChange: (mode: LibraryViewMode) => void;
  librarySummary: string;
  trackListRef: RefObject<HTMLUListElement | null>;
  onTrackListScroll: (event: UIEvent<HTMLUListElement>) => void;
  virtualTrackWindow: VirtualTrackWindow;
  selectedTrackId: string;
  onSelectTrack: (track: Track) => void;
  onSearchTrack: (track: Track) => void;
  onPlayFromLibraryCover: (event: MouseEvent<HTMLDivElement>, track: Track) => void;
  getFileName: (path: string) => string;
  IconFolder: IconComponent;
  IconGrid: IconComponent;
  IconListCompact: IconComponent;
  IconPlay: IconComponent;
  IconSearch: IconComponent;
};

export function LibrarySection({
  folderPath,
  isLoadingScan,
  onScan,
  query,
  onQueryChange,
  libraryViewMode,
  onLibraryViewModeChange,
  librarySummary,
  trackListRef,
  onTrackListScroll,
  virtualTrackWindow,
  selectedTrackId,
  onSelectTrack,
  onSearchTrack,
  onPlayFromLibraryCover,
  getFileName: resolveFileName,
  IconFolder,
  IconGrid,
  IconListCompact,
  IconPlay,
  IconSearch,
}: LibrarySectionProps) {
  return (
    <Card
      title="Library files"
      className="library-card"
      headerAfterTitle={<span className="library-path">{folderPath ? folderPath : "No folder selected"}</span>}
      headerRight={
        <button onClick={onScan} disabled={isLoadingScan} title={isLoadingScan ? "Scanning..." : "Select folder"} aria-label={isLoadingScan ? "Scanning..." : "Select folder"}>
          <span className="btn-content"><IconFolder className="btn-icon" /></span>
        </button>
      }
    >
      <div className="library-filter-row">
        <input
          className="input"
          placeholder="Filter files..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="library-view-toggle">
          <button
            className={libraryViewMode === "card" ? "view-mode-button" : "ghost-button view-mode-button"}
            onClick={() => onLibraryViewModeChange("card")}
            title="Card view"
          >
            <span className="btn-content"><IconGrid className="btn-icon" /></span>
          </button>
          <button
            className={libraryViewMode === "compact" ? "view-mode-button" : "ghost-button view-mode-button"}
            onClick={() => onLibraryViewModeChange("compact")}
            title="Compact list view"
          >
            <span className="btn-content"><IconListCompact className="btn-icon" /></span>
          </button>
        </div>
        <span className="library-summary">{librarySummary}</span>
      </div>
      <ul
        ref={trackListRef}
        onScroll={onTrackListScroll}
        className={libraryViewMode === "compact" ? "track-list compact" : "track-list"}
      >
        {virtualTrackWindow.topSpacerHeight > 0 && (
          <li
            className="track-list-spacer"
            style={{ height: virtualTrackWindow.topSpacerHeight, gridColumn: "1 / -1" }}
            aria-hidden="true"
          />
        )}
        {virtualTrackWindow.visibleTracks.map((track) => (
          <li key={track.id}>
            <div className={libraryViewMode === "compact" ? "track-item-shell compact" : "track-item-shell"}>
              <button
                className={
                  track.id === selectedTrackId
                    ? libraryViewMode === "compact"
                      ? "track-item compact active"
                      : "track-item active"
                    : libraryViewMode === "compact"
                      ? "track-item compact"
                      : "track-item"
                }
                onClick={() => {
                  onSelectTrack(track);
                }}
              >
                <div
                  className="track-thumb-trigger"
                  onClick={(event) => onPlayFromLibraryCover(event, track)}
                  title="Play track"
                >
                  {track.coverUrl ? (
                    <img
                      src={track.coverUrl}
                      alt={`Cover ${track.album || track.title}`}
                      className="track-thumb"
                    />
                  ) : (
                    <div className="track-thumb-placeholder">♪</div>
                  )}
                  <span className="track-thumb-play-indicator" aria-hidden="true">
                    <IconPlay className="track-thumb-play-icon" />
                  </span>
                </div>
                {libraryViewMode === "compact" ? (
                  <span className="track-text compact">
                    <strong>{track.title || "Untitled"}</strong>
                    <small className="muted compact-inline">
                      {track.artist || "Unknown artist"} · {track.album || "Unknown album"} · {track.year || "n/a"} · #{track.tracknumber || "-"} · {track.genre || "Genre n/a"} · {resolveFileName(track.path)}
                    </small>
                  </span>
                ) : (
                  <span className="track-text">
                    <strong>{track.title || "Untitled"}</strong>
                    <small>{track.artist || "Unknown artist"}</small>
                    <small className="muted">{track.album || "Unknown album"}</small>
                  </span>
                )}
              </button>
              <button
                className={libraryViewMode === "compact" ? "ghost-button track-item-search-button compact" : "ghost-button track-item-search-button"}
                onClick={(event) => {
                  event.stopPropagation();
                  onSearchTrack(track);
                }}
                title="Search online for this track"
                aria-label="Search online for this track"
              >
                <span className="btn-content"><IconSearch className="btn-icon" /></span>
              </button>
            </div>
          </li>
        ))}
        {virtualTrackWindow.bottomSpacerHeight > 0 && (
          <li
            className="track-list-spacer"
            style={{ height: virtualTrackWindow.bottomSpacerHeight, gridColumn: "1 / -1" }}
            aria-hidden="true"
          />
        )}
      </ul>
    </Card>
  );
}
