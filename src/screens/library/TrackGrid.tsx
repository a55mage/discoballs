import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { IconCheck, IconHeart, IconPause, IconPlay } from "../../components/icons";
import { getTrackIssues } from "../../domain/libraryView";
import { useVirtualList } from "../../hooks/useVirtualList";
import { Cover, cx } from "../../ui";
import type { Track } from "../../types";

const MIN_CARD = 168;
const GAP = 16;
const PAD = 18;
/** Card padding, cover margin and the two text lines, plus a little air between rows. */
const META_HEIGHT = 56;

type TrackGridProps = {
  tracks: Track[];
  duplicateIds: Set<string>;
  selectedIds: string[];
  cursorId: string;
  playingTrackId: string;
  isPlaying: boolean;
  favoriteIds: ReadonlySet<string>;
  onRowClick: (track: Track, event: MouseEvent) => void;
  onToggleSelected: (track: Track) => void;
  onPlay: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
  onKeyNavigate: (step: number, extend: boolean) => void;
  onSelectAll: () => void;
};

/** The tracks as a wall of covers. Virtualized by rows; the column count follows the width. */
export function TrackGrid({
  tracks,
  duplicateIds,
  selectedIds,
  cursorId,
  playingTrackId,
  isPlaying,
  favoriteIds,
  onRowClick,
  onToggleSelected,
  onPlay,
  onToggleFavorite,
  onKeyNavigate,
  onSelectAll,
}: TrackGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const measure = () => setWidth(element.clientWidth || 720);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  const inner = Math.max(MIN_CARD, width - PAD * 2);
  const columns = Math.max(1, Math.floor((inner + GAP) / (MIN_CARD + GAP)));
  const cardWidth = (inner - GAP * (columns - 1)) / columns;
  const rowHeight = Math.round(cardWidth + META_HEIGHT);
  const rowCount = Math.ceil(tracks.length / columns);
  const range = useVirtualList(scrollRef, rowCount, rowHeight);
  const selected = new Set(selectedIds);

  function keepInView(index: number) {
    const element = scrollRef.current;
    if (!element || index < 0) {
      return;
    }
    const top = Math.floor(index / columns) * rowHeight;
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
    const current = Math.max(0, tracks.findIndex((track) => track.id === cursorId));
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : event.key === "PageDown" ? columns * 3 : event.key === "PageUp" ? -columns * 3 : 0;
    if (step !== 0) {
      event.preventDefault();
      onKeyNavigate(step, event.shiftKey);
      keepInView(Math.min(tracks.length - 1, Math.max(0, current + step)));
    } else if (event.key === "Enter") {
      const track = tracks[current];
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

  const rows = [];
  for (let row = range.start; row < range.end; row += 1) {
    rows.push(tracks.slice(row * columns, row * columns + columns).map((track, column) => ({ track, index: row * columns + column })));
  }

  return (
    <div
      className="lib-grid"
      role="grid"
      aria-label="Tracks"
      aria-multiselectable="true"
      aria-rowcount={rowCount}
      aria-colcount={columns}
      tabIndex={0}
      aria-activedescendant={cursorId ? `lib-card-${cursorId}` : undefined}
      onKeyDown={onKeyDown}
    >
      <div ref={scrollRef} className="lib-grid__scroll" role="rowgroup">
        <div style={{ height: range.offsetTop }} aria-hidden="true" />
        {rows.map((cards, offset) => (
          <div
            key={range.start + offset}
            className="lib-grid__row"
            role="row"
            aria-rowindex={range.start + offset + 1}
            style={{ height: rowHeight, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {cards.map(({ track, index }) => {
              const isSelected = selected.has(track.id);
              const isCurrent = track.id === playingTrackId;
              const issues = getTrackIssues(track, duplicateIds);
              const title = track.title || fileLabel(track);
              return (
                <div
                  key={track.id}
                  id={`lib-card-${track.id}`}
                  role="gridcell"
                  aria-colindex={(index % columns) + 1}
                  aria-selected={isSelected}
                  className={cx("lib-card", isSelected && "is-selected", isCurrent && "is-current", track.id === cursorId && "is-cursor")}
                  onClick={(event) => onRowClick(track, event)}
                  onDoubleClick={() => onPlay(track)}
                >
                  <span className="lib-card__art">
                    <Cover radius={12} src={track.coverUrl} />
                    <button
                      type="button"
                      className={cx("lib-card__play", isCurrent && isPlaying && "is-playing")}
                      tabIndex={-1}
                      aria-label={isCurrent && isPlaying ? `Pause ${title}` : `Play ${title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onPlay(track);
                      }}
                    >
                      {isCurrent && isPlaying ? <IconPause aria-hidden="true" /> : <IconPlay aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className={cx("lib-check", "lib-card__check", isSelected && "is-on")}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`Select ${title}`}
                      tabIndex={-1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleSelected(track);
                      }}
                    >
                      <IconCheck aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={cx("lib-heart", "lib-card__heart", favoriteIds.has(track.id) && "is-on")}
                      aria-label={favoriteIds.has(track.id) ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
                      aria-pressed={favoriteIds.has(track.id)}
                      tabIndex={-1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(track);
                      }}
                    >
                      <IconHeart aria-hidden="true" />
                    </button>
                    {issues.length ? (
                      <span className="lib-issue lib-card__issue" title={issues.join(", ")} role="img" aria-label={`Issues: ${issues.join(", ")}`}>!</span>
                    ) : null}
                  </span>
                  <span className={cx("lib-card__title", !track.title && "is-missing")}>{title}</span>
                  <span className={cx("lib-card__artist", !track.artist && "is-missing")}>{track.artist || "Unknown artist"}</span>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ height: range.offsetBottom }} aria-hidden="true" />
        {tracks.length === 0 ? <p className="lib-empty-rows">No tracks match these filters.</p> : null}
      </div>
    </div>
  );
}

function fileLabel(track: Track): string {
  return track.path.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "") || "Untitled";
}
