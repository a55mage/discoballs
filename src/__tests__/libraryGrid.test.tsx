// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({
  adapter: {
    getTrackTechnicalInfo: async () => null,
    getAudioSource: async () => "",
    getTrackCoverSource: async () => null,
    selectFolderAndScan: async () => ({ folderPath: "", tracks: [] }),
    scanFolder: async () => ({ folderPath: "", tracks: [] }),
  },
}));

import { LibraryScreen } from "../screens/library/LibraryScreen";
import { Header } from "../shell/Header";
import { useFavoritesStore } from "../store/favoritesStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { useNavidromeStore } from "../store/navidromeStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import type { Track } from "../types";

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: `/Music/${id}.mp3`,
  title: `Song ${id}`,
  artist: "Artist",
  album: "Album",
  tracknumber: "",
  year: "2020",
  genre: "Rock",
  hasCover: true,
  ...patch,
});

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".lib-grid [role=gridcell]"));

beforeEach(() => {
  useLibraryStore.setState({ folderPath: "/Music", selectedTrackId: "", tracks: [track("1"), track("2"), track("3", { artist: "" })] });
  useLibraryViewStore.setState({ tab: "tracks", query: "", filter: "all", scope: null, sortKey: "title", sortDirection: "asc", selectedIds: [], anchorId: "" });
  useSettingsStore.setState({ listDensity: "grid" });
  useFavoritesStore.setState({ favorites: [], ratings: {} });
});

afterEach(cleanup);

describe("grid view of the library", () => {
  it("shows one card per track with title and artist", () => {
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    expect(screen.getByRole("grid", { name: "Tracks" })).toBeTruthy();
    expect(cards()).toHaveLength(3);
    expect(within(cards()[0]).getByText("Song 1")).toBeTruthy();
    expect(within(cards()[2]).getByText("Unknown artist")).toBeTruthy();
  });

  it("selects on click, extends with shift and favorites from the card", () => {
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    fireEvent.click(cards()[0]);
    fireEvent.click(cards()[2], { shiftKey: true });
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["1", "2", "3"]);
    fireEvent.click(within(cards()[1]).getByRole("button", { name: "Add Song 2 to favorites" }));
    expect(useFavoritesStore.getState().favorites).toEqual(["2"]);
  });

  it("moves the cursor with the arrow keys", () => {
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    const grid = screen.getByRole("grid", { name: "Tracks" });
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(grid.getAttribute("aria-activedescendant")).toBeTruthy();
    expect(useLibraryViewStore.getState().selectedIds).toHaveLength(1);
  });

  it("switches between the three list styles and offers sorting only for the grid", () => {
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    expect(screen.getByLabelText("Sort by")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Compact rows" }));
    expect(useSettingsStore.getState().listDensity).toBe("compact");
    expect(screen.queryByLabelText("Sort by")).toBeNull();
    expect(document.querySelector(".lib-grid")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Grid of covers" }));
    expect(document.querySelector(".lib-grid")).toBeTruthy();
  });

  it("sorts from the toolbar", () => {
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /Ascending/ }));
    expect(useLibraryViewStore.getState().sortDirection).toBe("desc");
    expect(within(cards()[0]).getByText("Song 3")).toBeTruthy();
  });
});

describe("header", () => {
  it("has the logo next to the app name (no section title) and separate buttons for folders and servers", () => {
    useUiStore.setState({ activeScreen: "library" });
    useNavidromeStore.setState({ isNavidromePanelOpen: false });
    const rotate = vi.fn();
    render(<Header onBrandClick={rotate} />);
    expect(screen.getByRole("heading", { name: "DiscoBalls" })).toBeTruthy();
    expect(screen.queryByText("Browse and manage your music")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /change accent color/ }));
    expect(rotate).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open folder" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Connect server" }));
    expect(useNavidromeStore.getState().isNavidromePanelOpen).toBe(true);
  });
});
