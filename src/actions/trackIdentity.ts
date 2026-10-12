import { useFavoritesStore } from "../store/favoritesStore";
import { useHistoryStore } from "../store/historyStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { usePlayerStore } from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useTagEditorStore } from "../store/tagEditorStore";

/**
 * A track is identified by its file path, so renaming a file changes its id. This moves everything that
 * referred to the old id (library, selection, draft, playback queue, playlists, history) to the new one.
 */
export function changeTrackIdentity(oldId: string, newPath: string): void {
  if (!newPath || oldId === newPath) {
    return;
  }
  const swap = (id: string) => (id === oldId ? newPath : id);

  const library = useLibraryStore.getState();
  library.setTracks((prev) => prev.map((track) => (track.id === oldId ? { ...track, id: newPath, path: newPath } : track)));
  library.setSelectedTrackId(swap(library.selectedTrackId));

  useTagEditorStore.getState().setTrackDraft((prev) => (prev && prev.id === oldId ? { ...prev, id: newPath, path: newPath } : prev));

  const player = usePlayerStore.getState();
  player.setPlaybackTrackId(swap(player.playbackTrackId));
  player.setPlaybackQueueTrackIds((prev) => prev.map(swap));
  player.setPlaybackHistoryTrackIds((prev) => prev.map(swap));

  const view = useLibraryViewStore.getState();
  view.setSelection(view.selectedIds.map(swap), swap(view.anchorId));

  usePlaylistStore.getState().retargetTrack(oldId, newPath);
  useHistoryStore.getState().retarget(oldId, newPath);
  useFavoritesStore.getState().retarget(oldId, newPath);
}
