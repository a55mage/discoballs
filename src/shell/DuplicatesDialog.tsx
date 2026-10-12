import { useMemo, useState } from "react";
import { IconFolder } from "../components/icons";
import { openTrackInFileManager } from "../actions/library";
import { findDuplicateGroups, getFormat, suggestKeep } from "../domain/libraryView";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { useUiStore } from "../store/uiStore";
import { Badge, Button, Cover, Dialog, IconButton } from "../ui";

/**
 * Walks through the tracks that look like the same song. DiscoBalls does not delete files: it suggests which
 * copy to keep, lets you select the extras in the library and show them in your file manager.
 */
export function DuplicatesDialog() {
  const { isDuplicatesOpen, setDuplicatesOpen, setActiveScreen, showToast } = useUiStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const view = useLibraryViewStore();
  const [choices, setChoices] = useState<Record<string, string>>({});

  const ignored = useMemo(() => new Set(view.ignoredDuplicates), [view.ignoredDuplicates]);
  const groups = useMemo(() => findDuplicateGroups(tracks, ignored), [tracks, ignored]);
  const keepOf = (key: string, fallback: string) => choices[key] ?? fallback;

  const extrasOf = (group: (typeof groups)[number]) => {
    const keep = keepOf(group.key, suggestKeep(group).id);
    return group.tracks.filter((track) => track.id !== keep).map((track) => track.id);
  };

  function selectExtras(ids: string[]) {
    view.setFilter("all");
    view.setScope(null);
    view.setTab("tracks");
    view.setSelection(ids, ids[0]);
    setActiveScreen("library");
    setDuplicatesOpen(false);
    showToast(`${ids.length} ${ids.length === 1 ? "track" : "tracks"} selected. Remove them in your file manager if you don’t need them.`, "info");
  }

  return (
    <Dialog
      open={isDuplicatesOpen}
      onClose={() => setDuplicatesOpen(false)}
      title="Review duplicates"
      width={760}
      footer={
        <>
          {view.ignoredDuplicates.length ? (
            <Button variant="ghost" onClick={view.resetIgnoredDuplicates}>Show the {view.ignoredDuplicates.length} ignored again</Button>
          ) : null}
          <Button variant="primary" disabled={groups.length === 0} onClick={() => selectExtras(groups.flatMap(extrasOf))}>
            Select all the extra copies
          </Button>
        </>
      }
    >
      <p className="dup__intro">
        {groups.length
          ? `${groups.length} ${groups.length === 1 ? "song appears" : "songs appear"} more than once. The suggested copy to keep is marked: lossless first, then complete tags and artwork.`
          : "No duplicates found. Songs with the same title and artist would show up here."}
      </p>
      <div className="dup__groups">
        {groups.map((group) => {
          const keep = keepOf(group.key, suggestKeep(group).id);
          const name = `keep-${group.key}`;
          return (
            <section key={group.key} className="dup__group" aria-label={`${group.tracks[0].title} by ${group.tracks[0].artist}`}>
              <header>
                <h3>{group.tracks[0].title} <span>{group.tracks[0].artist}</span></h3>
                <div className="dup__group-actions">
                  <Button size="sm" onClick={() => selectExtras(extrasOf(group))}>Select the others</Button>
                  <Button size="sm" variant="ghost" onClick={() => view.ignoreDuplicateGroup(group.key)}>Not duplicates</Button>
                </div>
              </header>
              <ul>
                {group.tracks.map((track) => (
                  <li key={track.id} className={track.id === keep ? "is-keep" : undefined}>
                    <label>
                      <input type="radio" name={name} checked={track.id === keep} onChange={() => setChoices((current) => ({ ...current, [group.key]: track.id }))} />
                      <Cover size={40} radius={8} src={track.coverUrl} />
                      <span className="dup__text">
                        <span className="dup__album">{track.album || "Unknown album"}{track.year ? ` · ${track.year}` : ""}</span>
                        <span className="dup__path" title={track.path}>{track.path}</span>
                      </span>
                      <Badge tone="neutral">{getFormat(track) || "?"}</Badge>
                      <span className="dup__keep">{track.id === keep ? <Badge>Keep</Badge> : null}</span>
                    </label>
                    <IconButton label={`Show ${track.title} in the file manager`} size="sm" onClick={() => void openTrackInFileManager(track.path)}>
                      <IconFolder />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
