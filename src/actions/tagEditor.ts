import { adapter } from "../api";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { getEditableTrack, getSelectedTrack } from "../store/selectors";
import { useSettingsStore } from "../store/settingsStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import type { OnlineMatch, Track, TrackUpdate } from "../types";
import { formatError } from "../utils/common";

const editor = () => useTagEditorStore.getState();

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

/** After tags are written (and possibly the file renamed) the path becomes the track's identity. */
function commitTrackAfterTagSave(currentId: string, source: Track, newPath: string): void {
  const finalPath = newPath || source.path;
  const committed: Track = { ...source, id: finalPath, path: finalPath };
  const library = useLibraryStore.getState();
  library.setTracks((prev) => prev.map((track) => (track.id === currentId ? committed : track)));
  editor().setTrackDraft(committed);
  library.setSelectedTrackId(finalPath);
  const player = usePlayerStore.getState();
  if (player.playbackTrackId === currentId) {
    player.setPlaybackTrackId(finalPath);
  }
}

function commitPathAfterRename(currentId: string, newPath: string): void {
  if (!newPath) {
    return;
  }
  const library = useLibraryStore.getState();
  library.setTracks((prev) =>
    prev.map((track) => (track.id === currentId ? { ...track, id: newPath, path: newPath } : track))
  );
  editor().setTrackDraft((prev) => (prev ? { ...prev, id: newPath, path: newPath } : prev));
  library.setSelectedTrackId(newPath);
  const player = usePlayerStore.getState();
  if (player.playbackTrackId === currentId) {
    player.setPlaybackTrackId(newPath);
  }
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
    commitTrackAfterTagSave(track.id, track, result.path);
    editor().setSearchStatus("Tags saved to track");
  } catch (error) {
    editor().setSearchStatus(`Save error: ${formatError(error)}`);
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
    commitTrackAfterTagSave(track.id, track, result.path);
    editor().setSearchStatus("Tags saved and file renamed");
  } catch (error) {
    editor().setSearchStatus(`Save/rename error: ${formatError(error)}`);
  }
}

export async function renameTrackFileOnly(): Promise<void> {
  const track = getEditableTrack();
  if (!track) {
    return;
  }
  try {
    const result = await adapter.renameTrack(track.path, toTrackUpdate(track), renameConfig());
    commitPathAfterRename(track.id, result.path);
    editor().setSearchStatus("File renamed");
  } catch (error) {
    editor().setSearchStatus(`Rename error: ${formatError(error)}`);
  }
}

function applyOnlineResultToDraft(result: OnlineMatch): Track | null {
  const base = getEditableTrack();
  if (!base) {
    return null;
  }
  const next: Track = {
    ...base,
    title: result.title,
    artist: result.artist,
    album: result.album,
    tracknumber: result.tracknumber ?? base.tracknumber,
    year: result.date.slice(0, 4),
    coverUrl: result.coverUrl,
    hasCover: Boolean(result.coverUrl),
  };
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
    commitTrackAfterTagSave(current.id, next, saved.path);
    editor().setSearchStatus("Result applied and tags saved to track");
  } catch (error) {
    editor().setSearchStatus(`Apply and save error: ${formatError(error)}`);
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
