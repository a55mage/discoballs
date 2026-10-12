import type { Track } from "../types";
import { getTrackReleaseSortKey } from "../utils/appHelpers";
import { getExtension } from "../utils/common";

export type LibraryTab = "tracks" | "albums" | "artists" | "folders";
export type HealthFilter = "all" | "cover" | "tags" | "duplicates";
export type SortKey = "added" | "title" | "artist" | "album" | "year" | "genre" | "format";
export type SortDirection = "asc" | "desc";

/** Narrows the track list to one album or one artist (set by clicking a card in Albums / Artists). */
export type LibraryScope = { kind: "album"; artist: string; album: string } | { kind: "artist"; artist: string } | null;

export type TrackIssue = "No cover" | "Missing tags" | "No genre" | "No year" | "Possible duplicate";

export const UNKNOWN_ARTIST = "Unknown artist";
export const UNKNOWN_ALBUM = "Unknown album";

export function hasCover(track: Track): boolean {
  return track.hasCover || Boolean(track.coverUrl);
}

export function hasCoreTags(track: Track): boolean {
  return Boolean(track.title.trim() && track.artist.trim() && track.album.trim());
}

export function hasAllTags(track: Track): boolean {
  return hasCoreTags(track) && Boolean(track.genre.trim() && track.year.trim());
}

/** Ids of tracks that share title and artist with another track. */
export function findDuplicateIds(tracks: Track[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const track of tracks) {
    const title = track.title.trim().toLowerCase();
    const artist = track.artist.trim().toLowerCase();
    if (!title || !artist) {
      continue;
    }
    const key = `${title}|${artist}`;
    groups.set(key, [...(groups.get(key) ?? []), track.id]);
  }
  const duplicates = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) {
      ids.forEach((id) => duplicates.add(id));
    }
  }
  return duplicates;
}

export function getTrackIssues(track: Track, duplicateIds: Set<string>): TrackIssue[] {
  const issues: TrackIssue[] = [];
  if (!hasCover(track)) issues.push("No cover");
  if (!hasCoreTags(track)) issues.push("Missing tags");
  if (!track.genre.trim()) issues.push("No genre");
  if (!track.year.trim()) issues.push("No year");
  if (duplicateIds.has(track.id)) issues.push("Possible duplicate");
  return issues;
}

export type HealthCounts = { all: number; cover: number; tags: number; duplicates: number; withIssues: number };

export function countHealth(tracks: Track[], duplicateIds: Set<string>): HealthCounts {
  return {
    all: tracks.length,
    cover: tracks.filter((track) => !hasCover(track)).length,
    tags: tracks.filter((track) => !hasAllTags(track)).length,
    duplicates: duplicateIds.size,
    withIssues: tracks.filter((track) => getTrackIssues(track, duplicateIds).length > 0).length,
  };
}

export function matchesHealthFilter(track: Track, filter: HealthFilter, duplicateIds: Set<string>): boolean {
  switch (filter) {
    case "cover":
      return !hasCover(track);
    case "tags":
      return !hasAllTags(track);
    case "duplicates":
      return duplicateIds.has(track.id);
    default:
      return true;
  }
}

export function matchesScope(track: Track, scope: LibraryScope): boolean {
  if (!scope) {
    return true;
  }
  const artist = track.artist.trim() || UNKNOWN_ARTIST;
  if (scope.kind === "artist") {
    return artist.toLowerCase() === scope.artist.toLowerCase();
  }
  const album = track.album.trim() || UNKNOWN_ALBUM;
  return artist.toLowerCase() === scope.artist.toLowerCase() && album.toLowerCase() === scope.album.toLowerCase();
}

export function matchesQuery(track: Track, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [track.title, track.artist, track.album, track.genre, track.year, track.path].some((value) =>
    value.toLowerCase().includes(needle)
  );
}

