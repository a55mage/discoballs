import { IconNext, IconPause, IconPlay, IconPrev, IconRepeatOne, IconShuffle } from "../components/icons";
import { playNextTrack, playPreviousTrack, seekTo } from "../actions/playback";
import { usePlaybackQueueView } from "../hooks/usePlaybackQueueView";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { IconButton, Slider } from "../ui";
import { formatTime } from "../utils/common";

type TransportControlsProps = {
  onTogglePlayPause: () => void;
};

/** Shuffle, previous, play/pause, next and repeat. */
export function TransportControls({ onTogglePlayPause }: TransportControlsProps) {
  const player = usePlayerStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const { playbackQueueTracks, playbackTrackIndex } = usePlaybackQueueView();
  const hasTrack = Boolean(player.audioSrc) || tracks.some((track) => track.id === player.playbackTrackId || track.id === selectedTrackId);

  return (
    <div className="shell__transport">
      <IconButton label={player.isShuffleEnabled ? "Disable shuffle" : "Enable shuffle"} active={player.isShuffleEnabled} onClick={() => player.setIsShuffleEnabled(!player.isShuffleEnabled)}>
        <IconShuffle />
      </IconButton>
      <IconButton label="Previous track" disabled={playbackTrackIndex <= 0} onClick={() => void playPreviousTrack()}>
        <IconPrev />
      </IconButton>
      <IconButton label={player.isPlaying ? "Pause" : "Play"} solid disabled={!hasTrack} onClick={onTogglePlayPause}>
        {player.isPlaying ? <IconPause /> : <IconPlay />}
      </IconButton>
      <IconButton label="Next track" disabled={playbackTrackIndex < 0 || playbackTrackIndex >= playbackQueueTracks.length - 1} onClick={() => void playNextTrack()}>
        <IconNext />
      </IconButton>
      <IconButton label={player.isRepeatTrackEnabled ? "Disable repeat track" : "Enable repeat track"} active={player.isRepeatTrackEnabled} onClick={() => player.setIsRepeatTrackEnabled(!player.isRepeatTrackEnabled)}>
        <IconRepeatOne />
      </IconButton>
    </div>
  );
}

/** Elapsed time, seek slider and duration. */
export function SeekBar() {
  const { currentTime, duration, audioSrc, audioTrackId, playbackTrackId } = usePlayerStore();
  const canSeek = Boolean(audioSrc && audioTrackId === playbackTrackId && duration > 0);
  return (
    <div className="shell__seek">
      <span className="shell__time">{formatTime(currentTime)}</span>
      <Slider label="Seek" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(currentTime, duration || 0)} disabled={!canSeek} onValueChange={seekTo} />
      <span className="shell__time">{formatTime(duration)}</span>
    </div>
  );
}
