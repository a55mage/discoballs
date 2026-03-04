import type { OnlineMatch, RenameField, SearchQuery, Track, TrackTechnicalInfo } from "../types";
import {
  formatDurationLabel,
  formatFileSize,
  formatSampleRate,
  getExtension,
  getFileName,
  normalizePath,
  sanitizeFilePart,
} from "./common";

type ParsedOnlineMatchDate =
  | { precision: "day"; year: number; month: number; day: number }
  | { precision: "month"; year: number; month: number }
  | { precision: "year"; year: number };

export function areTracksEqual(a: Track, b: Track): boolean {
  return (
    a.id === b.id &&
    a.path === b.path &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    a.tracknumber === b.tracknumber &&
    a.year === b.year &&
    a.genre === b.genre &&
    a.hasCover === b.hasCover &&
    (a.coverUrl ?? "") === (b.coverUrl ?? "")
  );
}

export function buildRenamePreview(track: Track, fields: RenameField[], separator: string): string {
  const fieldMap: Record<RenameField, string> = {
    tracknumber: track.tracknumber,
    artist: track.artist,
    album: track.album,
    title: track.title,
    year: track.year,
    genre: track.genre,
  };

  const parts = fields
    .map((field) => sanitizeFilePart((fieldMap[field] || "").trim()))
    .filter(Boolean);
  const ext = getExtension(track.path);
  if (!parts.length) {
    return getFileName(track.path);
  }
  return `${parts.join(separator || " - ")}${ext}`;
}

export function formatTrackTechnicalBadge(info: TrackTechnicalInfo | null, path?: string): string {
  const format =
    info?.format?.trim() ||
    getExtension(path || "")
      .replace(/^\./, "")
      .toUpperCase() ||
    "N/A";
  const bitrate = info?.bitrateKbps ? `${Math.round(info.bitrateKbps)} kbps` : "bitrate n/a";
  return `${format} · ${bitrate}`;
}

export function formatTrackTechnicalSummary(info: TrackTechnicalInfo | null): string {
  if (!info) {
    return "Duration: n/a · Sample rate: n/a · Size: n/a · Channels: n/a · Depth: n/a";
  }

  const duration = info.durationSeconds && info.durationSeconds > 0 ? formatDurationLabel(info.durationSeconds) : "n/a";
  const sampleRate = info.sampleRateHz ? formatSampleRate(info.sampleRateHz) : "n/a";
  const fileSize = info.fileSizeBytes ? formatFileSize(info.fileSizeBytes) : "n/a";
  const channels = info.channels ? `${info.channels} ch` : "n/a";
  const bitDepth = info.bitDepth ? `${info.bitDepth}-bit` : "n/a";

  return `Duration: ${duration} · Sample rate: ${sampleRate} · Size: ${fileSize} · Channels: ${channels} · Depth: ${bitDepth}`;
}

export function getTrackReleaseSortKey(year: string): number {
  const match = year.trim().match(/^(\d{4})/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return parsed;
}

export function getOnlineMatchDateSortKey(date: string): number {
  const parsedDate = parseOnlineMatchDate(date);
  if (parsedDate?.precision === "day") {
    return Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day);
  }
  if (parsedDate?.precision === "month") {
    return Date.UTC(parsedDate.year, parsedDate.month - 1, 1);
  }
  if (parsedDate?.precision === "year") {
    return Date.UTC(parsedDate.year, 0, 1);
  }

  const normalized = date.trim();
  if (!normalized) {
    return Number.POSITIVE_INFINITY;
  }

  const fallback = Date.parse(normalized);
  if (!Number.isNaN(fallback)) {
    return fallback;
  }

  return Number.POSITIVE_INFINITY;
}

export function scoreOnlineMatch(result: OnlineMatch, query: SearchQuery): number | null {
  const titleQuery = normalizeSearchText(query.title);
  const artistQuery = normalizeSearchText(query.artist);
  const albumQuery = normalizeSearchText(query.album);
  const resultTitle = normalizeSearchText(result.title);
  const resultArtist = normalizeSearchText(result.artist);
  const resultAlbum = normalizeSearchText(result.album);

  const titleScore = computeTextMatchScore(titleQuery, resultTitle);
  if (titleQuery && titleScore < 0.55) {
    return null;
  }

  const artistScore = computeTextMatchScore(artistQuery, resultArtist);
  const albumScore = computeTextMatchScore(albumQuery, resultAlbum);
  const dateCompletenessBonus = hasCompleteOnlineMatchDate(result.date) ? 3 : result.date.trim() ? 1 : 0;
  const coverBonus = result.coverUrl?.trim() ? 2 : 0;

  return titleScore * 70 + artistScore * 20 + albumScore * 10 + dateCompletenessBonus + coverBonus;
}

