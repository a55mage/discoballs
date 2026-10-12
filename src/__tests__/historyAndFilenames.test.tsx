// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const saveTrack = vi.fn(async (_id: string, path: string) => ({ path }));
const renameFile = vi.fn(async (path: string, fileName: string) => ({ path: path.slice(0, path.lastIndexOf("/") + 1) + fileName }));
vi.mock("../api", () => ({
  adapter: {
    saveTrack: (...args: [string, string]) => saveTrack(...args),
    renameTrack: async (path: string) => ({ path: path.replace("old", "renamed") }),
    renameFile: (...args: [string, string]) => renameFile(...args),
    getTrackTechnicalInfo: async () => null,
    getAudioSource: async () => "",
    getTrackCoverSource: async () => null,
  },
}));

import { applyBatchEdit } from "../actions/batchEdit";
import { newBatchId, recordTagChange, undoBatch, undoEntry, undoLast } from "../actions/history";
import { changeTrackIdentity } from "../actions/trackIdentity";
import { saveTrackTags, saveTrackTagsAndRename, changeDraftField } from "../actions/tagEditor";
import { selectTrack } from "../actions/library";
import { formatAgo, groupHistory, summarizeChanges, MAX_HISTORY_ENTRIES } from "../domain/history";
import { FilenameTagsDialog } from "../shell/FilenameTagsDialog";
import { HistoryDialog } from "../shell/HistoryDialog";
import { useHistoryStore } from "../store/historyStore";
import { useLibraryStore } from "../store/libraryStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import { useUiStore } from "../store/uiStore";

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: id.startsWith("/") ? id : `/Music/old/${id}.mp3`,
  title: `Song ${id}`,
  artist: "Artist",
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: false,
  ...patch,
});

const tracks = () => useLibraryStore.getState().tracks;

beforeEach(() => {
  saveTrack.mockClear();
  renameFile.mockClear();
  useHistoryStore.setState({ entries: [] });
  useLibraryStore.setState({ folderPath: "/Music", selectedTrackId: "", tracks: [track("/Music/old/1.mp3"), track("/Music/old/2.mp3", { title: "Other" })] });
  useTagEditorStore.setState({ trackDraft: null, searchStatus: "Ready" });
  useUiStore.setState({ toast: null, isHistoryOpen: false, filenameTags: null });
  usePlaylistStore.setState({ playlists: [], activePlaylistId: "", playlistNameDraft: "", isPlaylistRenaming: false });
});

afterEach(cleanup);

describe("history domain", () => {
  it("groups the entries of a batch and keeps newest first", () => {
    const base = { label: "Batch edit", trackTitle: "t", changes: [], trackId: "x", at: 1 };
    const groups = groupHistory([
      { ...base, id: "a", batchId: "b1" },
      { ...base, id: "b", batchId: "b1", undone: true },
      { ...base, id: "c", label: "Tags saved" },
    ]);
    expect(groups.map((group) => [group.key, group.entries.length, group.undone])).toEqual([
      ["b1", 2, false],
      ["c", 1, false],
    ]);
  });

  it("describes changes and formats time", () => {
    expect(
      summarizeChanges({
        id: "1", at: 0, label: "x", trackId: "t", trackTitle: "t",
        changes: [{ field: "title", label: "Title", from: "", to: "New" }],
        renamedFrom: "a.mp3", renamedTo: "b.mp3", coverChanged: true,
      })
    ).toBe("Title: — → New · File: a.mp3 → b.mp3 · Cover changed");
    expect(formatAgo(1000, 1000 + 10_000)).toBe("just now");
    expect(formatAgo(0, 5 * 60_000)).toBe("5 min ago");
    expect(formatAgo(0, 3 * 3_600_000)).toBe("3 h ago");
  });
});

