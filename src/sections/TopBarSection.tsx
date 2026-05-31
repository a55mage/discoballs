import { type ComponentType, type KeyboardEvent, type RefObject, type SVGProps } from "react";
import type { Track } from "../types";
import { formatTime } from "../utils/common";
import { VISUALIZER_PRESETS, type VisualizerPresetId } from "./MusicVisualizerSection";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type TopBarScreen = "dashboard" | "library" | "tagging" | "player" | "settings";

type TopBarSectionProps = {
  activeScreen: TopBarScreen;
  appIconSrc: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSrc: string;
  playerInfoTrack: Track | null;
  playerTechnicalBadge: string;
  playerTechnicalSummary: string;
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
  equalizerPresets: Array<{ id: string; name: string }>;
  equalizerPresetId: string;
  onEqualizerPresetChange: (presetId: string) => void;
  autoEqEnabled: boolean;
  onToggleAutoEq: () => void;
  showLibraryColumn: boolean;
  showVisualizerColumn: boolean;
  showQueueColumn: boolean;
  showLyricsSection: boolean;
  onToggleLibraryColumn: () => void;
  onToggleVisualizerColumn: () => void;
  onToggleQueueColumn: () => void;
  onToggleLyricsSection: () => void;
  visualizerPresetId: VisualizerPresetId;
  onVisualizerPresetChange: (presetId: VisualizerPresetId) => void;
  activePlaylistId: string;
  isPlaylistRenaming: boolean;
  playlistNameDraft: string;
  playlists: Array<{ id: string; name: string; entries: Array<{ id: string; trackId: string }> }>;
  hasActivePlaylist: boolean;
  canPlayActivePlaylist: boolean;
  onActivePlaylistChange: (playlistId: string) => void;
  onPlaylistDraftChange: (value: string) => void;
  onCreatePlaylist: () => void;
  onRenamePlaylist: () => void;
  onPlaylistRenameInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onDeletePlaylist: () => void;
  onPlayActivePlaylist: () => void;
  onOpenExternalLink: (url: string) => void;
  IconShuffle: IconComponent;
  IconPrev: IconComponent;
  IconPause: IconComponent;
  IconPlay: IconComponent;
  IconNext: IconComponent;
  IconRepeatTrack: IconComponent;
  IconMute: IconComponent;
  IconVolume: IconComponent;
  IconAutoEq: IconComponent;
  IconLibrary: IconComponent;
  IconVisualizer: IconComponent;
  IconQueue: IconComponent;
  IconLyrics: IconComponent;
  IconPlus: IconComponent;
  IconRename: IconComponent;
  IconTrash: IconComponent;
  IconGlobe: IconComponent;
  IconUser: IconComponent;
  IconHeart: IconComponent;
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
  playerTechnicalBadge,
  playerTechnicalSummary,
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
  equalizerPresets,
  equalizerPresetId,
  onEqualizerPresetChange,
  autoEqEnabled,
  onToggleAutoEq,
  showLibraryColumn,
  showVisualizerColumn,
  showQueueColumn,
  showLyricsSection,
  onToggleLibraryColumn,
  onToggleVisualizerColumn,
  onToggleQueueColumn,
  onToggleLyricsSection,
  visualizerPresetId,
  onVisualizerPresetChange,
  activePlaylistId,
  isPlaylistRenaming,
  playlistNameDraft,
  playlists,
  hasActivePlaylist,
  canPlayActivePlaylist,
  onActivePlaylistChange,
  onPlaylistDraftChange,
  onCreatePlaylist,
  onRenamePlaylist,
  onPlaylistRenameInputKeyDown,
  onDeletePlaylist,
  onPlayActivePlaylist,
  onOpenExternalLink,
  IconShuffle,
  IconPrev,
  IconPause,
  IconPlay,
  IconNext,
  IconRepeatTrack,
  IconMute,
  IconVolume,
  IconAutoEq,
  IconLibrary,
  IconVisualizer,
  IconQueue,
  IconLyrics,
  IconPlus,
  IconRename,
  IconTrash,
  IconGlobe,
  IconUser,
  IconHeart,
  IconDashboard,
  IconTagging,
  IconPlayer,
  IconSettings,
}: TopBarSectionProps) {
  return (
    <>
      <aside className="app-sidebar">
        <button
          type="button"
          className="app-brand"
          onClick={onRotateAccent}
          title="Change accent color"
          aria-label="Change accent color"
        >
          <img src={appIconSrc} alt="DiscoBalls" className="app-brand-icon" />
          <span className="app-brand-name">DiscoBalls</span>
        </button>

        <nav className="sidebar-nav" aria-label="Sections">
          <button
            className={activeScreen === "player" ? "sidebar-nav-btn is-active-toggle" : "ghost-button sidebar-nav-btn"}
            onClick={() => onScreenChange("player")}
            title="Player"
            aria-label="Player"
          >
            <span className="btn-content"><IconPlayer className="btn-icon" /><span className="sidebar-nav-label">Player</span></span>
          </button>
          <button
            className={activeScreen === "library" ? "sidebar-nav-btn is-active-toggle" : "ghost-button sidebar-nav-btn"}
            onClick={() => onScreenChange("library")}
            title="Library"
            aria-label="Library"
          >
            <span className="btn-content"><IconLibrary className="btn-icon" /><span className="sidebar-nav-label">Library</span></span>
          </button>
          <button
            className={activeScreen === "dashboard" ? "sidebar-nav-btn is-active-toggle" : "ghost-button sidebar-nav-btn"}
            onClick={() => onScreenChange("dashboard")}
            title="Playlists"
            aria-label="Playlists"
          >
            <span className="btn-content"><IconDashboard className="btn-icon" /><span className="sidebar-nav-label">Playlists</span></span>
          </button>
          <button
            className={activeScreen === "tagging" ? "sidebar-nav-btn is-active-toggle" : "ghost-button sidebar-nav-btn"}
            onClick={() => onScreenChange("tagging")}
            title="Tags"
            aria-label="Tags"
          >
            <span className="btn-content"><IconTagging className="btn-icon" /><span className="sidebar-nav-label">Tags</span></span>
          </button>
          <button
            className={activeScreen === "settings" ? "sidebar-nav-btn is-active-toggle" : "ghost-button sidebar-nav-btn"}
            onClick={() => onScreenChange("settings")}
            title="Settings"
            aria-label="Settings"
          >
            <span className="btn-content"><IconSettings className="btn-icon" /><span className="sidebar-nav-label">Settings</span></span>
          </button>
        </nav>

        <div className="sidebar-context">
          {activeScreen === "player" && (
            <div className="sidebar-context-panel" aria-label="Player view controls">
              <div className="sidebar-control-grid">
                <button
                  className={showLibraryColumn ? "sidebar-control-btn is-active-toggle" : "ghost-button sidebar-control-btn"}
                  onClick={onToggleLibraryColumn}
                  title={showLibraryColumn ? "Hide library card" : "Show library card"}
                  aria-label={showLibraryColumn ? "Hide library card" : "Show library card"}
                >
                  <span className="btn-content"><IconLibrary className="btn-icon" /></span>
                </button>
                <button
                  className={showLyricsSection ? "sidebar-control-btn is-active-toggle" : "ghost-button sidebar-control-btn"}
                  onClick={onToggleLyricsSection}
                  title={showLyricsSection ? "Hide lyrics card" : "Show lyrics card"}
                  aria-label={showLyricsSection ? "Hide lyrics card" : "Show lyrics card"}
                >
                  <span className="btn-content"><IconLyrics className="btn-icon" /></span>
                </button>
                <button
                  className={showVisualizerColumn ? "sidebar-control-btn is-active-toggle" : "ghost-button sidebar-control-btn"}
                  onClick={onToggleVisualizerColumn}
                  title={showVisualizerColumn ? "Hide visualizer card" : "Show visualizer card"}
                  aria-label={showVisualizerColumn ? "Hide visualizer card" : "Show visualizer card"}
                >
                  <span className="btn-content"><IconVisualizer className="btn-icon" /></span>
                </button>
                <button
                  className={showQueueColumn ? "sidebar-control-btn is-active-toggle" : "ghost-button sidebar-control-btn"}
                  onClick={onToggleQueueColumn}
                  title={showQueueColumn ? "Hide queue card" : "Show queue card"}
                  aria-label={showQueueColumn ? "Hide queue card" : "Show queue card"}
                >
                  <span className="btn-content"><IconQueue className="btn-icon" /></span>
                </button>
              </div>
              <label className="sidebar-select-label" htmlFor="sidebar-visualizer-preset">Visualizer</label>
              <select
                id="sidebar-visualizer-preset"
                className="input sidebar-select"
                value={visualizerPresetId}
                onChange={(event) => onVisualizerPresetChange(event.target.value as VisualizerPresetId)}
                title="Visualizer type"
                aria-label="Visualizer type"
              >
                {VISUALIZER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </div>
          )}

          {activeScreen === "dashboard" && (
            <div className="sidebar-context-panel" aria-label="Playlist controls">
              <div className="sidebar-action-row">
                <button className="ghost-button sidebar-control-btn" onClick={onCreatePlaylist} title="Create playlist" aria-label="Create playlist">
                  <span className="btn-content"><IconPlus className="btn-icon" /></span>
                </button>
                <button
                  className="ghost-button sidebar-control-btn"
                  onClick={onRenamePlaylist}
                  disabled={!hasActivePlaylist}
                  title={isPlaylistRenaming ? "Confirm rename" : "Rename playlist"}
                  aria-label={isPlaylistRenaming ? "Confirm rename" : "Rename playlist"}
                >
                  <span className="btn-content"><IconRename className="btn-icon" /></span>
                </button>
                <button className="ghost-button sidebar-control-btn" onClick={onDeletePlaylist} disabled={!hasActivePlaylist} title="Delete playlist" aria-label="Delete playlist">
                  <span className="btn-content"><IconTrash className="btn-icon" /></span>
                </button>
                <button className="ghost-button sidebar-control-btn" onClick={onPlayActivePlaylist} disabled={!canPlayActivePlaylist} title="Play playlist" aria-label="Play playlist">
                  <span className="btn-content"><IconPlay className="btn-icon" /></span>
                </button>
              </div>
              {isPlaylistRenaming && (
                <input
                  className="input sidebar-select"
                  value={playlistNameDraft}
                  onChange={(event) => onPlaylistDraftChange(event.target.value)}
                  onKeyDown={onPlaylistRenameInputKeyDown}
                  placeholder="Playlist name"
                  aria-label="Playlist name"
                  autoFocus
                />
              )}
              <ul className="sidebar-playlist-list">
                {!playlists.length && <li className="sidebar-empty">No playlists</li>}
                {playlists.map((playlist) => (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      className={playlist.id === activePlaylistId ? "sidebar-playlist-btn active" : "sidebar-playlist-btn"}
                      onClick={() => onActivePlaylistChange(playlist.id)}
                      title={playlist.name}
                    >
                      <span>{playlist.name}</span>
                      <small>{playlist.entries.length}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeScreen === "settings" && (
            <div className="sidebar-context-panel sidebar-settings-panel" aria-label="App links">
              <strong>DiscoBalls v1.5.0</strong>
              <button className="ghost-button sidebar-link-btn" onClick={() => onOpenExternalLink("https://a55mage.github.io/discoballs/")} title="Website" aria-label="Website">
                <span className="btn-content"><IconGlobe className="btn-icon" /></span>
              </button>
              <button className="ghost-button sidebar-link-btn" onClick={() => onOpenExternalLink("https://a55mage.github.io/")} title="Developer" aria-label="Developer">
                <span className="btn-content"><IconUser className="btn-icon" /></span>
              </button>
              <button className="ghost-button sidebar-link-btn" onClick={() => onOpenExternalLink("https://www.paypal.com/donate/?business=r.macis%40live.it")} title="Donate" aria-label="Donate">
                <span className="btn-content"><IconHeart className="btn-icon" /></span>
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-now-playing">
          {playerInfoTrack?.coverUrl ? (
            <img
              src={playerInfoTrack.coverUrl}
              alt={`Cover ${playerInfoTrack.album || playerInfoTrack.title}`}
              className="sidebar-now-cover"
            />
          ) : (
            <div className="sidebar-now-cover placeholder">♪</div>
          )}
          <div className="sidebar-now-meta">
            <strong title={playerInfoTrack?.title || "No track selected"}>{playerInfoTrack?.title || "No track selected"}</strong>
            <span title={playerInfoTrack?.artist || "Select a track from library"}>{playerInfoTrack?.artist || "Select a track from library"}</span>
            <span title={playerInfoTrack?.album || "Album n/a"}>{playerInfoTrack?.album || "Album n/a"}</span>
            <dl className="sidebar-track-facts">
              <div>
                <dt>Year</dt>
                <dd>{playerInfoTrack?.year || "n/a"}</dd>
              </div>
              <div>
                <dt>Genre</dt>
                <dd>{playerInfoTrack?.genre || "n/a"}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd title={playerTechnicalSummary}>{playerInfoTrack ? playerTechnicalBadge : "n/a"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>

      <footer className="top-player bottom-player">
        <audio ref={audioRef as RefObject<HTMLAudioElement>} src={audioSrc} preload="metadata" />
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

        <div className="bottom-eq-controls">
          <select
            className="input bottom-eq-select"
            value={equalizerPresetId}
            onChange={(event) => onEqualizerPresetChange(event.target.value)}
            title="Equalizer preset"
            aria-label="Equalizer preset"
          >
            <option value="">Custom</option>
            {equalizerPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
          <button
            className={autoEqEnabled ? "ghost-button player-btn is-active-toggle bottom-auto-eq" : "ghost-button player-btn bottom-auto-eq"}
            onClick={onToggleAutoEq}
            title={autoEqEnabled ? "Disable Auto EQ" : "Enable Auto EQ"}
            aria-label={autoEqEnabled ? "Disable Auto EQ" : "Enable Auto EQ"}
          >
            <span className="btn-content"><IconAutoEq className="btn-icon" /></span>
          </button>
        </div>

        {audioError && showAudioError && <span className="player-error">{audioError}</span>}
      </footer>
    </>
  );
}
