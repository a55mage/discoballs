import { create } from "zustand";
import { BUILTIN_EQ_PRESET_IDS, buildUniqueEqualizerPresetName } from "../domain/equalizer";
import { inferGenrePresetId, NO_GENRE_EQ_KEY } from "../utils/appHelpers";
import {
  DEFAULT_EQUALIZER_PRESET,
  EQUALIZER_FREQUENCIES,
  EQUALIZER_PRESETS,
  type EqualizerPreset,
} from "../utils/audioGraph";
import { readJson, readString, writeJson, writeString } from "./storage";
import { useSettingsStore } from "./settingsStore";

const KEYS = {
  presets: "musicmanager-eq-presets",
  presetId: "musicmanager-eq-preset-id",
  startupPresetId: "musicmanager-startup-eq-preset-id",
  presetName: "musicmanager-eq-preset-name",
  bandGains: "musicmanager-eq-band-gains",
  preampDb: "musicmanager-eq-preamp-db",
  wetMix: "musicmanager-eq-wet-mix",
  genreMap: "musicmanager-genre-eq-map",
} as const;

const clampGain = (value: number) => Math.max(-12, Math.min(12, value));
const clampWet = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function cloneBuiltins(): EqualizerPreset[] {
  return EQUALIZER_PRESETS.map((preset) => ({ ...preset, bandGains: [...preset.bandGains] }));
}

function normalizeBandGains(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== EQUALIZER_FREQUENCIES.length) {
    return null;
  }
  return value.map((item) => {
    const numeric = Number(item);
    return Number.isFinite(numeric) ? clampGain(numeric) : 0;
  });
}

export function normalizeEqualizerPresets(value: unknown): EqualizerPreset[] {
  const builtins = cloneBuiltins();
  if (!Array.isArray(value) || !value.length) {
    return builtins;
  }
  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const bandGains = normalizeBandGains(candidate.bandGains);
      if (!id || !name || !bandGains) {
        return null;
      }
      const preampDbRaw = Number(candidate.preampDb);
      const wetMixRaw = Number(candidate.wetMixPercent);
      return {
        id,
        name,
        bandGains,
        preampDb: Number.isFinite(preampDbRaw) ? clampGain(preampDbRaw) : 0,
        wetMixPercent: Number.isFinite(wetMixRaw) ? clampWet(wetMixRaw) : 100,
      } satisfies EqualizerPreset;
    })
    .filter((item): item is EqualizerPreset => Boolean(item));
  if (!normalized.length) {
    return builtins;
  }
  return [...builtins, ...normalized.filter((preset) => !BUILTIN_EQ_PRESET_IDS.has(preset.id))];
}

type CoreState = {
  equalizerPresets: EqualizerPreset[];
  equalizerPresetId: string;
  startupEqualizerPresetId: string;
  equalizerPresetName: string;
  equalizerBandGains: number[];
  equalizerPreampDb: number;
  equalizerWetMixPercent: number;
  isEqualizerPresetRenaming: boolean;
  genreEqPresetMap: Record<string, string>;
};

export type EqualizerState = CoreState & {
  setEqualizerPresetIdRaw: (presetId: string) => void;
  setStartupEqualizerPresetId: (presetId: string) => void;
  setEqualizerPresetName: (name: string) => void;
  setEqualizerPreampDb: (value: number) => void;
  setEqualizerWetMixPercent: (value: number) => void;
  setEqualizerBandGain: (index: number, value: number) => void;
  changePreset: (presetId: string) => void;
  applyPreset: (presetId: string, presetName: string, bandGains: number[], preampDb?: number, wetMixPercent?: number) => void;
  setGenreEqPreset: (genreKey: string, presetId: string) => void;
  syncGenreEqMap: (libraryGenres: Array<{ key: string; label: string }>) => void;
  createPreset: () => void;
  savePreset: () => void;
  renameButtonClick: () => void;
  deletePreset: () => void;
  reset: () => void;
};

