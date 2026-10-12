import { create } from "zustand";
import type { AppScreen } from "../types";
import { useSettingsStore } from "./settingsStore";
import { fieldSetter, type Setter } from "./util";

export type UiState = {
  activeScreen: AppScreen;
  showRenameSettings: boolean;
  setActiveScreen: Setter<AppScreen>;
  setShowRenameSettings: Setter<boolean>;
};

export const useUiStore = create<UiState>()((set) => ({
  activeScreen: useSettingsStore.getState().startupScreen,
  showRenameSettings: false,
  setActiveScreen: fieldSetter(set, "activeScreen"),
  setShowRenameSettings: fieldSetter(set, "showRenameSettings"),
}));
