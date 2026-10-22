// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const pickFolder = vi.fn(async () => "/picked");
vi.mock("../api", () => ({ adapter: { pickFolder: () => pickFolder() } }));
vi.mock("../utils/audioGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/audioGraph")>()),
  getOrCreateMediaAudioGraph: () => null,
}));

import { EQUALIZER_PRESETS } from "../utils/audioGraph";
import { buildEqCurvePath, averageGain, formatBandFrequency, formatGain } from "../domain/equalizerCurve";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { useEqualizerStore } from "../store/equalizerStore";
import { useLibraryStore } from "../store/libraryStore";
import { useNavidromeStore } from "../store/navidromeStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";

const track = (genre: string): Track => ({
  id: genre || "none",
  path: `/m/${genre}.mp3`,
  title: "T",
  artist: "A",
  album: "B",
  tracknumber: "1",
  year: "2020",
  genre,
  hasCover: false,
});

beforeEach(() => {
  pickFolder.mockClear();
  useEqualizerStore.setState({
    equalizerPresets: EQUALIZER_PRESETS.map((preset) => ({ ...preset, bandGains: [...preset.bandGains] })),
    equalizerPresetId: "flat",
    equalizerPresetName: "Flat",
    equalizerBandGains: new Array(10).fill(0),
    isEqualizerPresetRenaming: false,
    genreEqPresetMap: {},
  });
  useUiStore.setState({ settingsTab: "general", isPaletteOpen: false });
  useLibraryStore.setState({ tracks: [track("Rock"), track("Jazz")], folderPath: "/Music", selectedTrackId: "" });
  useSettingsStore.setState({
    colorMode: "light",
    startupScreen: "library",
    listDensity: "list",
    dynamicBackground: true,
    backgroundIntensity: 70,
    autoOpenDefaultFolder: false,
    defaultFolderPath: "",
    audioAutoEq: false,
    renameFields: ["tracknumber", "artist", "title"],
    renameSeparator: " - ",
  });
});

afterEach(cleanup);

const tab = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("SettingsScreen navigation", () => {
  it("shows one section at a time and marks the current one", () => {
    render(<SettingsScreen />);
    expect(screen.getByRole("heading", { name: "General" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "General" }).getAttribute("aria-current")).toBe("page");
    tab("Appearance");
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(useUiStore.getState().settingsTab).toBe("appearance");
    expect(screen.queryByRole("heading", { name: "General" })).toBeNull();
  });

  it("opens on the section requested elsewhere in the app", () => {
    useUiStore.setState({ settingsTab: "renaming" });
    render(<SettingsScreen />);
    expect(screen.getByRole("heading", { name: "File renaming" })).toBeTruthy();
  });
});

describe("General", () => {
  it("changes the start screen", () => {
    render(<SettingsScreen />);
    fireEvent.change(screen.getByRole("combobox", { name: "Start screen" }), { target: { value: "player" } });
    expect(useSettingsStore.getState().startupScreen).toBe("player");
  });

  it("shows the version and the project links", () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/DiscoBalls v\d+\.\d+\.\d+/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Website" })).toBeTruthy();
  });
});

describe("Appearance", () => {
  beforeEach(() => useUiStore.setState({ settingsTab: "appearance" }));

  it("switches theme and list density", () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(useSettingsStore.getState().colorMode).toBe("dark");
    fireEvent.click(screen.getByRole("radio", { name: "Grid" }));
    expect(useSettingsStore.getState().listDensity).toBe("grid");
  });

  it("turns the dynamic background off, which disables its intensity", () => {
    render(<SettingsScreen />);
    const intensity = screen.getByRole("slider", { name: "Background intensity" }) as HTMLInputElement;
    expect(intensity.disabled).toBe(false);
    fireEvent.change(intensity, { target: { value: "35" } });
    expect(useSettingsStore.getState().backgroundIntensity).toBe(35);
    fireEvent.click(screen.getByRole("switch", { name: "Dynamic background" }));
    expect(useSettingsStore.getState().dynamicBackground).toBe(false);
    expect(intensity.disabled).toBe(true);
  });

  it("selects, adds and removes accent colors", () => {
    render(<SettingsScreen />);
    const before = useSettingsStore.getState().accentThemes.length;
    fireEvent.click(screen.getByRole("button", { name: "Add an accent color" }));
    expect(useSettingsStore.getState().accentThemes).toHaveLength(before + 1);
    expect(useSettingsStore.getState().accentIndex).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(useSettingsStore.getState().accentThemes).toHaveLength(before);
    fireEvent.click(screen.getByRole("button", { name: /^Accent 2,/ }));
    expect(useSettingsStore.getState().accentIndex).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset palette" }));
    expect(useSettingsStore.getState().accentIndex).toBe(0);
  });
});