function normalizeState(state: CoreState): CoreState {
  let next = state;
  if (next.equalizerPresetId && !next.equalizerPresets.some((preset) => preset.id === next.equalizerPresetId)) {
    next = { ...next, equalizerPresetId: "", isEqualizerPresetRenaming: false };
  }
  if (next.startupEqualizerPresetId && !next.equalizerPresets.some((preset) => preset.id === next.startupEqualizerPresetId)) {
    next = { ...next, startupEqualizerPresetId: "" };
  }
  return next;
}

function loadInitialState(): CoreState {
  const equalizerPresets = normalizeEqualizerPresets(readJson(KEYS.presets));
  const genreMapRaw = readJson(KEYS.genreMap);
  const genreEqPresetMap: Record<string, string> =
    genreMapRaw && typeof genreMapRaw === "object"
      ? Object.fromEntries(
          Object.entries(genreMapRaw as Record<string, unknown>)
            .filter(([, presetId]) => typeof presetId === "string")
            .map(([genreKey, presetId]) => [genreKey, presetId as string])
        )
      : {};

  const base: CoreState = {
    equalizerPresets,
    equalizerPresetId: DEFAULT_EQUALIZER_PRESET.id,
    startupEqualizerPresetId: "",
    equalizerPresetName: DEFAULT_EQUALIZER_PRESET.name,
    equalizerBandGains: [...DEFAULT_EQUALIZER_PRESET.bandGains],
    equalizerPreampDb: 0,
    equalizerWetMixPercent: 100,
    isEqualizerPresetRenaming: false,
    genreEqPresetMap,
  };

  const startupId = readString(KEYS.startupPresetId) || "";
  const startupPreset = equalizerPresets.find((preset) => preset.id === startupId);
  if (startupPreset) {
    return {
      ...base,
      startupEqualizerPresetId: startupPreset.id,
      equalizerPresetId: startupPreset.id,
      equalizerPresetName: startupPreset.name,
      equalizerBandGains: [...startupPreset.bandGains],
      equalizerPreampDb: startupPreset.preampDb,
      equalizerWetMixPercent: startupPreset.wetMixPercent,
    };
  }

  const savedId = readString(KEYS.presetId);
  if (savedId && equalizerPresets.some((preset) => preset.id === savedId)) {
    base.equalizerPresetId = savedId;
  }
  const savedName = readString(KEYS.presetName);
  if (savedName) {
    base.equalizerPresetName = savedName;
  }
  const savedGains = normalizeBandGains(readJson(KEYS.bandGains));
  if (savedGains) {
    base.equalizerBandGains = savedGains;
  }
  const savedPreamp = readString(KEYS.preampDb);
  if (savedPreamp !== null && Number.isFinite(Number(savedPreamp))) {
    base.equalizerPreampDb = clampGain(Number(savedPreamp));
  }
  const savedWet = readString(KEYS.wetMix);
  if (savedWet !== null && Number.isFinite(Number(savedWet))) {
    base.equalizerWetMixPercent = clampWet(Number(savedWet));
  }
  return base;
}

