import { create } from "zustand";
import type { VisualizerPresetId } from "../sections/MusicVisualizerSection";
import { ACCENT_THEMES, buildSoftAccent, buildStrongAccent, type AccentTheme } from "../domain/theme";
import { RENAME_FIELD_KEYS } from "../domain/rename";
import type { PlayerColumnVisibility, RenameField, StartupScreen } from "../types";
import { readJson, readString, writeJson, writeString } from "./storage";

export type ColorMode = "light" | "dark";

const KEYS = {
  colorMode: "musicmanager-color-mode",
  playerColumns: "musicmanager-player-columns",
  visualizerPreset: "musicmanager-player-visualizer-preset",
  showLyrics: "musicmanager-player-show-lyrics",
  startupScreen: "musicmanager-startup-screen",
  accentIndex: "musicmanager-accent-index",
  accentThemes: "musicmanager-accent-themes",
  accentRotate: "musicmanager-accent-rotate-on-launch",
  renameFields: "musicmanager-rename-fields",
  renameSeparator: "musicmanager-rename-separator",
  autoOpen: "musicmanager-auto-open-default-folder",
  defaultFolder: "musicmanager-default-folder-path",
  normalizeVolume: "musicmanager-audio-normalize-volume",
  autoEq: "musicmanager-audio-auto-eq",
  smartCrossfade: "musicmanager-audio-smart-crossfade",
} as const;

const VISUALIZER_IDS: VisualizerPresetId[] = ["scope", "alchemy", "xp-bars", "turntable"];
const STARTUP_SCREENS: StartupScreen[] = ["tagging", "library", "dashboard", "player"];

export const DEFAULT_RENAME_FIELDS: RenameField[] = ["tracknumber", "artist", "title"];
export const DEFAULT_RENAME_SEPARATOR = " - ";
const NEW_ACCENT_THEME: AccentTheme = { accent: "#4f8cff", soft: "#dce8ff", strong: "#3b6fd1" };

function cloneDefaultAccents(): AccentTheme[] {
  return ACCENT_THEMES.map((theme) => ({ ...theme }));
}

export function normalizeAccentThemes(value: unknown): AccentTheme[] | null {
  if (!Array.isArray(value) || !value.length) {
    return null;
  }
  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const accent = typeof candidate.accent === "string" ? candidate.accent : "";
      const soft = typeof candidate.soft === "string" ? candidate.soft : "";
      const strong = typeof candidate.strong === "string" ? candidate.strong : "";
      if (!accent || !soft || !strong) {
        return null;
      }
      return { accent, soft, strong } satisfies AccentTheme;
    })
    .filter((item): item is AccentTheme => Boolean(item));
  return normalized.length ? normalized : null;
}

export function normalizePlayerColumns(value: unknown): PlayerColumnVisibility | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const parsed = value as Partial<PlayerColumnVisibility>;
  const next: PlayerColumnVisibility = {
    library: parsed.library !== false,
    visualizer: parsed.visualizer !== false,
    queue: parsed.queue !== false,
  };
  if (!next.library && !next.visualizer && !next.queue) {
    next.visualizer = true;
  }
  return next;
}

export function normalizeRenameFields(value: unknown): RenameField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const valid = value
    .map((item) => String(item))
    .filter((item): item is RenameField => RENAME_FIELD_KEYS.has(item as RenameField));
  return valid.length ? valid : null;
}

export type SettingsState = {
  colorMode: ColorMode;
  startupScreen: StartupScreen;
  autoOpenDefaultFolder: boolean;
  defaultFolderPath: string;
  accentThemes: AccentTheme[];
  accentIndex: number;
  accentRotateOnLaunch: boolean;
  renameFields: RenameField[];
  renameSeparator: string;
  playerColumnVisibility: PlayerColumnVisibility;
  playerVisualizerPresetId: VisualizerPresetId;
  showPlayerLyricsSection: boolean;
  audioAutoEq: boolean;
  audioNormalizeVolume: boolean;
  audioSmartCrossfade: boolean;

  setColorMode: (mode: ColorMode) => void;
  setStartupScreen: (screen: StartupScreen) => void;
  setAutoOpenDefaultFolder: (value: boolean) => void;
  setDefaultFolderPath: (path: string) => void;
  setAccentIndex: (index: number) => void;
  setAccentRotateOnLaunch: (value: boolean) => void;
  addAccentTheme: () => void;
  removeAccentTheme: (index: number) => void;
  changeAccentColor: (index: number, color: string) => void;
  resetAccentThemes: () => void;
  rotateAccent: () => void;
  setRenameSeparator: (separator: string) => void;
  toggleRenameField: (field: RenameField) => void;
  moveRenameField: (field: RenameField, direction: -1 | 1) => void;
  togglePlayerColumn: (column: keyof PlayerColumnVisibility) => void;
  toggleShowPlayerLyrics: () => void;
  setPlayerVisualizerPresetId: (id: VisualizerPresetId) => void;
  setAudioAutoEq: (value: boolean) => void;
  setAudioNormalizeVolume: (value: boolean) => void;
  setAudioSmartCrossfade: (value: boolean) => void;
};

