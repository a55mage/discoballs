export type VisualizerPresetId = "xp-bars" | "alchemy" | "scope" | "turntable";

export const VISUALIZER_PRESETS: Array<{ id: VisualizerPresetId; label: string }> = [
  { id: "scope", label: "Scope Line" },
  { id: "alchemy", label: "Alchemy" },
  { id: "xp-bars", label: "XP Bars" },
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
