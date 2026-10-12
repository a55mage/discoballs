import { useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore";

/** Mirrors the theme settings onto <html> so the design tokens (`data-theme`, `--db-accent`) follow them. */
export function useApplyTheme(): void {
  const colorMode = useSettingsStore((state) => state.colorMode);
  const accent = useSettingsStore((state) => state.accentThemes[state.accentIndex]?.accent);

  useEffect(() => {
    document.documentElement.dataset.theme = colorMode;
  }, [colorMode]);

  useEffect(() => {
    if (accent) {
      document.documentElement.style.setProperty("--db-accent", accent);
    }
  }, [accent]);
}
