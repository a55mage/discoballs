// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbumRelease, Track } from "../types";

const release: AlbumRelease = {
  id: "r1",
  title: "Night Ferry",
  artist: "Marlow Vane",
  date: "2020-03-06",
  coverUrl: "data:image/png;base64,AAAA",
  tracks: [
    { title: "Harbor Lights", artist: "Marlow Vane", number: "1", disc: 1 },
    { title: "Salt & Static", artist: "Marlow Vane", number: "2", disc: 1 },
  ],
};
const saveTrack = vi.fn(async (_id: string, path: string, ..._rest: unknown[]) => ({ path }));
const searchAlbums = vi.fn(async (_query: unknown) => [{ id: "r1", title: "Night Ferry", artist: "Marlow Vane", date: "2020-03-06", country: "XW", label: "", trackCount: 2 }]);
vi.mock("../api", () => ({
  adapter: {
    searchAlbums: (query: unknown) => searchAlbums(query),
    getAlbumRelease: async () => release,
    saveTrack: (id: string, path: string, ...rest: unknown[]) => saveTrack(id, path, ...rest),
  },
}));

import { AlbumMatchDialog } from "../shell/AlbumMatchDialog";
import { useLibraryStore } from "../store/libraryStore";
import { useUiStore } from "../store/uiStore";

const track = (id: string, title: string): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title,
  artist: "Marlow Vane",
  album: "Night Ferry",
  tracknumber: "",
  year: "",
  genre: "",
  hasCover: false,
});

beforeEach(() => {
  saveTrack.mockClear();
  searchAlbums.mockClear();
  useLibraryStore.setState({ tracks: [track("a", "harbor lights"), track("b", "Salt and Static")], selectedTrackId: "" });
  useUiStore.setState({ albumMatch: { ids: ["a", "b"] }, toast: null });
});
afterEach(cleanup);

describe("AlbumMatchDialog", () => {
  it("searches with the guessed album, previews the mapping and writes the tags", async () => {
    const user = userEvent.setup();
    render(<AlbumMatchDialog />);
    await waitFor(() => expect(searchAlbums).toHaveBeenCalledWith({ artist: "Marlow Vane", album: "Night Ferry" }));
    await user.click(await screen.findByRole("button", { name: /Night Ferry/ }));
    expect(await screen.findByText("2. Salt & Static")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Apply to 2 tracks" }));
    await waitFor(() => expect(saveTrack).toHaveBeenCalledTimes(2));
    const update = saveTrack.mock.calls[0][2] as Record<string, string>;
    expect(update).toMatchObject({ title: "Harbor Lights", tracknumber: "1", album: "Night Ferry", year: "2020" });
    expect(saveTrack.mock.calls[0][3]).toBeUndefined();
    expect(useUiStore.getState().albumMatch).toBeNull();
    expect(useLibraryStore.getState().tracks[0].title).toBe("Harbor Lights");
  });

  it("embeds the cover only when asked", async () => {
    const user = userEvent.setup();
    render(<AlbumMatchDialog />);
    await user.click(await screen.findByRole("button", { name: /Night Ferry/ }));
    await user.click(await screen.findByRole("switch", { name: "Replace covers" }));
    await user.click(screen.getByRole("button", { name: "Apply to 2 tracks" }));
    await waitFor(() => expect(saveTrack).toHaveBeenCalled());
    expect(saveTrack.mock.calls[0][3]).toBe("data:image/png;base64,AAAA");
  });
});
