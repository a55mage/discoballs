import { adapter } from "../api";
import { useLibraryStore } from "../store/libraryStore";
import { getTrackById } from "../store/selectors";
import type { Track } from "../types";
import { formatError } from "../utils/common";

export type BatchPatch = Partial<Pick<Track, "artist" | "album" | "year" | "genre">>;

export type BatchResult = {
  updated: number;
  /** Remote (Navidrome) tracks cannot be written. */
  skippedRemote: number;
  failed: Array<{ title: string; error: string }>;
};

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
 * Writes the same tags to several tracks. Tracks are saved one after the other (a failure never stops
 * the rest) and each success is reflected in the library immediately. With `autoNumber` the track
 * numbers become 1..N following the order of `trackIds`.
 */
export async function applyBatchEdit(
  trackIds: string[],
  patch: BatchPatch,
  options: { autoNumber?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<BatchResult> {
  const changes = cleanPatch(patch);
  const result: BatchResult = { updated: 0, skippedRemote: 0, failed: [] };
  const setTracks = useLibraryStore.getState().setTracks;

  for (const [index, id] of trackIds.entries()) {
    const track = getTrackById(id);
    if (!track) {
      continue;
    }
    if (track.source?.type === "navidrome") {
      result.skippedRemote += 1;
      continue;
    }
    const next: Track = { ...track, ...changes, ...(options.autoNumber ? { tracknumber: String(index + 1) } : {}) };
    try {
      await adapter.saveTrack(track.id, track.path, {
        title: next.title,
        artist: next.artist,
        album: next.album,
        tracknumber: next.tracknumber,
        year: next.year,
        genre: next.genre,
      });
      setTracks((prev) => prev.map((item) => (item.id === track.id ? { ...item, ...next, id: item.id, path: item.path } : item)));
      result.updated += 1;
    } catch (error) {
      result.failed.push({ title: track.title || track.path, error: formatError(error) });
    }
    options.onProgress?.(index + 1, trackIds.length);
  }
  return result;
}