export function formatOnlineMatchDate(date: string, locale: string): string {
  const normalized = date.trim();
  if (!normalized) {
    return "n/a";
  }

  const parsedDate = parseOnlineMatchDate(normalized);
  if (!parsedDate) {
    return normalized;
  }

  try {
    if (parsedDate.precision === "day") {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
      }).format(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day));
    }
    if (parsedDate.precision === "month") {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        timeZone: "UTC",
      }).format(Date.UTC(parsedDate.year, parsedDate.month - 1, 1));
    }
    return String(parsedDate.year);
  } catch {
    return normalized;
  }
}

export function countFoldersAndSubfolders(items: Track[], rootPath: string): number {
  if (!items.length) {
    return 0;
  }

  const root = normalizePath(rootPath);
  const folders = new Set<string>();

  for (const track of items) {
    const normalizedTrackPath = normalizePath(track.path);
    const lastSlash = normalizedTrackPath.lastIndexOf("/");
    if (lastSlash <= 0) {
      continue;
    }

    const parent = normalizedTrackPath.slice(0, lastSlash);
    if (root && parent.startsWith(root)) {
      const relative = parent.slice(root.length).replace(/^\/+/, "");
      if (!relative) {
        continue;
      }

      const segments = relative.split("/").filter(Boolean);
      let composed = "";
      for (const segment of segments) {
        composed = composed ? `${composed}/${segment}` : segment;
        folders.add(composed);
      }
      continue;
    }

    folders.add(parent);
  }

  return folders.size;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function computeTextMatchScore(query: string, candidate: string): number {
  if (!query || !candidate) {
    return 0;
  }
  if (query === candidate) {
    return 1;
  }

  const queryTokens = query.split(" ").filter(Boolean);
  const candidateTokens = candidate.split(" ").filter(Boolean);
  const queryTokenSet = new Set(queryTokens);
  const candidateTokenSet = new Set(candidateTokens);
  const overlapCount = [...queryTokenSet].filter((token) => candidateTokenSet.has(token)).length;
  const overlapRatio = overlapCount / Math.max(1, queryTokenSet.size);
  const includesBonus = candidate.includes(query) || query.includes(candidate) ? 0.2 : 0;
  const prefixBonus = candidate.startsWith(query) || query.startsWith(candidate) ? 0.1 : 0;

  return Math.min(1, overlapRatio + includesBonus + prefixBonus);
}

function hasCompleteOnlineMatchDate(date: string): boolean {
  return parseOnlineMatchDate(date)?.precision === "day";
}

function parseOnlineMatchDate(date: string): ParsedOnlineMatchDate | null {
  const normalized = date.trim();
  if (!normalized) {
    return null;
  }

  const fullDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (fullDateMatch) {
    const year = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);
    const day = Number(fullDateMatch[3]);
    if (isValidYearMonthDay(year, month, day)) {
      return { precision: "day", year, month, day };
    }
  }

  const yearMonthMatch = normalized.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    if (isValidYearMonth(year, month)) {
      return { precision: "month", year, month };
    }
  }

  const yearMatch = normalized.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (Number.isInteger(year) && year > 0) {
      return { precision: "year", year };
    }
  }

  const fallback = Date.parse(normalized);
  if (!Number.isNaN(fallback)) {
    const fallbackDate = new Date(fallback);
    return {
      precision: "day",
      year: fallbackDate.getUTCFullYear(),
      month: fallbackDate.getUTCMonth() + 1,
      day: fallbackDate.getUTCDate(),
    };
  }

  return null;
}

function isValidYearMonth(year: number, month: number): boolean {
  return Number.isInteger(year) && year > 0 && Number.isInteger(month) && month >= 1 && month <= 12;
}

function isValidYearMonthDay(year: number, month: number, day: number): boolean {
  if (!isValidYearMonth(year, month) || !Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
