import { useEffect, useRef, useState } from "react";
import { IconPause, IconPlay, IconZoomIn, IconZoomOut } from "../../components/icons";
import { adapter } from "../../api";
import { audioRef } from "../../audio/audioRef";
import { playFromLibraryCover, seekTo } from "../../actions/playback";
import { useLibraryStore } from "../../store/libraryStore";
import { usePlayerStore } from "../../store/playerStore";
import { getOrCreateMediaAudioGraph } from "../../utils/audioGraph";
import { formatError } from "../../utils/common";
import type { Beatmap, Track } from "../../types";
import { Badge, Button, Cover, IconButton, ToggleGroup, cx } from "../../ui";
import { BAND_COLORS, BAND_NAMES, BeatmapTimeline } from "./BeatmapTimeline";
import "./beatmap.css";

/** Visible spans of the timeline, in seconds; the last step shows the whole track. */
const ZOOM_STEPS = [4, 8, 16, 32, 64];

type ClickSource = "beats" | "low" | "mid" | "high";
const CLICK_OPTIONS: Array<{ value: ClickSource; label: string }> = [
  { value: "beats", label: "Beats" },
  { value: "low", label: "Low" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
];
/** Pitch of each click, so they can be told apart by ear. */
const CLICK_PITCH: Record<ClickSource, number> = { beats: 1600, low: 330, mid: 880, high: 2600 };

/** Beatmaps already shown in this session, by track id (the backend keeps them on disk too). */
const sessionCache = new Map<string, Beatmap>();

type BeatmapLabProps = {
  onTogglePlayPause: () => void;
};

/**
 * Debug view of the rhythm-game analysis: what the analyser finds in a track, drawn over its waveform, with
 * clicks on beats or onsets to check by ear that they land on the music.
 */
export function BeatmapLab({ onTogglePlayPause }: BeatmapLabProps) {
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const playbackTrackId = usePlayerStore((state) => state.playbackTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const [trackId, setTrackId] = useState(playbackTrackId || selectedTrackId);
  const track = tracks.find((item) => item.id === trackId);
  const [beatmap, setBeatmap] = useState<Beatmap | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(2);
  const [viewStart, setViewStart] = useState(0);
  const [follow, setFollow] = useState(true);
  const [clicks, setClicks] = useState<ClickSource[]>([]);
  const isCurrent = Boolean(track && track.id === playbackTrackId);

  const viewSeconds = beatmap ? Math.min(beatmap.duration, ZOOM_STEPS[zoom] ?? beatmap.duration) : 16;
  const isWhole = !beatmap || zoom >= ZOOM_STEPS.length || viewSeconds >= beatmap.duration;

  async function analyze(target: Track, force: boolean) {
    setStatus("loading");
    setError("");
    try {
      const result = await adapter.analyzeBeatmap(target, force);
      sessionCache.set(target.id, result);
      setBeatmap(result);
      setViewStart(0);
      setStatus("idle");
    } catch (failure) {
      setBeatmap(null);
      setError(formatError(failure));
      setStatus("error");
    }
  }

  // A new track: show its beatmap at once when known, otherwise analyse it (the backend answers from its cache).
  useEffect(() => {
    if (!track) {
      setBeatmap(null);
      return;
    }
    const known = sessionCache.get(track.id);
    if (known) {
      setBeatmap(known);
      setViewStart(0);
      setStatus("idle");
      return;
    }
    void analyze(track, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  const readTime = () => (isCurrent && audioRef.current ? audioRef.current.currentTime : null);
  const stateRef = useRef({ beatmap, clicks, follow, isCurrent, viewSeconds });
  stateRef.current = { beatmap, clicks, follow, isCurrent, viewSeconds };

  // While this track plays: keep the playhead in view and click on the chosen events.
  useEffect(() => {
    let frame = 0;
    let last = -1;
    const tick = () => {
      const { beatmap: map, clicks: sources, follow: following, isCurrent: current, viewSeconds: span } = stateRef.current;
      const audio = audioRef.current;
      if (map && current && audio && !audio.paused) {
        const now = audio.currentTime;
        if (following) {
          setViewStart((start) => {
            const wanted = Math.max(0, Math.min(map.duration - span, now - span * 0.25));
            return Math.abs(wanted - start) > span * 0.002 ? wanted : start;
          });
        }
        // Only small steps forward: a seek must not fire every event in between.
        if (sources.length && last >= 0 && now > last && now - last < 0.25) {
          for (const source of sources) {
            const times = source === "beats" ? map.beats : map.onsets.filter((onset) => onset.band === ["low", "mid", "high"].indexOf(source)).map((onset) => onset.time);
            if (times.some((time) => time > last && time <= now)) {
              playClick(audio, CLICK_PITCH[source]);
            }
          }
        }
        last = now;
      } else {
        last = -1;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function onSeek(time: number) {
    if (!track || !beatmap) return;
    setViewStart(Math.max(0, Math.min(beatmap.duration - viewSeconds, time - viewSeconds * 0.25)));
    if (isCurrent) {
      seekTo(time);
    }
  }

  function playThisTrack() {
    if (!track) return;
    if (isCurrent) {
      onTogglePlayPause();
    } else {
      void playFromLibraryCover(track, [track.id]);
    }
  }

  if (!tracks.length) {
    return (
      <div className="bm bm--empty">
        <h2 className="db-text-display">Beatmap lab</h2>
        <p>Open a folder or connect a server, then pick a track: its rhythm analysis shows up here.</p>
      </div>
    );
  }

  const bandCounts = [0, 1, 2].map((band) => beatmap?.onsets.filter((onset) => onset.band === band).length ?? 0);

  return (
    <div className="bm">
      <div className="bm__head">
        <Cover size={52} radius={8} src={track?.coverUrl} />
        <div className="bm__title">
          <strong>{track ? track.title || "Untitled" : "No track"}</strong>
          <span>{track ? track.artist || "Unknown artist" : "Pick a track in the library or play one"}</span>
        </div>
        <div className="bm__pick">
          <Button size="sm" disabled={!playbackTrackId || playbackTrackId === trackId} onClick={() => setTrackId(playbackTrackId)}>
            Playing track
          </Button>
          <Button size="sm" disabled={!selectedTrackId || selectedTrackId === trackId} onClick={() => setTrackId(selectedTrackId)}>
            Selected in library
          </Button>
        </div>
        <div className="bm__actions">
          <IconButton label={isCurrent && isPlaying ? "Pause" : "Play this track"} solid disabled={!track} onClick={playThisTrack}>
            {isCurrent && isPlaying ? <IconPause /> : <IconPlay />}
          </IconButton>
          <Button size="sm" disabled={!track || status === "loading"} onClick={() => track && void analyze(track, true)}>
            {status === "loading" ? "Analysing…" : "Analyse again"}
          </Button>
        </div>
      </div>

      {status === "error" ? <p className="bm__error" role="alert">Analysis failed: {error}</p> : null}
      {status === "loading" && !beatmap ? <p className="bm__note" role="status">Decoding and analysing the whole track…</p> : null}

      {beatmap ? (
        <>
          <dl className="bm__stats">
            <div>
              <dt>Tempo</dt>
              <dd>
                {beatmap.bpm.toFixed(1)} BPM{" "}
                <Badge tone={beatmap.tempoConfidence >= 0.3 ? "ok" : "neutral"}>{Math.round(beatmap.tempoConfidence * 100)}% sure</Badge>
              </dd>
            </div>
            <div>
              <dt>Beats</dt>
              <dd>{beatmap.beats.length}</dd>
            </div>
            <div>
              <dt>Onsets</dt>
              <dd className="bm__bands">
                {bandCounts.map((count, band) => (
                  <span key={band}>
                    <i style={{ background: BAND_COLORS[band] }} aria-hidden="true" />
                    {BAND_NAMES[band]} {count}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Sections</dt>
              <dd>{beatmap.sections.length}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{formatDuration(beatmap.duration)}</dd>
            </div>
            <div>
              <dt>Analysis</dt>
              <dd>{beatmap.cached ? "from cache" : `decode ${beatmap.decodeMs} ms · analysis ${beatmap.analysisMs} ms`}</dd>
            </div>
          </dl>

          <div className="bm__toolbar" role="toolbar" aria-label="Timeline options">
            <div className="bm__zoom" role="group" aria-label="Zoom">
              <IconButton label="Zoom out" size="sm" disabled={isWhole} onClick={() => setZoom((value) => Math.min(ZOOM_STEPS.length, value + 1))}>
                <IconZoomOut />
              </IconButton>
              <IconButton label="Zoom in" size="sm" disabled={zoom === 0} onClick={() => setZoom((value) => Math.max(0, Math.min(value, ZOOM_STEPS.length) - 1))}>
                <IconZoomIn />
              </IconButton>
              <span>{isWhole ? "Whole track" : `${viewSeconds} s`}</span>
            </div>
            <label className="bm__follow">
              <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
              Follow playback
            </label>
            <div className="bm__clicks">
              <span>Click on</span>
              <ToggleGroup label="Click on" value={clicks} options={CLICK_OPTIONS} min={0} onChange={setClicks} />
            </div>
            {!isCurrent ? <span className="bm__note">Play this track to see the playhead and hear the clicks.</span> : null}
          </div>

          <BeatmapTimeline
            beatmap={beatmap}
            viewStart={isWhole ? 0 : viewStart}
            viewSeconds={isWhole ? beatmap.duration : viewSeconds}
            readTime={readTime}
            onSeek={onSeek}
            onScroll={(delta) => setViewStart((start) => Math.max(0, Math.min(beatmap.duration - viewSeconds, start + delta)))}
            onZoom={(direction) => setZoom((value) => Math.max(0, Math.min(ZOOM_STEPS.length, value - direction)))}
          />

          <ul className={cx("bm__sections")} aria-label="Sections">
            {beatmap.sections.map((section, index) => (
              <li key={index}>
                <button type="button" onClick={() => onSeek(section.start)}>
                  <span className="bm__section-bar" style={{ width: `${Math.round(section.intensity * 100)}%` }} aria-hidden="true" />
                  <strong>{index + 1}</strong>
                  <span>
                    {formatDuration(section.start)}–{formatDuration(section.end)}
                  </span>
                  <span>intensity {Math.round(section.intensity * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds - minutes * 60)).padStart(2, "0")}`;
}

/** A short tick through the app's audio context, straight to the speakers (not through the EQ). */
function playClick(audio: HTMLAudioElement, frequency: number) {
  const graph = getOrCreateMediaAudioGraph(audio);
  if (!graph) return;
  const { context } = graph;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  const now = context.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.06);
}