export const useEqualizerStore = create<EqualizerState>()((set, get) => {
  const update = (fn: (state: EqualizerState) => CoreState | EqualizerState) =>
    set((state) => normalizeState(fn(state)) as EqualizerState);

  const presetApplied = (preset: EqualizerPreset): Partial<CoreState> => ({
    equalizerPresetId: preset.id,
    equalizerPresetName: preset.name,
    equalizerBandGains: [...preset.bandGains],
    equalizerPreampDb: preset.preampDb,
    equalizerWetMixPercent: preset.wetMixPercent,
  });

  return {
    ...loadInitialState(),

    setEqualizerPresetIdRaw: (equalizerPresetId) => update((state) => ({ ...state, equalizerPresetId, isEqualizerPresetRenaming: false })),
    setStartupEqualizerPresetId: (startupEqualizerPresetId) => set({ startupEqualizerPresetId }),
    setEqualizerPresetName: (equalizerPresetName) => set({ equalizerPresetName }),
    setEqualizerPreampDb: (value) => set({ equalizerPreampDb: clampGain(value) }),
    setEqualizerWetMixPercent: (value) => set({ equalizerWetMixPercent: clampWet(value) }),
    setEqualizerBandGain: (index, value) =>
      set((state) => {
        if (index < 0 || index >= state.equalizerBandGains.length) {
          return state;
        }
        const nextValue = clampGain(value);
        return {
          equalizerBandGains: state.equalizerBandGains.map((current, currentIndex) => (currentIndex === index ? nextValue : current)),
        };
      }),

    changePreset: (presetId) => {
      const settings = useSettingsStore.getState();
      if (settings.audioAutoEq) {
        settings.setAudioAutoEq(false);
      }
      const preset = get().equalizerPresets.find((item) => item.id === presetId);
      if (!preset) {
        set({ equalizerPresetId: "" });
        return;
      }
      get().applyPreset(preset.id, preset.name, preset.bandGains, preset.preampDb, preset.wetMixPercent);
    },

    applyPreset: (presetId, presetName, bandGains, preampDb = 0, wetMixPercent = 100) =>
      set({
        equalizerPresetId: presetId,
        equalizerPresetName: presetName,
        equalizerBandGains: EQUALIZER_FREQUENCIES.map((_, index) => clampGain(Number(bandGains[index] ?? 0))),
        equalizerPreampDb: clampGain(preampDb),
        equalizerWetMixPercent: clampWet(wetMixPercent),
        isEqualizerPresetRenaming: false,
      }),

    setGenreEqPreset: (genreKey, presetId) => set((state) => ({ genreEqPresetMap: { ...state.genreEqPresetMap, [genreKey]: presetId } })),

    syncGenreEqMap: (libraryGenres) =>
      set((state) => {
        const presetIdSet = new Set(state.equalizerPresets.map((preset) => preset.id));
        const next: Record<string, string> = { ...state.genreEqPresetMap };
        let changed = false;
        for (const [genreKey, presetId] of Object.entries(next)) {
          if (presetId && !presetIdSet.has(presetId)) {
            next[genreKey] = "";
            changed = true;
          }
        }
        for (const genre of libraryGenres) {
          if (next[genre.key] !== undefined) {
            continue;
          }
          const inferred = inferGenrePresetId(genre.label);
          next[genre.key] = presetIdSet.has(inferred) ? inferred : "";
          changed = true;
        }
        if (next[NO_GENRE_EQ_KEY] === undefined) {
          const inferred = inferGenrePresetId("");
          next[NO_GENRE_EQ_KEY] = presetIdSet.has(inferred) ? inferred : "";
          changed = true;
        }
        return changed ? { genreEqPresetMap: next } : state;
      }),

    createPreset: () =>
      update((state) => {
        const preset: EqualizerPreset = {
          id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: buildUniqueEqualizerPresetName(state.equalizerPresets, "new preset"),
          bandGains: [...state.equalizerBandGains],
          preampDb: state.equalizerPreampDb,
          wetMixPercent: state.equalizerWetMixPercent,
        };
        return {
          ...state,
          equalizerPresets: [...state.equalizerPresets, preset],
          equalizerPresetId: preset.id,
          equalizerPresetName: preset.name,
          isEqualizerPresetRenaming: true,
        };
      }),

    savePreset: () => {
      const state = get();
      if (!state.equalizerPresetId || BUILTIN_EQ_PRESET_IDS.has(state.equalizerPresetId)) {
        get().createPreset();
        return;
      }
      update((current) => {
        const uniqueName = buildUniqueEqualizerPresetName(
          current.equalizerPresets,
          current.equalizerPresetName.trim() || "Preset",
          current.equalizerPresetId
        );
        return {
          ...current,
          equalizerPresets: current.equalizerPresets.map((preset) =>
            preset.id === current.equalizerPresetId
              ? {
                  ...preset,
                  name: uniqueName,
                  bandGains: [...current.equalizerBandGains],
                  preampDb: current.equalizerPreampDb,
                  wetMixPercent: current.equalizerWetMixPercent,
                }
              : preset
          ),
          equalizerPresetName: uniqueName,
          isEqualizerPresetRenaming: false,
        };
      });
    },

    renameButtonClick: () => {
      const state = get();
      if (!state.equalizerPresetId || BUILTIN_EQ_PRESET_IDS.has(state.equalizerPresetId)) {
        return;
      }
      if (!state.isEqualizerPresetRenaming) {
        set({ isEqualizerPresetRenaming: true });
        return;
      }
      const trimmedName = state.equalizerPresetName.trim();
      if (!trimmedName) {
        return;
      }
      update((current) => {
        const uniqueName = buildUniqueEqualizerPresetName(current.equalizerPresets, trimmedName, current.equalizerPresetId);
        return {
          ...current,
          equalizerPresets: current.equalizerPresets.map((preset) =>
            preset.id === current.equalizerPresetId ? { ...preset, name: uniqueName } : preset
          ),
          equalizerPresetName: uniqueName,
          isEqualizerPresetRenaming: false,
        };
      });
    },

    deletePreset: () =>
      update((state) => {
        if (!state.equalizerPresetId || BUILTIN_EQ_PRESET_IDS.has(state.equalizerPresetId)) {
          return state;
        }
        const equalizerPresets = state.equalizerPresets.filter((preset) => preset.id !== state.equalizerPresetId);
        const fallback =
          equalizerPresets.find((preset) => preset.id === DEFAULT_EQUALIZER_PRESET.id) ?? equalizerPresets[0] ?? DEFAULT_EQUALIZER_PRESET;
        return { ...state, equalizerPresets, ...presetApplied(fallback), isEqualizerPresetRenaming: false };
      }),

    reset: () =>
      update((state) => {
        const flat = state.equalizerPresets.find((preset) => preset.id === DEFAULT_EQUALIZER_PRESET.id) ?? DEFAULT_EQUALIZER_PRESET;
        return { ...state, ...presetApplied(flat), isEqualizerPresetRenaming: false };
      }),
  };
});