function loadInitialState(): Pick<
  SettingsState,
  | "colorMode"
  | "startupScreen"
  | "autoOpenDefaultFolder"
  | "defaultFolderPath"
  | "accentThemes"
  | "accentIndex"
  | "accentRotateOnLaunch"
  | "renameFields"
  | "renameSeparator"
  | "playerColumnVisibility"
  | "playerVisualizerPresetId"
  | "showPlayerLyricsSection"
  | "audioAutoEq"
  | "audioNormalizeVolume"
  | "audioSmartCrossfade"
> {
  const savedColorMode = readString(KEYS.colorMode);
  const savedStartup = readString(KEYS.startupScreen);
  const savedVisualizer = readString(KEYS.visualizerPreset);

  const accentThemes = normalizeAccentThemes(readJson(KEYS.accentThemes)) ?? cloneDefaultAccents();
  let accentIndex = 0;
  const savedAccentIndex = Number(readString(KEYS.accentIndex));
  if (readString(KEYS.accentIndex) !== null && Number.isInteger(savedAccentIndex) && savedAccentIndex >= 0) {
    accentIndex = savedAccentIndex % accentThemes.length;
  }
  const accentRotateOnLaunch = readString(KEYS.accentRotate) === "true";
  if (accentRotateOnLaunch) {
    accentIndex = (accentIndex + 1) % Math.max(1, accentThemes.length);
  }

  return {
    colorMode: savedColorMode === "dark" ? "dark" : "light",
    startupScreen: STARTUP_SCREENS.includes(savedStartup as StartupScreen) ? (savedStartup as StartupScreen) : "tagging",
    autoOpenDefaultFolder: readString(KEYS.autoOpen) === "true",
    defaultFolderPath: readString(KEYS.defaultFolder) ?? "",
    accentThemes,
    accentIndex,
    accentRotateOnLaunch,
    renameFields: normalizeRenameFields(readJson(KEYS.renameFields)) ?? [...DEFAULT_RENAME_FIELDS],
    renameSeparator: readString(KEYS.renameSeparator) ?? DEFAULT_RENAME_SEPARATOR,
    playerColumnVisibility: normalizePlayerColumns(readJson(KEYS.playerColumns)) ?? {
      library: true,
      visualizer: true,
      queue: true,
    },
    playerVisualizerPresetId: VISUALIZER_IDS.includes(savedVisualizer as VisualizerPresetId)
      ? (savedVisualizer as VisualizerPresetId)
      : "scope",
    showPlayerLyricsSection: readString(KEYS.showLyrics) !== "false",
    audioAutoEq: readString(KEYS.autoEq) === "true",
    audioNormalizeVolume: readString(KEYS.normalizeVolume) === "true",
    audioSmartCrossfade: readString(KEYS.smartCrossfade) === "true",
  };
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...loadInitialState(),

  setColorMode: (colorMode) => set({ colorMode }),
  setStartupScreen: (startupScreen) => set({ startupScreen }),
  setAutoOpenDefaultFolder: (autoOpenDefaultFolder) => set({ autoOpenDefaultFolder }),
  setDefaultFolderPath: (defaultFolderPath) => set({ defaultFolderPath }),
  setAccentIndex: (accentIndex) => set({ accentIndex }),
  setAccentRotateOnLaunch: (accentRotateOnLaunch) => set({ accentRotateOnLaunch }),

  addAccentTheme: () =>
    set((state) => {
      const accentThemes = [...state.accentThemes, { ...NEW_ACCENT_THEME }];
      return { accentThemes, accentIndex: accentThemes.length - 1 };
    }),
  removeAccentTheme: (index) =>
    set((state) => {
      if (state.accentThemes.length <= 1 || index < 0 || index >= state.accentThemes.length) {
        return state;
      }
      const accentThemes = state.accentThemes.filter((_, itemIndex) => itemIndex !== index);
      let accentIndex = state.accentIndex;
      if (accentIndex === index) {
        accentIndex = 0;
      } else if (accentIndex > index) {
        accentIndex -= 1;
      }
      return { accentThemes, accentIndex };
    }),
  changeAccentColor: (index, color) => {
    const normalized = color.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return;
    }
    set((state) => ({
      accentThemes: state.accentThemes.map((theme, itemIndex) =>
        itemIndex === index
          ? { accent: normalized, soft: buildSoftAccent(normalized), strong: buildStrongAccent(normalized) }
          : theme
      ),
    }));
  },
  resetAccentThemes: () => set({ accentThemes: cloneDefaultAccents(), accentIndex: 0 }),
  rotateAccent: () =>
    set((state) => ({ accentIndex: (state.accentIndex + 1) % Math.max(1, state.accentThemes.length) })),

  setRenameSeparator: (renameSeparator) => set({ renameSeparator }),
  toggleRenameField: (field) =>
    set((state) => {
      if (state.renameFields.includes(field)) {
        if (state.renameFields.length === 1) {
          return state;
        }
        return { renameFields: state.renameFields.filter((item) => item !== field) };
      }
      return { renameFields: [...state.renameFields, field] };
    }),
  moveRenameField: (field, direction) =>
    set((state) => {
      const index = state.renameFields.indexOf(field);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= state.renameFields.length) {
        return state;
      }
      const renameFields = [...state.renameFields];
      [renameFields[index], renameFields[nextIndex]] = [renameFields[nextIndex], renameFields[index]];
      return { renameFields };
    }),

  togglePlayerColumn: (column) =>
    set((state) => {
      const playerColumnVisibility = { ...state.playerColumnVisibility, [column]: !state.playerColumnVisibility[column] };
      const { library, visualizer, queue } = playerColumnVisibility;
      if (!library && !visualizer && !queue && !state.showPlayerLyricsSection) {
        return state;
      }
      return { playerColumnVisibility };
    }),
  toggleShowPlayerLyrics: () =>
    set((state) => {
      const next = !state.showPlayerLyricsSection;
      const { library, visualizer, queue } = state.playerColumnVisibility;
      if (!next && !library && !visualizer && !queue) {
        return state;
      }
      return { showPlayerLyricsSection: next };
    }),
  setPlayerVisualizerPresetId: (playerVisualizerPresetId) => set({ playerVisualizerPresetId }),

  setAudioAutoEq: (audioAutoEq) => set({ audioAutoEq }),
  setAudioNormalizeVolume: (audioNormalizeVolume) => set({ audioNormalizeVolume }),
  setAudioSmartCrossfade: (audioSmartCrossfade) => set({ audioSmartCrossfade }),
}));

