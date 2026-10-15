import { useEffect, useRef } from "react";
import { audioRef } from "../../audio/audioRef";
import { usePlayerStore } from "../../store/playerStore";
import { useSettingsStore } from "../../store/settingsStore";
import { getOrCreateMediaAudioGraph, type MediaAudioGraph } from "../../utils/audioGraph";

import type { VisualizerPresetId } from "../../domain/visualizer";
import { VizState, drawRadial, drawSpectrum, drawWave, idleFrameData, withAlpha, type VizFrame } from "./vizEffects";

type VisualizerProps = {
  preset: VisualizerPresetId;
  /** Cover of the track in use (drawn by the turntable preset). */
  coverUrl?: string;
};

/** Live audio visualizer drawn on a canvas that fills its container. */
export function Visualizer({ preset, coverUrl }: VisualizerProps) {
  const player = usePlayerStore();
  const colorMode = useSettingsStore((state) => state.colorMode);
  const accentColor = useSettingsStore((state) => state.accentThemes[state.accentIndex]?.accent ?? "#ee703e");
  const isDarkMode = colorMode === "dark";
  const { isPlaying, currentTime, duration } = player;
  const hasAudio = Boolean(player.audioSrc && player.audioTrackId === player.playbackTrackId);
  const isActive = true;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<MediaAudioGraph | null>(null);
  const frameRef = useRef<number | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const coverImageUrlRef = useRef<string>("");
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const vizStateRef = useRef(new VizState());
  const idleFreqRef = useRef(new Uint8Array(256));
  const idleTimeRef = useRef(new Uint8Array(512));

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
  }, [isActive]);

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
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.clearRect(0, 0, width, height);

      const t = performance.now() * 0.001;
      const graph = graphRef.current;
      let freq = idleFreqRef.current;
      let time = idleTimeRef.current;
      if (hasAudio && graph) {
        graph.analyser.getByteFrequencyData(graph.frequencyData);
        graph.analyser.getByteTimeDomainData(graph.timeData);
        freq = graph.frequencyData;
        time = graph.timeData;
      } else {
        idleFrameData(t, freq, time);
      }
      const frame: VizFrame = { freq, time, isPlaying: isPlaying && hasAudio, accent: accentColor, isDark: isDarkMode, t };
      const state = vizStateRef.current;

      switch (preset) {
        case "alchemy":
          drawRadial(ctx, width, height, frame, state);
          break;
        case "scope":
          drawWave(ctx, width, height, frame, state);
          break;
        case "turntable":
          drawTurntable(ctx, width, height, coverImageRef.current, accentColor, isDarkMode, isPlaying, currentTimeRef.current, durationRef.current);
          break;
        case "xp-bars":
        default:
          drawSpectrum(ctx, width, height, frame, state);
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
    <div ref={containerRef} className="np-viz">
      <canvas ref={canvasRef} className="np-viz__canvas" aria-label="Audio visualizer" role="img" />
      {!hasAudio && <p className="np-viz__hint">Press play to bring it to life.</p>}
    </div>
  );
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
