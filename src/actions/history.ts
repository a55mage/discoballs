import { adapter } from "../api";
import { diffTags, TAG_FIELDS, type HistoryEntry } from "../domain/history";
import { useHistoryStore } from "../store/historyStore";
import { useLibraryStore } from "../store/libraryStore";
import { getTrackById } from "../store/selectors";
import { useUiStore } from "../store/uiStore";
import type { Track } from "../types";
import { formatError, getFileName } from "../utils/common";
import { changeTrackIdentity } from "./trackIdentity";

let entryCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${(entryCounter += 1)}`;

export type RecordOptions = { label: string; batchId?: string };

/** Remembers what a save changed, so it can be undone. Returns the entry, or null when nothing changed. */
export function recordTagChange(before: Track, after: Track, options: RecordOptions): HistoryEntry | null {
  const changes = diffTags(before, after);
  const renamed = getFileName(before.path) !== getFileName(after.path);
  const coverChanged = (before.coverUrl ?? "") !== (after.coverUrl ?? "") || before.hasCover !== after.hasCover;
  if (!changes.length && !renamed && !coverChanged) {
    return null;
  }
  const entry: HistoryEntry = {
    id: newId("h"),
    at: Date.now(),
    label: options.label,
    batchId: options.batchId,
    trackId: after.id,
    trackTitle: after.title || getFileName(after.path),
    changes,
    ...(renamed ? { renamedFrom: getFileName(before.path), renamedTo: getFileName(after.path) } : {}),
    ...(coverChanged ? { coverChanged: true } : {}),
  };
  useHistoryStore.getState().add([entry]);
  return entry;
}

export function newBatchId(): string {
  return newId("batch");
}

export type UndoResult = { ok: boolean; message: string };

/** Puts the tags (and file name) of one entry back as they were. Covers are not restored. */
export async function undoEntry(entry: HistoryEntry): Promise<UndoResult> {
  if (entry.undone) {
    return { ok: false, message: "Already undone" };
  }
  const track = getTrackById(entry.trackId);
  if (!track) {
    return { ok: false, message: `“${entry.trackTitle}” is not in the library anymore` };
  }
  if (track.source?.type === "navidrome") {
    return { ok: false, message: "Remote tracks cannot be changed" };
  }
  try {
    let currentPath = track.path;
    const restored: Track = { ...track };
    for (const change of entry.changes) {
      restored[change.field] = change.from;
    }
    if (entry.changes.length) {
      await adapter.saveTrack(track.id, currentPath, Object.fromEntries(TAG_FIELDS.map(({ field }) => [field, restored[field]])) as never);
      useLibraryStore.getState().setTracks((prev) => prev.map((item) => (item.id === track.id ? { ...item, ...restored } : item)));
    }
    if (entry.renamedFrom && getFileName(currentPath) === entry.renamedTo) {
      const renamed = await adapter.renameFile(currentPath, entry.renamedFrom);
      currentPath = renamed.path;
      changeTrackIdentity(track.id, currentPath);
    }
    useHistoryStore.getState().markUndone([entry.id]);
    return { ok: true, message: entry.coverChanged ? "Tags restored (the cover is not restored)" : "Change undone" };
  } catch (error) {
    return { ok: false, message: `Undo failed: ${formatError(error)}` };
  }
}

/** Undoes every entry of a batch, newest first. */
export async function undoBatch(batchId: string): Promise<UndoResult> {
  const entries = useHistoryStore.getState().entries.filter((entry) => entry.batchId === batchId && !entry.undone);
  let done = 0;
  let firstFailure = "";
  for (const entry of entries) {
    const result = await undoEntry(entry);
    if (result.ok) {
      done += 1;
    } else if (!firstFailure) {
      firstFailure = result.message;
    }
  }
  return firstFailure
    ? { ok: false, message: `${done} of ${entries.length} undone. ${firstFailure}` }
    : { ok: true, message: `${done} ${done === 1 ? "change" : "changes"} undone` };
}

/** Undoes the most recent change that is still undoable (its whole batch, for batch edits). */
export async function undoLast(): Promise<UndoResult> {
  const latest = useHistoryStore.getState().entries.find((entry) => !entry.undone);
  if (!latest) {
    return { ok: false, message: "Nothing to undo" };
  }
  return latest.batchId ? undoBatch(latest.batchId) : undoEntry(latest);
}

/** Runs an undo and reports the outcome in a toast. */
export async function undoWithToast(run: () => Promise<UndoResult>): Promise<void> {
  const result = await run();
  useUiStore.getState().showToast(result.message, result.ok ? "success" : "error");
}
