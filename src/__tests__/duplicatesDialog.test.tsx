// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const openInFileManager = vi.fn(async (_path: string) => undefined);
vi.mock("../api", () => ({
  adapter: { openTrackInFileManager: (path: string) => openInFileManager(path), getTrackTechnicalInfo: async () => null },
}));

import { DuplicatesDialog } from "../shell/DuplicatesDialog";
import { LibraryScreen } from "../screens/library/LibraryScreen";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { useUiStore } from "../store/uiStore";

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title: "Afterimage",
  artist: "Velvet Circuit",
  album: "Neon Tides",
  tracknumber: "1",
  year: "2017",
  genre: "Electronic",
  hasCover: true,
  ...patch,
});

beforeEach(() => {
  openInFileManager.mockClear();
  useLibraryStore.setState({
    folderPath: "/m",
    tracks: [
      track("copy", { path: "/m/copy/a.mp3", album: "Neon Tides (copy)" }),
      track("flac", { path: "/m/a.flac" }),
      track("solo", { title: "Alone" }),
      track("x1", { title: "Twin", artist: "X" }),
      track("x2", { title: "Twin", artist: "X", path: "/m/x2.mp3" }),
    ],
    selectedTrackId: "",
  });
  useLibraryViewStore.setState({ tab: "tracks", query: "", filter: "all", scope: null, selectedIds: [], anchorId: "", ignoredDuplicates: [] });
  useUiStore.setState({ isDuplicatesOpen: true, toast: null, activeScreen: "tagging" });
});

afterEach(cleanup);

describe("DuplicatesDialog", () => {
  it("lists the groups and suggests keeping the lossless copy", () => {
    render(<DuplicatesDialog />);
    expect(screen.getByText(/2 songs appear more than once/)).toBeTruthy();
    const group = within(screen.getByRole("region", { name: /Afterimage by Velvet Circuit/ }));
    const keep = group.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked);
    expect(keep).toHaveLength(1);
    expect(keep[0].closest("label")?.textContent).toContain("FLAC");
  });

  it("lets the user pick another copy and selects the others", () => {
    render(<DuplicatesDialog />);
    const group = within(screen.getByRole("region", { name: /Afterimage/ }));
    const radios = group.getAllByRole("radio");
    fireEvent.click(radios[0]);
    fireEvent.click(group.getByRole("button", { name: "Select the others" }));
    expect(useLibraryViewStore.getState().selectedIds).toEqual(["flac"]);
    expect(useUiStore.getState().isDuplicatesOpen).toBe(false);
    expect(useUiStore.getState().activeScreen).toBe("library");
    expect(useUiStore.getState().toast?.message).toContain("1 track selected");
  });

  it("selects every extra copy of every group", () => {
    render(<DuplicatesDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Select all the extra copies" }));
    expect(useLibraryViewStore.getState().selectedIds).toHaveLength(2);
  });

  it("can mark a group as not duplicates, and bring it back", () => {
    render(<DuplicatesDialog />);
    const group = within(screen.getByRole("region", { name: /Twin/ }));
    fireEvent.click(group.getByRole("button", { name: "Not duplicates" }));
    expect(screen.queryByRole("region", { name: /Twin/ })).toBeNull();
    expect(useLibraryViewStore.getState().ignoredDuplicates).toEqual(["twin|x"]);
    fireEvent.click(screen.getByRole("button", { name: /Show the 1 ignored again/ }));
    expect(screen.getByRole("region", { name: /Twin/ })).toBeTruthy();
  });

  it("shows a copy in the file manager", () => {
    render(<DuplicatesDialog />);
    fireEvent.click(screen.getAllByRole("button", { name: /in the file manager/ })[0]);
    expect(openInFileManager).toHaveBeenCalledTimes(1);
  });

  it("says so when there is nothing to review", () => {
    useLibraryStore.setState({ tracks: [track("a", { title: "One" }), track("b", { title: "Two" })] });
    render(<DuplicatesDialog />);
    expect(screen.getByText(/No duplicates found/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Select all the extra copies" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Library duplicates entry point", () => {
  it("offers a review button only when there are duplicates, and the filter ignores dismissed groups", () => {
    useUiStore.setState({ isDuplicatesOpen: false });
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    expect(screen.getByRole("button", { name: /Duplicates/ }).textContent).toContain("4");
    fireEvent.click(screen.getByRole("button", { name: "Review duplicates…" }));
    expect(useUiStore.getState().isDuplicatesOpen).toBe(true);

    cleanup();
    useLibraryViewStore.setState({ ignoredDuplicates: ["afterimage|velvet circuit", "twin|x"] });
    render(<LibraryScreen onTogglePlayPause={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Review duplicates…" })).toBeNull();
    expect(screen.getByRole("button", { name: /Duplicates/ }).textContent).toBe("Duplicates0");
  });
});