function persistAll(state: EqualizerState): void {
  writeJson(KEYS.presets, state.equalizerPresets);
  writeString(KEYS.presetId, state.equalizerPresetId);
  writeString(KEYS.startupPresetId, state.startupEqualizerPresetId);
  writeString(KEYS.presetName, state.equalizerPresetName);
  writeJson(KEYS.bandGains, state.equalizerBandGains);
  writeString(KEYS.preampDb, String(state.equalizerPreampDb));
  writeString(KEYS.wetMix, String(state.equalizerWetMixPercent));
  writeJson(KEYS.genreMap, state.genreEqPresetMap);
}

persistAll(useEqualizerStore.getState());
useEqualizerStore.subscribe((state, previous) => {
  if (state.equalizerPresets !== previous.equalizerPresets) writeJson(KEYS.presets, state.equalizerPresets);
  if (state.equalizerPresetId !== previous.equalizerPresetId) writeString(KEYS.presetId, state.equalizerPresetId);
  if (state.startupEqualizerPresetId !== previous.startupEqualizerPresetId) writeString(KEYS.startupPresetId, state.startupEqualizerPresetId);
  if (state.equalizerPresetName !== previous.equalizerPresetName) writeString(KEYS.presetName, state.equalizerPresetName);
  if (state.equalizerBandGains !== previous.equalizerBandGains) writeJson(KEYS.bandGains, state.equalizerBandGains);
  if (state.equalizerPreampDb !== previous.equalizerPreampDb) writeString(KEYS.preampDb, String(state.equalizerPreampDb));
  if (state.equalizerWetMixPercent !== previous.equalizerWetMixPercent) writeString(KEYS.wetMix, String(state.equalizerWetMixPercent));
  if (state.genreEqPresetMap !== previous.genreEqPresetMap) writeJson(KEYS.genreMap, state.genreEqPresetMap);
});
