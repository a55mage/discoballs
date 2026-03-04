import { type MouseEvent } from "react";
import { Card } from "../components/Card";

type SettingsSectionProps = {
  autoOpenDefaultFolder: boolean;
  onAutoOpenDefaultFolderChange: (value: boolean) => void;
  defaultFolderPath: string;
  onDefaultFolderPathChange: (value: string) => void;
  folderPath: string;
  onUseCurrentLibraryFolder: () => void;
  audioNormalizeVolume: boolean;
  onAudioNormalizeVolumeChange: (value: boolean) => void;
  audioSmartCrossfade: boolean;
  onAudioSmartCrossfadeChange: (value: boolean) => void;
  colorMode: "light" | "dark";
  onColorModeChange: (value: "light" | "dark") => void;
  accentRotateOnLaunch: boolean;
  onAccentRotateOnLaunchChange: (value: boolean) => void;
  onRotateAccentNow: () => void;
  onOpenExternalLink: (event: MouseEvent<HTMLAnchorElement>, url: string) => void;
};

export function SettingsSection({
  autoOpenDefaultFolder,
  onAutoOpenDefaultFolderChange,
  defaultFolderPath,
  onDefaultFolderPathChange,
  folderPath,
  onUseCurrentLibraryFolder,
  audioNormalizeVolume,
  onAudioNormalizeVolumeChange,
  audioSmartCrossfade,
  onAudioSmartCrossfadeChange,
  colorMode,
  onColorModeChange,
  accentRotateOnLaunch,
  onAccentRotateOnLaunchChange,
  onRotateAccentNow,
  onOpenExternalLink,
}: SettingsSectionProps) {
  return (
    <main className="settings-layout">
      <Card title="General">
        <div className="settings-grid">
          <label className="settings-toggle">
            <input type="checkbox" checked={autoOpenDefaultFolder} onChange={(event) => onAutoOpenDefaultFolderChange(event.target.checked)} />
            <span>Auto-open default folder on launch</span>
          </label>
          <label>
            Default folder
            <input className="input" value={defaultFolderPath} onChange={(event) => onDefaultFolderPathChange(event.target.value)} placeholder="/Music" />
          </label>
          <button className="ghost-button" onClick={onUseCurrentLibraryFolder} disabled={!folderPath}>Use current library folder</button>
        </div>
      </Card>

      <Card title="Audio Settings">
        <div className="settings-grid">
          <label className="settings-toggle">
            <input type="checkbox" checked={audioNormalizeVolume} onChange={(event) => onAudioNormalizeVolumeChange(event.target.checked)} />
            <span>Normalize playback volume (planned)</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={audioSmartCrossfade} onChange={(event) => onAudioSmartCrossfadeChange(event.target.checked)} />
            <span>Smart crossfade between tracks (planned)</span>
          </label>
        </div>
      </Card>

      <Card title="Appearance">
        <div className="settings-grid">
          <label className="settings-toggle">
            <input type="checkbox" checked={colorMode === "dark"} onChange={(event) => onColorModeChange(event.target.checked ? "dark" : "light")} />
            <span>Enable dark mode</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={accentRotateOnLaunch} onChange={(event) => onAccentRotateOnLaunchChange(event.target.checked)} />
            <span>Rotate accent palette on launch</span>
          </label>
          <button className="ghost-button" onClick={onRotateAccentNow}>Rotate accent now</button>
        </div>
      </Card>

      <Card title="App Info">
        <div className="info-meta">
          <p><strong>App:</strong> DiscoBalls</p>
          <p><strong>Version:</strong> 1.3.1</p>
          <p>
            <strong>Website:</strong>{" "}
            <a
              href="https://a55mage.github.io/discoballs/"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => onOpenExternalLink(event, "https://a55mage.github.io/discoballs/")}
            >
              https://a55mage.github.io/discoballs/
            </a>
          </p>
          <p>
            <strong>Developer:</strong>{" "}
            <a
              href="https://a55mage.github.io/"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => onOpenExternalLink(event, "https://a55mage.github.io/")}
            >
              https://a55mage.github.io/
            </a>
          </p>
          <p>
            <strong>Donate:</strong>{" "}
            <a
              href="https://www.paypal.com/donate/?business=r.macis%40live.it"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => onOpenExternalLink(event, "https://www.paypal.com/donate/?business=r.macis%40live.it")}
            >
              Donate via PayPal
            </a>
          </p>
        </div>
      </Card>
    </main>
  );
}
