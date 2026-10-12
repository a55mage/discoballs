export const EQ_CURVE_WIDTH = 100;
export const EQ_CURVE_HEIGHT = 100;
const MAX_GAIN_DB = 12;

/** SVG path (viewBox 0 0 100 100) of a smooth curve through the band gains (Catmull-Rom → Bézier). */
export function buildEqCurvePath(gains: number[]): string {
  if (!gains.length) {
    return "";
  }
  const points = gains.map((value, index) => ({
    x: (index / Math.max(1, gains.length - 1)) * EQ_CURVE_WIDTH,
    y: EQ_CURVE_HEIGHT / 2 - (value / MAX_GAIN_DB) * (EQ_CURVE_HEIGHT / 2 - 8),
  }));
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const prev = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const cp1x = current.x + (next.x - prev.x) / 6;
    const cp1y = current.y + (next.y - prev.y) / 6;
    const cp2x = next.x - (after.x - current.x) / 6;
    const cp2y = next.y - (after.y - current.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function averageGain(gains: number[]): number {
  return gains.length ? gains.reduce((sum, value) => sum + value, 0) / gains.length : 0;
}

/** "31 Hz", "1 kHz", "16 kHz" */
export function formatBandFrequency(hz: number): string {
  return hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`;
}

export function formatGain(db: number): string {
  const rounded = Math.round(db * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
}
