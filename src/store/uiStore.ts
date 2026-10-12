import { create } from "zustand";
import type { AppScreen } from "../types";
import { useSettingsStore } from "./settingsStore";
import { fieldSetter, type Setter } from "./util";

export type UiState = {
  activeScreen: AppScreen;
  showRenameSettings: boolean;
  isPaletteOpen: boolean;
  /** Full-window mode: only the content is shown, without sidebar, header and player bar. */
  isImmersive: boolean;
  setActiveScreen: Setter<AppScreen>;
  setShowRenameSettings: Setter<boolean>;
  setPaletteOpen: Setter<boolean>;
  setImmersive: Setter<boolean>;
};

export const useUiStore = create<UiState>()((set) => ({
  activeScreen: useSettingsStore.getState().startupScreen,
  showRenameSettings: false,
  isPaletteOpen: false,
  isImmersive: false,
  setActiveScreen: fieldSetter(set, "activeScreen"),
  setShowRenameSettings: fieldSetter(set, "showRenameSettings"),
  setPaletteOpen: fieldSetter(set, "isPaletteOpen"),
  setImmersive: fieldSetter(set, "isImmersive"),
}));
