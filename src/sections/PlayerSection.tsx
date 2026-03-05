import type { ComponentType, RefObject, SVGProps } from "react";
import { Card } from "../components/Card";
import { LibrarySection, type LibrarySectionProps } from "./LibrarySection";
import { MusicVisualizerSection, VISUALIZER_PRESETS, type VisualizerPresetId } from "./MusicVisualizerSection";
import type { Track } from "../types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type PlayerSectionProps = {
  libraryProps: LibrarySectionProps;
  audioRef: RefObject<HTMLAudioElement | null>;
  isActive: boolean;
  hasAudio: boolean;
  isPlaying: boolean;
  coverUrl?: string;
  currentTime: number;
  duration: number;
  accentColor: string;
  isDarkMode: boolean;
  showLibraryColumn: boolean;
  showVisualizerColumn: boolean;
  showQueueColumn: boolean;
  onToggleLibraryColumn: () => void;
  onToggleVisualizerColumn: () => void;
  onToggleQueueColumn: () => void;
  IconLibrary: IconComponent;
  IconVisualizer: IconComponent;
  IconQueue: IconComponent;
  visualizerPresetId: VisualizerPresetId;
  onVisualizerPresetChange: (presetId: VisualizerPresetId) => void;
  equalizerPresets: Array<{ id: string; name: string }>;
  equalizerPresetId: string;
  onEqualizerPresetChange: (presetId: string) => void;
  autoEqEnabled: boolean;
  onToggleAutoEq: () => void;
  queueHistoryTracks: Track[];
  queueTracks: Track[];
  hasMoreQueueTracks: boolean;
  playbackTrackId: string;
  onQueueTrackClick: (track: Track) => void;
  onLoadMoreQueueTracks: () => void;
  onQueueRemoveTrack: (trackId: string) => void;
  onQueueClear: () => void;
  canClearQueue: boolean;
  IconPlay: IconComponent;
  IconTrash: IconComponent;
  IconAutoEq: IconComponent;
};

