import { adapter } from "../api";
import { useLibraryStore } from "../store/libraryStore";
import { getTrackById } from "../store/selectors";
import type { Track } from "../types";
import { formatError } from "../utils/common";
import { newBatchId, recordTagChange } from "./history";

export type TagPatch = Partial<Pick<Track, "title" | "artist" | "album" | "tracknumber" | "year" | "genre">>;
export type BatchPatch = Partial<Pick<Track, "artist" | "album" | "year" | "genre">>;

export type BatchResult = {
  updated: number;
  /** Remote (Navidrome) tracks cannot be written. */
  skippedRemote: number;
  /** Tracks whose patch changed nothing. */
  unchanged: number;
  failed: Array<{ title: string; error: string }>;
  /** Groups the history entries of this operation, so they can be undone together. */
  batchId?: string;
};

export type TrackEdit = { id: string; patch: TagPatch };

/** Which values of the patch are actually set (empty fields mean "leave as is"). */
export function cleanPatch(patch: BatchPatch): BatchPatch {
  const cleaned: BatchPatch = {};
  for (const key of ["artist", "album", "year", "genre"] as const) {
    const value = patch[key]?.trim();
    if (value) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Writes tags to several tracks, each with its own patch. Tracks are saved one after the other (a failure never
 * stops the rest) and each success is reflected in the library immediately.
 */
export async function applyTrackEdits(
  edits: TrackEdit[],
  onProgress?: (done: number, total: number) => void,
  label = "Batch edit"
): Promise<BatchResult> {
  const result: BatchResult = { updated: 0, skippedRemote: 0, unchanged: 0, failed: [], batchId: edits.length > 1 ? newBatchId() : undefined };
  const setTracks = useLibraryStore.getState().setTracks;

  for (const [index, edit] of edits.entries()) {
    const track = getTrackById(edit.id);
    if (!track) {
      continue;
    }
    if (track.source?.type === "navidrome") {
      result.skippedRemote += 1;
    } else {
      const next: Track = { ...track, ...edit.patch };
      const changed = (Object.keys(edit.patch) as Array<keyof TagPatch>).some((key) => next[key] !== track[key]);
      if (!changed) {
        result.unchanged += 1;
      } else {
        try {
          await adapter.saveTrack(track.id, track.path, {
            title: next.title,
            artist: next.artist,
            album: next.album,
            tracknumber: next.tracknumber,
            year: next.year,
            genre: next.genre,
          });
          setTracks((prev) => prev.map((item) => (item.id === track.id ? { ...item, ...edit.patch } : item)));
          recordTagChange(track, next, { label, batchId: result.batchId });
          result.updated += 1;
        } catch (error) {
          result.failed.push({ title: track.title || track.path, error: formatError(error) });
        }
      }
    }
    onProgress?.(index + 1, edits.length);
  }
  return result;
}

/**
 * Writes the same tags to several tracks. With `autoNumber` the track numbers become 1..N following the
 * order of `trackIds`.
 */
export async function applyBatchEdit(
  trackIds: string[],
  patch: BatchPatch,
  options: { autoNumber?: boolean; onProgress?: (done: number, total: number) => void; label?: string } = {}
): Promise<BatchResult> {
  const changes = cleanPatch(patch);
  return applyTrackEdits(
    trackIds.map((id, index) => ({ id, patch: { ...changes, ...(options.autoNumber ? { tracknumber: String(index + 1) } : {}) } })),
    options.onProgress,
    options.label ?? "Batch edit"
  );
}

/** One-line summary for a toast. */
export function describeBatchResult(result: BatchResult): { message: string; tone: "success" | "error" } {
  const extras = [
    result.unchanged ? `${result.unchanged} unchanged` : "",
    result.skippedRemote ? `${result.skippedRemote} remote skipped` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const suffix = extras ? ` · ${extras}` : "";
  if (result.failed.length) {
    return { message: `${result.updated} updated, ${result.failed.length} failed: ${result.failed[0].error}${suffix}`, tone: "error" };
  }
  return { message: `${result.updated} ${result.updated === 1 ? "track" : "tracks"} updated${suffix}`, tone: "success" };
}
