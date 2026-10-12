import type { OnlineMatch, Track } from "../types";

export type MatchField = "title" | "artist" | "album" | "tracknumber" | "year" | "cover";

export type MatchDiff = {
  field: MatchField;
  label: string;
  from: string;
  to: string;
};

const LABELS: Record<MatchField, string> = {
  title: "Title",
  artist: "Artist",
  album: "Album",
  tracknumber: "Track",
  year: "Year",
  cover: "Cover",
};

/** The track as it would be after applying a match (same rules as the "Apply" action). */
export function applyMatchToTrack(track: Track, match: OnlineMatch): Track {
  return {
    ...track,
    title: match.title,
    artist: match.artist,
    album: match.album,
    tracknumber: match.tracknumber ?? track.tracknumber,
    year: match.date.slice(0, 4),
    coverUrl: match.coverUrl,
    hasCover: Boolean(match.coverUrl),
  };
}

/** What applying `match` would change in the draft, field by field. Empty when everything already matches. */
export function diffMatch(draft: Track, match: OnlineMatch): MatchDiff[] {
  const next = applyMatchToTrack(draft, match);
  const diffs: MatchDiff[] = [];
  for (const field of ["title", "artist", "album", "tracknumber", "year"] as const) {
    if ((next[field] ?? "") !== (draft[field] ?? "")) {
      diffs.push({ field, label: LABELS[field], from: draft[field] ?? "", to: next[field] ?? "" });
    }
  }
  if ((next.coverUrl ?? "") !== (draft.coverUrl ?? "")) {
    diffs.push({
      field: "cover",
      label: LABELS.cover,
      from: draft.coverUrl || draft.hasCover ? "Current cover" : "None",
      to: match.coverUrl ? "Result cover" : "None",
    });
  }
  return diffs;
}

export type DraftChange = { field: keyof Track | "cover"; label: string };

const EDITABLE: Array<{ field: "title" | "artist" | "album" | "tracknumber" | "year" | "genre"; label: string }> = [
  { field: "title", label: "Title" },
  { field: "artist", label: "Artist" },
  { field: "album", label: "Album" },
  { field: "tracknumber", label: "Track" },
  { field: "year", label: "Year" },
  { field: "genre", label: "Genre" },
];

/** Fields of the draft that differ from the saved track (drives the unsaved-changes state). */
export function getDraftChanges(saved: Track | null, draft: Track | null): DraftChange[] {
  if (!saved || !draft || saved.id !== draft.id) {
    return [];
  }
  const changes: DraftChange[] = EDITABLE.filter(({ field }) => saved[field] !== draft[field]).map(({ field, label }) => ({ field, label }));
  if ((saved.coverUrl ?? "") !== (draft.coverUrl ?? "") || saved.hasCover !== draft.hasCover) {
    changes.push({ field: "cover", label: "Cover" });
  }
  return changes;
}
