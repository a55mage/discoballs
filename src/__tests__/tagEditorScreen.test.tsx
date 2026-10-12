// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OnlineMatch, Track } from "../types";

const saveTrack = vi.fn(async (_id: string, path: string) => ({ path: path.replace("old", "new") }));
const renameTrack = vi.fn(async (path: string) => ({ path: path.replace("old", "renamed") }));
const searchOnline = vi.fn<(query: unknown) => Promise<OnlineMatch[]>>(async () => []);
vi.mock("../api", () => ({
  adapter: {
    saveTrack: (...args: [string, string]) => saveTrack(...args),
    renameTrack: (...args: [string]) => renameTrack(...args),
    searchOnline: (query: unknown) => searchOnline(query),
    getTrackTechnicalInfo: async () => null,
    getAudioSource: async () => "",
    getTrackCoverSource: async () => null,
    openTrackInFileManager: async () => undefined,
  },
}));

import { selectTrack } from "../actions/library";
import { TagEditorScreen } from "../screens/tagEditor/TagEditorScreen";
import { useLibraryStore } from "../store/libraryStore";
import { useSettingsStore } from "../store/settingsStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import { useUiStore } from "../store/uiStore";
import { useTagDraftSync } from "../hooks/useTagDraftSync";

function Harness() {
  useTagDraftSync();
  return <TagEditorScreen />;
}

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: `/Music/old/${id}.mp3`,
  title: `Song ${id}`,
  artist: "Artist",
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: true,
  coverUrl: "c.jpg",
  ...patch,
});

const match = (patch: Partial<OnlineMatch> = {}): OnlineMatch => ({
  id: "m1",
  title: "Song 1",
  artist: "Artist",
  album: "Album",
  date: "2020-05-05",
  source: "iTunes",
  coverUrl: "c.jpg",
  ...patch,
});

function select(id: string) {
  const target = useLibraryStore.getState().tracks.find((item) => item.id === id);
  act(() => selectTrack(target as Track));
}

beforeEach(() => {
  saveTrack.mockClear();
  renameTrack.mockClear();
  searchOnline.mockReset();
  searchOnline.mockResolvedValue([]);
  useLibraryStore.setState({
    folderPath: "/Music",
    selectedTrackId: "",
    tracks: [track("1"), track("2", { genre: "", hasCover: false, coverUrl: undefined })],
  });
  useTagEditorStore.setState({ trackDraft: null, onlineResults: [], selectedResultId: "", isLoadingSearch: false, searchStatus: "Ready", searchTitle: "", searchArtist: "", searchAlbum: "" });
  useSettingsStore.setState({ renameFields: ["tracknumber", "title"], renameSeparator: " - " });
  useUiStore.setState({ toast: null });
});

afterEach(cleanup);

