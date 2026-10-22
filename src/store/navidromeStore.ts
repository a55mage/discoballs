import { create } from "zustand";
import { normalizeNavidromeBookmark } from "../domain/navidrome";
import type { NavidromeBookmark } from "../types";
import { readJson, writeJson } from "./storage";
import { fieldSetter, type Setter } from "./util";

const BOOKMARKS_KEY = "musicmanager-navidrome-bookmarks";

/** The server whose library is loaded, bookmarked or not. */
export type ConnectedNavidromeServer = { name: string; baseUrl: string; username: string };

export type NavidromeState = {
  isNavidromePanelOpen: boolean;
  navidromeName: string;
  navidromeBaseUrl: string;
  navidromeUsername: string;
  navidromePassword: string;
  navidromeConnectOnOpen: boolean;
  navidromeBookmarks: NavidromeBookmark[];
  connectedNavidromeBookmarkId: string;
  connectedNavidromeServer: ConnectedNavidromeServer | null;
  navidromeStatus: string;
  isConnectingNavidrome: boolean;
  setIsNavidromePanelOpen: Setter<boolean>;
  setNavidromeName: Setter<string>;
  setNavidromeBaseUrl: Setter<string>;
  setNavidromeUsername: Setter<string>;
  setNavidromePassword: Setter<string>;
  setNavidromeConnectOnOpen: Setter<boolean>;
  setNavidromeBookmarks: Setter<NavidromeBookmark[]>;
  setConnectedNavidromeBookmarkId: Setter<string>;
  setConnectedNavidromeServer: Setter<ConnectedNavidromeServer | null>;
  setNavidromeStatus: Setter<string>;
  setIsConnectingNavidrome: Setter<boolean>;
};

/** True until the startup auto-connection has been handled (set when a bookmark has connectOnOpen). */
let pendingStartupConnection = false;

export function isStartupConnectionPending(): boolean {
  return pendingStartupConnection;
}

export function clearPendingStartupConnection(): void {
  pendingStartupConnection = false;
}

function loadInitialState() {
  const parsed = readJson(BOOKMARKS_KEY);
  const bookmarks = Array.isArray(parsed)
    ? parsed.map(normalizeNavidromeBookmark).filter((bookmark): bookmark is NavidromeBookmark => Boolean(bookmark))
    : [];
  if (!bookmarks.length) {
    return { bookmarks, form: null as NavidromeBookmark | null };
  }
  pendingStartupConnection = bookmarks.some((bookmark) => bookmark.connectOnOpen);
  return { bookmarks, form: bookmarks.find((bookmark) => bookmark.connectOnOpen) ?? bookmarks[0] };
}

const initial = loadInitialState();

export const useNavidromeStore = create<NavidromeState>()((set) => ({
  isNavidromePanelOpen: false,
  navidromeName: initial.form?.name ?? "",
  navidromeBaseUrl: initial.form?.baseUrl ?? "",
  navidromeUsername: initial.form?.username ?? "",
  navidromePassword: initial.form?.password ?? "",
  navidromeConnectOnOpen: initial.form?.connectOnOpen ?? false,
  navidromeBookmarks: initial.bookmarks,
  connectedNavidromeBookmarkId: "",
  connectedNavidromeServer: null,
  navidromeStatus: "Navidrome not connected.",
  isConnectingNavidrome: false,
  setIsNavidromePanelOpen: fieldSetter(set, "isNavidromePanelOpen"),
  setNavidromeName: fieldSetter(set, "navidromeName"),
  setNavidromeBaseUrl: fieldSetter(set, "navidromeBaseUrl"),
  setNavidromeUsername: fieldSetter(set, "navidromeUsername"),
  setNavidromePassword: fieldSetter(set, "navidromePassword"),
  setNavidromeConnectOnOpen: fieldSetter(set, "navidromeConnectOnOpen"),
  setNavidromeBookmarks: fieldSetter(set, "navidromeBookmarks"),
  setConnectedNavidromeBookmarkId: fieldSetter(set, "connectedNavidromeBookmarkId"),
  setConnectedNavidromeServer: fieldSetter(set, "connectedNavidromeServer"),
  setNavidromeStatus: fieldSetter(set, "navidromeStatus"),
  setIsConnectingNavidrome: fieldSetter(set, "isConnectingNavidrome"),
}));

writeJson(BOOKMARKS_KEY, useNavidromeStore.getState().navidromeBookmarks);
useNavidromeStore.subscribe((state, previous) => {
  if (state.navidromeBookmarks !== previous.navidromeBookmarks) {
    writeJson(BOOKMARKS_KEY, state.navidromeBookmarks);
  }
});
