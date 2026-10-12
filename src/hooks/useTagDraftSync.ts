import { useEffect } from "react";
import { useLibraryStore } from "../store/libraryStore";
import { useTagEditorStore } from "../store/tagEditorStore";

/** Resets the tag editor draft to the selected track whenever the selection or the library changes. */
export function useTagDraftSync(): void {
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);

  useEffect(() => {
    const selected = tracks.find((track) => track.id === selectedTrackId) ?? null;
    useTagEditorStore.getState().setTrackDraft(selected ? { ...selected } : null);
  }, [selectedTrackId, tracks]);
}