export function getFormat(track: Track): string {
  return getExtension(track.path).replace(/^\./, "").toUpperCase();
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function sortTracks(tracks: Track[], key: SortKey, direction: SortDirection): Track[] {
  if (key === "added") {
    return direction === "desc" ? [...tracks].reverse() : [...tracks];
  }
  const value = (track: Track): string => {
    switch (key) {
      case "title":
        return track.title;
      case "artist":
        return track.artist;
      case "album":
        return track.album;
      case "genre":
        return track.genre;
      case "format":
        return getFormat(track);
      default:
        return "";
    }
  };
  const sorted = [...tracks].sort((a, b) => {
    if (key === "year") {
      return getTrackReleaseSortKey(a.year) - getTrackReleaseSortKey(b.year) || collator.compare(a.title, b.title);
    }
    // Empty values always go last, whatever the direction.
    const left = value(a);
    const right = value(b);
    if (!left && right) return 1;
    if (left && !right) return -1;
    return collator.compare(left, right) || collator.compare(a.title, b.title);
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

export type LibraryViewInput = {
  query: string;
  filter: HealthFilter;
  scope: LibraryScope;
  sortKey: SortKey;
  sortDirection: SortDirection;
};

/** The tracks shown in the Tracks tab (and used as the play queue when playing from the library). */
export function getVisibleTracks(tracks: Track[], view: LibraryViewInput, duplicateIds: Set<string>): Track[] {
  const filtered = tracks.filter(
    (track) =>
      matchesQuery(track, view.query) && matchesScope(track, view.scope) && matchesHealthFilter(track, view.filter, duplicateIds)
  );
  return sortTracks(filtered, view.sortKey, view.sortDirection);
}

/** Inclusive range of ids between two tracks in a list (shift-click selection). */
export function getIdRange(orderedIds: string[], fromId: string, toId: string): string[] {
  const from = orderedIds.indexOf(fromId);
  const to = orderedIds.indexOf(toId);
  if (from < 0 || to < 0) {
    return toId ? [toId] : [];
  }
  const [start, end] = from <= to ? [from, to] : [to, from];
  return orderedIds.slice(start, end + 1);
}

function splitPath(path: string): string[] {
  return path.replace(/\\/g, "/").split("/").filter(Boolean);
}

function relativeSegments(trackPath: string, rootPath: string): string[] {
  const track = splitPath(trackPath);
  const root = splitPath(rootPath);
  const matches = root.every((segment, index) => segment.localeCompare(track[index] ?? "", undefined, { sensitivity: "accent" }) === 0);
  return matches ? track.slice(root.length) : track.slice(-1);
}

export type FolderEntry =
  | { type: "folder"; name: string; pathSegments: string[]; trackCount: number }
  | { type: "track"; name: string; track: Track };

/** One level of the library's folder tree: sub-folders first, then the tracks stored directly in it. */
export function buildFolderEntries(tracks: Track[], rootPath: string, currentSegments: string[], query: string): FolderEntry[] {
  const needle = query.trim().toLowerCase();
  const folders = new Map<string, { name: string; pathSegments: string[]; trackCount: number }>();
  const direct: Track[] = [];

  for (const track of tracks) {
    const relative = relativeSegments(track.path, rootPath);
    if (!relative.length || !currentSegments.every((segment, index) => relative[index] === segment)) {
      continue;
    }
    const rest = relative.slice(currentSegments.length);
    if (rest.length > 1) {
      const pathSegments = [...currentSegments, rest[0]];
      const key = pathSegments.join("/");
      const existing = folders.get(key);
      if (existing) {
        existing.trackCount += 1;
      } else {
        folders.set(key, { name: rest[0], pathSegments, trackCount: 1 });
      }
    } else {
      direct.push(track);
    }
  }

  const fileName = (track: Track) => splitPath(track.path).pop() || track.title || "Untitled";
  const folderEntries = [...folders.values()]
    .filter((folder) => !needle || folder.name.toLowerCase().includes(needle))
    .sort((a, b) => collator.compare(a.name, b.name))
    .map((folder) => ({ type: "folder" as const, ...folder }));
  const trackEntries = direct
    .filter((track) => !needle || fileName(track).toLowerCase().includes(needle) || matchesQuery(track, needle))
    .sort((a, b) => collator.compare(fileName(a), fileName(b)))
    .map((track) => ({ type: "track" as const, name: fileName(track), track }));
  return [...folderEntries, ...trackEntries];
}
