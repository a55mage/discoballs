// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const startPlaybackSpy = vi.fn();
vi.mock("../api", () => ({
  adapter: { getAudioSource: async () => "", getTrackTechnicalInfo: async () => null, getTrackCoverSource: async () => null },
}));
vi.mock("../utils/audioGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/audioGraph")>()),
  getOrCreateMediaAudioGraph: () => null,
}));

import { PlaylistsScreen } from "../screens/playlists/PlaylistsScreen";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";

const track = (id: string, title: string): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title,
  artist: "Artist",
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: false,
});

const entry = (id: string, trackId: string) => ({ id, trackId });
const titlesInList = () => within(screen.getByRole("list", { name: "Tracks in this playlist" })).getAllByRole("listitem").map((item) => item.querySelector(".pl-entry__title")?.textContent);

beforeEach(() => {
  startPlaybackSpy.mockClear();
  useLibraryStore.setState({ tracks: [track("1", "Alpha"), track("2", "Bravo"), track("3", "Charlie")], selectedTrackId: "" });
  usePlayerStore.setState({ isShuffleEnabled: false, playbackTrackId: "", playbackQueueTrackIds: [], playbackPlaylistId: "" });
  usePlaylistStore.setState({
    playlists: [
      { id: "p1", name: "Road trip", entries: [entry("e1", "1"), entry("e2", "2"), entry("e3", "gone")] },
      { id: "p2", name: "Empty one", entries: [] },
    ],
    activePlaylistId: "p1",
    playlistNameDraft: "Road trip",
    isPlaylistRenaming: false,
  });
});

afterEach(cleanup);

describe("PlaylistsScreen", () => {
  it("invites to create a first playlist", () => {
    usePlaylistStore.setState({ playlists: [], activePlaylistId: "" });
    render(<PlaylistsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Create a playlist" }));
    expect(usePlaylistStore.getState().playlists).toHaveLength(1);
  });

  it("lists the playlists and switches between them", () => {
    render(<PlaylistsScreen />);
    const list = within(screen.getByRole("region", { name: "Playlists" }));
    expect(list.getByRole("button", { name: /Road trip/ }).getAttribute("aria-current")).toBe("true");
    fireEvent.click(list.getByRole("button", { name: /Empty one/ }));
    expect(usePlaylistStore.getState().activePlaylistId).toBe("p2");
    expect(screen.getByText(/Empty playlist/)).toBeTruthy();
  });

  it("shows the tracks in order and flags the ones missing from the library", () => {
    render(<PlaylistsScreen />);
    expect(titlesInList()).toEqual(["Alpha", "Bravo", "Track not in the library"]);
  });

  it("reorders with the move buttons and removes entries", () => {
    render(<PlaylistsScreen />);
    const items = () => within(screen.getByRole("list", { name: "Tracks in this playlist" })).getAllByRole("listitem");
    fireEvent.click(within(items()[1]).getByRole("button", { name: "Move up" }));
    expect(titlesInList()).toEqual(["Bravo", "Alpha", "Track not in the library"]);
    fireEvent.click(within(items()[0]).getByRole("button", { name: "Move down" }));
    expect(titlesInList()).toEqual(["Alpha", "Bravo", "Track not in the library"]);
    fireEvent.click(within(items()[2]).getByRole("button", { name: "Remove from playlist" }));
    expect(titlesInList()).toEqual(["Alpha", "Bravo"]);
    expect(within(items()[0]).getByRole("button", { name: "Move up" }).hasAttribute("disabled")).toBe(true);
  });

  it("renames the playlist inline", () => {
    render(<PlaylistsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Rename playlist" }));
    const input = screen.getByRole("textbox", { name: "Playlist name" });
    fireEvent.change(input, { target: { value: "Summer" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(usePlaylistStore.getState().playlists[0].name).toBe("Summer");
    expect(usePlaylistStore.getState().isPlaylistRenaming).toBe(false);
  });

  it("deletes the playlist", () => {
    render(<PlaylistsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Delete playlist" }));
    expect(usePlaylistStore.getState().playlists.map((playlist) => playlist.id)).toEqual(["p2"]);
  });

  it("plays in order, or shuffled", async () => {
    render(<PlaylistsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });
    expect(usePlayerStore.getState().playbackPlaylistId).toBe("p1");
    expect(usePlayerStore.getState().playbackQueueTrackIds).toEqual(["1", "2"]);
    expect(usePlayerStore.getState().isShuffleEnabled).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    });
    expect(usePlayerStore.getState().isShuffleEnabled).toBe(true);
    expect([...usePlayerStore.getState().playbackQueueTrackIds].sort()).toEqual(["1", "2"]);
  });

  it("does not offer to play when no track of the playlist is available", () => {
    usePlaylistStore.setState({ playlists: [{ id: "p1", name: "Ghosts", entries: [entry("e1", "gone")] }], activePlaylistId: "p1" });
    render(<PlaylistsScreen />);
    expect((screen.getByRole("button", { name: "Play" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("track picker", () => {
  const picker = () => within(screen.getByRole("complementary", { name: "Add tracks" }));

  it("adds a track with a click and marks tracks already in the playlist", () => {
    render(<PlaylistsScreen />);
    expect(picker().getAllByText("Added")).toHaveLength(2);
    fireEvent.click(picker().getByRole("button", { name: "Add Charlie" }));
    expect(usePlaylistStore.getState().playlists[0].entries.map((item) => item.trackId)).toEqual(["1", "2", "gone", "3"]);
  });

  it("filters the library and adds everything that is left in one go", () => {
    usePlaylistStore.setState({ activePlaylistId: "p2", playlistNameDraft: "Empty one" });
    render(<PlaylistsScreen />);
    fireEvent.click(picker().getByRole("button", { name: "Add 3 tracks" }));
    expect(usePlaylistStore.getState().playlists[1].entries.map((item) => item.trackId)).toEqual(["1", "2", "3"]);
  });

  it("narrows the list with the search box", () => {
    usePlaylistStore.setState({ activePlaylistId: "p2", playlistNameDraft: "Empty one" });
    render(<PlaylistsScreen />);
    fireEvent.change(picker().getByLabelText("Search tracks to add"), { target: { value: "ravo" } });
    expect(picker().getAllByRole("button", { name: /^Add (?!\d)/ })).toHaveLength(1);
    fireEvent.click(picker().getByRole("button", { name: "Add 1 track" }));
    expect(usePlaylistStore.getState().playlists[1].entries.map((item) => item.trackId)).toEqual(["2"]);
  });
});
