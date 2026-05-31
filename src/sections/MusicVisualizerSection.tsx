import { type RefObject, useEffect, useRef } from "react";
import { Card } from "../components/Card";
import { getOrCreateMediaAudioGraph, type MediaAudioGraph } from "../utils/audioGraph";

export type VisualizerPresetId = "xp-bars" | "alchemy" | "scope" | "turntable";
export const VISUALIZER_PRESETS: Array<{ id: VisualizerPresetId; label: string }> = [
  { id: "scope", label: "Scope Line" },
  { id: "alchemy", label: "Alchemy" },
  { id: "xp-bars", label: "XP Bars" },
  { id: "turntable", label: "Turntable" },
];

type MusicVisualizerSectionProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isActive: boolean;
  hasAudio: boolean;
  isPlaying: boolean;
  coverUrl?: string;
  currentTime: number;
  duration: number;
  accentColor: string;
  isDarkMode: boolean;
  preset: VisualizerPresetId;
};

export function MusicVisualizerSection({
  audioRef,
  isActive,
  hasAudio,
  isPlaying,
  coverUrl,
  currentTime,
  duration,
  accentColor,
  isDarkMode,
  preset,
}: MusicVisualizerSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<MediaAudioGraph | null>(null);
  const frameRef = useRef<number | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const coverImageUrlRef = useRef<string>("");
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const graph = getOrCreateMediaAudioGraph(audio);
    if (!graph) {
      return;
    }
    graphRef.current = graph;
    void graph.context.resume();
  }, [audioRef, isActive]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
  }, [currentTime, duration]);

  useEffect(() => {
    if (!coverUrl) {
      coverImageRef.current = null;
      coverImageUrlRef.current = "";
      return;
    }
    if (coverImageUrlRef.current === coverUrl && coverImageRef.current) {
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      coverImageRef.current = img;
      coverImageUrlRef.current = coverUrl;
    };
    img.onerror = () => {
      if (coverImageUrlRef.current === coverUrl) {
        coverImageRef.current = null;
      }
    };
    img.src = coverUrl;
  }, [coverUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !isActive) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = Math.max(280, Math.floor(container.clientWidth));
      const height = Math.max(220, Math.floor(container.clientHeight));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof window.ResizeObserver === "function") {
      resizeObserver = new window.ResizeObserver(resize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", resize);
    }

    const drawFrame = () => {
      const width = canvas.width / Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const height = canvas.height / Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      drawBackground(ctx, width, height, isDarkMode, accentColor);

      if (!hasAudio) {
        frameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const graph = graphRef.current;
      if (!graph) {
        frameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      graph.analyser.getByteFrequencyData(graph.frequencyData);
      graph.analyser.getByteTimeDomainData(graph.timeData);

      switch (preset) {
        case "alchemy":
          drawAlchemy(ctx, width, height, graph.frequencyData, accentColor, isPlaying);
          break;
        case "scope":
          drawScope(ctx, width, height, graph.timeData, accentColor, isPlaying);
          break;
        case "turntable":
          drawTurntable(
            ctx,
            width,
            height,
            coverImageRef.current,
            accentColor,
            isDarkMode,
            isPlaying,
            currentTimeRef.current,
            durationRef.current
          );
          break;
        case "xp-bars":
        default:
          drawXpBars(ctx, width, height, graph.frequencyData, accentColor, isPlaying);
          break;
      }

      frameRef.current = requestAnimationFrame(drawFrame);
    };

    frameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resize);
      }
    };
  }, [accentColor, hasAudio, isActive, isDarkMode, isPlaying, preset]);

  return (
    <Card title="Music Visualizer" className="visualizer-card" hideHeader>
      <div className="visualizer-layout">
        <div ref={containerRef} className="visualizer-stage">
          <canvas ref={canvasRef} className="visualizer-canvas" />
          {!hasAudio && (
            <div className="visualizer-overlay">
              <p>No audio loaded</p>
              <small>Press play to start.</small>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDarkMode: boolean,
  accentColor: string
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (isDarkMode) {
    gradient.addColorStop(0, blendHexColors(accentColor, "#0a1018", 0.28));
    gradient.addColorStop(1, blendHexColors(accentColor, "#060c13", 0.2));
  } else {
    gradient.addColorStop(0, blendHexColors(accentColor, "#eef3fa", 0.22));
    gradient.addColorStop(1, blendHexColors(accentColor, "#e2ebf7", 0.16));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawAlchemy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freq: Uint8Array<ArrayBuffer>,
  accentColor: string,
  isPlaying: boolean
) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const ringCount = 16;
  const maxRadius = Math.min(width, height) * 0.42;
  const baseAlpha = isPlaying ? 0.75 : 0.3;
  const t = performance.now() * 0.001;
  const low = bandEnergy(freq, 0, 28);
  const mid = bandEnergy(freq, 28, 96);
  const globalPulse = Math.sin(t * (1.6 + low * 2.2)) * (2 + low * 7);

  for (let i = 0; i < ringCount; i += 1) {
    const bin = Math.min(freq.length - 1, i * 3);
    const energy = freq[bin] / 255;
    const baseRadius = (i + 1) * (maxRadius / ringCount);
    const radius = baseRadius * (0.78 + energy * 0.42) + globalPulse * (0.35 + i * 0.05);
    const alpha = baseAlpha * (0.45 + energy * 0.55);
    ctx.lineWidth = 0.7 + energy * 1.1;
    ctx.strokeStyle = withAlpha(accentColor, alpha);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, radius), 0, Math.PI * 2);
    ctx.stroke();

    // Secondary halo ripple: stays circular (no rotation), reacts to audio energy.
    const rippleOffset = (Math.sin(t * (2.1 + mid * 2.8) + i * 0.38) * (1.2 + energy * 5.2));
    ctx.lineWidth = 0.5 + energy * 0.7;
    ctx.strokeStyle = withAlpha(accentColor, alpha * 0.42);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, radius + rippleOffset), 0, Math.PI * 2);
    ctx.stroke();
  }

  const coreEnergy = freq[1] / 255;
  const coreRadius = 14 + coreEnergy * 34;
  const radial = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreRadius);
  radial.addColorStop(0, withAlpha(accentColor, 0.9));
  radial.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fill();
}

