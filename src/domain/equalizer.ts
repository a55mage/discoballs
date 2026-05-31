import { EQUALIZER_PRESETS, type EqualizerPreset } from "../utils/audioGraph";

export const BUILTIN_EQ_PRESET_IDS = new Set(EQUALIZER_PRESETS.map((preset) => preset.id));

function normalizeEqualizerPresetName(value: string): string {
  return value.trim().toLowerCase();
}

export function buildUniqueEqualizerPresetName(presets: EqualizerPreset[], baseName: string, excludeId?: string): string {
  const fallbackBase = baseName.trim() || "New Preset";
  const usedNames = new Set(
    presets
      .filter((preset) => preset.id !== excludeId)
      .map((preset) => normalizeEqualizerPresetName(preset.name))
  );
  if (!usedNames.has(normalizeEqualizerPresetName(fallbackBase))) {
    return fallbackBase;
  }
  let index = 2;
  while (usedNames.has(normalizeEqualizerPresetName(`${fallbackBase} (${index})`))) {
    index += 1;
  }
  return `${fallbackBase} (${index})`;
}
