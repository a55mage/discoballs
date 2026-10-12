import { describe, expect, it } from "vitest";
import { compilePattern, fileStem, parseFileName, planFilenameTags } from "../domain/filenameTags";
import type { Track } from "../types";

const track = (path: string, patch: Partial<Track> = {}): Track => ({
  id: path,
  path,
  title: "",
  artist: "",
  album: "",
  tracknumber: "",
  year: "",
  genre: "",
  hasCover: false,
  ...patch,
});

describe("compilePattern", () => {
  it("rejects templates without known tokens, with unknown ones, or repeating one", () => {
    expect(compilePattern("just text")).toBeNull();
    expect(compilePattern("{nope} - {title}")).toBeNull();
    expect(compilePattern("{title} - {title}")).toBeNull();
  });

  it("accepts the known tokens", () => {
    expect(compilePattern("{track} - {artist} - {title}")?.fields).toEqual(["tracknumber", "artist", "title"]);
  });
});

describe("parseFileName", () => {
  const parse = (path: string, template: string) => parseFileName(path, compilePattern(template));

  it("reads track, artist and title", () => {
    expect(parse("/m/03 - Battle Tapes - Solid Gold.mp3", "{track} - {artist} - {title}")).toEqual({
      tracknumber: "3",
      artist: "Battle Tapes",
      title: "Solid Gold",
    });
  });

  it("keeps dashes inside the last field and tolerates spacing around separators", () => {
    expect(parse("/m/Artist-Title - Live.flac", "{artist} - {title}")).toEqual({ artist: "Artist-Title", title: "Live" });
    expect(parse("/m/Artist -  Title.flac", "{artist} - {title}")).toEqual({ artist: "Artist", title: "Title" });
  });

  it("turns underscores into spaces and trims", () => {
    expect(parse("/m/01_Harbor_Lights.mp3", "{track} {title}")).toEqual({ tracknumber: "1", title: "Harbor Lights" });
  });

  it("is case-insensitive about literals and reads years", () => {
    expect(parse("/m/Artist (2019) Title.mp3", "{artist} ({year}) {title}")).toEqual({ artist: "Artist", year: "2019", title: "Title" });
  });

  it("returns null when the name does not fit", () => {
    expect(parse("/m/Harbor Lights.mp3", "{track} - {artist} - {title}")).toBeNull();
    expect(parse("/m/x.mp3", "no tokens")).toBeNull();
  });

  it("handles Windows paths and names with dots", () => {
    expect(fileStem("C:\\Music\\01. Intro.v2.mp3")).toBe("01. Intro.v2");
    expect(parse("C:\\Music\\01 - Intro.mp3", "{track} - {title}")).toEqual({ tracknumber: "1", title: "Intro" });
  });
});

describe("planFilenameTags", () => {
  const tracks = [
    track("/m/01 - A - One.mp3"),
    track("/m/02 - B - Two.mp3", { artist: "Existing", title: "Kept" }),
    track("/m/unparsable.mp3"),
  ];

  it("fills everything the names provide", () => {
    const plan = planFilenameTags(tracks, "{track} - {artist} - {title}", { onlyEmpty: false });
    expect(plan[0].patch).toEqual({ tracknumber: "1", artist: "A", title: "One" });
    expect(plan[1].patch).toEqual({ tracknumber: "2", artist: "B", title: "Two" });
    expect(plan[2].parsed).toBeNull();
    expect(plan[2].patch).toEqual({});
  });

  it("can leave existing tags alone", () => {
    const plan = planFilenameTags(tracks, "{track} - {artist} - {title}", { onlyEmpty: true });
    expect(plan[1].patch).toEqual({ tracknumber: "2" });
  });

  it("skips values that are already right", () => {
    const plan = planFilenameTags([track("/m/01 - A - One.mp3", { artist: "A", title: "One", tracknumber: "1" })], "{track} - {artist} - {title}", { onlyEmpty: false });
    expect(plan[0].patch).toEqual({});
  });
});
