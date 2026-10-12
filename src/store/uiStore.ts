import { create } from "zustand";
import type { AppScreen } from "../types";
import { useSettingsStore } from "./settingsStore";
import { fieldSetter, type Setter } from "./util";

export type SettingsTab = "general" | "audio" | "appearance" | "renaming" | "library";

export type Toast = { id: number; message: string; tone: "info" | "success" | "error" };

export type UiState = {
  activeScreen: AppScreen;
  isPaletteOpen: boolean;
  settingsTab: SettingsTab;
  /** Full-window mode: only the content is shown, without sidebar, header and player bar. */
  isImmersive: boolean;
  toast: Toast | null;
  setActiveScreen: Setter<AppScreen>;
  setPaletteOpen: Setter<boolean>;
  setSettingsTab: Setter<SettingsTab>;
  setImmersive: Setter<boolean>;
  showToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: () => void;
};

let toastCounter = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set) => ({
  activeScreen: useSettingsStore.getState().startupScreen,
  isPaletteOpen: false,
  settingsTab: "general",
  isImmersive: false,
  toast: null,
  setActiveScreen: fieldSetter(set, "activeScreen"),
  setPaletteOpen: fieldSetter(set, "isPaletteOpen"),
  setSettingsTab: fieldSetter(set, "settingsTab"),
  setImmersive: fieldSetter(set, "isImmersive"),
  showToast: (message, tone = "info") => {
    toastCounter += 1;
    clearTimeout(toastTimer);
    set({ toast: { id: toastCounter, message, tone } });
    toastTimer = setTimeout(() => set({ toast: null }), tone === "error" ? 6000 : 3200);
  },
  dismissToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