describe("TagEditorScreen", () => {
  it("asks to pick a track when nothing is selected", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Pick a track to edit" })).toBeTruthy();
  });

  it("lists files and flags the ones that need attention", () => {
    render(<Harness />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(within(options[1]).getByRole("img", { name: /No cover, No genre/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Needs attention" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("opens a track from the list and fills the form", () => {
    render(<Harness />);
    fireEvent.click(within(screen.getAllByRole("option")[0]).getByRole("button"));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Song 1");
    expect((screen.getByLabelText("Genre") as HTMLInputElement).value).toBe("Rock");
    expect(screen.getByText("No unsaved changes")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save tags" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tracks unsaved changes by field and can revert them", () => {
    render(<Harness />);
    select("1");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited" } });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "1999" } });
    expect(screen.getByText("2 unsaved changes: Title, Year")).toBeTruthy();
    expect(screen.getByLabelText("Title").className).toContain("db-input--changed");
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Song 1");
    expect(screen.getByText("No unsaved changes")).toBeTruthy();
  });

  it("previews the new file name from the rename pattern", () => {
    render(<Harness />);
    select("1");
    expect(screen.getByText("1 - Song 1.mp3", { selector: "strong" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited" } });
    expect(screen.getByText("1 - Edited.mp3", { selector: "strong" })).toBeTruthy();
  });

  it("saves the tags, adopts the new path and confirms with a toast", async () => {
    render(<Harness />);
    select("1");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save tags" }));
    });
    expect(saveTrack).toHaveBeenCalledTimes(1);
    expect(saveTrack.mock.calls[0][1]).toBe("/Music/old/1.mp3");
    await waitFor(() => expect(useLibraryStore.getState().tracks[0].title).toBe("Edited"));
    expect(useLibraryStore.getState().selectedTrackId).toBe("/Music/new/1.mp3");
    expect(useUiStore.getState().toast?.message).toBe("Tags saved to track");
  });

  it("saves with Ctrl+S", async () => {
    const { container } = render(<Harness />);
    select("1");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited" } });
    await act(async () => {
      fireEvent.keyDown(container.querySelector(".tag-screen") as HTMLElement, { key: "s", ctrlKey: true });
    });
    expect(saveTrack).toHaveBeenCalledTimes(1);
  });

  it("reports a save error as an error toast and keeps the edits", async () => {
    saveTrack.mockRejectedValueOnce(new Error("read-only file system"));
    render(<Harness />);
    select("1");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save tags" }));
    });
    expect(useUiStore.getState().toast).toMatchObject({ tone: "error" });
    expect(useUiStore.getState().toast?.message).toContain("read-only file system");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Edited");
  });

  it("makes remote tracks read-only", () => {
    useLibraryStore.setState({
      tracks: [track("r", { source: { type: "navidrome", baseUrl: "http://s", username: "u", password: "p", songId: "1" } })],
    });
    render(<Harness />);
    select("r");
    expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Tracks of a Navidrome server are read-only.")).toBeTruthy();
  });
});

describe("online matches", () => {
  async function searchWith(results: OnlineMatch[]) {
    searchOnline.mockResolvedValue(results);
    render(<Harness />);
    select("2");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
    });
  }

  it("searches with the fields of the selected track", async () => {
    await searchWith([match()]);
    expect(searchOnline).toHaveBeenCalledWith({ title: "Song 2", artist: "Artist", album: "Album" });
    expect(screen.getByText(/Online results: 1/)).toBeTruthy();
  });

  it("shows what a result would change and applies it to the draft", async () => {
    await searchWith([match({ id: "a", title: "Song Two", album: "Better Album", date: "2021-01-01", coverUrl: "new.jpg" })]);
    const diffs = within(screen.getByRole("list", { name: "Changes" }));
    expect(diffs.getByText("Song Two")).toBeTruthy();
    expect(diffs.getByText("Better Album")).toBeTruthy();
    expect(diffs.getByText("Result cover")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Song Two");
    expect((screen.getByLabelText("Album") as HTMLInputElement).value).toBe("Better Album");
    expect(screen.getByText(/unsaved changes?: Title, Album, Year/)).toBeTruthy();
    expect(screen.getByText("Already identical to this result.")).toBeTruthy();
    expect(saveTrack).not.toHaveBeenCalled();
  });

  it("marks the best match and orders it first", async () => {
    await searchWith([
      match({ id: "x", title: "Song 2 (Live)", date: "2010-01-01" }),
      match({ id: "y", title: "Song 2", date: "2020-01-01" }),
    ]);
    const cards = screen.getAllByRole("listitem").filter((item) => item.classList.contains("tag-match"));
    expect(cards[0].textContent).toContain("Best match");
    expect(within(cards[0]).getByText("Song 2")).toBeTruthy();
  });

  it("applies and saves in one step", async () => {
    await searchWith([match({ id: "a", title: "Song Two", date: "2021-01-01" })]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply and save" }));
    });
    expect(saveTrack).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(useLibraryStore.getState().tracks[1].title).toBe("Song Two"));
    expect(useUiStore.getState().toast?.message).toBe("Result applied and tags saved to track");
  });

  it("only applies the cover when asked", async () => {
    await searchWith([match({ id: "a", title: "Other Title", coverUrl: "new.jpg" })]);
    fireEvent.click(screen.getByRole("button", { name: "Apply cover only" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Song 2");
    expect(screen.getByText("1 unsaved change: Cover")).toBeTruthy();
  });

  it("explains when nothing was found", async () => {
    await searchWith([]);
    expect(screen.getByText(/No results yet/)).toBeTruthy();
  });
});
