import { describe, expect, it } from "vitest";
import { hexToHsl, paletteAt, paletteFromColor, paletteFromPixels } from "../domain/palette";
import { VizState, analyseFrame } from "../screens/nowPlaying/vizEffects";

/** RGBA data for an image made of the given colours, `count` pixels each. */
function pixels(...parts: Array<[[number, number, number], number]>): Uint8ClampedArray {
  const data: number[] = [];
  for (const [[r, g, b], count] of parts) {
    for (let i = 0; i < count; i += 1) data.push(r, g, b, 255);
  }
  return new Uint8ClampedArray(data);
}

const hue = (color: string) => (hexToHsl(color) ?? [0, 0, 0])[0];

describe("paletteFromPixels", () => {
  it("picks the main vivid hues, most present first", () => {
    const palette = paletteFromPixels(pixels([[220, 40, 40], 600], [[40, 90, 220], 300], [[40, 200, 80], 100]));
    expect(palette).toHaveLength(3);
    expect(hue(palette![0])).toBeLessThan(0.05); // red
    expect(hue(palette![1])).toBeGreaterThan(0.55); // blue
    expect(hue(palette![1])).toBeLessThan(0.7);
    expect(hue(palette![2])).toBeGreaterThan(0.25); // green
    expect(hue(palette![2])).toBeLessThan(0.45);
  });

  it("ignores greys, black and white, and gives null for a dull cover", () => {
    expect(paletteFromPixels(pixels([[128, 128, 128], 500], [[0, 0, 0], 300], [[255, 255, 255], 200]))).toBeNull();
  });

  it("fills in three colours from a single hue", () => {
    const palette = paletteFromPixels(pixels([[30, 160, 200], 400], [[20, 20, 20], 400]));
    expect(palette).toHaveLength(3);
    expect(new Set(palette).size).toBe(3);
  });
});

describe("palette helpers", () => {
  it("builds three colours around an accent", () => {
    const palette = paletteFromColor("#ee703e");
    expect(palette).toHaveLength(3);
    palette.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/));
  });

  it("interpolates along a palette", () => {
    expect(paletteAt(["#000000", "#ffffff"], 0)).toBe("rgb(0, 0, 0)");
    expect(paletteAt(["#000000", "#ffffff"], 1)).toBe("rgb(255, 255, 255)");
    expect(paletteAt(["#000000", "#ffffff"], 0.5)).toBe("rgb(128, 128, 128)");
  });
});

describe("analyseFrame", () => {
  const frameAt = (state: VizState, t: number, loudBass: boolean) => {
    const freq = new Uint8Array(1024);
    for (let i = 0; i < freq.length; i += 1) freq[i] = i < 12 && loudBass ? 250 : 20;
    return analyseFrame(state, { freq, time: new Uint8Array(2048).fill(128), isPlaying: true, palette: ["#ff0000"], isDark: true, t });
  };

  it("flags a beat when the bass jumps above its average, then waits before the next one", () => {
    const state = new VizState();
    for (let i = 0; i < 60; i += 1) frameAt(state, i / 60, false);
    const hit = frameAt(state, 1.01, true);
    expect(hit.beat).toBe(true);
    expect(hit.bass).toBeGreaterThan(hit.treble);
    expect(frameAt(state, 1.05, true).beat).toBe(false);
  });

  it("never beats while paused", () => {
    const state = new VizState();
    const freq = new Uint8Array(1024).fill(250);
    const frame = analyseFrame(state, { freq, time: new Uint8Array(2048), isPlaying: false, palette: ["#ff0000"], isDark: true, t: 1 });
    expect(frame.beat).toBe(false);
  });
});
