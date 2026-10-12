// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveTrack = vi.fn(async (_id: string, path: string) => ({ path }));
vi.mock("../api", () => ({
  adapter: {
    saveTrack: (...args: [string, string]) => saveTrack(...args),
    getTrackTechnicalInfo: async () => null,
    getAudioSource: async () => "",
    getTrackCoverSource: async () => null,
    selectFolderAndScan: async () => ({ folderPath: "", tracks: [] }),
    scanFolder: async () => ({ folderPath: "", tracks: [] }),
    searchOnline: async () => [],
  },
}));

import { LibraryInspector } from "../screens/library/LibraryInspector";
import { LibraryScreen } from "../screens/library/LibraryScreen";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
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

function Harness() {
  return (
    <div>
      <LibraryScreen onTogglePlayPause={() => undefined} />
      <LibraryInspector />
    </div>
  );
}

const rows = () => Array.from(document.querySelectorAll<HTMLElement>(".lib-scroll [role=row]"));

beforeEach(() => {
  saveTrack.mockClear();
  useLibraryStore.setState({
    folderPath: "/Music",
    selectedTrackId: "",
    tracks: [
      track("1"),
      track("2", { hasCover: false, genre: "" }),
      track("3", { title: "Song 1", artist: "Artist" }),
      track("4", { album: "Other", artist: "Someone" }),
    ],
  });
  useLibraryViewStore.setState({ tab: "tracks", query: "", filter: "all", scope: null, sortKey: "added", sortDirection: "asc", selectedIds: [], anchorId: "" });
  useUiStore.setState({ toast: null, activeScreen: "library" });
});

afterEach(cleanup);

describe("LibraryScreen", () => {
  it("shows a welcome state when the library is empty", () => {
    useLibraryStore.setState({ tracks: [] });
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Your library is empty" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open music folder" })).toBeTruthy();
  });

  it("lists tracks as an ARIA grid with health counts on the filters", () => {
    render(<Harness />);
    expect(screen.getByRole("grid", { name: "Tracks" })).toBeTruthy();
    expect(rows()).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Missing cover/ }).textContent).toContain("1");
    expect(screen.getByRole("button", { name: /Duplicates/ }).textContent).toContain("2");
  });

  it("narrows the list with a health filter and with the text filter", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Missing cover/ }));
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByLabelText("Filter library"), { target: { value: "someone" } });
    expect(rows()).toHaveLength(1);
  });

  it("sorts by a column and reflects it in aria-sort", () => {
    render(<Harness />);
    const header = screen.getByRole("columnheader", { name: /Title/ });
    fireEvent.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("descending");
  });

  it("selects one track on click, extends with shift and toggles with ctrl", () => {
    render(<Harness />);
    fireEvent.click(rows()[0]);
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["1"]);
    expect(useLibraryStore.getState().selectedTrackId).toBe("1");
    fireEvent.click(rows()[2], { shiftKey: true });
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["1", "2", "3"]);
    fireEvent.click(rows()[1], { ctrlKey: true });
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["1", "3"]);
    expect(rows()[1].getAttribute("aria-selected")).toBe("false");
  });

  it("moves the selection with the arrow keys and selects all with Ctrl+A", () => {
    render(<Harness />);
    const grid = screen.getByRole("grid", { name: "Tracks" }).querySelector(".lib-scroll") as HTMLElement;
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["1"]);
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["2"]);
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["2", "3"]);
    fireEvent.keyDown(grid, { key: "a", ctrlKey: true });
    expect(useLibraryViewStore.getState().selectedIds).toHaveLength(4);
  });

  it("opens an album from the Albums tab as a removable filter", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Albums" }));
    fireEvent.click(screen.getByRole("button", { name: /Other/ }));
    expect(useLibraryViewStore.getState().tab).toBe("tracks");
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Remove filter/ }));
    expect(rows()).toHaveLength(4);
  });
});

describe("LibraryInspector", () => {
  it("shows an empty hint, then the selected track with its issues", () => {
    render(<Harness />);
    expect(screen.getByText("Select a track to inspect it")).toBeTruthy();
    fireEvent.click(rows()[1]);
    expect(screen.getByRole("heading", { name: "Song 2" })).toBeTruthy();
    expect(screen.getByText("No cover")).toBeTruthy();
    expect(screen.getByText("No genre")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fix with online match" })).toBeTruthy();
  });

  it("batch-edits the selection, leaving empty fields alone", async () => {
    render(<Harness />);
    fireEvent.click(rows()[0]);
    fireEvent.click(rows()[1], { shiftKey: true });
    expect(screen.getByRole("heading", { name: "2 tracks selected" })).toBeTruthy();

    const apply = screen.getByRole("button", { name: "Apply to 2 tracks" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Genre"), { target: { value: "Folk" } });
    expect(apply.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(apply);
    });

    await waitFor(() => expect(saveTrack).toHaveBeenCalledTimes(2));
    expect(useLibraryStore.getState().tracks.slice(0, 2).map((t) => t.genre)).toEqual(["Folk", "Folk"]);
    expect(useLibraryStore.getState().tracks[0].artist).toBe("Artist");
    expect(useUiStore.getState().toast?.message).toBe("2 tracks updated");
  });

  it("numbers the tracks in list order when asked", async () => {
    render(<Harness />);
    fireEvent.click(rows()[0]);
    fireEvent.click(rows()[2], { shiftKey: true });
    fireEvent.click(screen.getByRole("switch", { name: "Auto-number tracks" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply to 3 tracks" }));
    });
    await waitFor(() => expect(saveTrack).toHaveBeenCalledTimes(3));
    expect(useLibraryStore.getState().tracks.slice(0, 3).map((t) => t.tracknumber)).toEqual(["1", "2", "3"]);
  });

  it("keeps going and reports when a file cannot be saved", async () => {
    saveTrack.mockRejectedValueOnce(new Error("disk is read-only"));
    render(<Harness />);
    fireEvent.click(rows()[0]);
    fireEvent.click(rows()[1], { shiftKey: true });
    fireEvent.change(screen.getByLabelText("Album"), { target: { value: "New album" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply to 2 tracks" }));
    });
    await waitFor(() => expect(saveTrack).toHaveBeenCalledTimes(2));
    const toast = useUiStore.getState().toast;
    expect(toast?.tone).toBe("error");
    expect(toast?.message).toContain("1 updated, 1 failed");
    expect(useLibraryStore.getState().tracks[1].album).toBe("New album");
    expect(useLibraryStore.getState().tracks[0].album).toBe("Album");
  });
});