function persistAll(state: SettingsState): void {
  writeString(KEYS.colorMode, state.colorMode);
  writeString(KEYS.startupScreen, state.startupScreen);
  writeString(KEYS.autoOpen, String(state.autoOpenDefaultFolder));
  writeString(KEYS.defaultFolder, state.defaultFolderPath);
  writeJson(KEYS.accentThemes, state.accentThemes);
  writeString(KEYS.accentIndex, String(state.accentIndex));
  writeString(KEYS.accentRotate, String(state.accentRotateOnLaunch));
  writeJson(KEYS.renameFields, state.renameFields);
  writeString(KEYS.renameSeparator, state.renameSeparator);
  writeJson(KEYS.playerColumns, state.playerColumnVisibility);
  writeString(KEYS.visualizerPreset, state.playerVisualizerPresetId);
  writeString(KEYS.showLyrics, String(state.showPlayerLyricsSection));
  writeString(KEYS.autoEq, String(state.audioAutoEq));
  writeString(KEYS.normalizeVolume, String(state.audioNormalizeVolume));
  writeString(KEYS.smartCrossfade, String(state.audioSmartCrossfade));
}

// Persist the initial snapshot (it may include the rotated accent), then every change.
persistAll(useSettingsStore.getState());
useSettingsStore.subscribe((state, previous) => {
  if (state === previous) {
    return;
  }
  if (state.colorMode !== previous.colorMode) writeString(KEYS.colorMode, state.colorMode);
  if (state.startupScreen !== previous.startupScreen) writeString(KEYS.startupScreen, state.startupScreen);
  if (state.autoOpenDefaultFolder !== previous.autoOpenDefaultFolder) writeString(KEYS.autoOpen, String(state.autoOpenDefaultFolder));
  if (state.defaultFolderPath !== previous.defaultFolderPath) writeString(KEYS.defaultFolder, state.defaultFolderPath);
  if (state.accentThemes !== previous.accentThemes) writeJson(KEYS.accentThemes, state.accentThemes);
  if (state.accentIndex !== previous.accentIndex) writeString(KEYS.accentIndex, String(state.accentIndex));
  if (state.accentRotateOnLaunch !== previous.accentRotateOnLaunch) writeString(KEYS.accentRotate, String(state.accentRotateOnLaunch));
  if (state.renameFields !== previous.renameFields) writeJson(KEYS.renameFields, state.renameFields);
  if (state.renameSeparator !== previous.renameSeparator) writeString(KEYS.renameSeparator, state.renameSeparator);
  if (state.playerColumnVisibility !== previous.playerColumnVisibility) writeJson(KEYS.playerColumns, state.playerColumnVisibility);
  if (state.playerVisualizerPresetId !== previous.playerVisualizerPresetId) writeString(KEYS.visualizerPreset, state.playerVisualizerPresetId);
  if (state.showPlayerLyricsSection !== previous.showPlayerLyricsSection) writeString(KEYS.showLyrics, String(state.showPlayerLyricsSection));
  if (state.audioAutoEq !== previous.audioAutoEq) writeString(KEYS.autoEq, String(state.audioAutoEq));
  if (state.audioNormalizeVolume !== previous.audioNormalizeVolume) writeString(KEYS.normalizeVolume, String(state.audioNormalizeVolume));
  if (state.audioSmartCrossfade !== previous.audioSmartCrossfade) writeString(KEYS.smartCrossfade, String(state.audioSmartCrossfade));
});
