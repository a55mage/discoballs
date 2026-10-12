import { type KeyboardEvent, type MouseEvent, useRef } from "react";
import { IconCheck, IconPause, IconPlay } from "../../components/icons";
import { getFormat, getTrackIssues, type SortKey } from "../../domain/libraryView";
import { useVirtualList } from "../../hooks/useVirtualList";
import { Badge, Cover, cx } from "../../ui";
import type { Track } from "../../types";

const ROW_HEIGHT = { comfortable: 60, compact: 40 } as const;
const COVER_SIZE = { comfortable: 44, compact: 28 } as const;

type TrackTableProps = {
  tracks: Track[];
  duplicateIds: Set<string>;
  density: "comfortable" | "compact";
  selectedIds: string[];
  cursorId: string;
  playingTrackId: string;
  isPlaying: boolean;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onRowClick: (track: Track, event: MouseEvent) => void;
  onToggleSelected: (track: Track) => void;
  onToggleAll: () => void;
  onPlay: (track: Track) => void;
  onKeyNavigate: (step: number, extend: boolean) => void;
  onSelectAll: () => void;
};

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "title", label: "Title" },
  { key: "album", label: "Album" },
  { key: "year", label: "Year" },
  { key: "genre", label: "Genre" },
  { key: "format", label: "Format" },
];

/** Virtualized, sortable, multi-select track list (ARIA grid). */
export function TrackTable({
  tracks,
  duplicateIds,
  density,
  selectedIds,
  cursorId,
  playingTrackId,
  isPlaying,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  onToggleSelected,
  onToggleAll,
  onPlay,
  onKeyNavigate,
  onSelectAll,
}: TrackTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = ROW_HEIGHT[density];
  const range = useVirtualList(scrollRef, tracks.length, rowHeight);
  const selected = new Set(selectedIds);
  const allSelected = tracks.length > 0 && tracks.every((track) => selected.has(track.id));

  function keepInView(index: number) {
    const element = scrollRef.current;
    if (!element || index < 0) {
      return;
    }
    const top = index * rowHeight;
    if (top < element.scrollTop) {
      element.scrollTop = top;
    } else if (top + rowHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + rowHeight - element.clientHeight;
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      onSelectAll();
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : event.key === "PageDown" ? 10 : event.key === "PageUp" ? -10 : 0;
    if (step) {
      event.preventDefault();
      onKeyNavigate(step, event.shiftKey);
      const currentIndex = tracks.findIndex((track) => track.id === cursorId);
      keepInView(Math.max(0, Math.min(tracks.length - 1, currentIndex + step)));
    } else if (event.key === "Enter") {
      const track = tracks.find((item) => item.id === cursorId);
      if (track) {
        event.preventDefault();
        onPlay(track);
      }
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onKeyNavigate(event.key === "Home" ? -tracks.length : tracks.length, event.shiftKey);
      keepInView(event.key === "Home" ? 0 : tracks.length - 1);
    }
  }

  const visible = tracks.slice(range.start, range.end);

  return (
    <div className={cx("lib-table", `lib-table--${density}`)} role="grid" aria-label="Tracks" aria-multiselectable="true" aria-rowcount={tracks.length + 1}>
      <div className="lib-row lib-row--head" role="row">
        <div role="columnheader" className="lib-cell lib-cell--check">
          <button type="button" className={cx("lib-check", allSelected && "is-on")} role="checkbox" aria-checked={allSelected} aria-label="Select all tracks" onClick={onToggleAll}>
            <IconCheck aria-hidden="true" />
          </button>
        </div>
        {COLUMNS.map((column) => (
          <div
            key={column.key}
            role="columnheader"
            aria-sort={sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            className={cx("lib-cell", `lib-cell--${column.key}`)}
          >
            <button type="button" className="lib-sort" onClick={() => onSort(column.key)}>
              {column.label}
              <span aria-hidden="true">{sortKey === column.key ? (sortDirection === "asc" ? "↑" : "↓") : ""}</span>
            </button>
          </div>
        ))}
        <div role="columnheader" className="lib-cell lib-cell--status"><span className="db-sr-only">Issues</span></div>
      </div>

      <div
        ref={scrollRef}
        className="lib-scroll"
        tabIndex={0}
        aria-activedescendant={cursorId ? `lib-row-${cursorId}` : undefined}
        onKeyDown={onKeyDown}
      >
        <div style={{ height: range.offsetTop }} aria-hidden="true" />
        {visible.map((track, offset) => {
          const index = range.start + offset;
          const isSelected = selected.has(track.id);
          const isCurrent = track.id === playingTrackId;
          const issues = getTrackIssues(track, duplicateIds);
          return (
            <div
              key={track.id}
              id={`lib-row-${track.id}`}
              role="row"
              aria-selected={isSelected}
              aria-rowindex={index + 2}
              className={cx("lib-row", isSelected && "is-selected", isCurrent && "is-current", track.id === cursorId && "is-cursor")}
              style={{ height: rowHeight }}
              onClick={(event) => onRowClick(track, event)}
              onDoubleClick={() => onPlay(track)}
            >
              <div role="gridcell" className="lib-cell lib-cell--check">
                <button
                  type="button"
                  className={cx("lib-check", isSelected && "is-on")}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`Select ${track.title || "track"}`}
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleSelected(track);
                  }}
                >
                  <IconCheck aria-hidden="true" />
                </button>
              </div>
              <div role="gridcell" className="lib-cell lib-cell--title">
                <span className="lib-cover">
                  <Cover size={COVER_SIZE[density]} radius={density === "compact" ? 6 : 8} src={track.coverUrl} />
                  <button
                    type="button"
                    className={cx("lib-play", isCurrent && isPlaying && "is-playing")}
                    tabIndex={-1}
                    aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPlay(track);
                    }}
                  >
                    {isCurrent && isPlaying ? <IconPause aria-hidden="true" /> : <IconPlay aria-hidden="true" />}
                  </button>
                </span>
                <span className="lib-title-text">
                  <span className={cx("lib-title", !track.title && "is-missing")}>{track.title || fileLabel(track)}</span>
                  {density === "comfortable" ? (
                    <span className={cx("lib-artist", !track.artist && "is-missing")}>{track.artist || "Unknown artist"}</span>
                  ) : null}
                </span>
              </div>
              <div role="gridcell" className={cx("lib-cell", "lib-cell--album", !track.album && "is-missing")}>{track.album || "—"}</div>
              <div role="gridcell" className={cx("lib-cell", "lib-cell--year", !track.year && "is-missing")}>{track.year || "—"}</div>
              <div role="gridcell" className={cx("lib-cell", "lib-cell--genre", !track.genre && "is-missing")}>{track.genre || "—"}</div>
              <div role="gridcell" className="lib-cell lib-cell--format"><Badge tone="neutral">{getFormat(track) || "?"}</Badge></div>
              <div role="gridcell" className="lib-cell lib-cell--status">
                {issues.length ? (
                  <span className="lib-issue" title={issues.join(", ")} role="img" aria-label={`Issues: ${issues.join(", ")}`}>!</span>
                ) : null}
              </div>
            </div>
          );
        })}
        <div style={{ height: range.offsetBottom }} aria-hidden="true" />
        {tracks.length === 0 ? <p className="lib-empty-rows">No tracks match these filters.</p> : null}
      </div>
    </div>
  );
}

function fileLabel(track: Track): string {
  return track.path.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "") || "Untitled";
}
