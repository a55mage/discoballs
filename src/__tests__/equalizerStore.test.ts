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

async function loadStores() {
  vi.resetModules();
  const equalizer = (await import("../store/equalizerStore")).useEqualizerStore;
  const settings = (await import("../store/settingsStore")).useSettingsStore;
  return { equalizer, settings };
}

const customPreset = {
  id: "eq-custom",
  name: "Mine",
  bandGains: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  preampDb: -2,
  wetMixPercent: 80,
};

describe("equalizerStore", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts on the flat preset", async () => {
    installStorage();
    const { equalizer } = await loadStores();
    const state = equalizer.getState();
    expect(state.equalizerPresetId).toBe("flat");
    expect(state.equalizerBandGains).toEqual(new Array(10).fill(0));
    expect(state.equalizerPresets.length).toBeGreaterThan(5);
  });

  it("restores custom presets, ignoring invalid entries and keeping built-ins", async () => {
    installStorage({
      "musicmanager-eq-presets": JSON.stringify([
        customPreset,
        { id: "bad", name: "Bad", bandGains: [1, 2] },
        { id: "flat", name: "Hacked flat", bandGains: new Array(10).fill(5), preampDb: 0, wetMixPercent: 100 },
      ]),
    });
    const { equalizer } = await loadStores();
    const presets = equalizer.getState().equalizerPresets;
    expect(presets.some((preset) => preset.id === "eq-custom")).toBe(true);
    expect(presets.some((preset) => preset.id === "bad")).toBe(false);
    expect(presets.find((preset) => preset.id === "flat")?.name).toBe("Flat");
  });

  it("loads the startup preset over the last used values", async () => {
    installStorage({
      "musicmanager-eq-presets": JSON.stringify([customPreset]),
      "musicmanager-startup-eq-preset-id": "eq-custom",
      "musicmanager-eq-preset-id": "flat",
    });
    const { equalizer } = await loadStores();
    const state = equalizer.getState();
    expect(state.equalizerPresetId).toBe("eq-custom");
    expect(state.equalizerBandGains[9]).toBe(10);
    expect(state.equalizerPreampDb).toBe(-2);
    expect(state.equalizerWetMixPercent).toBe(80);
  });

  it("restores the last used values when no startup preset is set", async () => {
    installStorage({
      "musicmanager-eq-preset-name": "Tweaked",
      "musicmanager-eq-band-gains": JSON.stringify([20, -20, 0, 0, 0, 0, 0, 0, 0, 0]),
      "musicmanager-eq-preamp-db": "3.5",
      "musicmanager-eq-wet-mix": "40",
    });
    const { equalizer } = await loadStores();
    const state = equalizer.getState();
    expect(state.equalizerPresetName).toBe("Tweaked");
    expect(state.equalizerBandGains.slice(0, 2)).toEqual([12, -12]);
    expect(state.equalizerPreampDb).toBe(3.5);
    expect(state.equalizerWetMixPercent).toBe(40);
  });

  it("clamps band, preamp and wet mix values", async () => {
    installStorage();
    const { equalizer } = await loadStores();
    equalizer.getState().setEqualizerBandGain(0, 99);
    equalizer.getState().setEqualizerPreampDb(-99);
    equalizer.getState().setEqualizerWetMixPercent(150.4);
    const state = equalizer.getState();
    expect(state.equalizerBandGains[0]).toBe(12);
    expect(state.equalizerPreampDb).toBe(-12);
    expect(state.equalizerWetMixPercent).toBe(100);
  });

  it("changing the preset disables Auto EQ", async () => {
    installStorage();
    const { equalizer, settings } = await loadStores();
    settings.getState().setAudioAutoEq(true);
    equalizer.getState().changePreset("genre-rock");
    expect(settings.getState().audioAutoEq).toBe(false);
    expect(equalizer.getState().equalizerPresetId).toBe("genre-rock");
    expect(equalizer.getState().equalizerPresetName).toBe("Rock");
  });

  it("creates, renames, saves and deletes custom presets", async () => {
    const data = installStorage();
    const { equalizer } = await loadStores();
    const builtinCount = equalizer.getState().equalizerPresets.length;
    equalizer.getState().createPreset();
    let state = equalizer.getState();
    expect(state.equalizerPresets).toHaveLength(builtinCount + 1);
    expect(state.isEqualizerPresetRenaming).toBe(true);
    const createdId = state.equalizerPresetId;

    equalizer.getState().setEqualizerPresetName("Bass lover");
    equalizer.getState().renameButtonClick();
    state = equalizer.getState();
    expect(state.isEqualizerPresetRenaming).toBe(false);
    expect(state.equalizerPresets.find((preset) => preset.id === createdId)?.name).toBe("Bass lover");

    equalizer.getState().setEqualizerBandGain(0, 6);
    equalizer.getState().savePreset();
    expect(equalizer.getState().equalizerPresets.find((preset) => preset.id === createdId)?.bandGains[0]).toBe(6);
    expect(JSON.parse(data.get("musicmanager-eq-presets") as string)).toHaveLength(builtinCount + 1);

    equalizer.getState().deletePreset();
    state = equalizer.getState();
    expect(state.equalizerPresets).toHaveLength(builtinCount);
    expect(state.equalizerPresetId).toBe("flat");
  });

  it("never renames or deletes built-in presets", async () => {
    installStorage();
    const { equalizer } = await loadStores();
    equalizer.getState().changePreset("genre-rock");
    const before = equalizer.getState().equalizerPresets.length;
    equalizer.getState().renameButtonClick();
    expect(equalizer.getState().isEqualizerPresetRenaming).toBe(false);
    equalizer.getState().deletePreset();
    expect(equalizer.getState().equalizerPresets).toHaveLength(before);
    // Saving a built-in preset creates a custom copy instead.
    equalizer.getState().savePreset();
    expect(equalizer.getState().equalizerPresets).toHaveLength(before + 1);
  });

  it("fills the genre map from the library without overwriting user choices", async () => {
    installStorage();
    const { equalizer } = await loadStores();
    equalizer.getState().syncGenreEqMap([
      { key: "heavy metal", label: "Heavy Metal" },
      { key: "weird", label: "Weird" },
    ]);
    let map = equalizer.getState().genreEqPresetMap;
    expect(map["heavy metal"]).toBe("genre-metal");
    expect(map["weird"]).toBe("flat");
    expect(map["__default_no_genre__"]).toBe("flat");
    equalizer.getState().setGenreEqPreset("heavy metal", "warm");
    equalizer.getState().syncGenreEqMap([{ key: "heavy metal", label: "Heavy Metal" }]);
    map = equalizer.getState().genreEqPresetMap;
    expect(map["heavy metal"]).toBe("warm");
  });

  it("falls back when a stored preset id no longer exists", async () => {
    installStorage();
    const { equalizer } = await loadStores();
    equalizer.getState().setEqualizerPresetIdRaw("ghost");
    expect(equalizer.getState().equalizerPresetId).toBe("");
  });
});
