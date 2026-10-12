import { chooseDefaultFolder } from "../../actions/library";
import { useLibraryStore } from "../../store/libraryStore";
import { useNavidromeStore } from "../../store/navidromeStore";
import { useSettingsStore } from "../../store/settingsStore";
import { Badge, Button, SettingRow, Switch, TextInput } from "../../ui";

export function LibraryTab() {
  const s = useSettingsStore();
  const folderPath = useLibraryStore((state) => state.folderPath);
  const { navidromeBookmarks, connectedNavidromeBookmarkId, setIsNavidromePanelOpen } = useNavidromeStore();
  const isRemote = folderPath.startsWith("Navidrome/");

  return (
    <>
      <h2 className="set__heading db-text-display">Library &amp; servers</h2>
      <div className="set__group">
        <SettingRow title="Open the default folder on launch" description="Scans your music folder when the app starts, after showing the last library instantly.">
          <Switch label="Open the default folder on launch" checked={s.autoOpenDefaultFolder} onChange={s.setAutoOpenDefaultFolder} />
        </SettingRow>
      </div>
      <h3 className="set__subheading">Default folder</h3>
      <div className="set__folder">
        <TextInput readOnly aria-label="Default folder" value={s.defaultFolderPath} placeholder="No default folder yet" />
        <Button onClick={() => void chooseDefaultFolder()}>Choose…</Button>
        <Button disabled={!folderPath || isRemote} onClick={() => s.setDefaultFolderPath(folderPath)}>Use current</Button>
      </div>

      <h3 className="set__subheading">Navidrome servers</h3>
      <ul className="set__servers">
        {navidromeBookmarks.map((bookmark) => (
          <li key={bookmark.id}>
            <span>
              <strong>{bookmark.name}</strong>
              <small>{bookmark.username} · {bookmark.baseUrl}</small>
            </span>
            {bookmark.id === connectedNavidromeBookmarkId ? <Badge tone="ok">Connected</Badge> : null}
            {bookmark.connectOnOpen ? <Badge tone="neutral">On open</Badge> : null}
          </li>
        ))}
        {navidromeBookmarks.length === 0 ? <li className="set__hint">No servers saved yet.</li> : null}
      </ul>
      <Button onClick={() => setIsNavidromePanelOpen(true)}>Manage servers…</Button>
    </>
  );
}
