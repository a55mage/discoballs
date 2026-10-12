import { IconGlobe, IconHeart, IconUser } from "../../components/icons";
import { useSettingsStore } from "../../store/settingsStore";
import type { StartupScreen } from "../../types";
import { openExternalLink } from "../../utils/external";
import { APP_VERSION } from "../../version";
import { Button, SettingRow, Select } from "../../ui";

const STARTUP_OPTIONS: Array<{ value: StartupScreen; label: string }> = [
  { value: "library", label: "Library" },
  { value: "tagging", label: "Tag Editor" },
  { value: "dashboard", label: "Playlists" },
  { value: "player", label: "Now Playing" },
];

export function GeneralTab() {
  const { startupScreen, setStartupScreen } = useSettingsStore();
  return (
    <>
      <h2 className="set__heading db-text-display">General</h2>
      <div className="set__group">
        <SettingRow title="Start on" description="The screen shown when the app opens.">
          <Select aria-label="Start screen" value={startupScreen} onChange={(event) => setStartupScreen(event.target.value as StartupScreen)}>
            {STARTUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow title="Language" description="The interface is available in English for now." />
      </div>

      <h3 className="set__subheading">About</h3>
      <div className="set__about">
        <strong className="db-text-display">DiscoBalls v{APP_VERSION}</strong>
        <p>An open-source music tag editor and player.</p>
        <div className="set__about-links">
          <Button icon={<IconGlobe />} onClick={() => void openExternalLink("https://a55mage.github.io/discoballs/")}>Website</Button>
          <Button icon={<IconUser />} onClick={() => void openExternalLink("https://a55mage.github.io/")}>Developer</Button>
          <Button icon={<IconHeart />} onClick={() => void openExternalLink("https://www.paypal.com/donate/?business=r.macis%40live.it")}>Donate</Button>
        </div>
      </div>
    </>
  );
}
