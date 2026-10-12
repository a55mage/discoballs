import type { Track } from "../types";

export type TagField = "title" | "artist" | "album" | "tracknumber" | "year" | "genre";

export const TAG_FIELDS: Array<{ field: TagField; label: string }> = [
  { field: "title", label: "Title" },
  { field: "artist", label: "Artist" },
  { field: "album", label: "Album" },
  { field: "tracknumber", label: "Track" },
  { field: "year", label: "Year" },
  { field: "genre", label: "Genre" },
];

export type HistoryChange = { field: TagField; label: string; from: string; to: string };

export type HistoryEntry = {
  id: string;
  /** Milliseconds since the epoch. */
  at: number;
  /** What the user did: "Tags saved", "Batch edit"… */
  label: string;
  /** Shared by the entries of one batch operation, so they can be undone together. */
  batchId?: string;
  /** The track as it is identified now (its path); updated when the file is renamed again. */
  trackId: string;
  trackTitle: string;
  changes: HistoryChange[];
  /** File names, when the change renamed the file. */
  renamedFrom?: string;
  renamedTo?: string;
  /** The cover changed too; covers are not restored by undo. */
  coverChanged?: boolean;
  undone?: boolean;
};

export function diffTags(before: Track, after: Track): HistoryChange[] {
  return TAG_FIELDS.filter(({ field }) => before[field] !== after[field]).map(({ field, label }) => ({
    field,
    label,
    from: before[field],
    to: after[field],
  }));
}

export function summarizeChanges(entry: HistoryEntry): string {
  const parts = entry.changes.map((change) => `${change.label}: ${change.from || "—"} → ${change.to || "—"}`);
  if (entry.renamedFrom && entry.renamedTo) {
    parts.push(`File: ${entry.renamedFrom} → ${entry.renamedTo}`);
  }
  if (entry.coverChanged) {
    parts.push("Cover changed");
  }
  return parts.join(" · ");
}

/** "just now", "5 min ago", "2 h ago", or the date. */
export function formatAgo(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(at).toLocaleDateString();
}

export const MAX_HISTORY_ENTRIES = 200;

export type HistoryGroup = {
  key: string;
  label: string;
  at: number;
  entries: HistoryEntry[];
  /** Every entry of the group was undone. */
  undone: boolean;
};

/** Entries newest first, with the entries of one batch operation folded into a single group. */
export function groupHistory(entries: HistoryEntry[]): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  const byBatch = new Map<string, HistoryGroup>();
  for (const entry of entries) {
    const existing = entry.batchId ? byBatch.get(entry.batchId) : undefined;
    if (existing) {
      existing.entries.push(entry);
      existing.undone = existing.undone && Boolean(entry.undone);
      continue;
    }
    const group: HistoryGroup = { key: entry.batchId ?? entry.id, label: entry.label, at: entry.at, entries: [entry], undone: Boolean(entry.undone) };
    groups.push(group);
    if (entry.batchId) {
      byBatch.set(entry.batchId, group);
    }
  }
  return groups;
}
