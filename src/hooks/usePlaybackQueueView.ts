import { useMemo } from "react";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "../types";

/** The playback queue resolved to tracks: upcoming (paged), history and navigation bounds. */
export function usePlaybackQueueView() {
  const tracks = useLibraryStore((state) => state.tracks);
  const { playbackTrackId, playbackQueueTrackIds, playbackHistoryTrackIds, playerQueueVisibleCount } = usePlayerStore();

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const playbackQueueTracks = useMemo(
    () => playbackQueueTrackIds.map((id) => trackById.get(id) ?? null).filter((track): track is Track => Boolean(track)),
    [playbackQueueTrackIds, trackById]
  );
  const playbackTrackIndex = useMemo(
    () => playbackQueueTracks.findIndex((track) => track.id === playbackTrackId),
    [playbackQueueTracks, playbackTrackId]
  );
  const startIndex = playbackTrackIndex >= 0 ? playbackTrackIndex : 0;
  const upcomingTracks = useMemo(
    () => playbackQueueTracks.slice(startIndex, startIndex + playerQueueVisibleCount),
    [playbackQueueTracks, startIndex, playerQueueVisibleCount]
  );
  const historyTracks = useMemo(
    () => playbackHistoryTrackIds.map((id) => trackById.get(id) ?? null).filter((track): track is Track => Boolean(track)),
    [playbackHistoryTrackIds, trackById]
  );

  return {
    trackById,
    playbackQueueTracks,
    playbackTrackIndex,
    upcomingTracks,
    historyTracks,
    hasMoreUpcomingTracks: startIndex + playerQueueVisibleCount < playbackQueueTracks.length,
  };
}
