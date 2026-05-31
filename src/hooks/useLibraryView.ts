import { type UIEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "../types";
import { getTrackReleaseSortKey } from "../utils/appHelpers";

const TRACK_LIST_OVERSCAN_ROWS = 4;
const TRACK_LIST_CARD_MIN_WIDTH = 250;
const TRACK_LIST_COMPACT_MIN_WIDTH = 320;
const TRACK_LIST_CARD_ROW_HEIGHT = 68;
const TRACK_LIST_COMPACT_ROW_HEIGHT = 32;
const TRACK_LIST_CARD_GAP = 8;
const TRACK_LIST_COMPACT_GAP = 4;
const TRACK_LIST_VIRTUALIZE_AFTER = 120;

export type LibraryViewMode = "card" | "compact";
export type LibrarySortMode = "title" | "artist" | "added" | "release";
export type SortDirection = "asc" | "desc";
export type FileSystemEntry =
  | { type: "folder"; name: string; pathSegments: string[]; trackCount: number }
  | { type: "track"; name: string; track: Track };

function splitPath(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean);
}

function getRelativeTrackSegments(trackPath: string, folderPath: string) {
  const trackSegments = splitPath(trackPath);
  const rootSegments = splitPath(folderPath);
  const rootMatches = rootSegments.every((segment, index) => (
    segment.localeCompare(trackSegments[index] ?? "", undefined, { sensitivity: "accent" }) === 0
  ));
  return rootMatches ? trackSegments.slice(rootSegments.length) : trackSegments.slice(-1);
}

function getTrackFileName(track: Track) {
  const segments = splitPath(track.path);
  return segments[segments.length - 1] || track.title || "Untitled";
}