function bandEnergy(freq: Uint8Array<ArrayBuffer>, start: number, end: number): number {
  const from = Math.max(0, Math.min(freq.length - 1, start));
  const to = Math.max(from + 1, Math.min(freq.length, end));
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    sum += freq[i];
  }
  return sum / ((to - from) * 255);
}

function drawXpBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freq: Uint8Array<ArrayBuffer>,
  accentColor: string,
  isPlaying: boolean
) {
  const bins = Math.min(64, freq.length);
  const barGap = 2;
  const totalGapWidth = (bins - 1) * barGap;
  const barWidth = Math.max(1, (width - totalGapWidth) / bins);
  const baselineY = height;

  for (let i = 0; i < bins; i += 1) {
    const energy = freq[i] / 255;
    const boost = isPlaying ? 1 : 0.25;
    const amp = Math.max(0.02, energy * boost);
    const barHeight = amp * (height * 0.88);
    const x = i * (barWidth + barGap);
    const y = baselineY - barHeight;

    const topGradient = ctx.createLinearGradient(0, y, 0, baselineY);
    topGradient.addColorStop(0, accentColor);
    topGradient.addColorStop(1, withAlpha(accentColor, 0.2));
    ctx.fillStyle = topGradient;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function drawScope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: Uint8Array<ArrayBuffer>,
  accentColor: string,
  isPlaying: boolean
) {
  const centerY = height * 0.5;
  const amp = isPlaying ? height * 0.35 : height * 0.1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  ctx.shadowBlur = 10;
  ctx.shadowColor = accentColor;
  ctx.beginPath();

  for (let i = 0; i < time.length; i += 1) {
    const x = (i / (time.length - 1)) * width;
    const normalized = (time[i] - 128) / 128;
    const y = centerY + normalized * amp;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawTurntable(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  coverImage: HTMLImageElement | null,
  accentColor: string,
  isDarkMode: boolean,
  isPlaying: boolean,
  currentTime: number,
  duration: number
) {
  const t = performance.now() * 0.001;
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const cx = width * 0.47;
  const cy = height * 0.56;
  const platterRadius = Math.min(width, height) * 0.39;
  const discRadius = platterRadius * 0.9;
  const labelRadius = discRadius * 0.36;
  const spindleRadius = discRadius * 0.03;

  const platter = ctx.createRadialGradient(cx, cy, platterRadius * 0.15, cx, cy, platterRadius);
  platter.addColorStop(0, isDarkMode ? "#3a4352" : "#7f8c9f");
  platter.addColorStop(1, isDarkMode ? "#19202b" : "#4b596d");
  ctx.fillStyle = platter;
  ctx.beginPath();
  ctx.arc(cx, cy, platterRadius, 0, Math.PI * 2);
  ctx.fill();

  const rotation = isPlaying ? t * 2.2 : progress * Math.PI * 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  ctx.fillStyle = "#0f1012";
  ctx.beginPath();
  ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 26; i += 1) {
    const rr = discRadius * (0.42 + (i / 25) * 0.56);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
  ctx.clip();
  if (coverImage) {
    const side = Math.min(coverImage.naturalWidth || coverImage.width, coverImage.naturalHeight || coverImage.height);
    const sx = Math.max(0, ((coverImage.naturalWidth || coverImage.width) - side) * 0.5);
    const sy = Math.max(0, ((coverImage.naturalHeight || coverImage.height) - side) * 0.5);
    ctx.drawImage(coverImage, sx, sy, side, side, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  } else {
    const labelGrad = ctx.createRadialGradient(0, 0, labelRadius * 0.1, 0, 0, labelRadius);
    labelGrad.addColorStop(0, withAlpha(accentColor, 0.8));
    labelGrad.addColorStop(1, withAlpha(accentColor, 0.45));
    ctx.fillStyle = labelGrad;
    ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  }
  ctx.restore();

  ctx.fillStyle = "#d7dce3";
  ctx.beginPath();
  ctx.arc(0, 0, spindleRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Stylus path: from outer groove to inner groove on the same record radius direction.
  const grooveRayAngle = 0.58;
  const grooveOuter = discRadius * 0.93;
  const grooveInner = labelRadius * 1.1;
  const startPointX = cx + Math.cos(grooveRayAngle) * grooveOuter;
  const startPointY = cy + Math.sin(grooveRayAngle) * grooveOuter;
  const endPointX = cx + Math.cos(grooveRayAngle) * grooveInner;
  const endPointY = cy + Math.sin(grooveRayAngle) * grooveInner;

  // Tonearm length is kept close to record diameter, with fixed pivot and angular sweep.
  const armLength = discRadius * 1.84;
  const chordX = endPointX - startPointX;
  const chordY = endPointY - startPointY;
  const chord = Math.hypot(chordX, chordY) || 1;
  const midX = (startPointX + endPointX) * 0.5;
  const midY = (startPointY + endPointY) * 0.5;
  const nx = -chordY / chord;
  const ny = chordX / chord;
  const pivotOffset = Math.sqrt(Math.max(0, armLength * armLength - (chord * 0.5) * (chord * 0.5)));
  const pivotAX = midX + nx * pivotOffset;
  const pivotAY = midY + ny * pivotOffset;
  const pivotBX = midX - nx * pivotOffset;
  const pivotBY = midY - ny * pivotOffset;
  const desiredPivotX = cx + discRadius * 1.08;
  const desiredPivotY = cy - discRadius * 0.76;
  const distA = Math.hypot(pivotAX - desiredPivotX, pivotAY - desiredPivotY);
  const distB = Math.hypot(pivotBX - desiredPivotX, pivotBY - desiredPivotY);
  const armPivotX = distA <= distB ? pivotAX : pivotBX;
  const armPivotY = distA <= distB ? pivotAY : pivotBY;

  const startArmAngle = Math.atan2(startPointY - armPivotY, startPointX - armPivotX);
  const endArmAngle = Math.atan2(endPointY - armPivotY, endPointX - armPivotX);
  const armAngle = startArmAngle + (endArmAngle - startArmAngle) * progress;
  const ux = Math.cos(armAngle);
  const uy = Math.sin(armAngle);
  const px = -uy;
  const py = ux;

  const armTipX = armPivotX + ux * armLength;
  const armTipY = armPivotY + uy * armLength;
  const elbowX = armPivotX + ux * (armLength * 0.62) + px * (platterRadius * 0.07);
  const elbowY = armPivotY + uy * (armLength * 0.62) + py * (platterRadius * 0.07);
  const headshellBaseX = armTipX - ux * (platterRadius * 0.09);
  const headshellBaseY = armTipY - uy * (platterRadius * 0.09);
  const stylusX = armTipX;
  const stylusY = armTipY;

  // Pivot base and collar.
  ctx.fillStyle = isDarkMode ? "#4e596b" : "#8694a9";
  ctx.beginPath();
  ctx.arc(armPivotX, armPivotY, platterRadius * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isDarkMode ? "#252f3d" : "#617085";
  ctx.beginPath();
  ctx.arc(armPivotX, armPivotY, platterRadius * 0.075, 0, Math.PI * 2);
  ctx.fill();

  // Counterweight.
  const cwX = armPivotX - ux * (platterRadius * 0.16);
  const cwY = armPivotY - uy * (platterRadius * 0.16);
  ctx.strokeStyle = isDarkMode ? "#5f6b7d" : "#7b879c";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(armPivotX, armPivotY);
  ctx.lineTo(cwX, cwY);
  ctx.stroke();
  ctx.fillStyle = isDarkMode ? "#7a8698" : "#69788d";
  ctx.beginPath();
  ctx.arc(cwX, cwY, platterRadius * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Arm tube with slight S-like bend and headshell.
  ctx.strokeStyle = isDarkMode ? "#b4becd" : "#5f6c7d";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(armPivotX, armPivotY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(headshellBaseX, headshellBaseY);
  ctx.stroke();

  ctx.strokeStyle = isDarkMode ? "#8d98aa" : "#4f5d70";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(headshellBaseX, headshellBaseY);
  ctx.lineTo(stylusX, stylusY);
  ctx.stroke();

  ctx.fillStyle = withAlpha(accentColor, isPlaying ? 0.9 : 0.5);
  ctx.beginPath();
  ctx.arc(stylusX, stylusY, 4, 0, Math.PI * 2);
  ctx.fill();
}

function withAlpha(color: string, alpha: number): string {
  const safe = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${safe})`;
    }
  }
  return color;
}

function blendHexColors(accentColor: string, baseColor: string, accentWeight: number): string {
  const accent = parseHexColor(accentColor);
  const base = parseHexColor(baseColor);
  if (!accent || !base) {
    return baseColor;
  }
  const weight = Math.max(0, Math.min(1, accentWeight));
  const r = Math.round(base.r * (1 - weight) + accent.r * weight);
  const g = Math.round(base.g * (1 - weight) + accent.g * weight);
  const b = Math.round(base.b * (1 - weight) + accent.b * weight);
  return `rgb(${r}, ${g}, ${b})`;
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  if (!value.startsWith("#")) {
    return null;
  }
  const hex = value.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((channel) => Number.isNaN(channel))) {
      return null;
    }
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((channel) => Number.isNaN(channel))) {
      return null;
    }
    return { r, g, b };
  }
  return null;
}
