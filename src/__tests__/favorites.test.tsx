// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

vi.mock("../api", () => ({
  adapter: { getTrackTechnicalInfo: async () => null, getAudioSource: async () => "", getTrackCoverSource: async () => null },
}));

import { changeTrackIdentity } from "../actions/trackIdentity";
import { LibraryInspector } from "../screens/library/LibraryInspector";
import { LibraryScreen } from "../screens/library/LibraryScreen";
import { PlayerBar } from "../shell/PlayerBar";
import { Sidebar } from "../shell/Sidebar";
import { CommandPalette } from "../shell/CommandPalette";
import { useFavoritesStore } from "../store/favoritesStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { usePlayerStore } from "../store/playerStore";
import { useUiStore } from "../store/uiStore";
import { Rating } from "../ui";

const track = (id: string, title: string): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title,
  artist: "Artist",
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: true,
});

const rows = () => Array.from(document.querySelectorAll<HTMLElement>(".lib-scroll [role=row]"));
const titles = () => rows().map((row) => row.querySelector(".lib-title")?.textContent);

beforeEach(() => {
  useFavoritesStore.setState({ favorites: [], ratings: {} });
  useLibraryStore.setState({ folderPath: "/m", selectedTrackId: "", tracks: [track("1", "Alpha"), track("2", "Bravo"), track("3", "Charlie")] });
  useLibraryViewStore.setState({ tab: "tracks", query: "", filter: "all", scope: null, sortKey: "added", sortDirection: "asc", selectedIds: [], anchorId: "" });
  usePlayerStore.setState({ playbackTrackId: "", playbackQueueTrackIds: [] });
  useUiStore.setState({ activeScreen: "library", isPaletteOpen: false });
});

afterEach(cleanup);

describe("favoritesStore", () => {
  it("toggles favorites and sets or clears ratings", () => {
    const store = useFavoritesStore.getState();
    store.toggleFavorite("a");
    store.setFavorite("b", true);
    store.setFavorite("b", true);
    expect(useFavoritesStore.getState().favorites).toEqual(["a", "b"]);
    useFavoritesStore.getState().toggleFavorite("a");
    expect(useFavoritesStore.getState().favorites).toEqual(["b"]);

    useFavoritesStore.getState().setRating("a", 4);
    expect(useFavoritesStore.getState().ratings).toEqual({ a: 4 });
    useFavoritesStore.getState().setRating("a", 4);
    expect(useFavoritesStore.getState().ratings).toEqual({});
    useFavoritesStore.getState().setRating("a", 9);
    expect(useFavoritesStore.getState().ratings.a).toBe(5);
    useFavoritesStore.getState().setRating("a", 0);
    expect(useFavoritesStore.getState().ratings).toEqual({});
  });

  it("follows a renamed file", () => {
    useFavoritesStore.setState({ favorites: ["old"], ratings: { old: 3 } });
    useFavoritesStore.getState().retarget("old", "new");
    expect(useFavoritesStore.getState().favorites).toEqual(["new"]);
    expect(useFavoritesStore.getState().ratings).toEqual({ new: 3 });
    changeTrackIdentity("new", "newer");
    expect(useFavoritesStore.getState().ratings).toEqual({ newer: 3 });
  });
});

describe("Rating", () => {
  it("is a read-only image without a handler", () => {
    render(<Rating value={3} label="Rating of Alpha" />);
    expect(screen.getByRole("img", { name: "Rating of Alpha: 3 of 5" })).toBeTruthy();
  });

  it("offers five buttons that report the star clicked", () => {
    const onChange = vi.fn();
    render(<Rating value={2} onChange={onChange} label="Rating of Alpha" />);
    const group = screen.getByRole("group", { name: "Rating of Alpha" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true", "false", "false", "false"]);
    fireEvent.click(within(group).getByRole("button", { name: "4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe("in the library", () => {
  it("rates and favorites straight from the list without selecting the row", () => {
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    fireEvent.click(within(rows()[1]).getByRole("button", { name: "5 stars" }));
    fireEvent.click(within(rows()[1]).getByRole("button", { name: "Add Bravo to favorites" }));
    expect(useFavoritesStore.getState().ratings).toEqual({ "2": 5 });
    expect(useFavoritesStore.getState().favorites).toEqual(["2"]);
    expect(useLibraryViewStore.getState().selectedIds).toEqual([]);
    expect(within(rows()[1]).getByRole("button", { name: "Remove Bravo from favorites" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("filters on favorites and lets you remove the filter", () => {
    useFavoritesStore.setState({ favorites: ["1", "3"], ratings: {} });
    useLibraryViewStore.setState({ filter: "favorites" });
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    expect(titles()).toEqual(["Alpha", "Charlie"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Favorites" }));
    expect(titles()).toHaveLength(3);
  });

  it("sorts by rating, unrated first when ascending", () => {
    useFavoritesStore.setState({ favorites: [], ratings: { "1": 5, "3": 2 } });
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    const header = screen.getByRole("columnheader", { name: /Rating/ });
    fireEvent.click(within(header).getByRole("button"));
    expect(titles()).toEqual(["Bravo", "Charlie", "Alpha"]);
    fireEvent.click(within(header).getByRole("button"));
    expect(titles()).toEqual(["Alpha", "Charlie", "Bravo"]);
  });

  it("rates and favorites a track from the inspector", () => {
    render(
      <>
        <LibraryScreen onTogglePlayPause={() => undefined} />
        <LibraryInspector />
      </>
    );
    fireEvent.click(rows()[0]);
    const inspector = within(screen.getByRole("complementary", { name: "Track inspector" }));
    fireEvent.click(inspector.getByRole("button", { name: "3 stars" }));
    fireEvent.click(inspector.getByRole("button", { name: "Add to favorites" }));
    expect(useFavoritesStore.getState()).toMatchObject({ ratings: { "1": 3 }, favorites: ["1"] });
  });
});

describe("elsewhere", () => {
  it("favorites the playing track from the player bar", () => {
    usePlayerStore.setState({ playbackTrackId: "2" });
    render(<PlayerBar onTogglePlayPause={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
    expect(useFavoritesStore.getState().favorites).toEqual(["2"]);
    expect(screen.getByRole("button", { name: "Remove from favorites" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens the favorites from the sidebar", () => {
    useFavoritesStore.setState({ favorites: ["1"], ratings: {} });
    useUiStore.setState({ activeScreen: "player" });
    useLibraryViewStore.setState({ scope: { kind: "artist", artist: "x" }, tab: "albums" });
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    expect(useUiStore.getState().activeScreen).toBe("library");
    expect(useLibraryViewStore.getState()).toMatchObject({ filter: "favorites", scope: null, tab: "tracks" });
  });

  it("toggles the current track from the command palette", () => {
    useLibraryStore.setState({ selectedTrackId: "3" });
    render(<CommandPalette onTogglePlayPause={() => undefined} />);
    act(() => useUiStore.getState().setPaletteOpen(true));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "favorites" } });
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(useFavoritesStore.getState().favorites).toEqual(["3"]);
  });
});
