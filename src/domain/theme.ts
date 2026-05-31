export type AccentTheme = { accent: string; soft: string; strong: string };

export const ACCENT_THEMES: AccentTheme[] = [
  { accent: "#ee703e", soft: "#e9dfce", strong: "#df6535" },
  { accent: "#2d9c5f", soft: "#d8ebdd", strong: "#23804c" },
  { accent: "#2f7dd1", soft: "#dbe7f4", strong: "#2565aa" },
  { accent: "#b85cc8", soft: "#ebddf1", strong: "#9b49aa" },
  { accent: "#d14f6a", soft: "#f3d9df", strong: "#ae3d56" },
  { accent: "#cc8a22", soft: "#efe3ce", strong: "#aa721b" },
  { accent: "#3a8b8f", soft: "#d5e7e8", strong: "#2e7073" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(base: string, target: string, ratio: number): string {
  const baseRgb = hexToRgb(base);
  const targetRgb = hexToRgb(target);
  if (!baseRgb || !targetRgb) {
    return base;
  }
  const safeRatio = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    baseRgb.r + (targetRgb.r - baseRgb.r) * safeRatio,
    baseRgb.g + (targetRgb.g - baseRgb.g) * safeRatio,
    baseRgb.b + (targetRgb.b - baseRgb.b) * safeRatio
  );
}

export function buildSoftAccent(accent: string): string {
  return mixHex(accent, "#ffffff", 0.78);
}

export function buildStrongAccent(accent: string): string {
  return mixHex(accent, "#000000", 0.12);
}
