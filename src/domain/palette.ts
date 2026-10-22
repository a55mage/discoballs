/**
 * Colours of a cover, for the visualizers. Pure functions over RGBA pixel data (from a small canvas), so the
 * picking can be tested without images.
 */

type Rgb = [number, number, number];

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) {
    return [0, 0, lightness];
  }
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  hue /= 6;
  return [hue, saturation, lightness];
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const wrap = ((hue % 1) + 1) % 1;
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset: number) => {
    let t = wrap + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    const value = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(1 / 3)}${channel(0)}${channel(-1 / 3)}`;
}

/** `#rrggbb` → hue, saturation, lightness (0…1). Other formats give null. */
export function hexToHsl(color: string): [number, number, number] | null {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return null;
  }
  return rgbToHsl([parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)]);
}

/** Three related colours around one base colour (the accent), for when there is no usable cover. */
export function paletteFromColor(color: string): string[] {
  const [hue, saturation] = hexToHsl(color) ?? [0.05, 0.8, 0.6];
  const s = Math.max(0.55, saturation);
  return [hslToHex(hue, s, 0.6), hslToHex(hue + 0.08, s, 0.68), hslToHex(hue - 0.1, s * 0.9, 0.55)];
}

const HUE_BINS = 12;

/**
 * The three most present vivid hues of an image, brightened so they read on a dark or light window.
 * Greys, near-black and near-white pixels are ignored; a dull image gives null.
 */
export function paletteFromPixels(data: ArrayLike<number>): string[] | null {
  const weight = new Float64Array(HUE_BINS);
  const sums = Array.from({ length: HUE_BINS }, () => [0, 0, 0]);
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
    const [hue, saturation, lightness] = rgbToHsl(rgb);
    if (saturation < 0.22 || lightness < 0.14 || lightness > 0.92) continue;
    const bin = Math.floor(hue * HUE_BINS) % HUE_BINS;
    const w = saturation * (1 - Math.abs(lightness - 0.5));
    weight[bin] += w;
    sums[bin][0] += hue * w;
    sums[bin][1] += saturation * w;
    sums[bin][2] += lightness * w;
  }

  const total = weight.reduce((sum, value) => sum + value, 0);
  const pixels = data.length / 4;
  if (!pixels || total / pixels < 0.02) {
    return null;
  }

  const order = Array.from({ length: HUE_BINS }, (_, bin) => bin).sort((a, b) => weight[b] - weight[a]);
  const picked: number[] = [];
  for (const bin of order) {
    if (weight[bin] < total * 0.04) break;
    // Neighbouring bins are the same colour to the eye: skip them.
    if (picked.some((other) => Math.min(Math.abs(other - bin), HUE_BINS - Math.abs(other - bin)) < 2)) continue;
    picked.push(bin);
    if (picked.length === 3) break;
  }
  if (!picked.length) {
    return null;
  }

  const colors = picked.map((bin) => {
    const hue = sums[bin][0] / weight[bin];
    const saturation = Math.min(0.95, Math.max(0.55, (sums[bin][1] / weight[bin]) * 1.15));
    const lightness = Math.min(0.68, Math.max(0.52, sums[bin][2] / weight[bin]));
    return hslToHex(hue, saturation, lightness);
  });
  // One strong hue: fill in with its neighbours so effects still have three colours.
  while (colors.length < 3) {
    const [hue, saturation] = hexToHsl(colors[0]) ?? [0, 0.7, 0.6];
    colors.push(hslToHex(hue + (colors.length === 1 ? 0.07 : -0.07), saturation, colors.length === 1 ? 0.7 : 0.5));
  }
  return colors;
}

/** Linear mix of two `#rrggbb` colours, as `rgb()`. */
export function mixColors(from: string, to: string, amount: number): string {
  const k = Math.max(0, Math.min(1, amount));
  const channel = (offset: number) =>
    Math.round(parseInt(from.slice(offset, offset + 2), 16) * (1 - k) + parseInt(to.slice(offset, offset + 2), 16) * k);
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}

/** Colour at position 0…1 along a palette. */
export function paletteAt(palette: string[], position: number): string {
  if (palette.length === 1) {
    return palette[0];
  }
  const scaled = Math.max(0, Math.min(1, position)) * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  return mixColors(palette[index], palette[index + 1], scaled - index);
}
