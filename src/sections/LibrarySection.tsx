import { type ComponentType, type DragEvent, type MouseEvent, type PointerEvent, type RefObject, type SVGProps, type UIEvent } from "react";
import { Card } from "../components/Card";
import type { Track } from "../types";
import type { FileSystemEntry, LibraryViewMode } from "../hooks/useLibraryView";

type LibrarySortMode = "title" | "artist" | "added" | "release";
type SortDirection = "asc" | "desc";
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type VirtualTrackWindow = {
  visibleTracks: Track[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
};

export type LibrarySectionProps = {
  folderPath: string;
  onOpenFolderPathClick: () => void;
  isLoadingScan: boolean;
  onScan: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  libraryViewMode: LibraryViewMode;
  onLibraryViewModeChange: (mode: LibraryViewMode) => void;
  isFileSystemView: boolean;
  onFileSystemViewChange: (enabled: boolean) => void;
  fileSystemEntries: FileSystemEntry[];
  fileSystemCurrentPath: string;
  canGoUpFileSystemFolder: boolean;
  onOpenFileSystemFolder: (pathSegments: string[]) => void;
  onGoUpFileSystemFolder: () => void;
  librarySortMode: LibrarySortMode;
  librarySortDirection: SortDirection;
  onLibrarySortClick: (mode: LibrarySortMode) => void;
  trackCount: number;
  folderCount: number;
  trackListRef: RefObject<HTMLUListElement | null>;
  onTrackListScroll: (event: UIEvent<HTMLUListElement>) => void;
  virtualTrackWindow: VirtualTrackWindow;
  selectedTrackId: string;
  onSelectTrack: (track: Track) => void;
  onSearchTrack: (track: Track) => void;
  onTrackAction?: (track: Track) => void;
  trackActionTitle?: string;
  trackActionAriaLabel?: string;
  onBulkTrackAction?: () => void;
  bulkTrackActionTitle?: string;
  bulkTrackActionAriaLabel?: string;
  onPlayFromLibraryCover: (event: MouseEvent<HTMLElement>, track: Track) => void;
  enableTrackDrag?: boolean;
  useNativeTrackDrag?: boolean;
  onTrackDragStart?: (event: DragEvent<HTMLElement>, track: Track) => void;
  onTrackDragEnd?: () => void;
  onTrackPointerDown?: (event: PointerEvent<HTMLElement>, track: Track) => void;
  draggingTrackId?: string;
  IconFolder: IconComponent;
  IconArrowUp: IconComponent;
  IconMusicNote: IconComponent;
  IconSortTitle: IconComponent;
  IconSortArtist: IconComponent;
  IconSortAdded: IconComponent;
  IconSortRelease: IconComponent;
  IconGrid: IconComponent;
  IconListCompact: IconComponent;
  IconPlay: IconComponent;
  IconSearch: IconComponent;
  IconTrackAction?: IconComponent;
  IconBulkTrackAction?: IconComponent;
};

export function LibrarySection({
  folderPath,
  onOpenFolderPathClick,
  isLoadingScan,
  onScan,
  query,
  onQueryChange,
  libraryViewMode,
  onLibraryViewModeChange,
  isFileSystemView,
  onFileSystemViewChange,
  fileSystemEntries,
  fileSystemCurrentPath,
  canGoUpFileSystemFolder,
  onOpenFileSystemFolder,
  onGoUpFileSystemFolder,
  librarySortMode,
  librarySortDirection,
  onLibrarySortClick,
  trackCount,
  folderCount,
  trackListRef,
  onTrackListScroll,
  virtualTrackWindow,
  selectedTrackId,
  onSelectTrack,
  onSearchTrack,
  onTrackAction,
  trackActionTitle,
  trackActionAriaLabel,
  onBulkTrackAction,
  bulkTrackActionTitle,
  bulkTrackActionAriaLabel,
  onPlayFromLibraryCover,
  enableTrackDrag = false,
  useNativeTrackDrag = true,
  onTrackDragStart,
  onTrackDragEnd,
  onTrackPointerDown,
  draggingTrackId = "",
  IconFolder,
  IconArrowUp,
  IconMusicNote,
  IconSortTitle,
  IconSortArtist,
  IconSortAdded,
  IconSortRelease,
  IconGrid,
  IconListCompact,
  IconPlay,
  IconSearch,
  IconTrackAction,
  IconBulkTrackAction,
}: LibrarySectionProps) {
  const sortDirectionSymbol = librarySortDirection === "asc" ? "↑" : "↓";
  const sortDirectionLabel = librarySortDirection === "asc" ? "ascending" : "descending";
  const isCompactView = libraryViewMode === "compact";

  const trackActionHandler = onTrackAction ?? onSearchTrack;
  const resolvedTrackActionTitle = trackActionTitle ?? "Search online for this track";
  const resolvedTrackActionAriaLabel = trackActionAriaLabel ?? "Search online for this track";
  const TrackActionIcon = IconTrackAction ?? IconSearch;
  const BulkTrackActionIcon = IconBulkTrackAction ?? IconSearch;

  return (
    <Card
      title="Library files"
      className="library-card"
      headerAfterTitle={
        <>
          <div className="library-summary" aria-label={`Tracks: ${trackCount}, folders and subfolders: ${folderCount}`}>
            <span className="library-summary-item" title="Tracks">
              <IconMusicNote className="library-summary-icon" />
              <strong>{trackCount}</strong>
            </span>
            <span className="library-summary-item" title="Folders and subfolders">
              <IconFolder className="library-summary-icon" />
              <strong>{folderCount}</strong>
            </span>
          </div>
          <button
            type="button"
            className="library-path library-path-link"
            onClick={onOpenFolderPathClick}
            disabled={!folderPath}
            title={folderPath || "No folder selected"}
            aria-label="Open library folder"
          >
            {folderPath ? folderPath : "No folder selected"}
          </button>
        </>
      }
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
        <div className="library-sort-toggle" role="group" aria-label="Library sort options">
          <button
            type="button"
            className={librarySortMode === "title" ? "sort-icon-button active" : "ghost-button sort-icon-button"}
            onClick={() => onLibrarySortClick("title")}
            title={`Sort by title (${sortDirectionLabel})`}
            aria-label={`Sort by title (${sortDirectionLabel})`}
          >
            <span className="btn-content">
              <IconSortTitle className="btn-icon" />
              {librarySortMode === "title" && <span className="sort-direction-glyph" aria-hidden="true">{sortDirectionSymbol}</span>}
            </span>
          </button>
          <button
            type="button"
            className={librarySortMode === "artist" ? "sort-icon-button active" : "ghost-button sort-icon-button"}
            onClick={() => onLibrarySortClick("artist")}
            title={`Sort by artist (${sortDirectionLabel})`}
            aria-label={`Sort by artist (${sortDirectionLabel})`}
          >
            <span className="btn-content">
              <IconSortArtist className="btn-icon" />
              {librarySortMode === "artist" && <span className="sort-direction-glyph" aria-hidden="true">{sortDirectionSymbol}</span>}
            </span>
          </button>
          <button
            type="button"
            className={librarySortMode === "added" ? "sort-icon-button active" : "ghost-button sort-icon-button"}
            onClick={() => onLibrarySortClick("added")}
            title={`Sort by date added (${sortDirectionLabel})`}
            aria-label={`Sort by date added (${sortDirectionLabel})`}
          >
            <span className="btn-content">
              <IconSortAdded className="btn-icon" />
              {librarySortMode === "added" && <span className="sort-direction-glyph" aria-hidden="true">{sortDirectionSymbol}</span>}
            </span>
          </button>
          <button
            type="button"
            className={librarySortMode === "release" ? "sort-icon-button active" : "ghost-button sort-icon-button"}
            onClick={() => onLibrarySortClick("release")}
            title={`Sort by release date (${sortDirectionLabel})`}
            aria-label={`Sort by release date (${sortDirectionLabel})`}
          >
            <span className="btn-content">
              <IconSortRelease className="btn-icon" />
              {librarySortMode === "release" && <span className="sort-direction-glyph" aria-hidden="true">{sortDirectionSymbol}</span>}
            </span>
          </button>
        </div>
        <div className="library-view-toggle">
          <button
            className="view-mode-button"
            onClick={() => onLibraryViewModeChange(isCompactView ? "card" : "compact")}
            title={isCompactView ? "Switch to card view" : "Switch to compact view"}
            aria-label={isCompactView ? "Switch to card view" : "Switch to compact view"}
          >
            <span className="btn-content">
              {isCompactView ? <IconListCompact className="btn-icon" /> : <IconGrid className="btn-icon" />}
            </span>
          </button>
          <button
            className={isFileSystemView ? "view-mode-button active" : "view-mode-button"}
            onClick={() => onFileSystemViewChange(!isFileSystemView)}
            disabled={!folderPath}
            title={isFileSystemView ? "Switch to library track view" : "Switch to file system view"}
            aria-label={isFileSystemView ? "Switch to library track view" : "Switch to file system view"}
          >
            <span className="btn-content">
              <IconFolder className="btn-icon" />
            </span>
          </button>
        </div>
        {onBulkTrackAction && (
          <div className="library-bulk-action">
            <button
              type="button"
              className="ghost-button library-bulk-action-button"
              onClick={onBulkTrackAction}
              title={bulkTrackActionTitle ?? "Apply action to all visible tracks"}
              aria-label={bulkTrackActionAriaLabel ?? "Apply action to all visible tracks"}
            >
              <span className="btn-content">
                <BulkTrackActionIcon className="btn-icon" />
              </span>
            </button>
          </div>
        )}
      </div>
      {isFileSystemView ? (
        <>
          <div className="file-system-bar">
            <button
              type="button"
              className="ghost-button file-system-up-button"
              onClick={onGoUpFileSystemFolder}
              disabled={!canGoUpFileSystemFolder}
              title="Go to parent folder"
              aria-label="Go to parent folder"
            >
              <span className="btn-content"><IconArrowUp className="btn-icon" /></span>
            </button>
            <span className="file-system-current-path" title={fileSystemCurrentPath}>{fileSystemCurrentPath}</span>
          </div>
          <ul
            ref={trackListRef as RefObject<HTMLUListElement>}
            onScroll={onTrackListScroll}
            className={isCompactView ? "track-list compact file-system-list" : "track-list file-system-list"}
          >
            {fileSystemEntries.map((entry) => (
              <li key={entry.type === "folder" ? `folder-${entry.pathSegments.join("/")}` : entry.track.id}>
                {entry.type === "folder" ? (
                  <div className={isCompactView ? "track-item-shell compact" : "track-item-shell"}>
                    <button
                      type="button"
                      className={isCompactView ? "track-item compact file-system-folder-item" : "track-item file-system-folder-item"}
                      onClick={() => onOpenFileSystemFolder(entry.pathSegments)}
                    >
                      <div className="track-thumb-trigger file-system-folder-trigger">
                        <div className="track-thumb-placeholder file-system-folder-thumb">
                          <IconFolder className="file-system-folder-icon" />
                        </div>
                      </div>
                      {isCompactView ? (
                        <span className="track-text compact">
                          <strong>{entry.name}</strong>
                          <small className="muted compact-inline">{entry.trackCount} tracks</small>
                        </span>
                      ) : (
                        <span className="track-text">
                          <strong>{entry.name}</strong>
                          <small>{entry.trackCount} tracks</small>
                          <small className="muted">Folder</small>
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className={isCompactView ? "track-item-shell compact" : "track-item-shell"}>
                    <button
                      type="button"
                      className={
                        entry.track.id === selectedTrackId
                          ? isCompactView
                            ? "track-item compact active"
                            : "track-item active"
                          : isCompactView
                            ? "track-item compact"
                            : "track-item"
                      }
                      onClick={() => onSelectTrack(entry.track)}
                      onDoubleClick={(event) => onPlayFromLibraryCover(event, entry.track)}
                    >
                      <div
                        className="track-thumb-trigger"
                        onClick={(event) => onPlayFromLibraryCover(event, entry.track)}
                        title="Play track"
                      >
                        {entry.track.coverUrl ? (
                          <img
                            src={entry.track.coverUrl}
                            alt={`Cover ${entry.track.album || entry.track.title}`}
                            className="track-thumb"
                          />
                        ) : (
                          <div className="track-thumb-placeholder">
                            <IconMusicNote className="file-system-file-icon" />
                          </div>
                        )}
                        <span className="track-thumb-play-indicator" aria-hidden="true">
                          <IconPlay className="track-thumb-play-icon" />
                        </span>
                      </div>
                      {isCompactView ? (
                        <span className="track-text compact">
                          <strong>{entry.name}</strong>
                          <small className="muted compact-inline">{entry.track.artist || entry.track.album || "Audio file"}</small>
                        </span>
                      ) : (
                        <span className="track-text">
                          <strong>{entry.name}</strong>
                          <small>{entry.track.artist || "Unknown artist"}</small>
                          <small className="muted">{entry.track.album || "Audio file"}</small>
                        </span>
                      )}
                    </button>
                    <button
                      className={isCompactView ? "ghost-button track-item-search-button compact" : "ghost-button track-item-search-button"}
                      onClick={(event) => {
                        event.stopPropagation();
                        trackActionHandler(entry.track);
                      }}
                      title={resolvedTrackActionTitle}
                      aria-label={resolvedTrackActionAriaLabel}
                    >
                      <span className="btn-content"><TrackActionIcon className="btn-icon" /></span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul
          ref={trackListRef as RefObject<HTMLUListElement>}
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
              <div
                className={
                  track.id === draggingTrackId
                    ? libraryViewMode === "compact"
                      ? "track-item-shell compact dragging"
                      : "track-item-shell dragging"
                    : libraryViewMode === "compact"
                      ? "track-item-shell compact"
                      : "track-item-shell"
                }
                draggable={enableTrackDrag && useNativeTrackDrag}
                onDragStart={(event) => {
                  if (!enableTrackDrag || !useNativeTrackDrag) {
                    return;
                  }
                  event.dataTransfer.effectAllowed = "copyMove";
                  event.dataTransfer.setData("text/plain", track.id);
                  event.dataTransfer.setData("application/x-musicmanager-track-id", track.id);
                  onTrackDragStart?.(event, track);
                }}
                onDragEnd={() => {
                  onTrackDragEnd?.();
                }}
                onPointerDown={(event) => {
                  if (!enableTrackDrag) {
                    return;
                  }
                  onTrackPointerDown?.(event, track);
                }}
              >
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
                      <small className="muted compact-inline">{track.artist || "Unknown artist"}</small>
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
                    trackActionHandler(track);
                  }}
                  title={resolvedTrackActionTitle}
                  aria-label={resolvedTrackActionAriaLabel}
                >
                  <span className="btn-content"><TrackActionIcon className="btn-icon" /></span>
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
      )}
    </Card>
  );
}
