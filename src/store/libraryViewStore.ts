import { create } from "zustand";
import type { HealthFilter, LibraryScope, LibraryTab, SortDirection, SortKey } from "../domain/libraryView";
import { readString, writeString } from "./storage";
import { fieldSetter, type Setter } from "./util";

const KEYS = {
  tab: "musicmanager-library-tab",
  sortKey: "musicmanager-library-sort-key",
  sortDirection: "musicmanager-library-sort-direction",
} as const;

const TABS: LibraryTab[] = ["tracks", "albums", "artists", "folders"];
const SORT_KEYS: SortKey[] = ["added", "title", "artist", "album", "year", "genre", "format"];

export type LibraryViewState = {
  tab: LibraryTab;
  query: string;
  filter: HealthFilter;
  scope: LibraryScope;
  sortKey: SortKey;
  sortDirection: SortDirection;
  /** Ids selected in the Tracks tab (the inspector works on these). */
  selectedIds: string[];
  /** Last clicked track: origin of shift-click ranges and of keyboard navigation. */
  anchorId: string;
  /** Position in the Folders tab, relative to the library root. */
  folderSegments: string[];

  setTab: Setter<LibraryTab>;
  setQuery: Setter<string>;
  setFilter: Setter<HealthFilter>;
  setScope: Setter<LibraryScope>;
  setSelection: (ids: string[], anchorId?: string) => void;
  setFolderSegments: Setter<string[]>;
  /** Same key again reverses the direction, a new key starts ascending. */
  clickSort: (key: SortKey) => void;
};

export const useLibraryViewStore = create<LibraryViewState>()((set) => {
  const savedTab = readString(KEYS.tab) as LibraryTab | null;
  const savedSort = readString(KEYS.sortKey) as SortKey | null;
  return {
    tab: savedTab && TABS.includes(savedTab) ? savedTab : "tracks",
    query: "",
    filter: "all",
    scope: null,
    sortKey: savedSort && SORT_KEYS.includes(savedSort) ? savedSort : "added",
    sortDirection: readString(KEYS.sortDirection) === "desc" ? "desc" : "asc",
    selectedIds: [],
    anchorId: "",
    folderSegments: [],

    setTab: fieldSetter(set, "tab"),
    setQuery: fieldSetter(set, "query"),
    setFilter: fieldSetter(set, "filter"),
    setScope: fieldSetter(set, "scope"),
    setSelection: (selectedIds, anchorId) => set((state) => ({ selectedIds, anchorId: anchorId ?? state.anchorId })),
    setFolderSegments: fieldSetter(set, "folderSegments"),
    clickSort: (key) =>
      set((state) =>
        state.sortKey === key
          ? { sortDirection: state.sortDirection === "asc" ? "desc" : "asc" }
          : { sortKey: key, sortDirection: "asc" }
      ),
  };
});

useLibraryViewStore.subscribe((state, previous) => {
  if (state.tab !== previous.tab) writeString(KEYS.tab, state.tab);
  if (state.sortKey !== previous.sortKey) writeString(KEYS.sortKey, state.sortKey);
  if (state.sortDirection !== previous.sortDirection) writeString(KEYS.sortDirection, state.sortDirection);
});
