import { useEffect, useMemo } from "react";
import { IconCollapse, IconExpand, IconQueue } from "../../components/icons";
import { seekTo } from "../../actions/playback";
import { NOW_PLAYING_PARTS, VISUALIZER_PRESETS, type NowPlayingPart, type VisualizerPresetId } from "../../domain/visualizer";
import { useLyrics } from "../../hooks/useLyrics";
import { useLibraryStore } from "../../store/libraryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { SeekBar, TransportControls } from "../../shell/Transport";
import { Badge, Button, Cover, IconButton, Select, ToggleGroup, cx } from "../../ui";
import { getActiveLyricIndex } from "../../utils/lyrics";
import { LyricsView } from "./LyricsView";
import { QueuePane } from "./QueuePane";
import { Visualizer } from "./Visualizer";
import "./nowPlaying.css";

const PART_OPTIONS: Array<{ value: NowPlayingPart; label: string }> = [
  { value: "cover", label: "Cover" },
  { value: "lyrics", label: "Lyrics" },
  { value: "viz", label: "Visualizer" },
];

type NowPlayingScreenProps = {
  onTogglePlayPause: () => void;
};

/**
 * What is playing, your way: cover, lyrics and visualizer can be shown alone or together, next to the queue,
 * or in a full-window mode that hides the rest of the interface.
 */
export function NowPlayingScreen({ onTogglePlayPause }: NowPlayingScreenProps) {
  const { nowPlayingShow, setNowPlayingShow, nowPlayingQueue, setNowPlayingQueue, playerVisualizerPresetId, setPlayerVisualizerPresetId } = useSettingsStore();
  const { isImmersive, setImmersive } = useUiStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const { playbackTrackId, currentTime } = usePlayerStore();

  const track = tracks.find((item) => item.id === playbackTrackId) ?? tracks.find((item) => item.id === selectedTrackId) ?? null;
  const lyrics = useLyrics(track);
  const activeIndex = useMemo(() => getActiveLyricIndex(lyrics.lines, currentTime), [lyrics.lines, currentTime]);

  const parts = NOW_PLAYING_PARTS.filter((part) => nowPlayingShow.includes(part));
  const showCover = parts.includes("cover");
  const showLyrics = parts.includes("lyrics");
  const showViz = parts.includes("viz");

  useEffect(() => {
    if (!isImmersive) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImmersive, setImmersive]);

  if (!track) {
    return (
      <div className="np np--empty">
        <h2 className="db-text-display">Nothing playing yet</h2>
        <p>Play a track from the library and it shows up here, with its lyrics and a live visualizer.</p>
      </div>
    );
  }

  return (
    <div className={cx("np", `np--parts-${parts.length}`, isImmersive && "np--immersive")}>
      <div className="np__main">
        <div className="np__toolbar" role="toolbar" aria-label="Now Playing options">
          <ToggleGroup label="Show in Now Playing" value={parts} options={PART_OPTIONS} onChange={setNowPlayingShow} />
          {showViz ? (
            <Select
              className="np__viz-select"
              aria-label="Visualizer type"
              value={playerVisualizerPresetId}
              onChange={(event) => setPlayerVisualizerPresetId(event.target.value as VisualizerPresetId)}
            >
              {VISUALIZER_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </Select>
          ) : null}
          <div className="np__toolbar-end">
            {!isImmersive ? (
              <IconButton label={nowPlayingQueue ? "Hide queue" : "Show queue"} active={nowPlayingQueue} onClick={() => setNowPlayingQueue(!nowPlayingQueue)}>
                <IconQueue />
              </IconButton>
            ) : null}
            <Button size="sm" icon={isImmersive ? <IconCollapse /> : <IconExpand />} onClick={() => setImmersive(!isImmersive)}>
              {isImmersive ? "Exit full window" : "Full window"}
            </Button>
          </div>
        </div>

        <div className="np__stage">
          {showCover ? (
            <div className="np__cover">
              <Cover src={track.coverUrl} radius={16} alt={`Cover of ${track.album || track.title}`} />
            </div>
          ) : null}
          {showLyrics ? (
            <div className="np__lyrics">
              <LyricsView lines={lyrics.lines} activeIndex={activeIndex} synced={lyrics.isSynced} status={lyrics.status} large={isImmersive || parts.length === 1} onSeek={seekTo} />
            </div>
          ) : null}
          {showViz ? (
            <div className="np__viz">
              <Visualizer preset={playerVisualizerPresetId} coverUrl={track.coverUrl} />
            </div>
          ) : null}
        </div>

        {isImmersive ? (
          <div className="np__dock">
            <div className="np__dock-info">
              <strong className="db-text-display">{track.title || "Untitled"}</strong>
              <span>{[track.artist, track.album].filter(Boolean).join(" · ")}</span>
              {lyrics.isSynced ? <Badge tone="neutral">Synced lyrics</Badge> : null}
            </div>
            <TransportControls onTogglePlayPause={onTogglePlayPause} />
            <SeekBar />
          </div>
        ) : null}
      </div>
      {nowPlayingQueue && !isImmersive ? <QueuePane /> : null}
    </div>
  );
}
