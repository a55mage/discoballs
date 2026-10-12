import { create } from "zustand";
import type { AppScreen } from "../types";
import { useSettingsStore } from "./settingsStore";
import { fieldSetter, type Setter } from "./util";

export type SettingsTab = "general" | "audio" | "appearance" | "renaming" | "library";

export type FilenameTagsRequest = { ids: string[]; mode: "write" | "draft" };

export type AlbumMatchRequest = { ids: string[] };

export type ToastAction = { label: string; run: () => void };
export type Toast = { id: number; message: string; tone: "info" | "success" | "error"; action?: ToastAction };

export type UiState = {
  activeScreen: AppScreen;
  isPaletteOpen: boolean;
  isHistoryOpen: boolean;
  isDuplicatesOpen: boolean;
  /** Set while the "tags from file names" dialog is open. */
  filenameTags: FilenameTagsRequest | null;
  /** Set while the "match album online" dialog is open. */
  albumMatch: AlbumMatchRequest | null;
  settingsTab: SettingsTab;
  /** Full-window mode: only the content is shown, without sidebar, header and player bar. */
  isImmersive: boolean;
  toast: Toast | null;
  setActiveScreen: Setter<AppScreen>;
  setPaletteOpen: Setter<boolean>;
  setHistoryOpen: Setter<boolean>;
  setDuplicatesOpen: Setter<boolean>;
  setFilenameTags: Setter<FilenameTagsRequest | null>;
  setAlbumMatch: Setter<AlbumMatchRequest | null>;
  setSettingsTab: Setter<SettingsTab>;
  setImmersive: Setter<boolean>;
  showToast: (message: string, tone?: Toast["tone"], action?: ToastAction) => void;
  dismissToast: () => void;
};

let toastCounter = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set) => ({
  activeScreen: useSettingsStore.getState().startupScreen,
  isPaletteOpen: false,
  isHistoryOpen: false,
  isDuplicatesOpen: false,
  filenameTags: null,
  albumMatch: null,
  settingsTab: "general",
  isImmersive: false,
  toast: null,
  setActiveScreen: fieldSetter(set, "activeScreen"),
  setPaletteOpen: fieldSetter(set, "isPaletteOpen"),
  setHistoryOpen: fieldSetter(set, "isHistoryOpen"),
  setDuplicatesOpen: fieldSetter(set, "isDuplicatesOpen"),
  setFilenameTags: fieldSetter(set, "filenameTags"),
  setAlbumMatch: fieldSetter(set, "albumMatch"),
  setSettingsTab: fieldSetter(set, "settingsTab"),
  setImmersive: fieldSetter(set, "isImmersive"),
  showToast: (message, tone = "info", action) => {
    toastCounter += 1;
    clearTimeout(toastTimer);
    set({ toast: { id: toastCounter, message, tone, action } });
    toastTimer = setTimeout(() => set({ toast: null }), action ? 9000 : tone === "error" ? 6000 : 3200);
  },
  dismissToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
