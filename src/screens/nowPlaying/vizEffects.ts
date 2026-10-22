/**
 * Drawing code of the visualizers. Each frame the analyser data is read once (`analyseFrame`): bands smoothed
 * between frames (fast attack, slow release), bass / mid / treble levels and a beat flag. The effects paint on a
 * transparent canvas, so they sit directly on the window, with colours from the cover (or the accent).
 */
import { paletteAt } from "../../domain/palette";

export type VizFrame = {
  /** Byte frequency data of the analyser (real or synthetic). */
  freq: Uint8Array<ArrayBuffer>;
  /** Byte time-domain data of the analyser. */
  time: Uint8Array<ArrayBuffer>;
  isPlaying: boolean;
  /** Three colours, from the cover when there is one. */
  palette: string[];
  isDark: boolean;
  /** Seconds, for motion. */
  t: number;
  /** Seconds since the previous frame (capped), for frame-rate independent motion. */
  dt: number;
  /** 0…1 energy of the low, middle and high bands, and of the whole spectrum. */
  bass: number;
  mid: number;
  treble: number;
  level: number;
  /** True on the frame a bass hit is detected. */
  beat: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string };

/** State that lives between frames. */
export class VizState {
  bands: Float32Array = new Float32Array(0);
  peaks: Float32Array = new Float32Array(0);
  scopeHistory: Float32Array[] = [];
  ridgeHistory: Float32Array[] = [];
  ridgeClock = 0;
  shockwaves: Array<{ born: number; color: string }> = [];
  particles: Particle[] = [];
  rings: Array<{ z: number; hue: number; spin: number }> = [];
  ringClock = 0;
  bassAverage = 0;
  lastBeat = -1;
  lastT = 0;
  beatGlow = 0;
}

const BAND_COUNT = 96;

/** Analyses the frame once for every effect: smoothed bands, energies and beats. */
export function analyseFrame(
  state: VizState,
  input: Pick<VizFrame, "freq" | "time" | "isPlaying" | "palette" | "isDark" | "t">
): VizFrame {
  const dt = state.lastT ? Math.min(0.1, Math.max(0, input.t - state.lastT)) : 1 / 60;
  state.lastT = input.t;
  const bands = smoothBands(state, computeBands(input.freq, BAND_COUNT));
  const average = (from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i += 1) sum += bands[i];
    return sum / (to - from);
  };
  const bass = average(0, 12);
  const mid = average(12, 52);
  const treble = average(52, BAND_COUNT);
  const level = average(0, BAND_COUNT);

  state.bassAverage = state.bassAverage * 0.95 + bass * 0.05;
  const beat = input.isPlaying && bass > 0.32 && bass > state.bassAverage * 1.28 && input.t - state.lastBeat > 0.24;
  if (beat) {
    state.lastBeat = input.t;
    state.beatGlow = 1;
  } else {
    state.beatGlow = Math.max(0, state.beatGlow - dt * 3.2);
  }
  return { ...input, dt, bass, mid, treble, level, beat };
}

