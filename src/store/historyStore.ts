import { create } from "zustand";
import { MAX_HISTORY_ENTRIES, type HistoryEntry } from "../domain/history";
import { readJson, writeJson } from "./storage";

const KEY = "musicmanager-history";

export type HistoryState = {
  /** Newest first. */
  entries: HistoryEntry[];
  add: (entries: HistoryEntry[]) => void;
  markUndone: (ids: string[]) => void;
  /** A file was renamed: entries that pointed to its old path follow it. */
  retarget: (oldTrackId: string, newTrackId: string) => void;
  clear: () => void;
};

function load(): HistoryEntry[] {
  const saved = readJson(KEY);
  if (!Array.isArray(saved)) {
    return [];
  }
  return saved
    .filter((item): item is HistoryEntry => Boolean(item) && typeof item === "object" && typeof (item as HistoryEntry).id === "string" && Array.isArray((item as HistoryEntry).changes))
    .slice(0, MAX_HISTORY_ENTRIES);
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  entries: load(),
  add: (added) => set((state) => ({ entries: [...added, ...state.entries].slice(0, MAX_HISTORY_ENTRIES) })),
  markUndone: (ids) => set((state) => ({ entries: state.entries.map((entry) => (ids.includes(entry.id) ? { ...entry, undone: true } : entry)) })),
  retarget: (oldTrackId, newTrackId) =>
    set((state) => ({ entries: state.entries.map((entry) => (entry.trackId === oldTrackId ? { ...entry, trackId: newTrackId } : entry)) })),
  clear: () => set({ entries: [] }),
}));

useHistoryStore.subscribe((state, previous) => {
  if (state.entries !== previous.entries) {
    writeJson(KEY, state.entries);
  }
});
