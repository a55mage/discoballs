import { IconFolder, IconMoon, IconSearch, IconSun } from "../components/icons";
import { scanLibraryWithPicker } from "../actions/library";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { Button, IconButton } from "../ui";
import { COMMAND_KEY_LABEL } from "./platform";
import { getScreenMeta } from "./screens";

export function Header() {
  const { activeScreen, setPaletteOpen } = useUiStore();
  const { colorMode, setColorMode } = useSettingsStore();
  const meta = getScreenMeta(activeScreen);
  const isDark = colorMode === "dark";

  return (
    <header className="shell__header" data-tauri-drag-region>
      <div className="shell__title" data-tauri-drag-region>
        <h1 className="db-text-display" data-tauri-drag-region>{meta.title}</h1>
        <p data-tauri-drag-region>{meta.subtitle}</p>
      </div>

      <button type="button" className="shell__search" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K Meta+K">
        <IconSearch aria-hidden="true" />
        <span>Search tracks, commands…</span>
        <kbd aria-hidden="true">{COMMAND_KEY_LABEL}</kbd>
      </button>

      <div className="shell__header-actions">
        <IconButton label={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setColorMode(isDark ? "light" : "dark")}>
          {isDark ? <IconSun /> : <IconMoon />}
        </IconButton>
        <Button variant="primary" icon={<IconFolder />} onClick={() => void scanLibraryWithPicker()}>
          Open folder
        </Button>
      </div>
    </header>
  );
}
