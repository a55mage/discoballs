export type VisualizerPresetId = "xp-bars" | "alchemy" | "scope" | "turntable" | "ridges" | "bloom" | "tunnel";

export const VISUALIZER_PRESETS: Array<{ id: VisualizerPresetId; label: string }> = [
  { id: "scope", label: "Wave" },
  { id: "alchemy", label: "Radial" },
  { id: "xp-bars", label: "Spectrum" },
  { id: "ridges", label: "Ridges" },
  { id: "bloom", label: "Bloom" },
  { id: "tunnel", label: "Tunnel" },
  { id: "turntable", label: "Turntable" },
];

export type NowPlayingPart = "cover" | "lyrics" | "viz";

export const NOW_PLAYING_PARTS: NowPlayingPart[] = ["cover", "lyrics", "viz"];

/** Keeps known parts only, in display order, and never returns an empty selection. */
export function normalizeNowPlayingParts(value: unknown): NowPlayingPart[] {
  const list = Array.isArray(value) ? value : [];
  const parts = NOW_PLAYING_PARTS.filter((part) => list.includes(part));
  return parts.length ? parts : ["cover", "lyrics"];
}
