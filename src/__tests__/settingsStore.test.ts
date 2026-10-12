import { beforeEach, describe, expect, it, vi } from "vitest";

function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return data;
}

async function loadStore() {
  vi.resetModules();
  return (await import("../store/settingsStore")).useSettingsStore;
}

describe("settingsStore", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses defaults when nothing is stored", async () => {
    installStorage();
    const state = (await loadStore()).getState();
    expect(state.colorMode).toBe("light");
    expect(state.startupScreen).toBe("tagging");
    expect(state.renameFields).toEqual(["tracknumber", "artist", "title"]);
    expect(state.renameSeparator).toBe(" - ");
    expect(state.playerColumnVisibility).toEqual({ library: true, visualizer: true, queue: true });
    expect(state.accentIndex).toBe(0);
  });

  it("restores persisted values using the legacy keys", async () => {
    installStorage({
      "musicmanager-color-mode": "dark",
      "musicmanager-startup-screen": "player",
      "musicmanager-rename-fields": JSON.stringify(["artist", "bogus", "title"]),
      "musicmanager-rename-separator": "_",
      "musicmanager-player-columns": JSON.stringify({ library: false, visualizer: false, queue: false }),
      "musicmanager-player-visualizer-preset": "turntable",
      "musicmanager-audio-auto-eq": "true",
    });
    const state = (await loadStore()).getState();
    expect(state.colorMode).toBe("dark");
    expect(state.startupScreen).toBe("player");
    expect(state.renameFields).toEqual(["artist", "title"]);
    expect(state.renameSeparator).toBe("_");
    expect(state.playerColumnVisibility.visualizer).toBe(true);
    expect(state.playerVisualizerPresetId).toBe("turntable");
    expect(state.audioAutoEq).toBe(true);
  });

  it("rotates the accent on launch and persists the rotated index", async () => {
    const data = installStorage({
      "musicmanager-accent-index": "2",
      "musicmanager-accent-rotate-on-launch": "true",
    });
    const state = (await loadStore()).getState();
    expect(state.accentIndex).toBe(3);
    expect(data.get("musicmanager-accent-index")).toBe("3");
  });

  it("persists changes", async () => {
    const data = installStorage();
    const store = await loadStore();
    store.getState().setColorMode("dark");
    store.getState().setDefaultFolderPath("/music");
    expect(data.get("musicmanager-color-mode")).toBe("dark");
    expect(data.get("musicmanager-default-folder-path")).toBe("/music");
  });

  it("keeps at least one rename field and reorders fields", async () => {
    installStorage();
    const store = await loadStore();
    const { toggleRenameField, moveRenameField } = store.getState();
    toggleRenameField("artist");
    toggleRenameField("title");
    toggleRenameField("tracknumber");
    expect(store.getState().renameFields).toHaveLength(1);
    toggleRenameField("album");
    moveRenameField("album", -1);
    expect(store.getState().renameFields[0]).toBe("album");
  });

  it("refuses to hide every player section", async () => {
    installStorage();
    const store = await loadStore();
    const s = store.getState();
    s.togglePlayerColumn("library");
    s.togglePlayerColumn("visualizer");
    s.togglePlayerColumn("queue");
    s.toggleShowPlayerLyrics();
    // Lyrics stay visible because every column is already hidden.
    expect(store.getState().showPlayerLyricsSection).toBe(true);
    expect(store.getState().playerColumnVisibility).toEqual({ library: false, visualizer: false, queue: false });
    store.getState().togglePlayerColumn("queue");
    expect(store.getState().playerColumnVisibility.queue).toBe(true);
    store.getState().toggleShowPlayerLyrics();
    expect(store.getState().showPlayerLyricsSection).toBe(false);
  });

  it("manages accent themes", async () => {
    installStorage();
    const store = await loadStore();
    const initialCount = store.getState().accentThemes.length;
    store.getState().addAccentTheme();
    expect(store.getState().accentThemes).toHaveLength(initialCount + 1);
    expect(store.getState().accentIndex).toBe(initialCount);
    store.getState().changeAccentColor(initialCount, "not-a-color");
    expect(store.getState().accentThemes[initialCount].accent).toBe("#4f8cff");
    store.getState().changeAccentColor(initialCount, "#112233");
    expect(store.getState().accentThemes[initialCount].accent).toBe("#112233");
    store.getState().removeAccentTheme(initialCount);
    expect(store.getState().accentIndex).toBe(0);
    store.getState().resetAccentThemes();
    expect(store.getState().accentThemes).toHaveLength(initialCount);
  });
});
