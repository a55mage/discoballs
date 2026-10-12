import { useEffect, useMemo } from "react";
import { ensureAudioGraphReady } from "../actions/playback";
import { selectTrack } from "../actions/library";
import { adapter } from "../api";
import { audioRef } from "../audio/audioRef";
import { areTrackIdListsEqual, buildPlaylistQueueOrder, shuffleTrackIds } from "../domain/playlist";
import { useEqualizerStore } from "../store/equalizerStore";
import { useLibraryStore } from "../store/libraryStore";
import {
  PLAYER_QUEUE_HISTORY_SIZE,
  PLAYER_QUEUE_PAGE_SIZE,
  playbackRuntime,
  usePlayerStore,
} from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";
import { getPlaybackQueueTracks, getPlaybackTrackIndex } from "../store/selectors";
import type { Track } from "../types";
import { applyEqualizerSettings, getOrCreateMediaAudioGraph } from "../utils/audioGraph";

const player = () => usePlayerStore.getState();

/**
 * Keeps the <audio> element, the Web Audio graph and the playback queue in sync with the stores.
 * Mount it once, high in the tree.
 */
export function usePlaybackEngine(): void {
  const tracks = useLibraryStore((state) => state.tracks);
  const playlists = usePlaylistStore((state) => state.playlists);
  const {
    playbackTrackId,
    playbackPlaylistId,
    playbackQueueTrackIds,
    isShuffleEnabled,
    volume,
    isMuted,
    audioSrc,
    audioTrackId,
    shouldAutoplay,
  } = usePlayerStore();
  const { equalizerBandGains, equalizerPreampDb, equalizerWetMixPercent } = useEqualizerStore();

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const playbackTrack: Track | null = trackById.get(playbackTrackId) ?? null;

  // <audio> element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => player().setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => player().setDuration(audio.duration || 0);
    const onEnded = async () => {
      const state = player();
      if (state.isRepeatTrackEnabled && state.playbackTrackId) {
        audio.currentTime = 0;
        try {
          await ensureAudioGraphReady();
          await audio.play();
          state.setIsPlaying(true);
          state.setAudioError("");
          return;
        } catch {
          state.setIsPlaying(false);
          state.setAudioError("Unable to start playback in this environment.");
          return;
        }
      }
      const queueTracks = getPlaybackQueueTracks();
      const currentIndex = getPlaybackTrackIndex();
      if (currentIndex >= 0 && currentIndex < queueTracks.length - 1) {
        const nextTrack = queueTracks[currentIndex + 1];
        if (nextTrack) {
          state.setPlaybackTrackId(nextTrack.id);
          state.setShouldAutoplay(true);
          selectTrack(nextTrack);
          return;
        }
      }
      state.setIsPlaying(false);
    };
    const onError = () => player().setAudioError("Playback unavailable for this track.");

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // Volume / mute.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const graph = getOrCreateMediaAudioGraph(audio);
    const targetGain = isMuted ? 0 : volume;
    if (graph) {
      const now = graph.context.currentTime;
      graph.outputGain.gain.cancelScheduledValues(now);
      graph.outputGain.gain.setTargetAtTime(targetGain, now, 0.015);
      audio.volume = 1;
      audio.muted = false;
      return;
    }
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted, audioSrc]);

  // Equalizer.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const graph = getOrCreateMediaAudioGraph(audio);
    if (!graph) {
      return;
    }
    applyEqualizerSettings(graph, {
      bandGains: equalizerBandGains,
      preampDb: equalizerPreampDb,
      wetMixPercent: equalizerWetMixPercent,
    });
  }, [equalizerBandGains, equalizerPreampDb, equalizerWetMixPercent, audioSrc]);

  // Load the audio source of the playback track.
  useEffect(() => {
    let cancelled = false;
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const state = player();
    audio.pause();
    state.setIsPlaying(false);
    state.setCurrentTime(0);
    state.setDuration(0);

    if (!playbackTrack?.path) {
      state.setAudioSrc("");
      state.setAudioTrackId("");
      state.setAudioError("");
      state.setShouldAutoplay(false);
      return;
    }

    (async () => {
      try {
        const src = await adapter.getAudioSource(playbackTrack);
        if (cancelled) {
          return;
        }
        state.setAudioSrc(src);
        state.setAudioTrackId(playbackTrackId);
        state.setAudioError("");
      } catch {
        if (cancelled) {
          return;
        }
        state.setAudioSrc("");
        state.setAudioTrackId("");
        state.setAudioError("Playback unavailable for this track.");
        state.setShouldAutoplay(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playbackTrack?.path, playbackTrackId]);

  // Autoplay once the source of the wanted track is ready.
  useEffect(() => {
    if (!shouldAutoplay || !audioSrc || !audioTrackId || audioTrackId !== playbackTrackId) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureAudioGraphReady();
        await audio.play();
        if (cancelled) {
          return;
        }
        player().setIsPlaying(true);
        player().setAudioError("");
      } catch {
        if (cancelled) {
          return;
        }
        player().setAudioError("Unable to start playback in this environment.");
        player().setIsPlaying(false);
      } finally {
        if (!cancelled) {
          player().setShouldAutoplay(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioSrc, shouldAutoplay, audioTrackId, playbackTrackId]);

  // Drop queue/history entries whose tracks disappeared from the library.
  useEffect(() => {
    const state = player();
    state.setPlaybackQueueTrackIds((prev) => {
      const next = prev.filter((trackId) => trackById.has(trackId));
      if (next.length === prev.length && next.every((trackId, index) => trackId === prev[index])) {
        return prev;
      }
      return next;
    });
    state.setPlaybackHistoryTrackIds((prev) => {
      const next = prev.filter((trackId) => trackById.has(trackId));
      if (next.length === prev.length && next.every((trackId, index) => trackId === prev[index])) {
        return prev;
      }
      return next.slice(-PLAYER_QUEUE_HISTORY_SIZE);
    });
  }, [trackById]);

  // Remember the previously played track.
  useEffect(() => {
    if (!playbackTrackId) {
      playbackRuntime.previousTrackId = "";
      return;
    }
    const previousTrackId = playbackRuntime.previousTrackId;
    if (previousTrackId && previousTrackId !== playbackTrackId) {
      player().setPlaybackHistoryTrackIds((prev) => {
        const withoutPreviousTrack = prev.filter((trackId) => trackId !== previousTrackId);
        return [...withoutPreviousTrack, previousTrackId].slice(-PLAYER_QUEUE_HISTORY_SIZE);
      });
    }
    playbackRuntime.previousTrackId = playbackTrackId;
  }, [playbackTrackId]);

  // Reshuffle the queue when shuffle is switched on.
  useEffect(() => {
    if (playbackRuntime.previousShuffleEnabled === isShuffleEnabled) {
      return;
    }
    playbackRuntime.previousShuffleEnabled = isShuffleEnabled;
    if (!isShuffleEnabled) {
      return;
    }
    if (!playbackQueueTrackIds.length) {
      return;
    }
    const state = player();

    if (playbackPlaylistId) {
      const playlist = playlists.find((item) => item.id === playbackPlaylistId);
      if (playlist) {
        const playlistTrackIds = playlist.entries.map((entry) => entry.trackId).filter((trackId) => trackById.has(trackId));
        const startTrackId =
          playbackTrackId && playlistTrackIds.includes(playbackTrackId) ? playbackTrackId : playlistTrackIds[0];
        const nextQueueTrackIds = buildPlaylistQueueOrder(playlistTrackIds, true, startTrackId);
        if (nextQueueTrackIds.length) {
          state.setPlaybackQueueTrackIds(nextQueueTrackIds);
          state.setPlaybackHistoryTrackIds([]);
          state.setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
          playbackRuntime.previousTrackId = playbackTrackId || "";
        }
        return;
      }
    }

    const startTrackId =
      playbackTrackId && playbackQueueTrackIds.includes(playbackTrackId) ? playbackTrackId : playbackQueueTrackIds[0];
    if (!startTrackId) {
      return;
    }
    const remainingTrackIds = playbackQueueTrackIds.filter((trackId) => trackId !== startTrackId);
    state.setPlaybackQueueTrackIds([startTrackId, ...shuffleTrackIds(remainingTrackIds)]);
    state.setPlaybackHistoryTrackIds([]);
    state.setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
    playbackRuntime.previousTrackId = playbackTrackId || startTrackId;
  }, [isShuffleEnabled, playbackPlaylistId, playbackTrackId, playbackQueueTrackIds, playlists, trackById]);

  // Playback from a playlist: keep the queue aligned with the playlist while it is edited.
  useEffect(() => {
    if (!playbackPlaylistId) {
      return;
    }
    const playlist = playlists.find((item) => item.id === playbackPlaylistId);
    if (!playlist) {
      return;
    }
    const state = player();
    const playlistTrackIds = playlist.entries.map((entry) => entry.trackId).filter((trackId) => trackById.has(trackId));
    if (!playlistTrackIds.length) {
      state.setPlaybackQueueTrackIds([]);
      state.setPlaybackHistoryTrackIds([]);
      state.setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
      return;
    }

    const playlistTrackIdSet = new Set(playlistTrackIds);
    const currentTrackId = playbackTrackId && playlistTrackIdSet.has(playbackTrackId) ? playbackTrackId : "";

    let nextQueueTrackIds: string[] = [];
    if (isShuffleEnabled) {
      const startTrackId =
        currentTrackId || playbackQueueTrackIds.find((trackId) => playlistTrackIdSet.has(trackId)) || playlistTrackIds[0];
      if (!startTrackId) {
        return;
      }
      const preservedTrackIds = playbackQueueTrackIds.filter(
        (trackId) => trackId !== startTrackId && playlistTrackIdSet.has(trackId)
      );
      const newTrackIds = playlistTrackIds.filter(
        (trackId) => trackId !== startTrackId && !preservedTrackIds.includes(trackId)
      );
      nextQueueTrackIds = [startTrackId, ...preservedTrackIds, ...shuffleTrackIds(newTrackIds)];
    } else {
      const startTrackId = currentTrackId || playlistTrackIds[0];
      const startIndex = playlistTrackIds.indexOf(startTrackId);
      nextQueueTrackIds = playlistTrackIds.slice(Math.max(0, startIndex));
    }

    if (!areTrackIdListsEqual(nextQueueTrackIds, playbackQueueTrackIds)) {
      state.setPlaybackQueueTrackIds(nextQueueTrackIds);
    }

    if (!currentTrackId) {
      const fallbackTrackId = nextQueueTrackIds[0];
      if (!fallbackTrackId || fallbackTrackId === playbackTrackId) {
        return;
      }
      const fallbackTrack = trackById.get(fallbackTrackId);
      if (fallbackTrack) {
        selectTrack(fallbackTrack);
      }
      state.setPlaybackTrackId(fallbackTrackId);
      state.setShouldAutoplay(true);
    }
  }, [playbackPlaylistId, playlists, trackById, playbackTrackId, playbackQueueTrackIds, isShuffleEnabled]);

  // Clear a stale playback playlist id when the playlist is deleted.
  useEffect(() => {
    if (!playbackPlaylistId) {
      return;
    }
    if (!playlists.some((playlist) => playlist.id === playbackPlaylistId)) {
      player().setPlaybackPlaylistId("");
      player().clearQueueState();
    }
  }, [playbackPlaylistId, playlists]);
}
