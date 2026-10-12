import { describe, expect, it } from "vitest";
import {
  formatDurationLabel,
  formatFileSize,
  formatSampleRate,
  formatTime,
  getExtension,
  getFileName,
  normalizePath,
  sanitizeFilePart,
} from "../utils/common";

describe("path helpers", () => {
  it("normalizes separators and trailing slashes", () => {
    expect(normalizePath("C:\\Music\\Album\\")).toBe("C:/Music/Album");
  });
  it("extracts file name and extension", () => {
    expect(getFileName("/a/b/song.flac")).toBe("song.flac");
    expect(getExtension("/a/b/song.flac")).toBe(".flac");
    expect(getExtension("/a/b/noext")).toBe("");
  });
});

describe("sanitizeFilePart", () => {
  it("replaces forbidden characters and trims trailing dots", () => {
    expect(sanitizeFilePart('AC/DC: "Hells" Bells?...')).toBe("AC_DC_ _Hells_ Bells_");
  });
  it("collapses whitespace", () => {
    expect(sanitizeFilePart("a \n  b")).toBe("a b");
  });
});

describe("time formatting", () => {
  it("formats m:ss and guards invalid values", () => {
    expect(formatTime(75.9)).toBe("1:15");
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-3)).toBe("0:00");
  });
  it("formats duration labels with hours", () => {
    expect(formatDurationLabel(251)).toBe("4:11");
    expect(formatDurationLabel(3661)).toBe("1:01:01");
    expect(formatDurationLabel(0)).toBe("n/a");
  });
  it("formats sample rates", () => {
    expect(formatSampleRate(44100)).toBe("44.1 kHz");
    expect(formatSampleRate(48000)).toBe("48 kHz");
  });
});

describe("formatFileSize", () => {
  it("returns a non-empty label", () => {
    expect(formatFileSize(9_600_000).length).toBeGreaterThan(0);
  });
});