describe("File renaming", () => {
  beforeEach(() => useUiStore.setState({ settingsTab: "renaming" }));

  it("previews the pattern on an example, then on the selected track", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("3 - Battle Tapes - Solid Gold.mp3")).toBeTruthy();
    act_select({ ...track("Rock"), title: "Harbor Lights", artist: "Marlow Vane", tracknumber: "1" });
    expect(screen.getByText("1 - Marlow Vane - Harbor Lights.mp3")).toBeTruthy();
  });

  it("reorders, removes and adds fields", () => {
    render(<SettingsScreen />);
    const pattern = within(screen.getByRole("list", { name: "Fields in the file name" }));
    fireEvent.click(pattern.getByRole("button", { name: "Move Title earlier" }));
    expect(useSettingsStore.getState().renameFields).toEqual(["tracknumber", "title", "artist"]);
    fireEvent.click(pattern.getByRole("button", { name: "Remove Artist" }));
    expect(useSettingsStore.getState().renameFields).toEqual(["tracknumber", "title"]);
    fireEvent.click(screen.getByRole("button", { name: "Album" }));
    expect(useSettingsStore.getState().renameFields).toEqual(["tracknumber", "title", "album"]);
  });

  it("never lets the last field be removed", () => {
    useSettingsStore.setState({ renameFields: ["title"] });
    render(<SettingsScreen />);
    expect((screen.getByRole("button", { name: "Remove Title" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits the separator by hand or with a preset", () => {
    render(<SettingsScreen />);
    fireEvent.change(screen.getByLabelText("Between fields"), { target: { value: "__" } });
    expect(useSettingsStore.getState().renameSeparator).toBe("__");
    fireEvent.click(screen.getByRole("button", { name: "“ – ”" }));
    expect(useSettingsStore.getState().renameSeparator).toBe(" – ");
  });
});

function act_select(selected: Track) {
  act(() => useLibraryStore.setState({ tracks: [selected], selectedTrackId: selected.id }));
}

describe("Audio & EQ", () => {
  beforeEach(() => useUiStore.setState({ settingsTab: "audio" }));

  it("applies a preset and edits a band", () => {
    render(<SettingsScreen />);
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "genre-rock" } });
    expect(useEqualizerStore.getState().equalizerPresetName).toBe("Rock");
    fireEvent.change(screen.getByRole("slider", { name: "1 kHz gain" }), { target: { value: "6" } });
    expect(useEqualizerStore.getState().equalizerBandGains[5]).toBe(6);
    fireEvent.click(screen.getByRole("button", { name: "Reset to flat" }));
    expect(useEqualizerStore.getState().equalizerBandGains.every((gain) => gain === 0)).toBe(true);
  });

  it("creates and renames a custom preset", () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "New preset from the current settings" }));
    const name = screen.getByLabelText("Preset name");
    fireEvent.change(name, { target: { value: "Bass boost" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(useEqualizerStore.getState().equalizerPresets.some((preset) => preset.name === "Bass boost")).toBe(true);
  });

  it("disables rename and delete for built-in presets", () => {
    render(<SettingsScreen />);
    expect((screen.getByRole("button", { name: "Rename preset" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Delete preset" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("toggles Auto EQ and volume normalization, and marks crossfade as coming soon", () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole("switch", { name: "Auto EQ by genre" }));
    expect(useSettingsStore.getState().audioAutoEq).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "Normalize volume" }));
    expect(useSettingsStore.getState().audioNormalizeVolume).toBe(true);
    expect((screen.getByRole("switch", { name: "Smart crossfade" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("Coming soon")).toHaveLength(1);
  });

  it("maps the genres of the library to presets", () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByText("Genre → preset mapping"));
    fireEvent.change(screen.getByLabelText("Jazz"), { target: { value: "genre-jazz" } });
    expect(useEqualizerStore.getState().genreEqPresetMap["jazz"]).toBe("genre-jazz");
  });
});

describe("Library & servers", () => {
  beforeEach(() => {
    useUiStore.setState({ settingsTab: "library" });
    useNavidromeStore.setState({
      isNavidromePanelOpen: false,
      connectedNavidromeBookmarkId: "n1",
      navidromeBookmarks: [{ id: "n1", name: "Home", baseUrl: "http://home", username: "me", password: "x", connectOnOpen: true }],
    });
  });

  it("chooses and reuses the default folder", async () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Use current" }));
    expect(useSettingsStore.getState().defaultFolderPath).toBe("/Music");
    fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await vi.waitFor(() => expect(useSettingsStore.getState().defaultFolderPath).toBe("/picked"));
  });

  it("lists saved servers and opens the server dialog", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage servers…" }));
    expect(useNavidromeStore.getState().isNavidromePanelOpen).toBe(true);
  });
});

describe("equalizer curve helpers", () => {
  it("draws nothing without bands and a smooth path through the others", () => {
    expect(buildEqCurvePath([])).toBe("");
    const path = buildEqCurvePath([0, 12, -12]);
    expect(path.startsWith("M 0 50")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
  });

  it("formats gains and frequencies", () => {
    expect(averageGain([2, 4])).toBe(3);
    expect(averageGain([])).toBe(0);
    expect(formatGain(3)).toBe("+3.0 dB");
    expect(formatGain(-1.26)).toBe("-1.3 dB");
    expect(formatBandFrequency(31)).toBe("31 Hz");
    expect(formatBandFrequency(16000)).toBe("16 kHz");
  });
});