function parseColor(color: string): [number, number, number] | null {
  if (color.startsWith("#") && color.length === 7) {
    return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  }
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** CSS colour with alpha, from `#rrggbb` or `rgb()` (other formats are returned unchanged). */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  const safe = Math.max(0, Math.min(1, alpha));
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safe})` : color;
}

/** Moves a colour towards white (positive) or black (negative). */
export function shade(color: string, amount: number): string {
  const rgb = parseColor(color);
  if (!rgb) {
    return color;
  }
  const target = amount >= 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  const [r, g, b] = rgb.map((channel) => Math.round(channel * (1 - k) + target * k));
  return `rgb(${r}, ${g}, ${b})`;
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

/** `count` values resampled from the analysed bands (averaging neighbours), for effects with fewer slots. */
function resample(bands: Float32Array, count: number, from = 0, to = bands.length): Float32Array {
  const out = new Float32Array(count);
  const span = (to - from) / count;
  for (let i = 0; i < count; i += 1) {
    const start = from + Math.floor(i * span);
    const end = Math.max(start + 1, from + Math.floor((i + 1) * span));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += bands[j];
    out[i] = sum / (end - start);
  }
  return out;
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

/** Glowing colours add up on a dark window; on a light one they would wash out, so they are painted normally. */
function glowMode(frame: VizFrame): GlobalCompositeOperation {
  return frame.isDark ? "lighter" : "source-over";
}

function horizontalPalette(ctx: CanvasRenderingContext2D, width: number, palette: string[]): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  palette.forEach((color, index) => gradient.addColorStop(index / Math.max(1, palette.length - 1), color));
  return gradient;
}

/** Spectrum: rounded bars across the cover colours, falling peak caps, a reflection and a glow on beats. */
export function drawSpectrum(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const count = Math.max(24, Math.min(72, Math.floor(width / 15)));
  const bands = resample(state.bands, count, 0, Math.floor(state.bands.length * 0.92));
  const peaks = resample(state.peaks, count, 0, Math.floor(state.peaks.length * 0.92));
  const side = width * 0.04;
  const usable = width - side * 2;
  const gap = Math.max(2, (usable / count) * 0.24);
  const barWidth = (usable - gap * (count - 1)) / count;
  const baseline = height * 0.76;
  const maxHeight = baseline - height * 0.08;
  const colors = horizontalPalette(ctx, width, frame.palette);

  // A soft floor light that swells on beats.
  const floor = ctx.createRadialGradient(width / 2, baseline, 0, width / 2, baseline, Math.min(width * 0.5, height * 0.6));
  floor.addColorStop(0, withAlpha(frame.palette[0], 0.12 + state.beatGlow * 0.18));
  floor.addColorStop(1, withAlpha(frame.palette[0], 0));
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.shadowColor = withAlpha(frame.palette[1], 0.6);
  ctx.shadowBlur = 10 + state.beatGlow * 18;
  ctx.fillStyle = colors;
  for (let i = 0; i < count; i += 1) {
    const x = side + i * (barWidth + gap);
    const h = Math.max(3, bands[i] * maxHeight);
    roundedBar(ctx, x, baseline - h, barWidth, h, barWidth / 2);
    ctx.fill();
  }
  ctx.restore();

  // Reflection, fading downwards.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = colors;
  for (let i = 0; i < count; i += 1) {
    const x = side + i * (barWidth + gap);
    const h = Math.min(bands[i] * maxHeight, maxHeight * 0.3);
    ctx.fillRect(x, baseline + 4, barWidth, h);
  }
  ctx.globalCompositeOperation = "destination-out";
  const fade = ctx.createLinearGradient(0, baseline, 0, baseline + maxHeight * 0.3);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = fade;
  ctx.fillRect(0, baseline + 2, width, maxHeight * 0.3 + 4);
  ctx.restore();

  // Peak caps.
  for (let i = 0; i < count; i += 1) {
    const x = side + i * (barWidth + gap);
    const peakY = baseline - Math.max(bands[i] * maxHeight + 5, peaks[i] * maxHeight + 5);
    ctx.fillStyle = withAlpha(shade(paletteAt(frame.palette, i / count), 0.5), frame.isPlaying ? 0.95 : 0.35);
    ctx.fillRect(x, peakY, barWidth, 2.5);
  }
}

/** Wave: layered oscilloscope lines across the palette, tapering at the ends, with a fading trail. */
export function drawWave(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const points = 200;
  const current = new Float32Array(points);
  for (let i = 0; i < points; i += 1) {
    const index = Math.floor((i / (points - 1)) * (frame.time.length - 1));
    current[i] = (frame.time[index] - 128) / 128;
  }
  state.scopeHistory.unshift(current);
  state.scopeHistory.length = Math.min(state.scopeHistory.length, 12);

  const centerY = height * 0.5;
  const amplitude = height * (frame.isPlaying ? 0.4 : 0.12) * (0.85 + frame.bass * 0.4);

  const trace = (samples: Float32Array, scale: number, offset: number) => {
    ctx.beginPath();
    let previousX = 0;
    let previousY = centerY;
    for (let i = 0; i < points; i += 1) {
      const x = (i / (points - 1)) * width;
      const envelope = Math.pow(Math.sin((i / (points - 1)) * Math.PI), 0.8);
      const y = centerY + samples[i] * amplitude * scale * envelope + offset * envelope;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.quadraticCurveTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2);
      }
      previousX = x;
      previousY = y;
    }
    ctx.lineTo(previousX, previousY);
  };

  const colors = horizontalPalette(ctx, width, frame.palette);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Soft fill between the main line and the centre.
  trace(state.scopeHistory[0], 1, 0);
  ctx.lineTo(width, centerY);
  ctx.lineTo(0, centerY);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
  fill.addColorStop(0, withAlpha(frame.palette[0], 0.24));
  fill.addColorStop(0.5, withAlpha(frame.palette[1], 0.03));
  fill.addColorStop(1, withAlpha(frame.palette[2], 0.24));
  ctx.fillStyle = fill;
  ctx.fill();

  // Trail, oldest first.
  ctx.save();
  ctx.globalCompositeOperation = glowMode(frame);
  for (let age = Math.min(state.scopeHistory.length - 1, 11); age >= 2; age -= 3) {
    trace(state.scopeHistory[age], 1, 0);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha(paletteAt(frame.palette, age / 11), 0.45 / (age * 0.5 + 1));
    ctx.stroke();
  }
  // Two echoes of the live line, slightly shifted, give it depth.
  trace(state.scopeHistory[0], 0.6, -6 - frame.mid * 18);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = withAlpha(frame.palette[1], 0.5);
  ctx.stroke();
  trace(state.scopeHistory[0], -0.45, 6 + frame.treble * 18);
  ctx.strokeStyle = withAlpha(frame.palette[2], 0.45);
  ctx.stroke();
  ctx.restore();

  trace(state.scopeHistory[0], 1, 0);
  ctx.lineWidth = 3 + state.beatGlow * 1.5;
  ctx.strokeStyle = colors;
  ctx.shadowBlur = 14 + state.beatGlow * 16;
  ctx.shadowColor = frame.palette[0];
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Radial: a mirrored circular spectrum around a pulsing core; beats send out shockwaves and sparks. */
export function drawRadial(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const half = 60;
  const bands = resample(state.bands, half, 0, Math.floor(state.bands.length * 0.9));
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const radius = size * 0.19 * (1 + frame.bass * 0.2);
  const reach = size * 0.26;

  if (frame.beat) {
    state.shockwaves.push({ born: frame.t, color: frame.palette[state.shockwaves.length % frame.palette.length] });
    spawnSparks(state, cx, cy, radius, 18, frame.palette, size * 0.5);
  }
  state.shockwaves = state.shockwaves.filter((wave) => frame.t - wave.born < 1.4);

  ctx.save();
  ctx.globalCompositeOperation = glowMode(frame);
  for (const wave of state.shockwaves) {
    const life = (frame.t - wave.born) / 1.4;
    ctx.strokeStyle = withAlpha(wave.color, (1 - life) * 0.5);
    ctx.lineWidth = 3 * (1 - life) + 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + life * size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawParticles(ctx, state, frame, 0.6);

  // Core glow.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.2);
  glow.addColorStop(0, withAlpha(shade(frame.palette[0], 0.35), 0.5 + frame.bass * 0.4));
  glow.addColorStop(0.6, withAlpha(frame.palette[1], 0.15));
  glow.addColorStop(1, withAlpha(frame.palette[1], 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Bars, mirrored left/right so the picture is symmetric, slowly turning; colour follows the frequency.
  const spin = frame.t * 0.1;
  const slots = half * 2;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2.5, ((Math.PI * 2 * radius) / slots) * 0.55);
  for (let i = 0; i < slots; i += 1) {
    const band = i < half ? i : slots - 1 - i;
    const value = bands[band];
    const angle = spin + (i / slots) * Math.PI * 2 - Math.PI / 2;
    const inner = radius + 6;
    const outer = inner + 3 + value * reach;
    ctx.strokeStyle = withAlpha(shade(paletteAt(frame.palette, band / half), value * 0.35), 0.4 + value * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha(frame.palette[0], 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Ridges: the spectrum over time as a range of mountains seen in perspective (the "Unknown Pleasures" look).
 * New lines appear at the front and sink back; each one hides the lines behind it.
 */
export function drawRidges(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const lines = 30;
  const points = 72;
  state.ridgeClock += frame.dt;
  if (state.ridgeClock > 0.05 || !state.ridgeHistory.length) {
    state.ridgeClock = 0;
    const snapshot = resample(state.bands, points, 0, Math.floor(state.bands.length * 0.85));
    state.ridgeHistory.unshift(snapshot);
    state.ridgeHistory.length = Math.min(state.ridgeHistory.length, lines);
  }

  const horizon = height * 0.16;
  const front = height * 0.92;
  // Back to front, so nearer lines paint over farther ones.
  for (let index = state.ridgeHistory.length - 1; index >= 0; index -= 1) {
    const samples = state.ridgeHistory[index];
    const depth = index / (lines - 1);
    const perspective = 1 - depth;
    const y = horizon + (front - horizon) * Math.pow(perspective, 1.6);
    const span = width * (0.42 + perspective * 0.5);
    const left = (width - span) / 2;
    const lift = height * (0.08 + perspective * 0.28);

    ctx.beginPath();
    ctx.moveTo(left, y);
    for (let i = 0; i < points; i += 1) {
      const x = left + (i / (points - 1)) * span;
      // Peaks gather in the middle, the edges stay calm.
      const envelope = Math.pow(Math.sin((i / (points - 1)) * Math.PI), 1.4);
      ctx.lineTo(x, y - samples[i] * lift * envelope);
    }
    ctx.lineTo(left + span, y);

    // Erase what lies behind the line, so the ridge in front hides it.
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fill();
    ctx.restore();

    const color = paletteAt(frame.palette, depth);
    ctx.lineWidth = 1 + perspective * 1.6;
    ctx.strokeStyle = withAlpha(color, 0.25 + perspective * 0.75);
    if (index === 0) {
      ctx.shadowBlur = 12 + state.beatGlow * 14;
      ctx.shadowColor = color;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function spawnSparks(state: VizState, cx: number, cy: number, radius: number, count: number, palette: string[], speed: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random() * 0.65);
    state.particles.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0,
      maxLife: 0.8 + Math.random() * 1.2,
      size: 1 + Math.random() * 2.2,
      color: palette[Math.floor(Math.random() * palette.length)],
    });
  }
  if (state.particles.length > 700) {
    state.particles.splice(0, state.particles.length - 700);
  }
}

/** Moves and paints particles as short streaks; slows them with a little drag. */
function drawParticles(ctx: CanvasRenderingContext2D, state: VizState, frame: VizFrame, opacity: number) {
  const drag = Math.pow(0.35, frame.dt);
  ctx.lineCap = "round";
  state.particles = state.particles.filter((particle) => {
    particle.life += frame.dt;
    if (particle.life > particle.maxLife) {
      return false;
    }
    particle.vx *= drag;
    particle.vy *= drag;
    particle.x += particle.vx * frame.dt;
    particle.y += particle.vy * frame.dt;
    const fade = 1 - particle.life / particle.maxLife;
    ctx.strokeStyle = withAlpha(particle.color, fade * opacity);
    ctx.lineWidth = particle.size * (0.6 + fade * 0.6);
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(particle.x - particle.vx * 0.05, particle.y - particle.vy * 0.05);
    ctx.stroke();
    return true;
  });
}

/** Bloom: a glowing orb that breathes with the bass and keeps throwing out sparks; beats throw a burst. */
export function drawBloom(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const radius = size * (0.09 + frame.bass * 0.06);

  const steady = Math.round((frame.isPlaying ? 2 + frame.level * 10 : 0.6) * frame.dt * 60);
  spawnSparks(state, cx, cy, radius * 0.8, steady, frame.palette, size * (0.25 + frame.mid * 0.6));
  if (frame.beat) {
    spawnSparks(state, cx, cy, radius, 40, frame.palette, size * 1.1);
  }

  ctx.save();
  ctx.globalCompositeOperation = glowMode(frame);
  drawParticles(ctx, state, frame, 0.85);

  // Halo layers, one per palette colour, each pulsing with its own band.
  const energies = [frame.bass, frame.mid, frame.treble];
  frame.palette.forEach((color, index) => {
    const reach = radius * (2.4 + index * 0.9 + energies[index] * 2.2);
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, reach);
    halo.addColorStop(0, withAlpha(color, 0.3 + energies[index] * 0.3));
    halo.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, reach, 0, Math.PI * 2);
    ctx.fill();
  });

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  core.addColorStop(0, withAlpha(shade(frame.palette[0], 0.8), 0.95));
  core.addColorStop(0.7, withAlpha(frame.palette[0], 0.7 + state.beatGlow * 0.3));
  core.addColorStop(1, withAlpha(frame.palette[0], 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (1 + state.beatGlow * 0.25), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Tunnel: polygons fly towards the viewer, bent by the spectrum and turning with the mids; beats add a ring. */
export function drawTunnel(ctx: CanvasRenderingContext2D, width: number, height: number, frame: VizFrame, state: VizState) {
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(width, height) * 0.55;
  const sides = 6;
  const speed = (frame.isPlaying ? 0.3 + frame.level * 0.6 : 0.1) * frame.dt;

  // Start with a full tunnel rather than an empty screen.
  if (!state.rings.length) {
    for (let z = 1; z > 0; z -= 0.09) {
      state.rings.push({ z, hue: state.rings.length, spin: z * 2 });
    }
  }
  state.ringClock += frame.dt;
  if (state.ringClock > 0.28 || frame.beat) {
    state.ringClock = 0;
    state.rings.push({ z: 0, hue: state.rings.length, spin: frame.t * 0.4 });
  }
  for (const ring of state.rings) {
    ring.z += speed * (0.4 + ring.z * 2.2);
  }
  state.rings = state.rings.filter((ring) => ring.z < 1.15);

  const outline = resample(state.bands, sides * 4, 0, Math.floor(state.bands.length * 0.8));
  ctx.save();
  ctx.globalCompositeOperation = glowMode(frame);
  ctx.lineJoin = "round";
  for (const ring of state.rings) {
    const radius = Math.pow(ring.z, 2.2) * reach;
    if (radius < 2) continue;
    const turn = ring.spin + frame.t * (0.15 + frame.mid * 0.6) * (ring.hue % 2 ? 1 : -1);
    const alpha = Math.min(1, ring.z * 3) * Math.max(0, 1.15 - ring.z);
    const vertices = outline.length;
    ctx.beginPath();
    for (let i = 0; i <= vertices; i += 1) {
      const angle = turn + (i / vertices) * Math.PI * 2;
      // Polygon radius at this angle, then pushed out by its band.
      const corner = Math.cos(Math.PI / sides) / Math.cos(((angle - turn) % ((Math.PI * 2) / sides)) - Math.PI / sides);
      const r = radius * corner * (1 + outline[i % vertices] * 0.35);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.2 + ring.z * 5;
    ctx.strokeStyle = withAlpha(frame.palette[ring.hue % frame.palette.length], Math.min(1, alpha * (0.9 + frame.level)));
    ctx.stroke();
  }
  ctx.restore();

  // The vanishing point glows with the bass.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.18);
  glow.addColorStop(0, withAlpha(frame.palette[0], 0.25 + frame.bass * 0.45));
  glow.addColorStop(1, withAlpha(frame.palette[0], 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - reach * 0.18, cy - reach * 0.18, reach * 0.36, reach * 0.36);
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
