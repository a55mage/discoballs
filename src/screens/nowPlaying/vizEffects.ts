/**
 * Drawing code of the spectrum-style visualizers. They read the analyser data, smooth it between frames
 * (fast attack, slow release) and paint on a transparent canvas, so the visualizer sits directly on the window.
 */

export type VizFrame = {
  /** Byte frequency data of the analyser (real or synthetic). */
  freq: Uint8Array<ArrayBuffer>;
  /** Byte time-domain data of the analyser. */
  time: Uint8Array<ArrayBuffer>;
  isPlaying: boolean;
  accent: string;
  isDark: boolean;
  /** Seconds, for idle motion. */
  t: number;
};

/** State that lives between frames. */
export class VizState {
  bands: Float32Array = new Float32Array(0);
  peaks: Float32Array = new Float32Array(0);
  scopeHistory: Float32Array[] = [];
  shockwaves: Array<{ born: number }> = [];
  bassAverage = 0;
  lastShockwave = 0;
}

/** CSS colour with alpha, from `#rrggbb` (other formats are returned unchanged). */
export function withAlpha(color: string, alpha: number): string {
  const safe = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${safe})`;
  }
  return color;
}

/** Moves a `#rrggbb` colour towards white (positive) or black (negative). */
export function shade(color: string, amount: number): string {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  const target = amount >= 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  const channel = (offset: number) => Math.round(parseInt(color.slice(offset, offset + 2), 16) * (1 - k) + target * k);
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}

/** Frequency data folded into `count` log-spaced bands (0…1), tilted so highs are not buried by the bass. */
export function computeBands(freq: Uint8Array<ArrayBuffer>, count: number): Float32Array {
  const bands = new Float32Array(count);
  const maxBin = Math.max(count + 1, Math.floor(freq.length * 0.78));
  for (let i = 0; i < count; i += 1) {
    const from = Math.floor(Math.pow(maxBin, i / count));
    const to = Math.max(from + 1, Math.ceil(Math.pow(maxBin, (i + 1) / count)));
    let sum = 0;
    for (let bin = from; bin < to && bin < freq.length; bin += 1) {
      sum += freq[bin];
    }
    const average = sum / ((to - from) * 255);
    const tilt = 0.85 + (i / count) * 0.7;
    bands[i] = Math.min(1, Math.pow(average * tilt, 1.2));
  }
  return bands;
}

/** Eases the displayed bands towards the new ones; also keeps falling peak markers. */
export function smoothBands(state: VizState, target: Float32Array): Float32Array {
  if (state.bands.length !== target.length) {
    state.bands = new Float32Array(target.length);
    state.peaks = new Float32Array(target.length);
  }
  for (let i = 0; i < target.length; i += 1) {
    const current = state.bands[i];
    const rate = target[i] > current ? 0.55 : 0.14;
    state.bands[i] = current + (target[i] - current) * rate;
    state.peaks[i] = Math.max(state.bands[i], state.peaks[i] - 0.008);
  }
  return state.bands;
}

function roundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/** Mirrored-reflection spectrum with rounded bars and falling peak caps. */
export function drawSpectrum(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const count = Math.max(24, Math.min(80, Math.floor(width / 14)));
  const bands = smoothBands(state, computeBands(frame.freq, count));
  const gap = Math.max(2, width / count * 0.22);
  const barWidth = (width - gap * (count - 1)) / count;
  const baseline = height * 0.78;
  const maxHeight = baseline - height * 0.06;
  const top = shade(frame.accent, 0.45);

  const gradient = ctx.createLinearGradient(0, baseline - maxHeight, 0, baseline);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, frame.accent);
  const reflection = ctx.createLinearGradient(0, baseline, 0, baseline + maxHeight * 0.35);
  reflection.addColorStop(0, withAlpha(frame.accent, 0.28));
  reflection.addColorStop(1, withAlpha(frame.accent, 0));

  for (let i = 0; i < count; i += 1) {
    const x = i * (barWidth + gap);
    const h = Math.max(3, bands[i] * maxHeight);
    ctx.fillStyle = gradient;
    roundedBar(ctx, x, baseline - h, barWidth, h, barWidth / 2);
    ctx.fill();

    ctx.fillStyle = reflection;
    ctx.fillRect(x, baseline + 3, barWidth, Math.min(h, maxHeight * 0.35));

    const peakY = baseline - Math.max(h + 5, state.peaks[i] * maxHeight + 5);
    ctx.fillStyle = withAlpha(top, frame.isPlaying ? 0.9 : 0.35);
    ctx.fillRect(x, peakY, barWidth, 2);
  }
}

