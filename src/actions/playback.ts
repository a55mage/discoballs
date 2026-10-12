import { audioRef } from "../audio/audioRef";
import { buildLibraryQueueOrder, buildPlaylistQueueOrder } from "../domain/playlist";
import { useEqualizerStore } from "../store/equalizerStore";
import { useLibraryStore } from "../store/libraryStore";
import { PLAYER_QUEUE_PAGE_SIZE, playbackRuntime, usePlayerStore } from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";
import { getPlaybackQueueTracks, getPlaybackTrack, getPlaybackTrackIndex, getSelectedTrack, getTrackMap } from "../store/selectors";
import type { Track } from "../types";
import { applyEqualizerSettings, getOrCreateMediaAudioGraph } from "../utils/audioGraph";
import { selectTrack } from "./library";

const PLAYBACK_START_ERROR = "Unable to start playback in this environment.";

const player = () => usePlayerStore.getState();

export async function ensureAudioGraphReady(): Promise<void> {
  const audio = audioRef.current;
  if (!audio) {
    return;
  }
  const graph = getOrCreateMediaAudioGraph(audio);
  if (!graph) {
    return;
  }
  const { equalizerBandGains, equalizerPreampDb, equalizerWetMixPercent } = useEqualizerStore.getState();
  applyEqualizerSettings(graph, {
    bandGains: equalizerBandGains,
    preampDb: equalizerPreampDb,
    wetMixPercent: equalizerWetMixPercent,
  });
  if (graph.context.state === "suspended") {
    await graph.context.resume();
  }
}

/** Prepares the audio graph; on failure reports the error and returns false. */
async function prepareAudio(): Promise<boolean> {
  try {
    await ensureAudioGraphReady();
    return true;
  } catch {
    player().setAudioError(PLAYBACK_START_ERROR);
    player().setIsPlaying(false);
    return false;
  }
}

/** Starts the element if the loaded audio matches the wanted track. */
async function playLoadedAudio(): Promise<void> {
  const audio = audioRef.current;
  try {
    await ensureAudioGraphReady();
    await audio?.play();
    player().setIsPlaying(true);
    player().setAudioError("");
  } catch {
    player().setAudioError(PLAYBACK_START_ERROR);
    player().setIsPlaying(false);
  }
}

export function startPlaybackSession(queueTrackIds: string[], startTrackId: string, playlistId = ""): boolean {
  const startTrack = getTrackMap().get(startTrackId);
  if (!startTrack || !queueTrackIds.length) {
    return false;
  }
  const state = player();
  playbackRuntime.previousTrackId = "";
  state.setPlaybackQueueTrackIds(queueTrackIds);
  state.setPlaybackHistoryTrackIds([]);
  state.setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
  state.setPlaybackPlaylistId(playlistId);
  if (startTrack.id !== useLibraryStore.getState().selectedTrackId) {
    selectTrack(startTrack);
  }
  state.setPlaybackTrackId(startTrack.id);
  state.setShouldAutoplay(true);
  return true;
}

export function startPlaybackFromPlaylist(playlistId: string, startTrackId?: string): boolean {
  const playlist = usePlaylistStore.getState().playlists.find((item) => item.id === playlistId);
  if (!playlist) {
    return false;
  }
  const trackMap = getTrackMap();
  const playlistTrackIds = playlist.entries.map((entry) => entry.trackId).filter((trackId) => trackMap.has(trackId));
  const queueTrackIds = buildPlaylistQueueOrder(playlistTrackIds, player().isShuffleEnabled, startTrackId);
  const firstTrackId = queueTrackIds[0];
  if (!firstTrackId) {
    return false;
  }
  return startPlaybackSession(queueTrackIds, firstTrackId, playlistId);
}

/** `visibleTrackIds` is the library list as currently filtered and sorted. */
export function startPlaybackFromLibrary(track: Track, visibleTrackIds: string[]): boolean {
  const queueTrackIds = buildLibraryQueueOrder(visibleTrackIds, track.id);
  return startPlaybackSession(queueTrackIds.length ? queueTrackIds : [track.id], track.id, "");
}

export async function togglePlayPause(visibleTrackIds: string[]): Promise<void> {
  const audio = audioRef.current;
  if (!audio) {
    return;
  }
  if (player().isPlaying) {
    audio.pause();
    player().setIsPlaying(false);
    return;
  }
  if (!(await prepareAudio())) {
    return;
  }

  const state = player();
  const selectedTrack = getSelectedTrack();
  const targetTrack = getPlaybackTrack() ?? selectedTrack;
  if (targetTrack && targetTrack.id !== state.playbackTrackId) {
    if (selectedTrack && targetTrack.id === selectedTrack.id) {
      startPlaybackFromLibrary(targetTrack, visibleTrackIds);
      return;
    }
    state.setPlaybackTrackId(targetTrack.id);
    state.setShouldAutoplay(true);
    return;
  }

  if (!state.audioSrc || !state.audioTrackId || state.audioTrackId !== state.playbackTrackId) {
    if (targetTrack) {
      state.setShouldAutoplay(true);
    }
    return;
  }
  await playLoadedAudio();
}

export async function playFromLibraryCover(track: Track, visibleTrackIds: string[]): Promise<void> {
  if (!(await prepareAudio())) {
    return;
  }
  if (!startPlaybackFromLibrary(track, visibleTrackIds)) {
    return;
  }
  const { audioSrc, audioTrackId } = player();
  if (!audioRef.current || !audioSrc || audioTrackId !== track.id) {
    player().setShouldAutoplay(true);
    return;
  }
  await playLoadedAudio();
}

export function seekTo(value: number): void {
  const audio = audioRef.current;
  if (!audio) {
    return;
  }
  audio.currentTime = value;
  player().setCurrentTime(value);
}

