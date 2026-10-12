import { type PointerEvent, useEffect, useRef, useState } from "react";
import { usePlaylistStore } from "../store/playlistStore";
import type { AppScreen, Track } from "../types";

type DragKind = "none" | "library-track" | "playlist-entry";
type DragState = { kind: DragKind; id: string; startX: number; startY: number; moved: boolean };
type DropArea = "none" | "dropzone" | "playlist";

const IDLE: DragState = { kind: "none", id: "", startX: 0, startY: 0, moved: false };

/**
 * Pointer based drag & drop for the playlist editor: library tracks into the playlist and entries
 * within it. (Native HTML5 drag & drop is unreliable inside the desktop webview.)
 */
export function useDashboardDrag(activeScreen: AppScreen) {
  const dragRef = useRef<DragState>({ ...IDLE });
  const suppressNextClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dropArea, setDropArea] = useState<DropArea>("none");
  const [dropEntryId, setDropEntryId] = useState("");

  function clearDragState() {
    dragRef.current = { ...IDLE };
    setIsDragging(false);
    setDropArea("none");
    setDropEntryId("");
  }

  function applyDrop(
    payload: { kind: "library-track"; trackId: string } | { kind: "playlist-entry"; entryId: string },
    target: Element | null
  ): boolean {
    if (activeScreen !== "dashboard" || !(target instanceof HTMLElement)) {
      return false;
    }
    const entryElement = target.closest<HTMLElement>("[data-playlist-entry-id]");
    const listElement = target.closest<HTMLElement>("[data-playlist-list]");
    const dropzoneElement = target.closest<HTMLElement>("[data-playlist-dropzone]");
    if (!entryElement && !listElement && !dropzoneElement) {
      return false;
    }
    const targetEntryId = entryElement?.dataset.playlistEntryId ?? null;
    const playlists = usePlaylistStore.getState();
    if (payload.kind === "library-track") {
      playlists.insertTrack(payload.trackId, targetEntryId);
      return true;
    }
    playlists.moveEntry(payload.entryId, targetEntryId);
    return true;
  }

  useEffect(() => {
    const onPointerMove = (event: globalThis.PointerEvent) => {
      const state = dragRef.current;
      if (state.kind === "none") {
        return;
      }
      const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (!state.moved && distance > 6) {
        state.moved = true;
        setIsDragging(true);
      }
      if (!state.moved || activeScreen !== "dashboard") {
        return;
      }
      const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const hoveredEntry = hovered?.closest<HTMLElement>("[data-playlist-entry-id]");
      const hoveredDropzone = hovered?.closest<HTMLElement>("[data-playlist-dropzone]");
      const hoveredList = hovered?.closest<HTMLElement>("[data-playlist-list]");
      const nextDropArea: DropArea = hoveredDropzone ? "dropzone" : hoveredList ? "playlist" : "none";
      const nextDropEntryId = hoveredEntry?.dataset.playlistEntryId ?? "";
      setDropArea((prev) => (prev === nextDropArea ? prev : nextDropArea));
      setDropEntryId((prev) => (prev === nextDropEntryId ? prev : nextDropEntryId));
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      const state = dragRef.current;
      if (activeScreen !== "dashboard" || state.kind === "none" || !state.moved) {
        clearDragState();
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const payload =
        state.kind === "library-track"
          ? ({ kind: "library-track", trackId: state.id } as const)
          : ({ kind: "playlist-entry", entryId: state.id } as const);
      if (applyDrop(payload, target)) {
        suppressNextClickRef.current = true;
      }
      clearDragState();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [activeScreen]);

  const begin = (kind: DragKind, id: string, event: PointerEvent<HTMLElement>) => {
    dragRef.current = { kind, id, startX: event.clientX, startY: event.clientY, moved: false };
  };

  return {
    isDragging,
    dropArea,
    dropEntryId,
    draggingTrackId: isDragging && dragRef.current.kind === "library-track" ? dragRef.current.id : "",
    draggingPlaylistEntryId: isDragging && dragRef.current.kind === "playlist-entry" ? dragRef.current.id : "",
    onLibraryTrackPointerDown: (event: PointerEvent<HTMLElement>, track: Track) => begin("library-track", track.id, event),
    onPlaylistEntryPointerDown: (event: PointerEvent<HTMLElement>, entryId: string) => begin("playlist-entry", entryId, event),
    /** True once after a drop, so the click that follows the pointer-up is ignored. */
    consumeSuppressedClick: () => {
      const suppressed = suppressNextClickRef.current;
      suppressNextClickRef.current = false;
      return suppressed;
    },
  };
}
