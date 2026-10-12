import { describe, expect, it } from "vitest";
import { getActiveLyricIndex, parsePlainLyrics, parseSyncedLyrics } from "../utils/lyrics";

describe("parseSyncedLyrics", () => {
  it("parses timestamps and sorts lines", () => {
    const lines = parseSyncedLyrics("[00:10.50] second\n[00:02.00] first");
    expect(lines).toEqual([
      { timeSec: 2, text: "first" },
      { timeSec: 10.5, text: "second" },
    ]);
  });
  it("expands multiple time tags on one line", () => {
    const lines = parseSyncedLyrics("[00:05.00][01:05.00] chorus");
    expect(lines.map((line) => line.timeSec)).toEqual([5, 65]);
  });
  it("reads three-digit fractions as milliseconds", () => {
    expect(parseSyncedLyrics("[00:01.250] hi")[0].timeSec).toBeCloseTo(1.25);
  });
  it("skips empty lines and lines without timestamps", () => {
    expect(parseSyncedLyrics("[00:01.00]\nno tag here")).toEqual([]);
  });
});

describe("parsePlainLyrics", () => {
  it("trims and drops blank lines", () => {
    expect(parsePlainLyrics("  a \n\n b\r\n")).toEqual([{ text: "a" }, { text: "b" }]);
  });
});

describe("getActiveLyricIndex", () => {
  const lines = [
    { timeSec: 0, text: "a" },
    { timeSec: 10, text: "b" },
    { timeSec: 20, text: "c" },
  ];
  it("returns -1 for empty or unsynced lyrics", () => {
    expect(getActiveLyricIndex([], 5)).toBe(-1);
    expect(getActiveLyricIndex([{ text: "x" }], 5)).toBe(-1);
  });
  it("returns the last line whose time has passed", () => {
    expect(getActiveLyricIndex(lines, 0)).toBe(0);
    expect(getActiveLyricIndex(lines, 9.9)).toBe(0);
    expect(getActiveLyricIndex(lines, 10)).toBe(1);
    expect(getActiveLyricIndex(lines, 999)).toBe(2);
  });
  it("returns -1 before the first timestamp", () => {
    expect(getActiveLyricIndex([{ timeSec: 5, text: "a" }], 1)).toBe(-1);
  });
});
