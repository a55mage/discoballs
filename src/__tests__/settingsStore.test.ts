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
    expect(state.startupScreen).toBe("library");
    expect(state.renameFields).toEqual(["tracknumber", "artist", "title"]);
    expect(state.renameSeparator).toBe(" - ");
    expect(state.nowPlayingShow).toEqual(["cover", "lyrics"]);
    expect(state.nowPlayingQueue).toBe(true);
    expect(state.accentIndex).toBe(0);
  });

  it("restores persisted values using the legacy keys", async () => {
    installStorage({
      "musicmanager-color-mode": "dark",
      "musicmanager-startup-screen": "player",
      "musicmanager-rename-fields": JSON.stringify(["artist", "bogus", "title"]),
      "musicmanager-rename-separator": "_",
      "musicmanager-player-visualizer-preset": "turntable",
      "musicmanager-audio-auto-eq": "true",
    });
    const state = (await loadStore()).getState();
    expect(state.colorMode).toBe("dark");
    expect(state.startupScreen).toBe("player");
    expect(state.renameFields).toEqual(["artist", "title"]);
    expect(state.renameSeparator).toBe("_");
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

  it("always keeps at least one Now Playing part, in display order", async () => {
    installStorage();
    const store = await loadStore();
    store.getState().setNowPlayingShow(["viz", "cover"]);
    expect(store.getState().nowPlayingShow).toEqual(["cover", "viz"]);
    store.getState().setNowPlayingShow([]);
    expect(store.getState().nowPlayingShow).toEqual(["cover", "lyrics"]);
    store.getState().setNowPlayingShow(["bogus" as never]);
    expect(store.getState().nowPlayingShow).toEqual(["cover", "lyrics"]);
  });

  it("restores the Now Playing layout", async () => {
    installStorage({ "musicmanager-now-playing-show": JSON.stringify(["lyrics"]), "musicmanager-now-playing-queue": "false" });
    const state = (await loadStore()).getState();
    expect(state.nowPlayingShow).toEqual(["lyrics"]);
    expect(state.nowPlayingQueue).toBe(false);
  });

  it("migrates the column toggles of version 1.x to Now Playing parts", async () => {
    installStorage({
      "musicmanager-player-columns": JSON.stringify({ library: true, visualizer: true, queue: false }),
      "musicmanager-player-show-lyrics": "false",
    });
    const state = (await loadStore()).getState();
    expect(state.nowPlayingShow).toEqual(["cover", "viz"]);
    expect(state.nowPlayingQueue).toBe(false);
  });

  it("migrates a hidden-everything legacy layout to something visible", async () => {
    installStorage({
      "musicmanager-player-columns": JSON.stringify({ library: false, visualizer: false, queue: false }),
      "musicmanager-player-show-lyrics": "false",
    });
    const state = (await loadStore()).getState();
    expect(state.nowPlayingShow.length).toBeGreaterThan(0);
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

describe("settingsStore dynamic background", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to on at 70% and restores stored values", async () => {
    installStorage();
    let state = (await loadStore()).getState();
    expect(state.dynamicBackground).toBe(true);
    expect(state.backgroundIntensity).toBe(70);

    installStorage({ "musicmanager-dynamic-background": "false", "musicmanager-background-intensity": "25" });
    state = (await loadStore()).getState();
    expect(state.dynamicBackground).toBe(false);
    expect(state.backgroundIntensity).toBe(25);
  });

  it("clamps the intensity and falls back on invalid stored values", async () => {
    installStorage({ "musicmanager-background-intensity": "abc" });
    const store = await loadStore();
    expect(store.getState().backgroundIntensity).toBe(70);
    store.getState().setBackgroundIntensity(250);
    expect(store.getState().backgroundIntensity).toBe(100);
    store.getState().setBackgroundIntensity(-5);
    expect(store.getState().backgroundIntensity).toBe(0);
  });

  it("persists changes", async () => {
    const data = installStorage();
    const store = await loadStore();
    store.getState().setDynamicBackground(false);
    store.getState().setBackgroundIntensity(40);
    expect(data.get("musicmanager-dynamic-background")).toBe("false");
    expect(data.get("musicmanager-background-intensity")).toBe("40");
  });
});