describe("recording and undoing", () => {
  it("records only real changes", () => {
    const before = track("a");
    expect(recordTagChange(before, { ...before }, { label: "x" })).toBeNull();
    const entry = recordTagChange(before, { ...before, title: "New", genre: "" }, { label: "Tags saved" });
    expect(entry?.changes.map((change) => change.field)).toEqual(["title", "genre"]);
    expect(useHistoryStore.getState().entries).toHaveLength(1);
  });

  it("keeps at most 200 entries", () => {
    const before = track("a");
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 5; index += 1) {
      recordTagChange(before, { ...before, title: `T${index}` }, { label: "x" });
    }
    expect(useHistoryStore.getState().entries).toHaveLength(MAX_HISTORY_ENTRIES);
  });

  it("undoes a tag change by writing the old values back", async () => {
    const before = tracks()[0];
    const after = { ...before, title: "Changed", year: "1999" };
    useLibraryStore.getState().setTracks((prev) => prev.map((item) => (item.id === before.id ? after : item)));
    const entry = recordTagChange(before, after, { label: "Tags saved" }) as NonNullable<ReturnType<typeof recordTagChange>>;
    const result = await undoEntry(entry);
    expect(result.ok).toBe(true);
    expect(saveTrack.mock.calls[0][2]).toMatchObject({ title: "Song /Music/old/1.mp3", year: "2020" });
    expect(tracks()[0]).toMatchObject({ title: "Song /Music/old/1.mp3", year: "2020" });
    expect(useHistoryStore.getState().entries[0].undone).toBe(true);
    expect((await undoEntry(useHistoryStore.getState().entries[0])).message).toBe("Already undone");
  });

  it("restores the old file name when the change renamed the file", async () => {
    const before = tracks()[0];
    const after = { ...before, id: "/Music/old/New name.mp3", path: "/Music/old/New name.mp3" };
    useLibraryStore.getState().setTracks((prev) => prev.map((item) => (item.id === before.id ? after : item)));
    const entry = recordTagChange(before, after, { label: "File renamed" }) as NonNullable<ReturnType<typeof recordTagChange>>;
    expect(entry.renamedFrom).toBe("1.mp3");
    const result = await undoEntry(entry);
    expect(result.ok).toBe(true);
    expect(renameFile).toHaveBeenCalledWith("/Music/old/New name.mp3", "1.mp3");
    expect(tracks()[0].path).toBe("/Music/old/1.mp3");
  });

  it("explains when the track is gone", async () => {
    const entry = recordTagChange(track("x"), { ...track("x"), title: "n" }, { label: "x" }) as NonNullable<ReturnType<typeof recordTagChange>>;
    const result = await undoEntry(entry);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not in the library");
  });

  it("follows a track whose file was renamed again", async () => {
    const before = tracks()[0];
    const entry = recordTagChange(before, { ...before, title: "Changed" }, { label: "x" }) as NonNullable<ReturnType<typeof recordTagChange>>;
    useLibraryStore.getState().setTracks((prev) => prev.map((item) => (item.id === before.id ? { ...item, title: "Changed" } : item)));
    changeTrackIdentity(before.id, "/Music/old/moved.mp3");
    expect(useHistoryStore.getState().entries[0].trackId).toBe("/Music/old/moved.mp3");
    expect((await undoEntry(useHistoryStore.getState().entries[0])).ok).toBe(true);
    expect(entry.trackId).toBe(before.id);
  });

  it("undoes a whole batch, and 'undo last' picks the newest undoable change", async () => {
    const result = await applyBatchEdit([tracks()[0].id, tracks()[1].id], { genre: "Jazz" });
    expect(result.updated).toBe(2);
    expect(useHistoryStore.getState().entries).toHaveLength(2);
    expect(new Set(useHistoryStore.getState().entries.map((entry) => entry.batchId)).size).toBe(1);
    expect(tracks().map((item) => item.genre)).toEqual(["Jazz", "Jazz"]);

    const undone = await undoLast();
    expect(undone.message).toBe("2 changes undone");
    expect(tracks().map((item) => item.genre)).toEqual(["Rock", "Rock"]);
    expect((await undoLast()).message).toBe("Nothing to undo");
  });

  it("reports the entries it could not undo", async () => {
    const batchId = newBatchId();
    const a = tracks()[0];
    recordTagChange(a, { ...a, genre: "X" }, { label: "Batch edit", batchId });
    recordTagChange(track("missing"), { ...track("missing"), genre: "X" }, { label: "Batch edit", batchId });
    const result = await undoBatch(batchId);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("1 of 2 undone");
  });
});

describe("saving from the tag editor", () => {
  async function editAndSave(save: () => Promise<void>) {
    selectTrack(tracks()[0]);
    act(() => changeDraftField("title", "Edited"));
    await act(async () => {
      await save();
    });
  }

  it("records the save and offers Undo in the toast", async () => {
    await editAndSave(saveTrackTags);
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].changes[0]).toMatchObject({ field: "title", from: "Song /Music/old/1.mp3", to: "Edited" });
    const toast = useUiStore.getState().toast;
    expect(toast?.action?.label).toBe("Undo");

    await act(async () => {
      toast?.action?.run();
    });
    await waitFor(() => expect(tracks()[0].title).toBe("Song /Music/old/1.mp3"));
  });

  it("keeps playlists pointing at a track whose file was renamed", async () => {
    saveTrack.mockImplementationOnce(async (_id: string, path: string) => ({ path: path.replace("old", "new") }));
    usePlaylistStore.setState({ playlists: [{ id: "p", name: "P", entries: [{ id: "e", trackId: tracks()[0].id }] }], activePlaylistId: "p", playlistNameDraft: "P" });
    await editAndSave(saveTrackTagsAndRename);
    expect(usePlaylistStore.getState().playlists[0].entries[0].trackId).toBe("/Music/new/1.mp3");
    expect(useHistoryStore.getState().entries[0].trackId).toBe("/Music/new/1.mp3");
  });
});

