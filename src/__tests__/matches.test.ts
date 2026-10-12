import { describe, expect, it } from "vitest";
import { applyMatchToTrack, diffMatch, getDraftChanges } from "../domain/matches";
import type { OnlineMatch, Track } from "../types";

const track = (patch: Partial<Track> = {}): Track => ({
  id: "1",
  path: "/m/a.mp3",
  title: "Solid Gold",
  artist: "Battle Tapes",
  album: "Polygon",
  tracknumber: "3",
  year: "2015",
  genre: "Electronic",
  hasCover: false,
  ...patch,
});

const match = (patch: Partial<OnlineMatch> = {}): OnlineMatch => ({
  id: "m",
  title: "Solid Gold",
  artist: "Battle Tapes",
  album: "Polygon",
  date: "2015-11-20",
  ...patch,
});

describe("applyMatchToTrack", () => {
  it("copies the tags, keeps the genre and the existing track number when the match has none", () => {
    const next = applyMatchToTrack(track(), match({ album: "Polygon (Deluxe)", date: "2016-01-01", coverUrl: "c.jpg" }));
    expect(next).toMatchObject({ album: "Polygon (Deluxe)", year: "2016", tracknumber: "3", genre: "Electronic", coverUrl: "c.jpg", hasCover: true });
  });

  it("uses the track number of the match when present", () => {
    expect(applyMatchToTrack(track(), match({ tracknumber: "5" })).tracknumber).toBe("5");
  });
});

describe("diffMatch", () => {
  it("is empty when the match changes nothing", () => {
    expect(diffMatch(track(), match())).toEqual([]);
  });

  it("lists each changed field with before and after", () => {
    const diffs = diffMatch(track({ album: "", year: "" }), match());
    expect(diffs.map((diff) => [diff.field, diff.from, diff.to])).toEqual([
      ["album", "", "Polygon"],
      ["year", "", "2015"],
    ]);
  });

  it("reports a cover change", () => {
    const diffs = diffMatch(track({ hasCover: true, coverUrl: "old.jpg" }), match({ coverUrl: "new.jpg" }));
    expect(diffs).toEqual([{ field: "cover", label: "Cover", from: "Current cover", to: "Result cover" }]);
  });

  it("flags removing the cover when the result has none", () => {
    const diffs = diffMatch(track({ hasCover: true, coverUrl: "old.jpg" }), match());
    expect(diffs[0]).toMatchObject({ field: "cover", to: "None" });
  });
});

describe("getDraftChanges", () => {
  it("returns nothing for identical or unrelated tracks", () => {
    expect(getDraftChanges(track(), track())).toEqual([]);
    expect(getDraftChanges(track(), track({ id: "2", title: "Other" }))).toEqual([]);
    expect(getDraftChanges(null, track())).toEqual([]);
  });

  it("names the edited fields and the cover", () => {
    const changes = getDraftChanges(track(), track({ title: "New", genre: "Rock", coverUrl: "x.jpg", hasCover: true }));
    expect(changes.map((change) => change.label)).toEqual(["Title", "Genre", "Cover"]);
  });
});
