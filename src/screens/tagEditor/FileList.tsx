import { useMemo, useRef, useState } from "react";
import { selectTrack } from "../../actions/library";
import { getTrackIssues } from "../../domain/libraryView";
import { useVirtualList } from "../../hooks/useVirtualList";
import { useVisibleTracks } from "../../hooks/useVisibleTracks";
import { useLibraryStore } from "../../store/libraryStore";
import { Chip, Cover, cx } from "../../ui";

const ROW_HEIGHT = 52;

type FileListProps = {
  /** True when the current draft has edits that were not saved yet. */
  dirty: boolean;
};

/** Left pane of the Tag Editor: every track, optionally only those with something to fix. */
export function FileList({ dirty }: FileListProps) {
  const { tracks, duplicateIds } = useVisibleTracks();
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(
    () =>
      tracks
        .map((track) => ({ track, issues: getTrackIssues(track, duplicateIds) }))
        .filter((item) => !onlyIssues || item.issues.length > 0),
    [tracks, duplicateIds, onlyIssues]
  );
  const range = useVirtualList(scrollRef, items.length, ROW_HEIGHT);

  return (
    <section className="tag-files db-glass db-pane--divider-right" aria-label="Files">
      <header className="tag-files__head">
        <h2>Files</h2>
        <Chip on={onlyIssues} onClick={() => setOnlyIssues((value) => !value)}>Needs attention</Chip>
      </header>
      <div ref={scrollRef} className="tag-files__scroll">
        <ul aria-label="Tracks" style={{ paddingTop: range.offsetTop, paddingBottom: range.offsetBottom }}>
          {items.slice(range.start, range.end).map(({ track, issues }) => {
            const isSelected = track.id === selectedTrackId;
            return (
              <li key={track.id}>
                <button type="button" className={cx("tag-file", isSelected && "is-selected")} style={{ height: ROW_HEIGHT }} aria-current={isSelected || undefined} onClick={() => selectTrack(track)}>
                  <Cover size={36} radius={8} src={track.coverUrl} />
                  <span className="tag-file__text">
                    <span className="tag-file__title">{track.title || fileName(track.path)}</span>
                    <span className="tag-file__artist">{track.artist || "Unknown artist"}</span>
                  </span>
                  {isSelected && dirty ? <span className="tag-file__dirty" role="img" aria-label="Unsaved changes" /> : null}
                  {issues.length ? <span className="tag-file__warn" role="img" aria-label={`Issues: ${issues.join(", ")}`} title={issues.join(", ")}>!</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {items.length === 0 ? <p className="tag-files__empty">{tracks.length ? "Nothing needs attention." : "Open a folder to start."}</p> : null}
      </div>
    </section>
  );
}

function fileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || "Untitled";
}
