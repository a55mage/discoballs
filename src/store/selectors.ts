import type { Track } from "../types";
import { findDuplicateIds, getVisibleTracks } from "../domain/libraryView";
import { useLibraryStore } from "./libraryStore";
import { useFavoritesStore } from "./favoritesStore";
import { useLibraryViewStore } from "./libraryViewStore";
import { usePlayerStore } from "./playerStore";
import { useTagEditorStore } from "./tagEditorStore";

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

/** The track shown in the tag editor: the unsaved draft when present, else the selected track. */
export function getEditableTrack(): Track | null {
  return useTagEditorStore.getState().trackDraft ?? getSelectedTrack();
}

let cachedDuplicateTracks: Track[] | null = null;
let cachedIgnored: string[] | null = null;
let cachedDuplicateIds = new Set<string>();

/** Ids of tracks that look duplicated; recomputed only when the track list or the ignored groups change. */
export function getDuplicateIds(): Set<string> {
  const { tracks } = useLibraryStore.getState();
  const { ignoredDuplicates } = useLibraryViewStore.getState();
  if (tracks !== cachedDuplicateTracks || ignoredDuplicates !== cachedIgnored) {
    cachedDuplicateTracks = tracks;
    cachedIgnored = ignoredDuplicates;
    cachedDuplicateIds = findDuplicateIds(tracks, new Set(ignoredDuplicates));
  }
  return cachedDuplicateIds;
}

/** The Tracks tab list as currently filtered and sorted: also the queue used when playing from the library. */
export function getVisibleLibraryTracks(): Track[] {
  const { tracks } = useLibraryStore.getState();
  const { query, filter, scope, sortKey, sortDirection } = useLibraryViewStore.getState();
  const { favorites, ratings } = useFavoritesStore.getState();
  return getVisibleTracks(tracks, { query, filter, scope, sortKey, sortDirection }, getDuplicateIds(), { favoriteIds: new Set(favorites), ratings });
}
