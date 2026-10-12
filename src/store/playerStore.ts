import { create } from "zustand";
import { readString, writeString } from "./storage";
import { fieldSetter, type Setter } from "./util";

const SHUFFLE_KEY = "musicmanager-player-shuffle";
const REPEAT_KEY = "musicmanager-player-repeat-track";

export const PLAYER_QUEUE_PAGE_SIZE = 50;
export const PLAYER_QUEUE_HISTORY_SIZE = 1;

/** Non-reactive playback bookkeeping shared by playback actions and effects. */
export const playbackRuntime = { previousTrackId: "", previousShuffleEnabled: false };

export type PlayerState = {
  playbackTrackId: string;
  playbackPlaylistId: string;
  playbackQueueTrackIds: string[];
  playbackHistoryTrackIds: string[];
  playerQueueVisibleCount: number;
  isPlaying: boolean;
  isShuffleEnabled: boolean;
  isRepeatTrackEnabled: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioSrc: string;
  audioTrackId: string;
  audioError: string;
  shouldAutoplay: boolean;
  /** ReplayGain of the playing track, when the file has it. */
  replayGainDb: number | null;

  setPlaybackTrackId: Setter<string>;
  setPlaybackPlaylistId: Setter<string>;
  setPlaybackQueueTrackIds: Setter<string[]>;
  setPlaybackHistoryTrackIds: Setter<string[]>;
  setPlayerQueueVisibleCount: Setter<number>;
  setIsPlaying: Setter<boolean>;
  setIsShuffleEnabled: Setter<boolean>;
  setIsRepeatTrackEnabled: Setter<boolean>;
  setCurrentTime: Setter<number>;
  setDuration: Setter<number>;
  setVolume: Setter<number>;
  setIsMuted: Setter<boolean>;
  setAudioSrc: Setter<string>;
  setAudioTrackId: Setter<string>;
  setAudioError: Setter<string>;
  setShouldAutoplay: Setter<boolean>;
  setReplayGainDb: Setter<number | null>;
  clearQueueState: () => void;
  resetSession: () => void;
};

export const usePlayerStore = create<PlayerState>()((set) => ({
  playbackTrackId: "",
  playbackPlaylistId: "",
  playbackQueueTrackIds: [],
  playbackHistoryTrackIds: [],
  playerQueueVisibleCount: PLAYER_QUEUE_PAGE_SIZE,
  isPlaying: false,
  isShuffleEnabled: readString(SHUFFLE_KEY) === "true",
  isRepeatTrackEnabled: readString(REPEAT_KEY) === "true",
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  isMuted: false,
  audioSrc: "",
  audioTrackId: "",
  audioError: "",
  shouldAutoplay: false,
  replayGainDb: null,

  setPlaybackTrackId: fieldSetter(set, "playbackTrackId"),
  setPlaybackPlaylistId: fieldSetter(set, "playbackPlaylistId"),
  setPlaybackQueueTrackIds: fieldSetter(set, "playbackQueueTrackIds"),
  setPlaybackHistoryTrackIds: fieldSetter(set, "playbackHistoryTrackIds"),
  setPlayerQueueVisibleCount: fieldSetter(set, "playerQueueVisibleCount"),
  setIsPlaying: fieldSetter(set, "isPlaying"),
  setIsShuffleEnabled: fieldSetter(set, "isShuffleEnabled"),
  setIsRepeatTrackEnabled: fieldSetter(set, "isRepeatTrackEnabled"),
  setCurrentTime: fieldSetter(set, "currentTime"),
  setDuration: fieldSetter(set, "duration"),
  setVolume: fieldSetter(set, "volume"),
  setIsMuted: fieldSetter(set, "isMuted"),
  setAudioSrc: fieldSetter(set, "audioSrc"),
  setAudioTrackId: fieldSetter(set, "audioTrackId"),
  setAudioError: fieldSetter(set, "audioError"),
  setShouldAutoplay: fieldSetter(set, "shouldAutoplay"),
  setReplayGainDb: fieldSetter(set, "replayGainDb"),

  clearQueueState: () => {
    playbackRuntime.previousTrackId = "";
    set({ playbackQueueTrackIds: [], playbackHistoryTrackIds: [], playerQueueVisibleCount: PLAYER_QUEUE_PAGE_SIZE });
  },
  resetSession: () => {
    playbackRuntime.previousTrackId = "";
    set({
      playbackPlaylistId: "",
      playbackTrackId: "",
      playbackQueueTrackIds: [],
      playbackHistoryTrackIds: [],
      playerQueueVisibleCount: PLAYER_QUEUE_PAGE_SIZE,
      shouldAutoplay: false,
    });
  },
}));

writeString(SHUFFLE_KEY, String(usePlayerStore.getState().isShuffleEnabled));
writeString(REPEAT_KEY, String(usePlayerStore.getState().isRepeatTrackEnabled));
usePlayerStore.subscribe((state, previous) => {
  if (state.isShuffleEnabled !== previous.isShuffleEnabled) writeString(SHUFFLE_KEY, String(state.isShuffleEnabled));
  if (state.isRepeatTrackEnabled !== previous.isRepeatTrackEnabled) writeString(REPEAT_KEY, String(state.isRepeatTrackEnabled));
});