export function changeVolume(value: number): void {
  const clamped = Math.max(0, Math.min(1, value));
  player().setVolume(clamped);
  if (clamped > 0 && player().isMuted) {
    player().setIsMuted(false);
  }
  const audio = audioRef.current;
  if (!audio) {
    return;
  }
  const graph = getOrCreateMediaAudioGraph(audio);
  if (graph) {
    const now = graph.context.currentTime;
    graph.outputGain.gain.cancelScheduledValues(now);
    graph.outputGain.gain.setTargetAtTime(clamped, now, 0.015);
    audio.volume = 1;
    audio.muted = false;
    return;
  }
  audio.volume = clamped;
  if (clamped > 0 && audio.muted) {
    audio.muted = false;
  }
}

async function playAdjacentTrack(offset: -1 | 1): Promise<void> {
  if (!(await prepareAudio())) {
    return;
  }
  const queueTracks = getPlaybackQueueTracks();
  const index = getPlaybackTrackIndex();
  const target =
    offset < 0
      ? index > 0
        ? queueTracks[index - 1] ?? null
        : null
      : index >= 0 && index < queueTracks.length - 1
        ? queueTracks[index + 1] ?? null
        : null;
  if (target) {
    player().setPlaybackTrackId(target.id);
    player().setShouldAutoplay(true);
    selectTrack(target);
  }
}

export const playPreviousTrack = () => playAdjacentTrack(-1);
export const playNextTrack = () => playAdjacentTrack(1);

export async function playTrackFromQueue(track: Track): Promise<void> {
  if (!(await prepareAudio())) {
    return;
  }
  if (track.id !== useLibraryStore.getState().selectedTrackId) {
    selectTrack(track);
  }
  const state = player();
  if (track.id !== state.playbackTrackId) {
    state.setPlaybackTrackId(track.id);
    state.setShouldAutoplay(true);
    return;
  }
  if (!audioRef.current || !state.audioSrc || state.audioTrackId !== track.id) {
    state.setShouldAutoplay(true);
    return;
  }
  await playLoadedAudio();
}

export async function playTrackFromPlaylist(track: Track, playlistId?: string): Promise<void> {
  if (!(await prepareAudio())) {
    return;
  }
  if (!playlistId) {
    await playTrackFromQueue(track);
    return;
  }
  startPlaybackFromPlaylist(playlistId, track.id);
}

export async function playPlaylist(playlistId: string, options: { shuffle?: boolean } = {}): Promise<void> {
  if (!(await prepareAudio())) {
    return;
  }
  if (options.shuffle !== undefined) {
    player().setIsShuffleEnabled(options.shuffle);
  }
  startPlaybackFromPlaylist(playlistId);
}

export function loadMoreQueueTracks(): void {
  player().setPlayerQueueVisibleCount((prev) => prev + PLAYER_QUEUE_PAGE_SIZE);
}

export function clearPlayerQueue(): void {
  const state = player();
  state.setPlaybackPlaylistId("");
  if (!state.playbackTrackId) {
    state.setPlaybackQueueTrackIds([]);
    state.setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
    return;
  }
  const currentId = state.playbackTrackId;
  state.setPlaybackQueueTrackIds((prev) => (prev.includes(currentId) ? [currentId] : []));
  state.setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
}

export function removeTrackFromPlayerQueue(trackId: string): void {
  const state = player();
  state.setPlaybackPlaylistId("");
  state.setPlaybackHistoryTrackIds((prev) => prev.filter((id) => id !== trackId));
  const queueIds = state.playbackQueueTrackIds;
  const currentIndex = queueIds.indexOf(trackId);
  if (currentIndex < 0) {
    return;
  }
  const nextQueueTrackIds = queueIds.filter((id) => id !== trackId);
  state.setPlaybackQueueTrackIds(nextQueueTrackIds);
  if (trackId !== state.playbackTrackId) {
    return;
  }
  const fallbackTrackId = nextQueueTrackIds[currentIndex] ?? nextQueueTrackIds[currentIndex - 1] ?? "";
  if (!fallbackTrackId) {
    state.setPlaybackTrackId("");
    state.setShouldAutoplay(false);
    return;
  }
  state.setPlaybackTrackId(fallbackTrackId);
  const fallbackTrack = getTrackMap().get(fallbackTrackId);
  if (fallbackTrack) {
    selectTrack(fallbackTrack);
  }
  state.setShouldAutoplay(state.isPlaying);
}

export function enqueueTrack(trackId: string): void {
  const track = getTrackMap().get(trackId);
  if (!track) {
    return;
  }
  const state = player();
  state.setPlaybackPlaylistId("");
  state.setPlaybackQueueTrackIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
  state.setPlayerQueueVisibleCount((prev) => Math.max(prev, PLAYER_QUEUE_PAGE_SIZE));
  if (!state.playbackTrackId) {
    state.setPlaybackTrackId(trackId);
    selectTrack(track);
  }
}

export function enqueueTracks(trackIds: string[]): void {
  const trackMap = getTrackMap();
  const ids = trackIds.filter((trackId) => trackMap.has(trackId));
  if (!ids.length) {
    return;
  }
  const state = player();
  state.setPlaybackPlaylistId("");
  state.setPlaybackQueueTrackIds((prev) => {
    const existing = new Set(prev);
    const next = ids.filter((trackId) => !existing.has(trackId));
    return next.length ? [...prev, ...next] : prev;
  });
  state.setPlayerQueueVisibleCount((prev) => Math.max(prev, PLAYER_QUEUE_PAGE_SIZE));
  if (!state.playbackTrackId) {
    const firstTrack = trackMap.get(ids[0]);
    if (firstTrack) {
      state.setPlaybackTrackId(firstTrack.id);
      selectTrack(firstTrack);
    }
  }
}
