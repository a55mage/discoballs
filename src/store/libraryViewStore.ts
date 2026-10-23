import { create } from "zustand";
import type { HealthFilter, LibraryScope, LibraryTab, SortDirection, SortKey } from "../domain/libraryView";
import { readJson, readString, writeJson, writeString } from "./storage";
import { fieldSetter, type Setter } from "./util";

const KEYS = {
  tab: "musicmanager-library-tab",
  sortKey: "musicmanager-library-sort-key",
  sortDirection: "musicmanager-library-sort-direction",
  ignoredDuplicates: "musicmanager-ignored-duplicates",
  duplicatesIgnoreFormats: "musicmanager-duplicates-ignore-formats",
  tagEditorSort: "musicmanager-tag-editor-sort",
} as const;

/** Order of the Tag Editor's file list: by folder (scan order), newest additions first, or by title / artist. */
export type TagEditorSort = "folder" | "added" | "title" | "artist";
const TAG_EDITOR_SORTS: TagEditorSort[] = ["folder", "added", "title", "artist"];

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
  /** Duplicate groups (see `duplicateKey`) the user marked as "not duplicates". */
  ignoredDuplicates: string[];
  /** Count only copies in the same format as duplicates (FLAC + MP3 of one song are fine). */
  duplicatesIgnoreFormats: boolean;
  tagEditorSort: TagEditorSort;

  setTab: Setter<LibraryTab>;
  setQuery: Setter<string>;
  setFilter: Setter<HealthFilter>;
  setScope: Setter<LibraryScope>;
  setSelection: (ids: string[], anchorId?: string) => void;
  setFolderSegments: Setter<string[]>;
  setDuplicatesIgnoreFormats: Setter<boolean>;
  setTagEditorSort: Setter<TagEditorSort>;
  /** Same key again reverses the direction, a new key starts ascending. */
  clickSort: (key: SortKey) => void;
  ignoreDuplicateGroup: (key: string) => void;
  resetIgnoredDuplicates: () => void;
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
    duplicatesIgnoreFormats: readString(KEYS.duplicatesIgnoreFormats) === "true",
    ignoredDuplicates: Array.isArray(readJson(KEYS.ignoredDuplicates)) ? (readJson(KEYS.ignoredDuplicates) as unknown[]).filter((item): item is string => typeof item === "string") : [],
    tagEditorSort: ((value) => (TAG_EDITOR_SORTS.includes(value as TagEditorSort) ? (value as TagEditorSort) : "folder"))(readString(KEYS.tagEditorSort)),

    setTab: fieldSetter(set, "tab"),
    setQuery: fieldSetter(set, "query"),
    setFilter: fieldSetter(set, "filter"),
    setScope: fieldSetter(set, "scope"),
    setSelection: (selectedIds, anchorId) => set((state) => ({ selectedIds, anchorId: anchorId ?? state.anchorId })),
    setFolderSegments: fieldSetter(set, "folderSegments"),
    setDuplicatesIgnoreFormats: fieldSetter(set, "duplicatesIgnoreFormats"),
    setTagEditorSort: fieldSetter(set, "tagEditorSort"),
    ignoreDuplicateGroup: (key) => set((state) => (state.ignoredDuplicates.includes(key) ? state : { ignoredDuplicates: [...state.ignoredDuplicates, key] })),
    resetIgnoredDuplicates: () => set({ ignoredDuplicates: [] }),
    clickSort: (key) =>
      set((state) =>
        state.sortKey === key
          ? { sortDirection: state.sortDirection === "asc" ? "desc" : "asc" }
          : // Newest first is the useful start for dates.
            { sortKey: key, sortDirection: key === "added" ? "desc" : "asc" }
      ),
  };
});

useLibraryViewStore.subscribe((state, previous) => {
  if (state.tab !== previous.tab) writeString(KEYS.tab, state.tab);
  if (state.sortKey !== previous.sortKey) writeString(KEYS.sortKey, state.sortKey);
  if (state.sortDirection !== previous.sortDirection) writeString(KEYS.sortDirection, state.sortDirection);
  if (state.duplicatesIgnoreFormats !== previous.duplicatesIgnoreFormats) writeString(KEYS.duplicatesIgnoreFormats, String(state.duplicatesIgnoreFormats));
  if (state.ignoredDuplicates !== previous.ignoredDuplicates) writeJson(KEYS.ignoredDuplicates, state.ignoredDuplicates);
  if (state.tagEditorSort !== previous.tagEditorSort) writeString(KEYS.tagEditorSort, state.tagEditorSort);
});
