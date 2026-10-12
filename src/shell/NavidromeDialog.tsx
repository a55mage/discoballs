import { type FormEvent } from "react";
import { IconGlobe, IconTrash } from "../components/icons";
import {
  connectNavidromeBookmark,
  connectNavidromeFromForm,
  deleteNavidromeBookmark,
  saveNavidromeBookmark,
  setNavidromeBookmarkConnectOnOpen,
} from "../actions/navidrome";
import { useNavidromeStore } from "../store/navidromeStore";
import { Badge, Button, Dialog, Field, IconButton, Switch, TextInput } from "../ui";

/** Add, save and connect to Navidrome servers. Opened from the library toolbar or the sidebar. */
export function NavidromeDialog() {
  const store = useNavidromeStore();
  const close = () => store.setIsNavidromePanelOpen(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    connectNavidromeFromForm();
  }

  return (
    <Dialog open={store.isNavidromePanelOpen} onClose={close} title="Navidrome" width={560}>
      <form className="shell__dialog-form" onSubmit={onSubmit}>
        <Field label="Name">
          <TextInput placeholder="Home server" value={store.navidromeName} onChange={(event) => store.setNavidromeName(event.target.value)} />
        </Field>
        <Field label="Server URL">
          <TextInput placeholder="http://192.168.1.10:4533" inputMode="url" value={store.navidromeBaseUrl} onChange={(event) => store.setNavidromeBaseUrl(event.target.value)} />
        </Field>
        <div className="shell__dialog-row">
          <Field label="Username">
            <TextInput autoComplete="username" value={store.navidromeUsername} onChange={(event) => store.setNavidromeUsername(event.target.value)} />
          </Field>
          <Field label="Password">
            <TextInput type="password" autoComplete="current-password" value={store.navidromePassword} onChange={(event) => store.setNavidromePassword(event.target.value)} />
          </Field>
        </div>
        <label className="shell__dialog-switch">
          <span>Connect on open</span>
          <Switch label="Connect on open" checked={store.navidromeConnectOnOpen} onChange={store.setNavidromeConnectOnOpen} />
        </label>
        <div className="shell__dialog-actions">
          <Button type="button" onClick={saveNavidromeBookmark}>Save bookmark</Button>
          <Button type="submit" variant="primary" icon={<IconGlobe />} disabled={store.isConnectingNavidrome}>
            {store.isConnectingNavidrome ? "Connecting…" : "Connect"}
          </Button>
        </div>
        <p className="shell__dialog-status" role="status">{store.navidromeStatus}</p>
      </form>

      {store.navidromeBookmarks.length ? (
        <section aria-label="Saved servers" className="shell__bookmarks">
          <h3>Saved servers</h3>
          <ul>
            {store.navidromeBookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <div className="shell__bookmark-text">
                  <strong>{bookmark.name}</strong>
                  <span>{bookmark.username} · {bookmark.baseUrl}</span>
                  {bookmark.lastConnectedAt ? <span>Last connected {bookmark.lastConnectedAt}</span> : null}
                </div>
                {bookmark.id === store.connectedNavidromeBookmarkId ? <Badge tone="ok">Connected</Badge> : null}
                <label className="shell__bookmark-open">
                  <Switch
                    label={`Connect to ${bookmark.name} on open`}
                    checked={bookmark.connectOnOpen}
                    onChange={(checked) => setNavidromeBookmarkConnectOnOpen(bookmark.id, checked)}
                  />
                  <span>On open</span>
                </label>
                <Button size="sm" onClick={() => connectNavidromeBookmark(bookmark)} disabled={store.isConnectingNavidrome}>Connect</Button>
                <IconButton label={`Delete ${bookmark.name}`} size="sm" onClick={() => deleteNavidromeBookmark(bookmark.id)}><IconTrash /></IconButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Dialog>
  );
}
