import type { Track } from "../types";
import { getTrackReleaseSortKey } from "../utils/appHelpers";
import { getExtension } from "../utils/common";

export type LibraryTab = "tracks" | "albums" | "artists" | "folders";
export type HealthFilter = "all" | "cover" | "tags" | "duplicates" | "favorites";
export type SortKey = "added" | "title" | "artist" | "album" | "year" | "genre" | "format" | "rating";
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

export type DuplicateOptions = {
  /** When true, the same song in different formats (for instance FLAC and MP3) is not a duplicate. */
  ignoreOtherFormats?: boolean;
};

/** Case, accents, punctuation and spacing do not make a song different: "Café  del Mar!" is "cafe del mar". */
function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}()]+/gu, " ")
    .trim();
}

/** Title and artist of a track, folded; the part of the key that does not depend on options. Null for untitled tracks. */
function songKey(track: Track): string | null {
  const title = foldText(track.title);
  const artist = foldText(track.artist);
  return title && artist ? `${title}|${artist}` : null;
}

/**
 * Key shared by tracks that look like the same song: title and artist, plus the format when other formats
 * are ignored. Null for untitled tracks.
 */
export function duplicateKey(track: Track, options: DuplicateOptions = {}): string | null {
  const song = songKey(track);
  if (!song) {
    return null;
  }
  return options.ignoreOtherFormats ? `${song}|${getFormat(track)}` : song;
}

export type DuplicateGroup = { key: string; tracks: Track[] };

/** Groups of two or more tracks with the same title and artist (except the groups the user marked as not duplicates). */
export function findDuplicateGroups(tracks: Track[], ignoredKeys: ReadonlySet<string> = new Set(), options: DuplicateOptions = {}): DuplicateGroup[] {
  const groups = new Map<string, Track[]>();
  for (const track of tracks) {
    const key = duplicateKey(track, options);
    if (key && !ignoredKeys.has(key) && !ignoredKeys.has(songKey(track) ?? "")) {
      groups.set(key, [...(groups.get(key) ?? []), track]);
    }
  }
  return [...groups.entries()].filter(([, list]) => list.length > 1).map(([key, list]) => ({ key, tracks: list }));
}

/** Ids of tracks that share title and artist with another track. */
export function findDuplicateIds(tracks: Track[], ignoredKeys: ReadonlySet<string> = new Set(), options: DuplicateOptions = {}): Set<string> {
  const ids = new Set<string>();
  for (const group of findDuplicateGroups(tracks, ignoredKeys, options)) {
    group.tracks.forEach((track) => ids.add(track.id));
  }
  return ids;
}

const FORMAT_QUALITY: Record<string, number> = { FLAC: 5, WAV: 5, AIFF: 5, ALAC: 5, M4A: 3, AAC: 3, OPUS: 3, OGG: 3, MP3: 2 };

/** Which track of a group is the one to keep: lossless first, then complete tags and cover, then not a "copy". */
export function suggestKeep(group: DuplicateGroup): Track {
  const score = (track: Track, index: number): number => {
    let value = (FORMAT_QUALITY[getFormat(track)] ?? 1) * 10;
    if (hasCover(track)) value += 4;
    if (hasAllTags(track)) value += 4;
    if (/\b(copy|copia|duplicate)\b|\(\d+\)/i.test(`${track.path} ${track.album}`)) value -= 6;
    return value - index * 0.01;
  };
  return group.tracks.reduce((best, track, index) => (score(track, index) > score(best, group.tracks.indexOf(best)) ? track : best), group.tracks[0]);
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

export type HealthCounts = { all: number; cover: number; tags: number; duplicates: number; favorites: number; withIssues: number };

export function countHealth(tracks: Track[], duplicateIds: Set<string>, favoriteIds: ReadonlySet<string> = new Set()): HealthCounts {
  return {
    all: tracks.length,
    cover: tracks.filter((track) => !hasCover(track)).length,
    tags: tracks.filter((track) => !hasAllTags(track)).length,
    duplicates: duplicateIds.size,
    favorites: tracks.filter((track) => favoriteIds.has(track.id)).length,
    withIssues: tracks.filter((track) => getTrackIssues(track, duplicateIds).length > 0).length,
  };
}

/** What the library list needs to know besides the tracks themselves. */
export type ViewContext = {
  duplicateIds: ReadonlySet<string>;
  favoriteIds?: ReadonlySet<string>;
  ratings?: Readonly<Record<string, number>>;
};

export function matchesHealthFilter(track: Track, filter: HealthFilter, duplicateIds: ReadonlySet<string>, favoriteIds: ReadonlySet<string> = new Set()): boolean {
  switch (filter) {
    case "favorites":
      return favoriteIds.has(track.id);
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

export function sortTracks(tracks: Track[], key: SortKey, direction: SortDirection, ratings: Readonly<Record<string, number>> = {}): Track[] {
  if (key === "added") {
    // Undated tracks (old snapshots) go last; ties keep the scan order, reversed with the direction.
    const order = new Map(tracks.map((track, index) => [track.id, index]));
    const sign = direction === "desc" ? -1 : 1;
    return [...tracks].sort((a, b) => {
      if (a.addedAt === undefined || b.addedAt === undefined) {
        if (a.addedAt !== b.addedAt) return a.addedAt === undefined ? 1 : -1;
      } else if (a.addedAt !== b.addedAt) {
        return sign * (a.addedAt - b.addedAt);
      }
      return sign * ((order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    });
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
    if (key === "rating") {
      // Best rated first when ascending is not natural: ascending means 1 star → 5 stars, unrated first.
      return (ratings[a.id] ?? 0) - (ratings[b.id] ?? 0) || collator.compare(a.title, b.title);
    }
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
export function getVisibleTracks(tracks: Track[], view: LibraryViewInput, duplicateIds: ReadonlySet<string>, extras: Omit<ViewContext, "duplicateIds"> = {}): Track[] {
  const filtered = tracks.filter(
    (track) =>
      matchesQuery(track, view.query) &&
      matchesScope(track, view.scope) &&
      matchesHealthFilter(track, view.filter, duplicateIds, extras.favoriteIds)
  );
  return sortTracks(filtered, view.sortKey, view.sortDirection, extras.ratings);
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
