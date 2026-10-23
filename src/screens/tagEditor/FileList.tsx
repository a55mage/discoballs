import { useMemo, useRef, useState } from "react";
import { selectTrack } from "../../actions/library";
import { type HealthFilter, getTrackIssues, matchesHealthFilter, sortTracks } from "../../domain/libraryView";
import { IconSearch } from "../../components/icons";
import { useVirtualList } from "../../hooks/useVirtualList";
import { useVisibleTracks } from "../../hooks/useVisibleTracks";
import { useLibraryStore } from "../../store/libraryStore";
import { useUiStore } from "../../store/uiStore";
import { type TagEditorSort, useLibraryViewStore } from "../../store/libraryViewStore";
import { Button, Chip, Cover, Select, Switch, TextInput, cx } from "../../ui";

const ROW_HEIGHT = 52;

type FileListProps = {
  /** True when the current draft has edits that were not saved yet. */
  dirty: boolean;
};

const CHIPS: Array<{ value: HealthFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "cover", label: "Missing cover" },
  { value: "tags", label: "Missing tags" },
  { value: "duplicates", label: "Duplicates" },
];

const SORTS: Array<{ value: TagEditorSort; label: string }> = [
  { value: "folder", label: "Folder" },
  { value: "added", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
];

/** Left pane of the Tag Editor: every track, with filters for what needs fixing (the only home of the health chips). */
export function FileList({ dirty }: FileListProps) {
  const { tracks, duplicateIds, health } = useVisibleTracks();
  const setDuplicatesOpen = useUiStore((state) => state.setDuplicatesOpen);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const [filter, setFilter] = useState<HealthFilter>("all");
  const [query, setQuery] = useState("");
  const { duplicatesIgnoreFormats, setDuplicatesIgnoreFormats, tagEditorSort, setTagEditorSort } = useLibraryViewStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    const matching = tracks.filter((track) => matchesHealthFilter(track, filter, duplicateIds) && matchesQuery(track, query));
    // "Folder" keeps the scan order (by path); the others reuse the library's sorting.
    const ordered = tagEditorSort === "folder" ? matching : sortTracks(matching, tagEditorSort, tagEditorSort === "added" ? "desc" : "asc");
    return ordered.map((track) => ({ track, issues: getTrackIssues(track, duplicateIds) }));
  }, [tracks, duplicateIds, filter, query, tagEditorSort]);
  const range = useVirtualList(scrollRef, items.length, ROW_HEIGHT);

  return (
    <section className="tag-files db-glass db-pane--divider-right" aria-label="Files">
      <header className="tag-files__head">
        <h2>Files</h2>
        <Select className="tag-files__sort" aria-label="Sort files" value={tagEditorSort} onChange={(event) => setTagEditorSort(event.target.value as TagEditorSort)}>
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>{sort.label}</option>
          ))}
        </Select>
      </header>
      <label className="tag-files__search">
        <IconSearch aria-hidden="true" />
        <TextInput type="search" placeholder="Search files…" aria-label="Search files" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="tag-files__filters" role="group" aria-label="Show tracks">
        {CHIPS.map((chip) => (
          <Chip key={chip.value} on={filter === chip.value} count={chip.value === "all" ? undefined : health[chip.value]} onClick={() => setFilter(chip.value)}>
            {chip.label}
          </Chip>
        ))}
        {health.duplicates > 0 ? <Button size="sm" variant="ghost" onClick={() => setDuplicatesOpen(true)}>Review duplicates…</Button> : null}
      </div>
      <label className="tag-files__option" title="FLAC and MP3 copies of one song are not counted as duplicates">
        <Switch label="Ignore other formats" checked={duplicatesIgnoreFormats} onChange={setDuplicatesIgnoreFormats} />
        <span>Ignore other formats</span>
      </label>
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
        {items.length === 0 ? <p className="tag-files__empty">{tracks.length ? "No tracks match." : "Open a folder to start."}</p> : null}
      </div>
    </section>
  );
}

function matchesQuery(track: { title: string; artist: string; album: string; path: string }, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [track.title, track.artist, track.album, fileName(track.path)].some((value) => value.toLowerCase().includes(needle));
}

function fileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || "Untitled";
}