export function useLibraryView(tracks: Track[], activeScreen: string, folderPath: string) {
  const trackListRef = useRef<HTMLUListElement | null>(null);
  const [query, setQuery] = useState("");
  const [librarySortMode, setLibrarySortMode] = useState<LibrarySortMode>("added");
  const [librarySortDirection, setLibrarySortDirection] = useState<SortDirection>("asc");
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("card");
  const [isFileSystemView, setIsFileSystemView] = useState(false);
  const [fileSystemPathSegments, setFileSystemPathSegments] = useState<string[]>([]);
  const [trackListScrollTop, setTrackListScrollTop] = useState(0);
  const [trackListViewportHeight, setTrackListViewportHeight] = useState(420);
  const [trackListWidth, setTrackListWidth] = useState(0);

  useEffect(() => {
    const list = trackListRef.current;
    if (!list) {
      return;
    }
    const updateMetrics = () => {
      setTrackListViewportHeight(list.clientHeight || 420);
      setTrackListWidth(list.clientWidth || 0);
    };
    updateMetrics();
    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(updateMetrics);
      observer.observe(list);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateMetrics);
    return () => {
      window.removeEventListener("resize", updateMetrics);
    };
  }, [libraryViewMode, activeScreen]);

  useEffect(() => {
    const list = trackListRef.current;
    if (list) {
      list.scrollTop = 0;
    }
    setTrackListScrollTop(0);
  }, [query, libraryViewMode, tracks.length, activeScreen, fileSystemPathSegments]);

  const filteredTracks = useMemo(() => {
    const q = query.toLowerCase();
    const sourceTracks = query.trim()
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q) ||
            t.path.toLowerCase().includes(q)
        )
      : tracks;
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });
    const tracksInScanOrder = [...sourceTracks];
    let sortedTracks = tracksInScanOrder;
    switch (librarySortMode) {
      case "title":
        sortedTracks = [...sourceTracks].sort((a, b) => collator.compare(a.title || "", b.title || ""));
        break;
      case "artist":
        sortedTracks = [...sourceTracks].sort((a, b) => collator.compare(a.artist || "", b.artist || ""));
        break;
      case "release":
        sortedTracks = [...sourceTracks].sort((a, b) => {
          const aYear = getTrackReleaseSortKey(a.year);
          const bYear = getTrackReleaseSortKey(b.year);
          if (aYear !== bYear) {
            return aYear - bYear;
          }
          return collator.compare(a.title || "", b.title || "");
        });
        break;
      case "added":
      default:
        sortedTracks = tracksInScanOrder;
        break;
    }
    return librarySortDirection === "desc" ? [...sortedTracks].reverse() : sortedTracks;
  }, [tracks, query, librarySortMode, librarySortDirection]);

  const virtualTrackWindow = useMemo(() => {
    const isCompact = libraryViewMode === "compact";
    const gap = isCompact ? TRACK_LIST_COMPACT_GAP : TRACK_LIST_CARD_GAP;
    const rowHeight = isCompact ? TRACK_LIST_COMPACT_ROW_HEIGHT : TRACK_LIST_CARD_ROW_HEIGHT;
    const minWidth = isCompact ? TRACK_LIST_COMPACT_MIN_WIDTH : TRACK_LIST_CARD_MIN_WIDTH;
    const columns = Math.max(1, Math.floor((trackListWidth + gap) / (minWidth + gap)));
    const totalRows = Math.ceil(filteredTracks.length / columns);
    const shouldVirtualize = filteredTracks.length > TRACK_LIST_VIRTUALIZE_AFTER;

    if (!shouldVirtualize) {
      return {
        visibleTracks: filteredTracks,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const viewportRows = Math.max(1, Math.ceil(trackListViewportHeight / rowHeight));
    const startRow = Math.max(0, Math.floor(trackListScrollTop / rowHeight) - TRACK_LIST_OVERSCAN_ROWS);
    const endRow = Math.min(totalRows, startRow + viewportRows + TRACK_LIST_OVERSCAN_ROWS * 2);
    const startIndex = startRow * columns;
    const endIndex = Math.min(filteredTracks.length, endRow * columns);

    return {
      visibleTracks: filteredTracks.slice(startIndex, endIndex),
      topSpacerHeight: startRow * rowHeight,
      bottomSpacerHeight: Math.max(0, (totalRows - endRow) * rowHeight),
    };
  }, [filteredTracks, libraryViewMode, trackListScrollTop, trackListViewportHeight, trackListWidth]);

  useEffect(() => {
    setFileSystemPathSegments([]);
  }, [folderPath]);

  const fileSystemEntries = useMemo<FileSystemEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const folders = new Map<string, { name: string; pathSegments: string[]; trackCount: number }>();
    const currentTracks: Track[] = [];

    for (const track of tracks) {
      const relativeSegments = getRelativeTrackSegments(track.path, folderPath);
      if (!relativeSegments.length) {
        continue;
      }
      const isInsideCurrentPath = fileSystemPathSegments.every((segment, index) => relativeSegments[index] === segment);
      if (!isInsideCurrentPath) {
        continue;
      }
      const rest = relativeSegments.slice(fileSystemPathSegments.length);
      if (rest.length > 1) {
        const folderName = rest[0];
        const nextPathSegments = [...fileSystemPathSegments, folderName];
        const key = nextPathSegments.join("/");
        const existing = folders.get(key);
        if (existing) {
          existing.trackCount += 1;
        } else {
          folders.set(key, { name: folderName, pathSegments: nextPathSegments, trackCount: 1 });
        }
        continue;
      }
      currentTracks.push(track);
    }

    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    const folderEntries = [...folders.values()]
      .filter((folder) => !q || folder.name.toLowerCase().includes(q))
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((folder) => ({ type: "folder" as const, ...folder }));
    const trackEntries = currentTracks
      .filter((track) => {
        if (!q) {
          return true;
        }
        const name = getTrackFileName(track).toLowerCase();
        return (
          name.includes(q) ||
          track.title.toLowerCase().includes(q) ||
          track.artist.toLowerCase().includes(q) ||
          track.album.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => collator.compare(getTrackFileName(a), getTrackFileName(b)))
      .map((track) => ({ type: "track" as const, name: getTrackFileName(track), track }));

    return [...folderEntries, ...trackEntries];
  }, [fileSystemPathSegments, folderPath, query, tracks]);

  const fileSystemCurrentPath = fileSystemPathSegments.length
    ? fileSystemPathSegments.join(" / ")
    : "Library root";

  function openFileSystemFolder(pathSegments: string[]) {
    setFileSystemPathSegments(pathSegments);
  }

  function goUpFileSystemFolder() {
    setFileSystemPathSegments((prev) => prev.slice(0, -1));
  }

  function handleLibrarySortClick(mode: LibrarySortMode) {
    if (mode === librarySortMode) {
      setLibrarySortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setLibrarySortMode(mode);
    setLibrarySortDirection("asc");
  }

  function handleTrackListScroll(event: UIEvent<HTMLUListElement>) {
    setTrackListScrollTop(event.currentTarget.scrollTop);
  }

  return {
    query,
    setQuery,
    librarySortMode,
    librarySortDirection,
    libraryViewMode,
    setLibraryViewMode,
    isFileSystemView,
    setIsFileSystemView,
    fileSystemEntries,
    fileSystemCurrentPath,
    canGoUpFileSystemFolder: fileSystemPathSegments.length > 0,
    openFileSystemFolder,
    goUpFileSystemFolder,
    trackListRef,
    handleTrackListScroll,
    handleLibrarySortClick,
    filteredTracks,
    virtualTrackWindow,
  };
}
