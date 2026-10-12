import { describe, expect, it } from "vitest";
import { summarizeAlbums, summarizeArtists, summarizeGenres } from "../domain/library";
import { findBestMatchId, orderOnlineResults, sortOnlineResultsByDate } from "../domain/onlineResults";
import type { OnlineMatch, Track } from "../types";

const track = (patch: Partial<Track>): Track => ({
  id: patch.id ?? "1",
  path: `/m/${patch.id ?? "1"}.mp3`,
  title: "T",
  artist: "A",
  album: "Al",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: false,
  ...patch,
});

describe("summarizeGenres", () => {
  it("dedupes by normalized key, keeps the first label and sorts", () => {
    const genres = summarizeGenres([
      track({ id: "1", genre: "Hip-Hop" }),
      track({ id: "2", genre: "hip hop" }),
      track({ id: "3", genre: "Blues" }),
      track({ id: "4", genre: "  " }),
    ]);
    expect(genres).toEqual([
      { key: "blues", label: "Blues" },
      { key: "hip hop", label: "Hip-Hop" },
    ]);
  });
});

describe("summarizeArtists", () => {
  it("groups case-insensitively, counts albums and falls back to Unknown artist", () => {
    const artists = summarizeArtists([
      track({ id: "1", artist: "Zed", album: "One" }),
      track({ id: "2", artist: "zed", album: "Two", coverUrl: "c.jpg" }),
      track({ id: "3", artist: "", album: "One" }),
    ]);
    expect(artists.map((artist) => artist.name)).toEqual(["Unknown artist", "Zed"]);
    const zed = artists.find((artist) => artist.name === "Zed");
    expect(zed).toMatchObject({ trackCount: 2, albumCount: 2, coverUrl: "c.jpg" });
  });
});

describe("summarizeAlbums", () => {
  it("groups by artist and album, fills the missing year and sorts by artist then title", () => {
    const albums = summarizeAlbums([
      track({ id: "1", artist: "B", album: "X", year: "" }),
      track({ id: "2", artist: "B", album: "x", year: "1999" }),
      track({ id: "3", artist: "A", album: "Y", year: "2001" }),
    ]);
    expect(albums.map((album) => `${album.artist}/${album.title}`)).toEqual(["A/Y", "B/X"]);
    expect(albums[1]).toMatchObject({ trackCount: 2, year: "1999" });
  });
});

const match = (patch: Partial<OnlineMatch>): OnlineMatch => ({
  id: "m",
  title: "Solid Gold",
  artist: "Battle Tapes",
  album: "Polygon",
  date: "2015-11-20",
  ...patch,
});
const query = { title: "Solid Gold", artist: "Battle Tapes", album: "Polygon" };

describe("online results ordering", () => {
  it("sorts by date, oldest first, undated last", () => {
    const sorted = sortOnlineResultsByDate([
      match({ id: "late", date: "2020-01-01" }),
      match({ id: "none", date: "" }),
      match({ id: "early", date: "2010" }),
    ]);
    expect(sorted.map((result) => result.id)).toEqual(["early", "late", "none"]);
  });

  it("prefers the highest score and breaks ties with the earliest date", () => {
    const results = [
      match({ id: "remix", title: "Solid Gold (Remix)", date: "2016-01-01" }),
      match({ id: "new", date: "2020-05-05" }),
      match({ id: "old", date: "2015-11-20" }),
    ];
    expect(findBestMatchId(results, query)).toBe("old");
  });

  it("returns an empty id when nothing resembles the query", () => {
    expect(findBestMatchId([match({ title: "Other" })], query)).toBe("");
  });

  it("moves the best match to the top of the date-sorted list", () => {
    const results = [
      match({ id: "a", date: "2010-01-01", album: "Compilation", coverUrl: undefined }),
      match({ id: "b", date: "2015-11-20", coverUrl: "x.jpg" }),
    ];
    const { sorted, bestMatchId } = orderOnlineResults(results, query);
    expect(bestMatchId).toBe("b");
    expect(sorted.map((result) => result.id)).toEqual(["b", "a"]);
  });
});
