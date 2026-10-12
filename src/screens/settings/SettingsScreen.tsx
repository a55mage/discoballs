import { type ReactNode } from "react";
import { type SettingsTab, useUiStore } from "../../store/uiStore";
import { cx } from "../../ui";
import { AppearanceTab } from "./AppearanceTab";
import { AudioTab } from "./AudioTab";
import { GeneralTab } from "./GeneralTab";
import { LibraryTab } from "./LibraryTab";
import { RenamingTab } from "./RenamingTab";
import "./settings.css";

const TABS: Array<{ id: SettingsTab; label: string; render: () => ReactNode }> = [
  { id: "general", label: "General", render: () => <GeneralTab /> },
  { id: "audio", label: "Audio & EQ", render: () => <AudioTab /> },
  { id: "appearance", label: "Appearance", render: () => <AppearanceTab /> },
  { id: "renaming", label: "File renaming", render: () => <RenamingTab /> },
  { id: "library", label: "Library & servers", render: () => <LibraryTab /> },
];

export function SettingsScreen() {
  const { settingsTab, setSettingsTab } = useUiStore();
  const active = TABS.find((tab) => tab.id === settingsTab) ?? TABS[0];

  return (
    <div className="set">
      <nav className="set__nav db-glass db-pane--divider-right" aria-label="Settings sections">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={cx("set__tab", tab.id === active.id && "is-active")} aria-current={tab.id === active.id ? "page" : undefined} onClick={() => setSettingsTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="set__panel">
        <div className="set__panel-inner">{active.render()}</div>
      </div>
    </div>
  );
}