describe("HistoryDialog", () => {
  it("lists changes and undoes one", async () => {
    const before = tracks()[0];
    const after = { ...before, title: "Changed" };
    useLibraryStore.getState().setTracks((prev) => prev.map((item) => (item.id === before.id ? after : item)));
    recordTagChange(before, after, { label: "Tags saved" });
    useUiStore.setState({ isHistoryOpen: true });
    render(<HistoryDialog />);
    const dialog = screen.getByRole("dialog", { name: "Change history" });
    expect(within(dialog).getByText(/Title: Song \/Music\/old\/1.mp3 → Changed/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Undo" }));
    });
    await waitFor(() => expect(within(dialog).getByText("Undone")).toBeTruthy());
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear history" }));
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(within(dialog).getByText(/No changes yet/)).toBeTruthy();
  });

  it("closes with Escape", () => {
    useUiStore.setState({ isHistoryOpen: true });
    render(<HistoryDialog />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(useUiStore.getState().isHistoryOpen).toBe(false);
  });
});

describe("FilenameTagsDialog", () => {
  beforeEach(() => {
    useLibraryStore.setState({
      tracks: [
        track("/m/01 - Marlow Vane - Harbor Lights.mp3", { title: "", artist: "", tracknumber: "" }),
        track("/m/02 - Marlow Vane - Salt.mp3", { title: "Keep me", artist: "", tracknumber: "" }),
        track("/m/whatever.mp3", { title: "", artist: "" }),
      ],
    });
  });

  const open = (mode: "write" | "draft", ids?: string[]) =>
    act(() => useUiStore.getState().setFilenameTags({ ids: ids ?? tracks().map((item) => item.id), mode }));

  it("previews what would be written, leaving existing tags alone by default", () => {
    render(<FilenameTagsDialog />);
    open("write");
    const preview = within(screen.getByRole("list", { name: "Preview" }));
    expect(preview.getByText(/Title: Harbor Lights/)).toBeTruthy();
    expect(preview.getAllByText(/Doesn’t match the pattern/)).toHaveLength(1);
    expect(screen.queryByText(/Title: Salt/)).toBeNull();
    expect(screen.getByText("2 will change")).toBeTruthy();
    expect(screen.getByText("1 don’t match the pattern")).toBeTruthy();
  });

  it("can overwrite existing tags", () => {
    render(<FilenameTagsDialog />);
    open("write");
    fireEvent.click(screen.getByRole("switch", { name: "Only fill empty tags" }));
    expect(screen.getByText(/Title: Salt/)).toBeTruthy();
  });

  it("writes the tags, records a batch and offers Undo", async () => {
    render(<FilenameTagsDialog />);
    open("write");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Write 2 tracks" }));
    });
    expect(saveTrack).toHaveBeenCalledTimes(2);
    expect(tracks()[0]).toMatchObject({ title: "Harbor Lights", artist: "Marlow Vane", tracknumber: "1" });
    expect(tracks()[1]).toMatchObject({ title: "Keep me", artist: "Marlow Vane", tracknumber: "2" });
    expect(useUiStore.getState().filenameTags).toBeNull();
    expect(useUiStore.getState().toast?.action?.label).toBe("Undo");
    expect(useHistoryStore.getState().entries).toHaveLength(2);
  });

  it("supports custom patterns and flags invalid ones", () => {
    render(<FilenameTagsDialog />);
    open("write");
    fireEvent.change(screen.getByLabelText("File name pattern"), { target: { value: "custom" } });
    const input = screen.getByLabelText(/Custom pattern/);
    fireEvent.change(input, { target: { value: "{title} {title}" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: /^Write/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "{track} - {artist} - {title}" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("only fills the editor form in draft mode, without saving", async () => {
    selectTrack(tracks()[0]);
    render(<FilenameTagsDialog />);
    open("draft", [tracks()[0].id]);
    expect(screen.getByRole("button", { name: "Fill the form" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    });
    expect(saveTrack).not.toHaveBeenCalled();
    expect(useTagEditorStore.getState().trackDraft).toMatchObject({ title: "Harbor Lights", artist: "Marlow Vane" });
  });
});