/** Smooth waveform that tapers to the centre line at both ends, with a fading trail and a soft fill. */
export function drawWave(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const points = 180;
  const current = new Float32Array(points);
  for (let i = 0; i < points; i += 1) {
    const index = Math.floor((i / (points - 1)) * (frame.time.length - 1));
    current[i] = (frame.time[index] - 128) / 128;
  }
  state.scopeHistory.unshift(current);
  state.scopeHistory.length = Math.min(state.scopeHistory.length, 9);

  const centerY = height * 0.5;
  const amplitude = height * (frame.isPlaying ? 0.42 : 0.12);

  const trace = (samples: Float32Array, lift: number) => {
    const xy: Array<[number, number]> = [];
    for (let i = 0; i < points; i += 1) {
      const x = (i / (points - 1)) * width;
      const envelope = Math.pow(Math.sin((i / (points - 1)) * Math.PI), 0.7);
      xy.push([x, centerY + samples[i] * amplitude * envelope - lift]);
    }
    ctx.beginPath();
    ctx.moveTo(xy[0][0], xy[0][1]);
    for (let i = 1; i < xy.length - 1; i += 1) {
      const midX = (xy[i][0] + xy[i + 1][0]) / 2;
      const midY = (xy[i][1] + xy[i + 1][1]) / 2;
      ctx.quadraticCurveTo(xy[i][0], xy[i][1], midX, midY);
    }
    ctx.lineTo(xy[xy.length - 1][0], xy[xy.length - 1][1]);
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Soft fill between the main line and the centre.
  trace(state.scopeHistory[0], 0);
  ctx.lineTo(width, centerY);
  ctx.lineTo(0, centerY);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
  fill.addColorStop(0, withAlpha(frame.accent, 0.28));
  fill.addColorStop(0.5, withAlpha(frame.accent, 0.04));
  fill.addColorStop(1, withAlpha(frame.accent, 0.28));
  ctx.fillStyle = fill;
  ctx.fill();

  // Trail, oldest first.
  for (let age = Math.min(state.scopeHistory.length - 1, 8); age >= 2; age -= 2) {
    trace(state.scopeHistory[age], 0);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha(frame.accent, 0.5 / (age * 0.7 + 1));
    ctx.stroke();
  }

  trace(state.scopeHistory[0], 0);
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(frame.accent, 0.15);
  ctx.shadowBlur = 16;
  ctx.shadowColor = frame.accent;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Circular spectrum around a pulsing core, with shockwave rings on strong bass hits. */
export function drawRadial(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const half = 56;
  const bands = smoothBands(state, computeBands(frame.freq, half));
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const bass = (bands[0] + bands[1] + bands[2] + bands[3]) / 4;
  const radius = size * 0.2 * (1 + bass * 0.18);
  const reach = size * 0.27;

  // Bass hit → shockwave.
  state.bassAverage = state.bassAverage * 0.96 + bass * 0.04;
  if (frame.isPlaying && bass > 0.45 && bass > state.bassAverage * 1.3 && frame.t - state.lastShockwave > 0.28) {
    state.shockwaves.push({ born: frame.t });
    state.lastShockwave = frame.t;
  }
  state.shockwaves = state.shockwaves.filter((wave) => frame.t - wave.born < 1.4);
  for (const wave of state.shockwaves) {
    const life = (frame.t - wave.born) / 1.4;
    ctx.strokeStyle = withAlpha(frame.accent, (1 - life) * 0.45);
    ctx.lineWidth = 2.5 * (1 - life) + 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + life * size * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Core glow.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
  glow.addColorStop(0, withAlpha(shade(frame.accent, 0.35), 0.55 + bass * 0.35));
  glow.addColorStop(0.6, withAlpha(frame.accent, 0.16));
  glow.addColorStop(1, withAlpha(frame.accent, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(frame.accent, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Bars, mirrored left/right so the picture is symmetric, slowly turning.
  const spin = frame.t * 0.12;
  const slots = half * 2;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2.5, (Math.PI * 2 * radius) / slots * 0.55);
  for (let i = 0; i < slots; i += 1) {
    const band = i < half ? i : slots - 1 - i;
    const value = bands[band];
    const angle = spin + (i / slots) * Math.PI * 2 - Math.PI / 2;
    const inner = radius + 6;
    const outer = inner + 3 + value * reach;
    ctx.strokeStyle = withAlpha(shade(frame.accent, value * 0.4), 0.45 + value * 0.55);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
}

/** Gentle synthetic data so the visualizer breathes while nothing is playing. */
export function idleFrameData(t: number, freq: Uint8Array<ArrayBuffer>, time: Uint8Array<ArrayBuffer>) {
  for (let i = 0; i < freq.length; i += 1) {
    const base = 22 + 18 * Math.sin(t * 1.1 + i * 0.09) + 10 * Math.sin(t * 0.6 + i * 0.21);
    freq[i] = Math.max(0, Math.min(255, base * (1 - i / freq.length)));
  }
  for (let i = 0; i < time.length; i += 1) {
    time[i] = 128 + Math.sin(t * 1.4 + i * 0.05) * 6;
  }
}
