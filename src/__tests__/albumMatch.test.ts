import { describe, expect, it } from "vitest";
import { albumIdsFor, buildAlbumPatch, describeRelease, guessAlbum, localTitle, matchTracksToRelease, normalizeTitle, titleSimilarity } from "../domain/albumMatch";
import type { AlbumTrack, Track } from "../types";

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title: "",
  artist: "",
  album: "",
  tracknumber: "",
  year: "",
  genre: "",
  hasCover: false,
  ...patch,
});

const remote = (title: string, number: string, patch: Partial<AlbumTrack> = {}): AlbumTrack => ({ title, artist: "Marlow Vane", number, disc: 1, ...patch });

describe("titles", () => {
  it("normalizes accents, ampersands, brackets and punctuation", () => {
    expect(normalizeTitle("Salt & Static (Remastered 2011)")).toBe("salt and static");
    expect(normalizeTitle("Café del Mar!")).toBe("cafe del mar");
  });

  it("scores identical titles 1 and unrelated ones 0", () => {
    expect(titleSimilarity("Salt and Static", "Salt & Static")).toBe(1);
    expect(titleSimilarity("Harbor Lights", "Slow Thaw")).toBe(0);
    expect(titleSimilarity("", "x")).toBe(0);
  });

  it("scores partly matching titles in between", () => {
    const score = titleSimilarity("Harbor Lights (Live)", "Harbor Lights Live in Paris");
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });

  it("falls back on the file name for untitled tracks", () => {
    expect(localTitle(track("a", { title: "Tagged" }))).toBe("Tagged");
    expect(localTitle(track("b", { path: "/m/03 - Low Tide Radio.mp3" }))).toBe("Low Tide Radio");
  });
});

describe("matchTracksToRelease", () => {
  const release = {
    tracks: [remote("Harbor Lights", "1"), remote("Salt & Static", "2"), remote("Night Ferry", "3"), remote("Bonus Track", "4")],
  };

  it("pairs tracks by title, whatever their order", () => {
    const result = matchTracksToRelease(
      [track("n", { title: "Night Ferry" }), track("h", { title: "Harbor Lights" }), track("s", { title: "Salt and Static" })],
      release
    );
    expect(result.rows.map((row) => [row.trackId, row.releaseIndex])).toEqual([["n", 2], ["h", 0], ["s", 1]]);
    expect(result.missing).toEqual([3]);
  });

  it("leaves tracks that fit nothing unmatched", () => {
    const result = matchTracksToRelease([track("x", { title: "Something Else" })], release);
    expect(result.rows[0]).toMatchObject({ releaseIndex: null, confidence: 0 });
    expect(result.missing).toEqual([0, 1, 2, 3]);
  });

  it("uses the track number to pick between similar titles", () => {
    const twin = { tracks: [remote("Intro", "1"), remote("Intro", "5")] };
    const result = matchTracksToRelease([track("a", { title: "Intro", tracknumber: "5" })], twin);
    expect(result.rows[0].releaseIndex).toBe(1);
  });

  it("never matches two local tracks to the same release track", () => {
    const result = matchTracksToRelease([track("a", { title: "Harbor Lights" }), track("b", { title: "Harbor Lights" })], release);
    const matched = result.rows.filter((row) => row.releaseIndex !== null);
    expect(matched).toHaveLength(1);
  });

  it("matches untitled files by their number", () => {
    const result = matchTracksToRelease([track("u", { path: "/m/audio.mp3", tracknumber: "3" })], release);
    expect(result.rows[0].releaseIndex).toBe(2);
    expect(result.rows[0].confidence).toBeLessThan(0.7);
  });

  it("copes with empty inputs", () => {
    expect(matchTracksToRelease([], release).missing).toEqual([0, 1, 2, 3]);
    expect(matchTracksToRelease([track("a", { title: "x" })], { tracks: [] }).rows[0].releaseIndex).toBeNull();
  });
});

describe("buildAlbumPatch", () => {
  it("writes title, number and artist, plus album and year when asked", () => {
    const base = { title: "Night Ferry (Deluxe)", date: "2020-03-06" };
    expect(buildAlbumPatch(base, remote("Harbor Lights", "01"), { setAlbumFields: true })).toEqual({
      title: "Harbor Lights",
      tracknumber: "1",
      artist: "Marlow Vane",
      album: "Night Ferry (Deluxe)",
      year: "2020",
    });
    expect(buildAlbumPatch(base, remote("Harbor Lights", "A1"), { setAlbumFields: false })).toEqual({ title: "Harbor Lights", tracknumber: "1", artist: "Marlow Vane" });
  });

  it("ignores unusable dates", () => {
    expect(buildAlbumPatch({ title: "X", date: "" }, remote("T", "1"), { setAlbumFields: true }).year).toBeUndefined();
  });
});

describe("helpers", () => {
  it("guesses the album from the most common tags", () => {
    expect(guessAlbum([track("1", { artist: "A", album: "X" }), track("2", { artist: "A", album: "X" }), track("3", { artist: "B", album: "Y" })])).toEqual({ artist: "A", album: "X" });
    expect(guessAlbum([])).toEqual({ artist: "", album: "" });
  });

  it("describes a candidate", () => {
    expect(describeRelease({ id: "1", title: "T", artist: "A", date: "2013-05-17", country: "XW", label: "Columbia", trackCount: 13 })).toBe("2013 · XW · Columbia");
  });
});

describe("albumIdsFor", () => {
  const lib = [
    track("a", { artist: "A", album: "X" }),
    track("b", { artist: "A", album: "X" }),
    track("c", { artist: "A", album: "Y" }),
    track("d", { artist: "B", album: "X" }),
  ];
  it("widens one track to its album", () => {
    expect(albumIdsFor(lib, ["a"])).toEqual(["a", "b"]);
  });
  it("keeps explicit selections and albumless tracks", () => {
    expect(albumIdsFor(lib, ["a", "c"])).toEqual(["a", "c"]);
    expect(albumIdsFor([track("z")], ["z"])).toEqual(["z"]);
  });
});
