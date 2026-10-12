import {
  IconAutoEq,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeatOne,
  IconShuffle,
  IconVolume,
} from "../components/icons";
import { changeVolume, playNextTrack, playPreviousTrack, seekTo } from "../actions/playback";
import { usePlaybackQueueView } from "../hooks/usePlaybackQueueView";
import { useEqualizerStore } from "../store/equalizerStore";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { Cover, IconButton, Select, Slider } from "../ui";
import { formatTime } from "../utils/common";

type PlayerBarProps = {
  /** Starts or pauses playback; needs the library list as filtered on screen, which only the screen knows. */
  onTogglePlayPause: () => void;
};

/** The persistent player: now playing info, transport, seek, equalizer preset and volume. */
export function PlayerBar({ onTogglePlayPause }: PlayerBarProps) {
  const player = usePlayerStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const setActiveScreen = useUiStore((state) => state.setActiveScreen);
  const { audioAutoEq, setAudioAutoEq } = useSettingsStore();
  const { equalizerPresets, equalizerPresetId, changePreset } = useEqualizerStore();
  const { playbackQueueTracks, playbackTrackIndex } = usePlaybackQueueView();

  const playbackTrack = tracks.find((track) => track.id === player.playbackTrackId) ?? null;
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const infoTrack = playbackTrack ?? selectedTrack;

  const hasAudio = Boolean(player.audioSrc && player.audioTrackId === player.playbackTrackId);
  const canSeek = hasAudio && player.duration > 0;
  const isMutedOrZero = player.isMuted || player.volume === 0;

  return (
    <footer className="shell__player" aria-label="Player">
      <div className="shell__player-info">
        <button type="button" className="shell__player-cover" onClick={() => setActiveScreen("player")} aria-label="Open Now Playing">
          <Cover size={68} radius={10} src={infoTrack?.coverUrl} />
        </button>
        <div className="shell__player-text">
          <strong title={infoTrack?.title}>{infoTrack?.title || "No track selected"}</strong>
          <span title={infoTrack?.artist}>{infoTrack ? infoTrack.artist || "Unknown artist" : "Pick a track from the library"}</span>
        </div>
      </div>

      <div className="shell__player-center">
        <div className="shell__transport">
          <IconButton label={player.isShuffleEnabled ? "Disable shuffle" : "Enable shuffle"} active={player.isShuffleEnabled} onClick={() => player.setIsShuffleEnabled(!player.isShuffleEnabled)}>
            <IconShuffle />
          </IconButton>
          <IconButton label="Previous track" disabled={playbackTrackIndex <= 0} onClick={() => void playPreviousTrack()}>
            <IconPrev />
          </IconButton>
          <IconButton label={player.isPlaying ? "Pause" : "Play"} solid disabled={!infoTrack && !player.audioSrc} onClick={onTogglePlayPause}>
            {player.isPlaying ? <IconPause /> : <IconPlay />}
          </IconButton>
          <IconButton label="Next track" disabled={playbackTrackIndex < 0 || playbackTrackIndex >= playbackQueueTracks.length - 1} onClick={() => void playNextTrack()}>
            <IconNext />
          </IconButton>
          <IconButton label={player.isRepeatTrackEnabled ? "Disable repeat track" : "Enable repeat track"} active={player.isRepeatTrackEnabled} onClick={() => player.setIsRepeatTrackEnabled(!player.isRepeatTrackEnabled)}>
            <IconRepeatOne />
          </IconButton>
        </div>
        <div className="shell__seek">
          <span className="shell__time">{formatTime(player.currentTime)}</span>
          <Slider
            label="Seek"
            min={0}
            max={Math.max(player.duration, 0)}
            step={0.1}
            value={Math.min(player.currentTime, player.duration || 0)}
            disabled={!canSeek}
            onValueChange={seekTo}
          />
          <span className="shell__time">{formatTime(player.duration)}</span>
        </div>
        {player.audioError && infoTrack ? (
          <span className="shell__player-error" role="status">{player.audioError}</span>
        ) : null}
      </div>

      <div className="shell__player-tools">
        <Select
          className="shell__eq-select"
          aria-label="Equalizer preset"
          value={equalizerPresetId}
          onChange={(event) => changePreset(event.target.value)}
        >
          <option value="">Custom</option>
          {equalizerPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </Select>
        <IconButton label={audioAutoEq ? "Disable Auto EQ" : "Enable Auto EQ"} active={audioAutoEq} onClick={() => setAudioAutoEq(!audioAutoEq)}>
          <IconAutoEq />
        </IconButton>
        <IconButton label="Show queue" onClick={() => setActiveScreen("player")}>
          <IconQueue />
        </IconButton>
        <IconButton label={isMutedOrZero ? "Unmute" : "Mute"} onClick={() => player.setIsMuted(!player.isMuted)}>
          {isMutedOrZero ? <IconMute /> : <IconVolume />}
        </IconButton>
        <Slider
          className="shell__volume"
          label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={player.isMuted ? 0 : player.volume}
          onValueChange={changeVolume}
        />
      </div>

    </footer>
  );
}
