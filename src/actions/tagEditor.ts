import { adapter } from "../api";
import { useLibraryStore } from "../store/libraryStore";
import { getEditableTrack, getSelectedTrack } from "../store/selectors";
import { useSettingsStore } from "../store/settingsStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import { useUiStore } from "../store/uiStore";
import type { OnlineMatch, Track, TrackUpdate } from "../types";
import { applyMatchToTrack } from "../domain/matches";
import { formatError } from "../utils/common";
import type { HistoryEntry } from "../domain/history";
import { recordTagChange, undoEntry, undoWithToast } from "./history";
import { changeTrackIdentity } from "./trackIdentity";

const editor = () => useTagEditorStore.getState();

/** Records the outcome in the search status line and shows it as a toast. */
function report(message: string, tone: "success" | "error" = "success", entry?: HistoryEntry | null): void {
  editor().setSearchStatus(message);
  useUiStore.getState().showToast(
    message,
    tone,
    entry ? { label: "Undo", run: () => void undoWithToast(() => undoEntry(entry)) } : undefined
  );
}

function toTrackUpdate(track: Track): TrackUpdate {
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    tracknumber: track.tracknumber,
    year: track.year,
    genre: track.genre,
  };
}

function renameConfig() {
  const { renameFields, renameSeparator } = useSettingsStore.getState();
  return { fields: renameFields, separator: renameSeparator };
}

/**
 * After tags are written (and possibly the file renamed) the path becomes the track's identity.
 * Adopts the saved track everywhere and remembers the change so it can be undone.
 */
function commitTrackAfterTagSave(currentId: string, source: Track, newPath: string, label: string): HistoryEntry | null {
  const before = getSelectedTrack();
  const finalPath = newPath || source.path;
  const committed: Track = { ...source, id: finalPath, path: finalPath };
  useLibraryStore.getState().setTracks((prev) => prev.map((track) => (track.id === currentId ? committed : track)));
  editor().setTrackDraft(committed);
  changeTrackIdentity(currentId, finalPath);
  return before ? recordTagChange(before, committed, { label }) : null;
}

function commitPathAfterRename(currentId: string, newPath: string): HistoryEntry | null {
  const before = getSelectedTrack();
  if (!newPath || !before) {
    return null;
  }
  const after: Track = { ...before, id: newPath, path: newPath };
  changeTrackIdentity(currentId, newPath);
  return recordTagChange(before, after, { label: "File renamed" });
}

function shouldRemoveCover(track: Track): boolean {
  return Boolean(getSelectedTrack()?.hasCover) && !track.hasCover && !track.coverUrl;
}

export function changeDraftField(field: keyof Track, value: string): void {
  if (!getEditableTrack()) {
    return;
  }
  editor().setTrackDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
}

export async function saveTrackTags(): Promise<void> {
  const track = getEditableTrack();
  if (!track) {
    return;
  }
  try {
    const result = await adapter.saveTrack(track.id, track.path, toTrackUpdate(track), track.coverUrl, undefined, shouldRemoveCover(track));
    const entry = commitTrackAfterTagSave(track.id, track, result.path, "Tags saved");
    report("Tags saved to track", "success", entry);
  } catch (error) {
    report(`Save error: ${formatError(error)}`, "error");
  }
}

export async function saveTrackTagsAndRename(): Promise<void> {
  const track = getEditableTrack();
  if (!track) {
    return;
  }
  try {
    const result = await adapter.saveTrack(
      track.id,
      track.path,
      toTrackUpdate(track),
      track.coverUrl,
      renameConfig(),
      shouldRemoveCover(track)
    );
    const entry = commitTrackAfterTagSave(track.id, track, result.path, "Tags saved and file renamed");
    report("Tags saved and file renamed", "success", entry);
  } catch (error) {
    report(`Save/rename error: ${formatError(error)}`, "error");
  }
}

export async function renameTrackFileOnly(): Promise<void> {
  const track = getEditableTrack();
  if (!track) {
    return;
  }
  try {
    const result = await adapter.renameTrack(track.path, toTrackUpdate(track), renameConfig());
    const entry = commitPathAfterRename(track.id, result.path);
    report("File renamed", "success", entry);
  } catch (error) {
    report(`Rename error: ${formatError(error)}`, "error");
  }
}

function applyOnlineResultToDraft(result: OnlineMatch): Track | null {
  const base = getEditableTrack();
  if (!base) {
    return null;
  }
  const next = applyMatchToTrack(base, result);
  editor().setTrackDraft(next);
  return next;
}

export function applyOnlineResult(result: OnlineMatch): void {
  if (!getEditableTrack()) {
    return;
  }
  applyOnlineResultToDraft(result);
  editor().setSearchStatus("Result applied. Save the track to confirm changes.");
}

export function applyOnlineCoverOnly(result: OnlineMatch): void {
  if (!getEditableTrack()) {
    return;
  }
  if (!result.coverUrl?.trim()) {
    editor().setSearchStatus("Selected result has no cover image.");
    return;
  }
  editor().setTrackDraft((prev) => (prev ? { ...prev, coverUrl: result.coverUrl, hasCover: true } : prev));
  editor().setSearchStatus("Cover applied. Save the track to persist changes.");
}

export async function applyAndSaveOnlineResult(result: OnlineMatch): Promise<void> {
  const current = getEditableTrack();
  if (!current) {
    return;
  }
  const next = applyOnlineResultToDraft(result);
  if (!next) {
    return;
  }
  try {
    const saved = await adapter.saveTrack(next.id, next.path, toTrackUpdate(next), next.coverUrl, undefined, shouldRemoveCover(next));
    const entry = commitTrackAfterTagSave(current.id, next, saved.path, "Online result applied");
    report("Result applied and tags saved to track", "success", entry);
  } catch (error) {
    report(`Apply and save error: ${formatError(error)}`, "error");
  }
}

export function loadDraftCoverFromFile(file: File): void {
  if (!getEditableTrack()) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    editor().setSearchStatus("Invalid cover format. Select an image file.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (typeof dataUrl !== "string") {
      editor().setSearchStatus("Unable to read cover file.");
      return;
    }
    editor().setTrackDraft((prev) => (prev ? { ...prev, coverUrl: dataUrl, hasCover: true } : prev));
    editor().setSearchStatus("Cover loaded. Save the track to persist changes.");
  };
  reader.onerror = () => editor().setSearchStatus("Unable to read cover file.");
  reader.readAsDataURL(file);
}

export function removeDraftCover(): void {
  if (!getEditableTrack()) {
    return;
  }
  editor().setTrackDraft((prev) => (prev ? { ...prev, coverUrl: undefined, hasCover: false } : prev));
  editor().setSearchStatus("Cover removed from draft. Save the track to persist changes.");
}

/** Drops the unsaved edits and shows the saved tags again. */
export function revertDraft(): void {
  const selected = getSelectedTrack();
  editor().setTrackDraft(selected ? { ...selected } : null);
  editor().setSearchStatus("Changes discarded");
}

/** Puts tags (for instance read from the file name) into the draft, to be reviewed and saved. */
export function fillDraft(patch: Partial<Pick<Track, "title" | "artist" | "album" | "tracknumber" | "year" | "genre">>): void {
  if (!getEditableTrack() || !Object.keys(patch).length) {
    return;
  }
  editor().setTrackDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  editor().setSearchStatus("Tags read from the file name. Save the track to confirm.");
}
