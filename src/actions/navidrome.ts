import { adapter } from "../api";
import { buildNavidromeBookmarkId, defaultNavidromeBookmarkName } from "../domain/navidrome";
import { useNavidromeStore } from "../store/navidromeStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import type { NavidromeBookmark, NavidromeConnectionInput } from "../types";
import { formatError, getUserLocale } from "../utils/common";
import { applyLoadedLibrary } from "./library";

const navidrome = () => useNavidromeStore.getState();

function getFormInput(): NavidromeConnectionInput | null {
  const { navidromeBaseUrl, navidromeUsername, navidromePassword, navidromeName, setNavidromeStatus } = navidrome();
  const baseUrl = navidromeBaseUrl.trim();
  const username = navidromeUsername.trim();
  if (!baseUrl || !username || !navidromePassword) {
    setNavidromeStatus("Server URL, username and password are required.");
    return null;
  }
  return {
    name: navidromeName.trim() || defaultNavidromeBookmarkName(baseUrl),
    baseUrl,
    username,
    password: navidromePassword,
  };
}

export async function connectToNavidrome(input: NavidromeConnectionInput, bookmarkId = ""): Promise<void> {
  const store = navidrome();
  const editor = useTagEditorStore.getState();
  store.setIsConnectingNavidrome(true);
  store.setNavidromeStatus(`Connecting to ${input.name || input.baseUrl}...`);
  try {
    const result = await adapter.connectNavidrome(input);
    if (!result.ok) {
      store.setConnectedNavidromeBookmarkId("");
      store.setConnectedNavidromeServer(null);
      store.setNavidromeStatus(result.message || "Navidrome connection rejected.");
      return;
    }

    const library = await adapter.scanNavidromeLibrary(input);
    const connectedAt = new Date().toLocaleString(getUserLocale(), { dateStyle: "short", timeStyle: "short" });
    if (bookmarkId) {
      store.setNavidromeBookmarks((prev) =>
        prev.map((bookmark) => (bookmark.id === bookmarkId ? { ...bookmark, lastConnectedAt: connectedAt } : bookmark))
      );
    }
    applyLoadedLibrary(library.folderPath, library.tracks);
    store.setConnectedNavidromeBookmarkId(bookmarkId);
    store.setConnectedNavidromeServer({ name: input.name || input.baseUrl, baseUrl: input.baseUrl, username: input.username });
    store.setIsNavidromePanelOpen(false);
    store.setNavidromeStatus(
      `Connected to ${input.name || input.baseUrl} · loaded ${library.tracks.length} tracks${result.serverVersion ? ` · server ${result.serverVersion}` : ""}${result.apiVersion ? ` · API ${result.apiVersion}` : ""}`
    );
    editor.setSearchStatus(`Navidrome library loaded: ${library.tracks.length} tracks.`);
  } catch (error) {
    store.setConnectedNavidromeBookmarkId("");
    store.setConnectedNavidromeServer(null);
    store.setNavidromeStatus(`Navidrome connection error: ${formatError(error)}`);
  } finally {
    store.setIsConnectingNavidrome(false);
  }
}

export function saveNavidromeBookmark(): void {
  const input = getFormInput();
  if (!input) {
    return;
  }
  const { navidromeConnectOnOpen, setNavidromeBookmarks, setNavidromeStatus } = navidrome();
  setNavidromeBookmarks((prev) => {
    const existing = prev.find((bookmark) => bookmark.baseUrl === input.baseUrl && bookmark.username === input.username);
    const nextBookmark: NavidromeBookmark = {
      ...(existing ?? { id: buildNavidromeBookmarkId() }),
      ...input,
      connectOnOpen: navidromeConnectOnOpen,
    };
    const next = existing
      ? prev.map((bookmark) => (bookmark.id === existing.id ? nextBookmark : bookmark))
      : [...prev, nextBookmark];
    if (!navidromeConnectOnOpen) {
      return next;
    }
    return next.map((bookmark) => ({ ...bookmark, connectOnOpen: bookmark.id === nextBookmark.id }));
  });
  setNavidromeStatus(`Saved bookmark ${input.name}.`);
}

export function connectNavidromeFromForm(): void {
  const input = getFormInput();
  if (!input) {
    return;
  }
  const matching = navidrome().navidromeBookmarks.find(
    (bookmark) => bookmark.baseUrl === input.baseUrl && bookmark.username === input.username
  );
  void connectToNavidrome(input, matching?.id ?? "");
}

export function connectNavidromeBookmark(bookmark: NavidromeBookmark): void {
  const store = navidrome();
  store.setNavidromeName(bookmark.name);
  store.setNavidromeBaseUrl(bookmark.baseUrl);
  store.setNavidromeUsername(bookmark.username);
  store.setNavidromePassword(bookmark.password);
  store.setNavidromeConnectOnOpen(bookmark.connectOnOpen);
  void connectToNavidrome(bookmark, bookmark.id);
}

export function deleteNavidromeBookmark(bookmarkId: string): void {
  const store = navidrome();
  store.setNavidromeBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== bookmarkId));
  if (store.connectedNavidromeBookmarkId === bookmarkId) {
    store.setConnectedNavidromeBookmarkId("");
    store.setNavidromeStatus("Navidrome bookmark removed.");
  }
}

export function setNavidromeBookmarkConnectOnOpen(bookmarkId: string, enabled: boolean): void {
  navidrome().setNavidromeBookmarks((prev) =>
    prev.map((bookmark) => ({
      ...bookmark,
      connectOnOpen: enabled ? bookmark.id === bookmarkId : bookmark.id === bookmarkId ? false : bookmark.connectOnOpen,
    }))
  );
}
