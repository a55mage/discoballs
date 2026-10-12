import { getIdRange } from "../domain/libraryView";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { getTrackById, getVisibleLibraryTracks } from "../store/selectors";
import { selectTrack } from "./library";

const view = () => useLibraryViewStore.getState();

function activate(id: string): void {
  const track = getTrackById(id);
  if (track) {
    selectTrack(track);
  }
}

/** Plain click: select just this track and make it the active one (tag editor, inspector). */
export function selectOnly(id: string): void {
  view().setSelection([id], id);
  activate(id);
}

/** Ctrl/Cmd-click or checkbox: add or remove a track from the selection. */
export function toggleSelected(id: string): void {
  const { selectedIds } = view();
  const next = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
  view().setSelection(next, id);
  if (next.includes(id)) {
    activate(id);
  }
}

/** Shift-click: everything between the anchor and this track in the current list. */
export function selectRangeTo(id: string): void {
  const { anchorId } = view();
  const orderedIds = getVisibleLibraryTracks().map((track) => track.id);
  const range = getIdRange(orderedIds, anchorId || id, id);
  view().setSelection(range, anchorId || id);
  activate(id);
}

/** Select every track of the current list (or none, when they are all selected already). */
export function toggleSelectAll(): void {
  const ids = getVisibleLibraryTracks().map((track) => track.id);
  const { selectedIds } = view();
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  view().setSelection(allSelected ? [] : ids, ids[0]);
}

export function clearSelection(): void {
  view().setSelection([]);
}

/** Moves the selection one step in the list (arrow keys); `extend` grows the range like shift-click. */
export function moveSelection(step: number, extend: boolean): void {
  const orderedIds = getVisibleLibraryTracks().map((track) => track.id);
  if (!orderedIds.length) {
    return;
  }
  const { anchorId, selectedIds } = view();
  const current = orderedIds.indexOf(selectedIds[selectedIds.length - 1] ?? anchorId);
  const nextIndex = Math.max(0, Math.min(orderedIds.length - 1, current < 0 ? (step > 0 ? 0 : orderedIds.length - 1) : current + step));
  const nextId = orderedIds[nextIndex];
  if (extend) {
    const origin = anchorId || orderedIds[Math.max(current, 0)];
    view().setSelection(getIdRange(orderedIds, origin, nextId), origin);
  } else {
    view().setSelection([nextId], nextId);
  }
  activate(nextId);
}
