import type { AlbumRelease, AlbumSummary, AlbumTrack, Track } from "../types";
import { fileStem } from "./filenameTags";

/** Lowercase, no accents, "&" read as "and", brackets and punctuation removed: for comparing titles. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[([{].*?[)\]}]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(title: string): string[] {
  return normalizeTitle(title).split(" ").filter(Boolean);
}

/** 0…1: how alike two song titles are (word overlap, with a bonus for being identical). */
export function titleSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) {
    return 0;
  }
  if (left.join(" ") === right.join(" ")) {
    return 1;
  }
  const setB = new Set(right);
  const shared = new Set(left.filter((token) => setB.has(token))).size;
  const union = new Set([...left, ...right]).size;
  const jaccard = shared / union;
  const containment = shared / Math.min(new Set(left).size, setB.size);
  return Math.max(jaccard, containment * 0.9);
}

function trackNumber(value: string): number | null {
  const match = /\d+/.exec(value);
  return match ? Number(match[0]) : null;
}

/** The title to compare for a local track: its tag, or its file name when untitled. */
export function localTitle(track: Track): string {
  const tag = track.title.trim();
  return tag || fileStem(track.path).replace(/^\s*\d+\s*[-._)]*\s*/, "");
}

export type AlbumMatchRow = {
  trackId: string;
  /** Index in `release.tracks`, or null when nothing fits. */
  releaseIndex: number | null;
  /** 0…1, how sure the match is. */
  confidence: number;
};

export type AlbumMatchResult = {
  rows: AlbumMatchRow[];
  /** Indexes of release tracks that no local track was matched to. */
  missing: number[];
};

const MIN_SCORE = 0.5;

/** Pairs local tracks with the tracks of a release, one to one, best matches first. */
export function matchTracksToRelease(tracks: Track[], release: Pick<AlbumRelease, "tracks">): AlbumMatchResult {
  type Candidate = { local: number; remote: number; score: number };
  const candidates: Candidate[] = [];
  tracks.forEach((track, local) => {
    const title = localTitle(track);
    const localNumber = trackNumber(track.tracknumber);
    release.tracks.forEach((remote, remoteIndex) => {
      const similarity = titleSimilarity(title, remote.title);
      const sameNumber = localNumber !== null && localNumber === trackNumber(remote.number);
      let score = similarity;
      if (sameNumber) {
        // A matching position backs up a similar title; for an untitled file it is the best clue left.
        score = similarity > 0 ? similarity + 0.2 : track.title.trim() ? 0 : 0.55;
      }
      if (score >= MIN_SCORE) {
        candidates.push({ local, remote: remoteIndex, score });
      }
    });
  });

  candidates.sort((a, b) => b.score - a.score || Math.abs(a.local - a.remote) - Math.abs(b.local - b.remote));
  const takenLocal = new Set<number>();
  const takenRemote = new Set<number>();
  const chosen = new Map<number, Candidate>();
  for (const candidate of candidates) {
    if (takenLocal.has(candidate.local) || takenRemote.has(candidate.remote)) {
      continue;
    }
    takenLocal.add(candidate.local);
    takenRemote.add(candidate.remote);
    chosen.set(candidate.local, candidate);
  }

  return {
    rows: tracks.map((track, local) => {
      const pick = chosen.get(local);
      return { trackId: track.id, releaseIndex: pick ? pick.remote : null, confidence: pick ? Math.min(1, pick.score) : 0 };
    }),
    missing: release.tracks.map((_, index) => index).filter((index) => !takenRemote.has(index)),
  };
}

export type AlbumApplyOptions = {
  /** Also write album, year and (when the files have none) nothing else changes about the artist. */
  setAlbumFields: boolean;
};

/** The tags a matched track gets from its release track. */
export function buildAlbumPatch(release: AlbumRelease | Pick<AlbumRelease, "title" | "date">, remote: AlbumTrack, options: AlbumApplyOptions) {
  const patch: Partial<Pick<Track, "title" | "artist" | "album" | "tracknumber" | "year">> = {
    title: remote.title,
    tracknumber: String(trackNumber(remote.number) ?? remote.number),
  };
  if (remote.artist) {
    patch.artist = remote.artist;
  }
  if (options.setAlbumFields) {
    patch.album = release.title;
    const year = release.date.slice(0, 4);
    if (/^\d{4}$/.test(year)) {
      patch.year = year;
    }
  }
  return patch;
}

/** The album most of the tracks belong to, to prefill the search. */
export function guessAlbum(tracks: Track[]): { artist: string; album: string } {
  const mostCommon = (values: string[]): string => {
    const counts = new Map<string, number>();
    for (const value of values.map((item) => item.trim()).filter(Boolean)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  };
  return { artist: mostCommon(tracks.map((track) => track.artist)), album: mostCommon(tracks.map((track) => track.album)) };
}

/** One-line description of a candidate release for a list. */
export function describeRelease(release: AlbumSummary): string {
  return [release.date.slice(0, 4), release.country, release.label, release.disambiguation].filter(Boolean).join(" · ");
}

/** What "match this album" acts on: several tracks as they are, or one track widened to its whole album. */
export function albumIdsFor(library: Track[], ids: string[]): string[] {
  if (ids.length !== 1) {
    return ids;
  }
  const track = library.find((item) => item.id === ids[0]);
  if (!track || !track.album.trim()) {
    return ids;
  }
  const same = library.filter(
    (item) => item.album === track.album && item.artist === track.artist && item.source?.type !== "navidrome"
  );
  return same.length ? same.map((item) => item.id) : ids;
}
