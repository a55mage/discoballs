import type { Track } from "../types";
import { useLibraryStore } from "./libraryStore";
import { usePlayerStore } from "./playerStore";

let cachedTracks: Track[] | null = null;
let cachedMap = new Map<string, Track>();

/** Id → track map for the current library, rebuilt only when the track list changes. */
export function getTrackMap(): Map<string, Track> {
  const { tracks } = useLibraryStore.getState();
  if (tracks !== cachedTracks) {
    cachedTracks = tracks;
    cachedMap = new Map(tracks.map((track) => [track.id, track]));
  }
  return cachedMap;
}

export function getTrackById(trackId: string): Track | undefined {
  return getTrackMap().get(trackId);
}

export function getSelectedTrack(): Track | null {
  return getTrackById(useLibraryStore.getState().selectedTrackId) ?? null;
}

export function getPlaybackTrack(): Track | null {
  return getTrackById(usePlayerStore.getState().playbackTrackId) ?? null;
}

export function getPlaybackQueueTracks(): Track[] {
  const map = getTrackMap();
  return usePlayerStore
    .getState()
    .playbackQueueTrackIds.map((trackId) => map.get(trackId) ?? null)
    .filter((track): track is Track => Boolean(track));
}

export function getPlaybackTrackIndex(): number {
  const { playbackTrackId } = usePlayerStore.getState();
  return getPlaybackQueueTracks().findIndex((track) => track.id === playbackTrackId);
}