export function PlayerSection({
  libraryProps,
  audioRef,
  isActive,
  hasAudio,
  isPlaying,
  coverUrl,
  currentTime,
  duration,
  accentColor,
  isDarkMode,
  showLibraryColumn,
  showVisualizerColumn,
  showQueueColumn,
  onToggleLibraryColumn,
  onToggleVisualizerColumn,
  onToggleQueueColumn,
  IconLibrary,
  IconVisualizer,
  IconQueue,
  visualizerPresetId,
  onVisualizerPresetChange,
  equalizerPresets,
  equalizerPresetId,
  onEqualizerPresetChange,
  autoEqEnabled,
  onToggleAutoEq,
  queueHistoryTracks,
  queueTracks,
  hasMoreQueueTracks,
  playbackTrackId,
  onQueueTrackClick,
  onLoadMoreQueueTracks,
  onQueueRemoveTrack,
  onQueueClear,
  canClearQueue,
  IconPlay,
  IconTrash,
  IconAutoEq,
}: PlayerSectionProps) {
  const hasRightColumn = showVisualizerColumn || showQueueColumn;
  const layoutClassName = showLibraryColumn && hasRightColumn
    ? "player-layout has-two-columns"
    : "player-layout has-single-column";
  const rightStackClassName = showVisualizerColumn && showQueueColumn
    ? "player-right-stack is-split"
    : "player-right-stack";
  const mergedQueueTracks = [...queueHistoryTracks.slice(-1), ...queueTracks];

  return (
    <main className="player-screen">
      <div className={layoutClassName}>
        {showLibraryColumn && (
          <div className="player-library">
            <LibrarySection {...libraryProps} />
          </div>
        )}

        {hasRightColumn && (
          <div className={rightStackClassName}>
            {showVisualizerColumn && (
              <div className="player-main">
                <MusicVisualizerSection
                  audioRef={audioRef}
                  isActive={isActive}
                  hasAudio={hasAudio}
                  isPlaying={isPlaying}
                  coverUrl={coverUrl}
                  currentTime={currentTime}
                  duration={duration}
                  accentColor={accentColor}
                  isDarkMode={isDarkMode}
                  preset={visualizerPresetId}
                />
              </div>
            )}

            {showQueueColumn && (
              <div className="player-queue">
                <Card
                  title="Playback Queue"
                  headerRight={(
                    <button
                      type="button"
                      className="ghost-button mini-icon"
                      onClick={onQueueClear}
                      disabled={!canClearQueue}
                      title="Clear queue (keep current and previous)"
                      aria-label="Clear queue (keep current and previous)"
                    >
                      <IconTrash className="btn-icon" />
                    </button>
                  )}
                >
                  <ul className="queue-list">
                    {mergedQueueTracks.map((track, index) => (
                      <li key={`${track.id}-${index}`}>
                        <div className={track.id === playbackTrackId ? "queue-item active" : "queue-item"}>
                          <button className="queue-item-main" onClick={() => onQueueTrackClick(track)}>
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt="" className="queue-item-cover" />
                            ) : (
                              <span className="queue-item-cover placeholder" aria-hidden="true">♪</span>
                            )}
                            <span className="queue-item-text">
                              <strong>{track.title || "Untitled"}</strong>
                              <small>{track.artist || "Unknown artist"}</small>
                            </span>
                          </button>
                          <span className="queue-item-actions">
                            <button
                              type="button"
                              className="ghost-button mini-icon"
                              onClick={() => onQueueTrackClick(track)}
                              title="Play track"
                              aria-label="Play track"
                            >
                              <IconPlay className="btn-icon" />
                            </button>
                            <button
                              type="button"
                              className="ghost-button mini-icon"
                              onClick={() => onQueueRemoveTrack(track.id)}
                              title="Remove track"
                              aria-label="Remove track"
                            >
                              <IconTrash className="btn-icon" />
                            </button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {hasMoreQueueTracks && (
                    <button className="ghost-button queue-load-more" onClick={onLoadMoreQueueTracks}>
                      Load more
                    </button>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="player-subbar" role="group" aria-label="Player layout controls">
        <div className="player-subbar-columns">
          <button
            className={showLibraryColumn ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
            onClick={onToggleLibraryColumn}
            title={showLibraryColumn ? "Hide library column" : "Show library column"}
            aria-label={showLibraryColumn ? "Hide library column" : "Show library column"}
          >
            <span className="btn-content"><IconLibrary className="btn-icon" /></span>
          </button>
          <button
            className={showVisualizerColumn ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
            onClick={onToggleVisualizerColumn}
            title={showVisualizerColumn ? "Hide visualizer column" : "Show visualizer column"}
            aria-label={showVisualizerColumn ? "Hide visualizer column" : "Show visualizer column"}
          >
            <span className="btn-content"><IconVisualizer className="btn-icon" /></span>
          </button>
          <button
            className={showQueueColumn ? "top-section-btn is-active-toggle" : "ghost-button top-section-btn"}
            onClick={onToggleQueueColumn}
            title={showQueueColumn ? "Hide queue column" : "Show queue column"}
            aria-label={showQueueColumn ? "Hide queue column" : "Show queue column"}
          >
            <span className="btn-content"><IconQueue className="btn-icon" /></span>
          </button>
        </div>
        <div className="player-subbar-selectors">
          <div className="player-subbar-select-group">
            <label className="player-subbar-eq-label" htmlFor="player-visualizer-preset">Viz</label>
            <select
              id="player-visualizer-preset"
              className="input player-subbar-select"
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
          <div className="player-subbar-select-group">
            <label className="player-subbar-eq-label" htmlFor="player-eq-preset">EQ</label>
          <select
            id="player-eq-preset"
            className="input player-subbar-select"
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
          </div>
          <button
            className={autoEqEnabled ? "top-section-btn is-active-toggle player-subbar-autoeq" : "ghost-button top-section-btn player-subbar-autoeq"}
            onClick={onToggleAutoEq}
            title={autoEqEnabled ? "Disable Auto EQ" : "Enable Auto EQ"}
            aria-label={autoEqEnabled ? "Disable Auto EQ" : "Enable Auto EQ"}
          >
            <span className="btn-content"><IconAutoEq className="btn-icon" />Auto EQ</span>
          </button>
        </div>
      </div>
    </main>
  );
}
