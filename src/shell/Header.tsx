import { IconFolder, IconGlobe, IconMoon, IconSearch, IconSun } from "../components/icons";
import appIcon from "../assets/discoballs-icon.png";
import { scanLibraryWithPicker } from "../actions/library";
import { useSettingsStore } from "../store/settingsStore";
import { useNavidromeStore } from "../store/navidromeStore";
import { useUiStore } from "../store/uiStore";
import { Button, IconButton } from "../ui";
import { COMMAND_KEY_LABEL } from "./platform";

type HeaderProps = {
  /** The accent rotates when the logo is clicked (kept from earlier versions). */
  onBrandClick: () => void;
};

export function Header({ onBrandClick }: HeaderProps) {
  const { setPaletteOpen } = useUiStore();
  const { colorMode, setColorMode } = useSettingsStore();
  const setNavidromePanelOpen = useNavidromeStore((state) => state.setIsNavidromePanelOpen);
  const isDark = colorMode === "dark";

  return (
    <header className="shell__header" data-tauri-drag-region>
      <button type="button" className="shell__brand" onClick={onBrandClick} title="DiscoBalls: change accent color" aria-label="DiscoBalls, change accent color">
        <img src={appIcon} alt="" className="shell__brand-icon" />
      </button>

      <div className="shell__title" data-tauri-drag-region>
        <h1 className="db-text-display" data-tauri-drag-region>DiscoBalls</h1>
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
        <Button icon={<IconGlobe />} onClick={() => setNavidromePanelOpen(true)}>
          Connect server
        </Button>
        <Button variant="primary" icon={<IconFolder />} onClick={() => void scanLibraryWithPicker()}>
          Open folder
        </Button>
      </div>
    </header>
  );
}
