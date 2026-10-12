import { describe, expect, it } from "vitest";
import type { OnlineMatch, Track } from "../types";
import {
  areTracksEqual,
  buildRenamePreview,
  formatTrackTechnicalBadge,
  inferGenrePresetId,
  normalizeGenreKey,
  scoreOnlineMatch,
} from "../utils/appHelpers";

const track = (patch: Partial<Track> = {}): Track => ({
  id: "1",
  path: "/music/Battle/solid.mp3",
  title: "Solid Gold",
  artist: "Battle Tapes",
  album: "Polygon",
  tracknumber: "3",
  year: "2015",
  genre: "Electronic",
  hasCover: true,
  ...patch,
});

const match = (patch: Partial<OnlineMatch> = {}): OnlineMatch => ({
  id: "m1",
  title: "Solid Gold",
  artist: "Battle Tapes",
  album: "Polygon",
  date: "2015-11-20",
  ...patch,
});

describe("buildRenamePreview", () => {
  it("joins the selected fields with the separator and keeps the extension", () => {
    expect(buildRenamePreview(track(), ["tracknumber", "artist", "title"], " - ")).toBe(
      "3 - Battle Tapes - Solid Gold.mp3"
    );
  });
  it("skips empty fields", () => {
    expect(buildRenamePreview(track({ artist: "" }), ["artist", "title"], "_")).toBe("Solid Gold.mp3");
  });
  it("sanitizes forbidden characters", () => {
    expect(buildRenamePreview(track({ title: "A/B" }), ["title"], " - ")).toBe("A_B.mp3");
  });
  it("falls back to the current file name when nothing is usable", () => {
    expect(buildRenamePreview(track({ title: "", artist: "" }), ["title", "artist"], " - ")).toBe("solid.mp3");
  });
});

describe("areTracksEqual", () => {
  it("detects tag differences", () => {
    expect(areTracksEqual(track(), track())).toBe(true);
    expect(areTracksEqual(track(), track({ genre: "Rock" }))).toBe(false);
  });
});

describe("formatTrackTechnicalBadge", () => {
  it("uses the format and bitrate when known", () => {
    expect(formatTrackTechnicalBadge({ format: "MP3", bitrateKbps: 320 })).toBe("MP3 · 320 kbps");
  });
  it("falls back to the file extension", () => {
    expect(formatTrackTechnicalBadge(null, "/a/b.flac")).toBe("FLAC · bitrate n/a");
  });
});

describe("genre helpers", () => {
  it("normalizes accents, case and punctuation", () => {
    expect(normalizeGenreKey("  Hip-Hop / Rap ")).toBe("hip hop rap");
  });
  it.each([
    ["Heavy Metal", "genre-metal"],
    ["Hip-Hop", "genre-hiphop"],
    ["Deep House", "genre-electronic"],
    ["Smooth Jazz", "genre-jazz"],
    ["Indie Rock", "genre-rock"],
    ["Synth Pop", "genre-pop"],
    ["", "flat"],
    ["Spoken Word", "flat"],
  ])("maps %s to %s", (genre, presetId) => {
    expect(inferGenrePresetId(genre)).toBe(presetId);
  });
});

describe("scoreOnlineMatch", () => {
  const query = { title: "Solid Gold", artist: "Battle Tapes", album: "Polygon" };
  it("scores an exact match highly", () => {
    expect(scoreOnlineMatch(match(), query)).toBeGreaterThan(90);
  });
  it("rejects results whose title does not resemble the query", () => {
    expect(scoreOnlineMatch(match({ title: "Completely Different" }), query)).toBeNull();
  });
  it("prefers results with a complete date and a cover", () => {
    const plain = scoreOnlineMatch(match({ date: "" }), query) ?? 0;
    const rich = scoreOnlineMatch(match({ coverUrl: "http://x/y.jpg" }), query) ?? 0;
    expect(rich).toBeGreaterThan(plain);
  });
});
