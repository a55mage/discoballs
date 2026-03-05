import { type ComponentType, type RefObject, type SVGProps } from "react";
import type { Track } from "../types";
import { formatTime } from "../utils/common";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type TopBarScreen = "dashboard" | "tagging" | "player" | "settings";

type TopBarSectionProps = {
  activeScreen: TopBarScreen;
  appIconSrc: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSrc: string;
  playerInfoTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioError: string;
  showAudioError: boolean;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  isShuffleEnabled: boolean;
  isRepeatTrackEnabled: boolean;
  isPlayDisabled: boolean;
  canSeek: boolean;
  onScreenChange: (screen: TopBarScreen) => void;
  onRotateAccent: () => void;
  onToggleShuffle: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onToggleRepeatTrack: () => void;
  onSeek: (value: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  IconShuffle: IconComponent;
  IconPrev: IconComponent;
  IconPause: IconComponent;
  IconPlay: IconComponent;
  IconNext: IconComponent;
  IconRepeatTrack: IconComponent;
  IconMute: IconComponent;
  IconVolume: IconComponent;
  IconDashboard: IconComponent;
  IconTagging: IconComponent;
  IconPlayer: IconComponent;
  IconSettings: IconComponent;
};

export function TopBarSection({
  activeScreen,
  appIconSrc,
  audioRef,
  audioSrc,
  playerInfoTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  audioError,
  showAudioError,
  isPrevDisabled,
  isNextDisabled,
  isShuffleEnabled,
  isRepeatTrackEnabled,
  isPlayDisabled,
  canSeek,
  onScreenChange,
  onRotateAccent,
  onToggleShuffle,
  onPrev,
  onPlayPause,
  onNext,
  onToggleRepeatTrack,
  onSeek,
  onToggleMute,
  onVolumeChange,
  IconShuffle,
  IconPrev,
  IconPause,
  IconPlay,
  IconNext,
  IconRepeatTrack,
  IconMute,
  IconVolume,
  IconDashboard,
  IconTagging,
  IconPlayer,
  IconSettings,
}: TopBarSectionProps) {
  return (
    <header className="top-bar">
      <button
        type="button"
        className="app-brand"
        onClick={onRotateAccent}
        title="Change accent color"
        aria-label="Change accent color"
      >
        <img src={appIconSrc} alt="DiscoBalls" className="app-brand-icon" />
      </button>

      <div className="top-player">
        <audio ref={audioRef} src={audioSrc} preload="metadata" />
        <div className="player-now-playing" title={playerInfoTrack ? `${playerInfoTrack.artist} - ${playerInfoTrack.title}` : "No track selected"}>
          {playerInfoTrack?.coverUrl ? (
            <img
              src={playerInfoTrack.coverUrl}
              alt={`Cover ${playerInfoTrack.album || playerInfoTrack.title}`}
              className="player-now-cover"
            />
          ) : (
            <div className="player-now-cover-placeholder">♪</div>
          )}
          <span className="player-now-text">
            <strong className="player-now-title">{playerInfoTrack?.title || "No track selected"}</strong>
            <small className="player-now-artist">{playerInfoTrack?.artist || "Select a track from library"}</small>
          </span>
        </div>

        <button
          className={isShuffleEnabled ? "ghost-button player-btn is-active-toggle" : "ghost-button player-btn"}
          onClick={onToggleShuffle}
          title={isShuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
          aria-label={isShuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
        >
          <span className="btn-content"><IconShuffle className="btn-icon" /></span>
        </button>
        <button className="ghost-button player-btn" onClick={onPrev} disabled={isPrevDisabled} title="Previous track" aria-label="Previous track">
          <span className="btn-content"><IconPrev className="btn-icon" /></span>
        </button>
        <button
          className="player-btn"
          onClick={onPlayPause}
          disabled={isPlayDisabled}
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <span className="btn-content">
            {isPlaying ? <IconPause className="btn-icon" /> : <IconPlay className="btn-icon" />}
          </span>
        </button>
        <button
          className="ghost-button player-btn"
          onClick={onNext}
          disabled={isNextDisabled}
          title="Next track"
          aria-label="Next track"
        >
          <span className="btn-content"><IconNext className="btn-icon" /></span>
        </button>
        <button
          className={isRepeatTrackEnabled ? "ghost-button player-btn is-active-toggle" : "ghost-button player-btn"}
          onClick={onToggleRepeatTrack}
          title={isRepeatTrackEnabled ? "Disable repeat track" : "Enable repeat track"}
          aria-label={isRepeatTrackEnabled ? "Disable repeat track" : "Enable repeat track"}
        >
          <span className="btn-content"><IconRepeatTrack className="btn-icon" /></span>
        </button>

        <div className="player-progress">
          <span className="player-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0)}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={!canSeek}
          />
          <span className="player-time">{formatTime(duration)}</span>
        </div>

        <div className="player-volume">
          <button className="ghost-button player-btn" onClick={onToggleMute} title={isMuted || volume === 0 ? "Unmute" : "Mute"} aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}>
            <span className="btn-content">
              {isMuted || volume === 0 ? <IconMute className="btn-icon" /> : <IconVolume className="btn-icon" />}
            </span>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            onInput={(event) => onVolumeChange(Number((event.target as HTMLInputElement).value))}
          />
        </div>

        {audioError && showAudioError && <span className="player-error">{audioError}</span>}
      </div>

      <div className="top-actions top-sections" role="group" aria-label="Sections">
        <button
          className={activeScreen === "player" ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
          onClick={() => onScreenChange("player")}
          title="Player"
          aria-label="Player"
        >
          <span className="btn-content"><IconPlayer className="btn-icon" /></span>
        </button>
        <button
          className={activeScreen === "dashboard" ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
          onClick={() => onScreenChange("dashboard")}
          title="Playlist editor"
          aria-label="Playlist editor"
        >
          <span className="btn-content"><IconDashboard className="btn-icon" /></span>
        </button>
        <button
          className={activeScreen === "tagging" ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
          onClick={() => onScreenChange("tagging")}
          title="Music tagging"
          aria-label="Music tagging"
        >
          <span className="btn-content"><IconTagging className="btn-icon" /></span>
        </button>
        <button
          className={activeScreen === "settings" ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
          onClick={() => onScreenChange("settings")}
          title="Settings"
          aria-label="Settings"
        >
          <span className="btn-content"><IconSettings className="btn-icon" /></span>
        </button>
      </div>
    </header>
  );
}
