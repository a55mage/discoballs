import { type FormEvent, useEffect, useRef } from "react";
import { IconClose, IconGlobe, IconTrash } from "../components/icons";
import {
  connectNavidromeBookmark,
  connectNavidromeFromForm,
  deleteNavidromeBookmark,
  saveNavidromeBookmark,
  setNavidromeBookmarkConnectOnOpen,
} from "../actions/navidrome";
import { useNavidromeStore } from "../store/navidromeStore";
import { Badge, Button, Field, IconButton, Switch, TextInput } from "../ui";

/** Add, save and connect to Navidrome servers. Opened from the library toolbar or the sidebar. */
export function NavidromeDialog() {
  const store = useNavidromeStore();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (store.isNavidromePanelOpen) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      firstFieldRef.current?.focus();
    } else {
      returnFocusRef.current?.focus?.();
    }
  }, [store.isNavidromePanelOpen]);

  if (!store.isNavidromePanelOpen) {
    return null;
  }

  const close = () => store.setIsNavidromePanelOpen(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    connectNavidromeFromForm();
  }

  return (
    <div
      className="shell__dialog-layer"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="shell__palette-scrim" onClick={close} aria-hidden="true" />
      <div className="shell__dialog" role="dialog" aria-modal="true" aria-labelledby="navidrome-title">
        <header className="shell__dialog-head">
          <h2 id="navidrome-title" className="db-text-display">Navidrome</h2>
          <IconButton label="Close" onClick={close}><IconClose /></IconButton>
        </header>

        <form className="shell__dialog-form" onSubmit={onSubmit}>
          <Field label="Name">
            <TextInput ref={firstFieldRef} placeholder="Home server" value={store.navidromeName} onChange={(event) => store.setNavidromeName(event.target.value)} />
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
      </div>
    </div>
  );
}
