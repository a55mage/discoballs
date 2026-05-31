import { type ComponentType, type RefObject, type SVGProps, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { LibrarySection, type LibrarySectionProps } from "./LibrarySection";
import { MusicVisualizerSection, type VisualizerPresetId } from "./MusicVisualizerSection";
import type { Track } from "../types";
import type { LyricLine } from "../utils/lyrics";

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
  showLyricsSection: boolean;
  visualizerPresetId: VisualizerPresetId;
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
  lyricsStatus: string;
  lyricsIsSynced: boolean;
  lyricsLines: LyricLine[];
  lyricsActiveIndex: number;
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
  showLyricsSection,
  visualizerPresetId,
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
  lyricsStatus,
  lyricsIsSynced,
  lyricsLines,
  lyricsActiveIndex,
}: PlayerSectionProps) {
  const lyricsListRef = useRef<HTMLUListElement | null>(null);
  const [liveLyrics, setLiveLyrics] = useState(true);
  const [lyricsFontSize, setLyricsFontSize] = useState(15);
  const [liveLyricsPanelWidth, setLiveLyricsPanelWidth] = useState(0);
  const isActiveLyricIndex = lyricsActiveIndex >= 0 && lyricsActiveIndex < lyricsLines.length;
  const visibleLyrics = useMemo(() => {
    if (!liveLyrics || lyricsLines.length <= 3) {
      return lyricsLines.map((line, index) => ({ line, index }));
    }
    if (!isActiveLyricIndex || lyricsActiveIndex <= 1) {
      return lyricsLines.slice(0, 3).map((line, index) => ({ line, index }));
    }
    if (lyricsActiveIndex >= lyricsLines.length - 2) {
      const start = lyricsLines.length - 3;
      return lyricsLines.slice(start).map((line, offset) => ({ line, index: start + offset }));
    }
    const start = lyricsActiveIndex - 1;
    return lyricsLines.slice(start, start + 3).map((line, offset) => ({ line, index: start + offset }));
  }, [liveLyrics, lyricsLines, lyricsActiveIndex, isActiveLyricIndex]);
  const getLineFontSize = (text: string, isActive: boolean) => {
    if (!liveLyrics) {
      return lyricsFontSize;
    }
    const baseWidth = liveLyricsPanelWidth > 0 ? liveLyricsPanelWidth : 420;
    const textLength = Math.max(6, text.trim().length);
    const widthRatio = isActive ? 0.9 : 0.82;
    const estimated = Math.round((baseWidth * widthRatio) / (textLength * 0.56));
    const userBase = lyricsFontSize + (isActive ? 8 : 4);
    const computed = Math.max(estimated, userBase);
    return Math.max(isActive ? 22 : 18, Math.min(isActive ? 58 : 46, computed));
  };

  useEffect(() => {
    if (lyricsIsSynced || !liveLyrics) {
      return;
    }
    setLiveLyrics(false);
  }, [lyricsIsSynced, liveLyrics]);

  useEffect(() => {
    if (!liveLyrics) {
      return;
    }
    const list = lyricsListRef.current;
    if (!list) {
      return;
    }
    const updateWidth = () => {
      setLiveLyricsPanelWidth(list.clientWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [liveLyrics, showLyricsSection]);

  const hasLeftColumn = showLibraryColumn || showLyricsSection;
  const hasRightColumn = showVisualizerColumn || showQueueColumn;
  const layoutClassName = hasLeftColumn && hasRightColumn
    ? "player-layout has-two-columns"
    : "player-layout has-single-column";
  const rightStackClassName = showVisualizerColumn && showQueueColumn
    ? "player-right-stack is-split"
    : "player-right-stack";
  const leftStackClassName = showLibraryColumn && showLyricsSection
    ? "player-library-stack is-split"
    : "player-library-stack";
  const mergedQueueTracks = [...queueHistoryTracks.slice(-1), ...queueTracks];

  return (
    <main className="player-screen">
      <div className={layoutClassName}>
        {hasLeftColumn && (
          <div className={leftStackClassName}>
            {showLibraryColumn && (
              <div className="player-library">
                <LibrarySection {...libraryProps} />
              </div>
            )}
            {showLyricsSection && (
              <div className="player-lyrics">
                <Card
                  title="Lyrics"
                  headerRight={(
                    <>
                      {!liveLyrics && (
                        <>
                          <button
                            type="button"
                            className="ghost-button top-section-btn player-lyrics-toggle player-lyrics-size-btn"
                            onClick={() => setLyricsFontSize((prev) => Math.max(12, prev - 1))}
                            title="Decrease lyrics font size"
                            aria-label="Decrease lyrics font size"
                          >
                            <span className="btn-content">A-</span>
                          </button>
                          <button
                            type="button"
                            className="ghost-button top-section-btn player-lyrics-toggle player-lyrics-size-btn"
                            onClick={() => setLyricsFontSize((prev) => Math.min(26, prev + 1))}
                            title="Increase lyrics font size"
                            aria-label="Increase lyrics font size"
                          >
                            <span className="btn-content">A+</span>
                          </button>
                        </>
                      )}
                      {lyricsIsSynced && (
                        <button
                          type="button"
                          className={liveLyrics ? "top-section-btn is-active-toggle player-lyrics-toggle" : "ghost-button top-section-btn player-lyrics-toggle"}
                          onClick={() => setLiveLyrics((prev) => !prev)}
                          title={liveLyrics ? "Disable live lyrics" : "Enable live lyrics"}
                          aria-label={liveLyrics ? "Disable live lyrics" : "Enable live lyrics"}
                        >
                          <span className="btn-content">Live lyrics</span>
                        </button>
                      )}
                    </>
                  )}
                >
                  {lyricsStatus && (
                    <p className="muted player-lyrics-status">{lyricsStatus}</p>
                  )}
                  <ul
                    ref={lyricsListRef}
                    className={liveLyrics ? "player-lyrics-list is-live" : "player-lyrics-list"}
                  >
                    {visibleLyrics.map(({ line, index }) => (
                      <li key={`${line.timeSec}-${index}`}>
                        <p
                          className={lyricsIsSynced && index === lyricsActiveIndex ? "player-lyrics-line active" : "player-lyrics-line"}
                          style={{ fontSize: `${getLineFontSize(line.text, lyricsIsSynced && index === lyricsActiveIndex)}px` }}
                        >
                          {line.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
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
    </main>
  );
}
