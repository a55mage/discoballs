import { describe, expect, it } from "vitest";
import {
  buildFolderEntries,
  countHealth,
  duplicateKey,
  findDuplicateGroups,
  suggestKeep,
  findDuplicateIds,
  getIdRange,
  getTrackIssues,
  getVisibleTracks,
  matchesScope,
  sortTracks,
  type LibraryViewInput,
} from "../domain/libraryView";
import type { Track } from "../types";

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: `/Music/${id}.mp3`,
  title: `Title ${id}`,
  artist: "Artist",
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: true,
  ...patch,
});

const view = (patch: Partial<LibraryViewInput> = {}): LibraryViewInput => ({
  query: "",
  filter: "all",
  scope: null,
  sortKey: "added",
  sortDirection: "asc",
  ...patch,
});

describe("duplicates and issues", () => {
  it("flags tracks sharing title and artist, ignoring case and untitled files", () => {
    const tracks = [
      track("1", { title: "Afterimage", artist: "Velvet" }),
      track("2", { title: "afterimage", artist: "VELVET" }),
      track("3", { title: "", artist: "" }),
      track("4", { title: "", artist: "" }),
      track("5", { title: "Other", artist: "Velvet" }),
    ];
    expect([...findDuplicateIds(tracks)].sort()).toEqual(["1", "2"]);
  });

  it("lists every issue of a track", () => {
    const issues = getTrackIssues(track("1", { hasCover: false, genre: "", year: "", artist: "" }), new Set(["1"]));
    expect(issues).toEqual(["No cover", "Missing tags", "No genre", "No year", "Possible duplicate"]);
    expect(getTrackIssues(track("2"), new Set())).toEqual([]);
  });

  it("treats a downloaded cover url as a cover", () => {
    expect(getTrackIssues(track("1", { hasCover: false, coverUrl: "x.jpg" }), new Set())).toEqual([]);
  });

  it("counts health per filter", () => {
    const tracks = [track("1"), track("2", { hasCover: false }), track("3", { genre: "" })];
    expect(countHealth(tracks, new Set())).toEqual({ all: 3, cover: 1, tags: 1, duplicates: 0, favorites: 0, withIssues: 2 });
  });
});

describe("getVisibleTracks", () => {
  const tracks = [
    track("1", { title: "Bravo", artist: "Zed", album: "One" }),
    track("2", { title: "alpha", artist: "Amy", album: "Two", hasCover: false }),
    track("3", { title: "Charlie", artist: "Amy", album: "Two", year: "" }),
  ];

  it("filters by query across tags and path", () => {
    expect(getVisibleTracks(tracks, view({ query: "amy" }), new Set()).map((t) => t.id)).toEqual(["2", "3"]);
    expect(getVisibleTracks(tracks, view({ query: "/music/1" }), new Set()).map((t) => t.id)).toEqual(["1"]);
  });

  it("filters by health and scope", () => {
    expect(getVisibleTracks(tracks, view({ filter: "cover" }), new Set()).map((t) => t.id)).toEqual(["2"]);
    const scope = { kind: "album" as const, artist: "Amy", album: "Two" };
    expect(getVisibleTracks(tracks, view({ scope }), new Set()).map((t) => t.id)).toEqual(["2", "3"]);
    expect(matchesScope(tracks[0], { kind: "artist", artist: "zed" })).toBe(true);
  });

  it("sorts case-insensitively in both directions", () => {
    expect(getVisibleTracks(tracks, view({ sortKey: "title" }), new Set()).map((t) => t.id)).toEqual(["2", "1", "3"]);
    expect(getVisibleTracks(tracks, view({ sortKey: "title", sortDirection: "desc" }), new Set()).map((t) => t.id)).toEqual(["3", "1", "2"]);
    expect(getVisibleTracks(tracks, view({ sortDirection: "desc" }), new Set()).map((t) => t.id)).toEqual(["3", "2", "1"]);
  });
});

