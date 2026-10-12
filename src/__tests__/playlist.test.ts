import { describe, expect, it } from "vitest";
import {
  areTrackIdListsEqual,
  buildLibraryQueueOrder,
  buildPlaylistQueueOrder,
  buildUniquePlaylistName,
  shuffleTrackIds,
  type Playlist,
} from "../domain/playlist";

const playlist = (id: string, name: string): Playlist => ({ id, name, entries: [] });

describe("shuffleTrackIds", () => {
  it("keeps every id and does not mutate the input", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffleTrackIds(input);
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
    expect([...out].sort()).toEqual(input);
  });
});

describe("buildPlaylistQueueOrder", () => {
  const ids = ["a", "b", "c", "d"];
  it("returns an empty queue for an empty playlist", () => {
    expect(buildPlaylistQueueOrder([], false)).toEqual([]);
  });
  it("starts from the requested track without shuffle", () => {
    expect(buildPlaylistQueueOrder(ids, false, "c")).toEqual(["c", "d"]);
  });
  it("falls back to the first track when the start id is unknown", () => {
    expect(buildPlaylistQueueOrder(ids, false, "zzz")).toEqual(ids);
  });
  it("removes duplicates and empty ids", () => {
    expect(buildPlaylistQueueOrder(["a", "", "a", "b"], false)).toEqual(["a", "b"]);
  });
  it("keeps the start track first and every other track with shuffle", () => {
    const out = buildPlaylistQueueOrder(ids, true, "b");
    expect(out[0]).toBe("b");
    expect([...out].sort()).toEqual(ids);
  });
});

describe("buildLibraryQueueOrder", () => {
  it("returns the tail starting at the track", () => {
    expect(buildLibraryQueueOrder(["a", "b", "c"], "b")).toEqual(["b", "c"]);
  });
  it("returns an empty queue when the track is missing", () => {
    expect(buildLibraryQueueOrder(["a", "b"], "x")).toEqual([]);
  });
});

describe("areTrackIdListsEqual", () => {
  it("compares length and order", () => {
    expect(areTrackIdListsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(areTrackIdListsEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(areTrackIdListsEqual(["a"], ["a", "b"])).toBe(false);
  });
});

describe("buildUniquePlaylistName", () => {
  it("keeps a free name", () => {
    expect(buildUniquePlaylistName([playlist("1", "Focus")], "Road trip")).toBe("Road trip");
  });
  it("appends a counter when the name is taken, ignoring case and spaces", () => {
    const list = [playlist("1", "Focus"), playlist("2", "focus (2)")];
    expect(buildUniquePlaylistName(list, "  FOCUS ")).toBe("FOCUS (3)");
  });
  it("ignores the playlist being renamed", () => {
    expect(buildUniquePlaylistName([playlist("1", "Focus")], "Focus", "1")).toBe("Focus");
  });
  it("uses a default name for blank input", () => {
    expect(buildUniquePlaylistName([], "   ")).toBe("New Playlist");
  });
});
