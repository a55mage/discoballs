import { beforeEach, describe, expect, it, vi } from "vitest";

function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
      setItem: (key: string, value: string) => void data.set(key, String(value)),
      removeItem: (key: string) => void data.delete(key),
    },
  });
  return data;
}

async function loadStore() {
  vi.resetModules();
  return (await import("../store/playlistStore")).usePlaylistStore;
}

describe("playlistStore", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty", async () => {
    installStorage();
    const state = (await loadStore()).getState();
    expect(state.playlists).toEqual([]);
    expect(state.activePlaylistId).toBe("");
  });

  it("restores playlists and falls back to the first when the saved active id is stale", async () => {
    installStorage({
      "musicmanager-playlists": JSON.stringify([
        { id: "a", name: "A", entries: [] },
        { id: "b", name: "B", entries: [] },
      ]),
      "musicmanager-active-playlist-id": "gone",
    });
    const state = (await loadStore()).getState();
    expect(state.activePlaylistId).toBe("a");
    expect(state.playlistNameDraft).toBe("A");
  });

  it("creates playlists with unique names and persists them", async () => {
    const data = installStorage();
    const store = await loadStore();
    store.getState().createPlaylist();
    store.getState().createPlaylist();
    const names = store.getState().playlists.map((playlist) => playlist.name);
    expect(names).toEqual(["New Playlist", "New Playlist (2)"]);
    expect(JSON.parse(data.get("musicmanager-playlists") as string)).toHaveLength(2);
    expect(data.get("musicmanager-active-playlist-id")).toBe(store.getState().activePlaylistId);
  });

  it("creates a playlist when a track is added with none active", async () => {
    installStorage();
    const store = await loadStore();
    store.getState().insertTrack("t1");
    expect(store.getState().playlists).toHaveLength(1);
    expect(store.getState().playlists[0].entries.map((entry) => entry.trackId)).toEqual(["t1"]);
  });

  it("inserts before an entry, appends, moves and removes entries", async () => {
    installStorage();
    const store = await loadStore();
    store.getState().createPlaylist();
    store.getState().appendTracks(["a", "b", "c"]);
    const ids = () => store.getState().playlists[0].entries.map((entry) => entry.trackId);
    expect(ids()).toEqual(["a", "b", "c"]);
    const entryB = store.getState().playlists[0].entries[1].id;
    store.getState().insertTrack("x", entryB);
    expect(ids()).toEqual(["a", "x", "b", "c"]);
    const entryA = store.getState().playlists[0].entries[0].id;
    store.getState().moveEntry(entryA, null);
    expect(ids()).toEqual(["x", "b", "c", "a"]);
    const entryC = store.getState().playlists[0].entries[2].id;
    store.getState().removeEntry(entryC);
    expect(ids()).toEqual(["x", "b", "a"]);
  });

  it("renames with a unique name and handles the two-step rename button", async () => {
    installStorage();
    const store = await loadStore();
    store.getState().createPlaylist();
    store.getState().createPlaylist();
    const second = store.getState().activePlaylistId;
    store.getState().renameButtonClick();
    expect(store.getState().isPlaylistRenaming).toBe(true);
    store.getState().setPlaylistNameDraft("new playlist");
    store.getState().renameButtonClick();
    expect(store.getState().isPlaylistRenaming).toBe(false);
    expect(store.getState().playlists.find((playlist) => playlist.id === second)?.name).toBe("new playlist (2)");
  });

  it("selects another playlist after deleting the active one", async () => {
    const data = installStorage();
    const store = await loadStore();
    store.getState().createPlaylist();
    store.getState().createPlaylist();
    store.getState().deleteActivePlaylist();
    expect(store.getState().playlists).toHaveLength(1);
    expect(store.getState().activePlaylistId).toBe(store.getState().playlists[0].id);
    store.getState().deleteActivePlaylist();
    expect(store.getState().activePlaylistId).toBe("");
    expect(data.has("musicmanager-active-playlist-id")).toBe(false);
  });
});
