import { type MouseEvent, type WheelEvent, useEffect, useRef } from "react";
import type { Beatmap } from "../../types";

/** Lane colours of the onset bands: low, mid, high. */
export const BAND_COLORS = ["#ff6b5a", "#f5b942", "#4fc3f7"] as const;
export const BAND_NAMES = ["Low", "Mid", "High"] as const;

type BeatmapTimelineProps = {
  beatmap: Beatmap;
  /** First visible second and how many seconds fit in the view. */
  viewStart: number;
  viewSeconds: number;
  /** Current playback position of this track, or null when another track (or nothing) is playing. */
  readTime: () => number | null;
  onSeek: (time: number) => void;
  onScroll: (deltaSeconds: number) => void;
  onZoom: (direction: 1 | -1) => void;
};

const OVERVIEW = 34;
const WAVE = 150;
const LANE = 34;
const AXIS = 20;
const HEIGHT = OVERVIEW + 10 + WAVE + LANE * 3 + AXIS;

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Canvas view of a beatmap: overview, waveform with intensity and sections, beat grid and onset lanes. */
export function BeatmapTimeline({ beatmap, viewStart, viewSeconds, readTime, onSeek, onScroll, onZoom }: BeatmapTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ beatmap, viewStart, viewSeconds, readTime });
  propsRef.current = { beatmap, viewStart, viewSeconds, readTime };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    let frame = 0;
    const draw = () => {
      const { beatmap: map, viewStart: start, viewSeconds: span, readTime: getTime } = propsRef.current;
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = canvas.clientWidth;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(HEIGHT * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(HEIGHT * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);
      drawTimeline(ctx, width, map, start, span, getTime());
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  function timeAt(event: MouseEvent<HTMLCanvasElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // The overview maps the whole track; the rest maps the view.
    return y < OVERVIEW ? (x / rect.width) * beatmap.duration : viewStart + (x / rect.width) * viewSeconds;
  }

  function onWheel(event: WheelEvent<HTMLCanvasElement>) {
    if (event.ctrlKey || event.metaKey) {
      onZoom(event.deltaY < 0 ? 1 : -1);
      return;
    }
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    onScroll((delta / 400) * viewSeconds);
  }

  return (
    <canvas
      ref={canvasRef}
      className="bm-timeline"
      style={{ height: HEIGHT }}
      role="img"
      aria-label={`Beatmap timeline: ${beatmap.beats.length} beats, ${beatmap.onsets.length} onsets, ${beatmap.sections.length} sections`}
      onClick={(event) => onSeek(Math.max(0, Math.min(beatmap.duration, timeAt(event))))}
      onWheel={onWheel}
    />
  );
}

function drawTimeline(ctx: CanvasRenderingContext2D, width: number, map: Beatmap, start: number, span: number, time: number | null) {
  const accent = cssColor("--db-accent", "#ee703e");
  const ink = cssColor("--db-ink", "#222");
  const ink2 = cssColor("--db-ink-2", "#666");
  const line = cssColor("--db-line", "rgba(0,0,0,0.15)");
  const x = (t: number) => ((t - start) / span) * width;
  const end = start + span;

  // ---- Overview: intensity of the whole track and the visible window.
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, width, OVERVIEW);
  ctx.beginPath();
  ctx.moveTo(0, OVERVIEW);
  map.intensity.forEach((value, i) => ctx.lineTo((i / map.intensity.length) * width, OVERVIEW - value * (OVERVIEW - 4)));
  ctx.lineTo(width, OVERVIEW);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.45);
  ctx.fill();
  const windowX = (start / map.duration) * width;
  const windowW = Math.max(3, (span / map.duration) * width);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(windowX + 0.75, 0.75, windowW - 1.5, OVERVIEW - 1.5);
  if (time !== null) {
    ctx.fillStyle = ink;
    ctx.fillRect((time / map.duration) * width - 1, 0, 2, OVERVIEW);
  }

  const top = OVERVIEW + 10;
  const waveMid = top + WAVE / 2;
  const lanesTop = top + WAVE;

  // ---- Sections: background bands tinted by their intensity, with a boundary line.
  for (const section of map.sections) {
    if (section.end < start || section.start > end) continue;
    const left = Math.max(0, x(section.start));
    const right = Math.min(width, x(section.end));
    ctx.fillStyle = withAlpha(accent, 0.05 + section.intensity * 0.2);
    ctx.fillRect(left, top, right - left, WAVE);
    if (section.start > start) {
      ctx.fillStyle = withAlpha(accent, 0.9);
      ctx.fillRect(x(section.start) - 1, top, 2, WAVE + LANE * 3);
    }
  }

  // ---- Waveform (peaks, mirrored).
  const firstSample = Math.max(0, Math.floor(start * map.waveformRate));
  const lastSample = Math.min(map.waveform.length - 1, Math.ceil(end * map.waveformRate));
  const perPixel = Math.max(1, (lastSample - firstSample) / width);
  ctx.fillStyle = withAlpha(ink2, 0.55);
  for (let px = 0; px < width; px += 1) {
    const from = firstSample + Math.floor(px * perPixel);
    const to = Math.min(lastSample, Math.floor(from + perPixel));
    let peak = 0;
    for (let i = from; i <= to; i += 1) peak = Math.max(peak, map.waveform[i] ?? 0);
    const h = peak * (WAVE / 2 - 6);
    ctx.fillRect(px, waveMid - h, 1, h * 2);
  }

  // ---- Intensity curve.
  ctx.beginPath();
  const firstValue = Math.max(0, Math.floor(start * map.intensityRate));
  const lastValue = Math.min(map.intensity.length - 1, Math.ceil(end * map.intensityRate));
  for (let i = firstValue; i <= lastValue; i += 1) {
    const px = x(i / map.intensityRate);
    const py = top + WAVE - 4 - map.intensity[i] * (WAVE - 8);
    if (i === firstValue) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ---- Beat grid across waveform and lanes; every fourth beat is stronger (a guess at the bar).
  const beatAlpha = span > 60 ? 0.12 : 0.3;
  map.beats.forEach((beat, index) => {
    if (beat < start || beat > end) return;
    ctx.fillStyle = withAlpha(ink, index % 4 === 0 ? beatAlpha * 1.8 : beatAlpha);
    ctx.fillRect(x(beat) - 0.5, top, 1, WAVE + LANE * 3);
  });

  // ---- Onset lanes.
  for (let band = 0; band < 3; band += 1) {
    const laneTop = lanesTop + band * LANE;
    if (band % 2) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = line;
      ctx.fillRect(0, laneTop, width, LANE);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = ink2;
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.fillText(BAND_NAMES[band].toUpperCase(), 6, laneTop + 12);
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, lanesTop + 0.5, width - 1, LANE * 3 - 1);
  for (const onset of map.onsets) {
    if (onset.time < start || onset.time > end) continue;
    const cy = lanesTop + onset.band * LANE + LANE / 2;
    ctx.beginPath();
    ctx.arc(x(onset.time), cy, 2.5 + onset.strength * 6, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(BAND_COLORS[onset.band], 0.35 + onset.strength * 0.6);
    ctx.fill();
  }

  // ---- Time axis.
  const axisTop = lanesTop + LANE * 3;
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60].find((candidate) => (candidate / span) * width >= 70) ?? 120;
  ctx.fillStyle = ink2;
  ctx.font = "600 10px system-ui, sans-serif";
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) {
    ctx.fillRect(x(t), axisTop, 1, 5);
    ctx.fillText(formatTime(t, step < 1), x(t) + 3, axisTop + 14);
  }

  // ---- Playhead.
  if (time !== null && time >= start && time <= end) {
    ctx.fillStyle = accent;
    ctx.fillRect(x(time) - 1, top - 4, 2, WAVE + LANE * 3 + 8);
  }
}

function formatTime(seconds: number, withTenths: boolean): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${withTenths ? rest.toFixed(1).padStart(4, "0") : String(Math.floor(rest)).padStart(2, "0")}`;
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  const match = /^rgba?\(([^)]+)\)/.exec(color);
  if (match) {
    const [r, g, b] = match[1].split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  return color;
}