describe("sortTracks", () => {
  it("puts empty values last when ascending and first when reversed", () => {
    const tracks = [track("1", { genre: "" }), track("2", { genre: "Folk" }), track("3", { genre: "Blues" })];
    expect(sortTracks(tracks, "genre", "asc").map((t) => t.id)).toEqual(["3", "2", "1"]);
    expect(sortTracks(tracks, "genre", "desc").map((t) => t.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts by year, unknown years last", () => {
    const tracks = [track("1", { year: "" }), track("2", { year: "2001" }), track("3", { year: "1999" })];
    expect(sortTracks(tracks, "year", "asc").map((t) => t.id)).toEqual(["3", "2", "1"]);
  });

  it("sorts by date added, undated tracks last", () => {
    const tracks = [track("1"), track("2", { addedAt: 300 }), track("3", { addedAt: 100 }), track("4"), track("5", { addedAt: 200 })];
    expect(sortTracks(tracks, "added", "asc").map((t) => t.id)).toEqual(["3", "5", "2", "1", "4"]);
    expect(sortTracks(tracks, "added", "desc").map((t) => t.id)).toEqual(["2", "5", "3", "4", "1"]);
  });

  it("sorts by file format", () => {
    const tracks = [track("1", { path: "/a.mp3" }), track("2", { path: "/b.flac" })];
    expect(sortTracks(tracks, "format", "asc").map((t) => t.id)).toEqual(["2", "1"]);
  });
});

describe("getIdRange", () => {
  const ids = ["a", "b", "c", "d"];
  it("returns an inclusive range in either direction", () => {
    expect(getIdRange(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(getIdRange(ids, "d", "b")).toEqual(["b", "c", "d"]);
  });
  it("falls back to the target when the anchor is unknown", () => {
    expect(getIdRange(ids, "x", "c")).toEqual(["c"]);
  });
});

describe("buildFolderEntries", () => {
  const tracks = [
    track("1", { path: "/Music/A/one.mp3" }),
    track("2", { path: "/Music/A/Deep/two.mp3" }),
    track("3", { path: "/Music/B/three.mp3" }),
    track("4", { path: "/Music/root.mp3" }),
  ];

  it("lists sub-folders with counts, then files, at the root", () => {
    const entries = buildFolderEntries(tracks, "/Music", [], "");
    expect(entries.map((entry) => `${entry.type}:${entry.name}`)).toEqual(["folder:A", "folder:B", "track:root.mp3"]);
    expect(entries[0]).toMatchObject({ trackCount: 2 });
  });

  it("descends into a folder", () => {
    const entries = buildFolderEntries(tracks, "/Music", ["A"], "");
    expect(entries.map((entry) => `${entry.type}:${entry.name}`)).toEqual(["folder:Deep", "track:one.mp3"]);
  });

  it("filters entries by query", () => {
    expect(buildFolderEntries(tracks, "/Music", [], "three")).toEqual([]);
    expect(buildFolderEntries(tracks, "/Music", ["B"], "three")).toHaveLength(1);
  });
});

describe("duplicate groups", () => {
  it("builds groups and honours ignored ones", () => {
    const tracks = [
      track("1", { title: "Afterimage", artist: "Velvet" }),
      track("2", { title: "AFTERIMAGE", artist: "velvet" }),
      track("3", { title: "Other", artist: "X" }),
      track("4", { title: "Other", artist: "X" }),
    ];
    const groups = findDuplicateGroups(tracks);
    expect(groups.map((group) => [group.key, group.tracks.length])).toEqual([
      ["afterimage|velvet", 2],
      ["other|x", 2],
    ]);
    expect([...findDuplicateIds(tracks, new Set(["other|x"]))].sort()).toEqual(["1", "2"]);
    expect(duplicateKey(track("5", { title: "", artist: "A" }))).toBeNull();
  });

  it("suggests keeping the lossless, complete, non-copy file", () => {
    const flac = track("a", { path: "/m/a.flac" });
    const mp3 = track("b", { path: "/m/b.mp3" });
    expect(suggestKeep({ key: "k", tracks: [mp3, flac] })).toBe(flac);

    const complete = track("c", { path: "/m/c.mp3" });
    const bare = track("d", { path: "/m/d.mp3", hasCover: false, genre: "", year: "" });
    expect(suggestKeep({ key: "k", tracks: [bare, complete] })).toBe(complete);

    const copy = track("e", { path: "/m/Album (copy)/e.mp3", album: "Album (copy)" });
    const original = track("f", { path: "/m/Album/f.mp3" });
    expect(suggestKeep({ key: "k", tracks: [copy, original] })).toBe(original);
  });

  it("keeps the first track when nothing tells them apart", () => {
    const one = track("1", { path: "/m/1.mp3" });
    const two = track("2", { path: "/m/2.mp3" });
    expect(suggestKeep({ key: "k", tracks: [one, two] })).toBe(one);
  });
});

describe("duplicates across formats", () => {
  const song = (id: string, path: string, patch: Partial<Track> = {}): Track => ({
    id,
    path,
    title: "Harbor Lights",
    artist: "Marlow Vane",
    album: "Night Ferry",
    tracknumber: "1",
    year: "2019",
    genre: "Indie",
    hasCover: true,
    ...patch,
  });
  const tracks = [song("flac", "/m/a.flac"), song("mp3", "/m/a.mp3"), song("mp3b", "/m/b.mp3")];

  it("counts a FLAC and an MP3 of one song as duplicates by default", () => {
    expect([...findDuplicateIds(tracks)].sort()).toEqual(["flac", "mp3", "mp3b"]);
  });

  it("with other formats ignored, only copies in the same format remain", () => {
    expect([...findDuplicateIds(tracks, new Set(), { ignoreOtherFormats: true })].sort()).toEqual(["mp3", "mp3b"]);
    expect(findDuplicateGroups(tracks.slice(0, 2), new Set(), { ignoreOtherFormats: true })).toEqual([]);
  });

  it("is not fooled by case, accents or punctuation, and honours dismissed groups in either mode", () => {
    const variants = [song("1", "/m/1.mp3", { title: "Café del Mar!" }), song("2", "/m/2.mp3", { title: "cafe  del mar" })];
    expect(findDuplicateGroups(variants)).toHaveLength(1);
    const key = findDuplicateGroups(variants)[0].key;
    expect(findDuplicateGroups(variants, new Set([key]))).toEqual([]);
    expect(findDuplicateGroups(variants, new Set([key]), { ignoreOtherFormats: true })).toEqual([]);
  });
});
