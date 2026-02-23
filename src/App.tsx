import { type ChangeEvent, type CSSProperties, type MouseEvent, type SVGProps, type UIEvent, useEffect, useMemo, useRef, useState } from "react";
import { createAdapter } from "./api/tauriAdapter";
import { mockAdapter } from "./api/mockAdapter";
import { LibrarySection } from "./sections/LibrarySection";
import { OnlineSearchSection } from "./sections/OnlineSearchSection";
import { TrackDetailsSection } from "./sections/TrackDetailsSection";
import type { OnlineMatch, RenameField, SearchQuery, Track, TrackTechnicalInfo } from "./types";

const adapter = createAdapter(mockAdapter);
const ACCENT_THEMES = [
  { accent: "#ee703e", soft: "#e9dfce", strong: "#df6535" },
  { accent: "#2d9c5f", soft: "#d8ebdd", strong: "#23804c" },
  { accent: "#2f7dd1", soft: "#dbe7f4", strong: "#2565aa" },
  { accent: "#b85cc8", soft: "#ebddf1", strong: "#9b49aa" },
  { accent: "#d14f6a", soft: "#f3d9df", strong: "#ae3d56" },
  { accent: "#cc8a22", soft: "#efe3ce", strong: "#aa721b" },
  { accent: "#3a8b8f", soft: "#d5e7e8", strong: "#2e7073" },
] as const;
const RENAME_FIELD_OPTIONS: Array<{ key: RenameField; label: string }> = [
  { key: "tracknumber", label: "Track number" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "title", label: "Title" },
  { key: "year", label: "Year" },
  { key: "genre", label: "Genre" },
];
const RENAME_FIELD_KEYS = new Set<RenameField>(RENAME_FIELD_OPTIONS.map((option) => option.key));
const TRACK_LIST_OVERSCAN_ROWS = 4;
const TRACK_LIST_CARD_MIN_WIDTH = 250;
const TRACK_LIST_CARD_ROW_HEIGHT = 68;
const TRACK_LIST_COMPACT_ROW_HEIGHT = 32;
const TRACK_LIST_CARD_GAP = 8;
const TRACK_LIST_COMPACT_GAP = 4;
const TRACK_LIST_VIRTUALIZE_AFTER = 120;
type ParsedOnlineMatchDate =
  | { precision: "day"; year: number; month: number; day: number }
  | { precision: "month"; year: number; month: number }
  | { precision: "year"; year: number };

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props} />
  );
}

const IconInfo = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconFolder = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </IconBase>
);

const IconSave = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h8V4" />
    <rect x="8" y="13" width="8" height="6" />
  </IconBase>
);

const IconSaveRename = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M4 4h10l3 3v4" />
    <path d="M7 4v5h6V4" />
    <rect x="7" y="13" width="5" height="4" />
    <line x1="15" y1="11" x2="21" y2="17" />
    <path d="M14 20h3l6-6-3-3-6 6z" />
    <line x1="12" y1="15" x2="18" y2="15" />
    <line x1="15" y1="12" x2="15" y2="18" />
  </IconBase>
);

const IconRename = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </IconBase>
);

const IconSettings = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconSearch = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="6" />
    <line x1="16" y1="16" x2="21" y2="21" />
  </IconBase>
);

const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="5 12 10 17 19 8" />
  </IconBase>
);

const IconClose = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </IconBase>
);

const IconPlus = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </IconBase>
);

const IconTrash = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
    <path d="M19 6l-1 14H6L5 6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </IconBase>
);

const IconArrowUp = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="6 14 12 8 18 14" />
  </IconBase>
);

const IconArrowDown = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="6 10 12 16 18 10" />
  </IconBase>
);

const IconPlay = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="8 6 18 12 8 18" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconPause = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="7" y="6" width="4" height="12" fill="currentColor" stroke="none" />
    <rect x="13" y="6" width="4" height="12" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconPrev = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="7" y1="6" x2="7" y2="18" />
    <polygon points="17 6 9 12 17 18" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconNext = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="17" y1="6" x2="17" y2="18" />
    <polygon points="7 6 15 12 7 18" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconVolume = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="4 10 8 10 12 6 12 18 8 14 4 14" />
    <path d="M15 9a4 4 0 0 1 0 6" />
    <path d="M17.5 7a7 7 0 0 1 0 10" />
  </IconBase>
);

const IconMute = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="4 10 8 10 12 6 12 18 8 14 4 14" />
    <line x1="16" y1="9" x2="21" y2="15" />
    <line x1="21" y1="9" x2="16" y2="15" />
  </IconBase>
);

const IconGrid = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="4" y="4" width="6" height="6" />
    <rect x="14" y="4" width="6" height="6" />
    <rect x="4" y="14" width="6" height="6" />
    <rect x="14" y="14" width="6" height="6" />
  </IconBase>
);

const IconListCompact = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="6" y1="7" x2="20" y2="7" />
    <line x1="6" y1="12" x2="20" y2="12" />
    <line x1="6" y1="17" x2="20" y2="17" />
    <circle cx="3" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="17" r="1" fill="currentColor" stroke="none" />
  </IconBase>
);

const IconSun = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.9" y1="4.9" x2="7" y2="7" />
    <line x1="17" y1="17" x2="19.1" y2="19.1" />
    <line x1="17" y1="7" x2="19.1" y2="4.9" />
    <line x1="4.9" y1="19.1" x2="7" y2="17" />
  </IconBase>
);

const IconMoon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M21 12.4A8.5 8.5 0 1 1 11.6 3a7 7 0 0 0 9.4 9.4z" />
  </IconBase>
);

export function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const trackListRef = useRef<HTMLUListElement | null>(null);
  const searchRequestRef = useRef<{ id: number; canceled: boolean } | null>(null);
  const searchRequestCounterRef = useRef(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [playbackTrackId, setPlaybackTrackId] = useState<string>("");
  const [trackDraft, setTrackDraft] = useState<Track | null>(null);
  const [onlineResults, setOnlineResults] = useState<OnlineMatch[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchStatus, setSearchStatus] = useState("Ready");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchAlbum, setSearchAlbum] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRenameSettings, setShowRenameSettings] = useState(false);
  const [renameFields, setRenameFields] = useState<RenameField[]>(["tracknumber", "artist", "title"]);
  const [renameSeparator, setRenameSeparator] = useState(" - ");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioSrc, setAudioSrc] = useState("");
  const [audioTrackId, setAudioTrackId] = useState("");
  const [audioError, setAudioError] = useState("");
  const [trackTechnicalInfo, setTrackTechnicalInfo] = useState<TrackTechnicalInfo | null>(null);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [libraryViewMode, setLibraryViewMode] = useState<"card" | "compact">("card");
  const [trackListScrollTop, setTrackListScrollTop] = useState(0);
  const [trackListViewportHeight, setTrackListViewportHeight] = useState(420);
  const [trackListWidth, setTrackListWidth] = useState(0);
  const [accentIndex, setAccentIndex] = useState(0);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const userLocale = useMemo(() => getUserLocale(), []);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const playbackTrack = tracks.find((t) => t.id === playbackTrackId) ?? null;
  const playerInfoTrack = playbackTrack ?? selectedTrack;
  const editableTrack = trackDraft ?? selectedTrack;
  const trackTechnicalBadge = useMemo(
    () => formatTrackTechnicalBadge(trackTechnicalInfo, editableTrack?.path),
    [trackTechnicalInfo, editableTrack?.path]
  );
  const trackTechnicalSummary = useMemo(
    () => formatTrackTechnicalSummary(trackTechnicalInfo),
    [trackTechnicalInfo]
  );
  const dateSortedOnlineResults = useMemo(
    () =>
      [...onlineResults].sort((a, b) => {
        const aDate = getOnlineMatchDateSortKey(a.date);
        const bDate = getOnlineMatchDateSortKey(b.date);
        if (aDate === bDate) {
          return 0;
        }
        return aDate < bDate ? -1 : 1;
      }),
    [onlineResults]
  );
  const bestMatchResultId = useMemo(
    () => dateSortedOnlineResults.find((result) => isOnlineMatchBestMatchCandidate(result))?.id ?? "",
    [dateSortedOnlineResults]
  );
  const sortedOnlineResults = useMemo(() => {
    if (!bestMatchResultId) {
      return dateSortedOnlineResults;
    }
    const bestMatchIndex = dateSortedOnlineResults.findIndex((result) => result.id === bestMatchResultId);
    if (bestMatchIndex <= 0) {
      return dateSortedOnlineResults;
    }
    const bestMatch = dateSortedOnlineResults[bestMatchIndex];
    return [
      bestMatch,
      ...dateSortedOnlineResults.slice(0, bestMatchIndex),
      ...dateSortedOnlineResults.slice(bestMatchIndex + 1),
    ];
  }, [bestMatchResultId, dateSortedOnlineResults]);
  const selectedResult = onlineResults.find((r) => r.id === selectedResultId) ?? null;
  const accentTheme = ACCENT_THEMES[accentIndex % ACCENT_THEMES.length];
  const appStyle: CSSProperties = {
    "--accent": accentTheme.accent,
    "--accent-soft": accentTheme.soft,
    "--accent-strong": accentTheme.strong,
  } as CSSProperties;

  useEffect(() => {
    const saved = window.localStorage.getItem("musicmanager-color-mode");
    if (saved === "light" || saved === "dark") {
      setColorMode(saved);
    }

    const savedAccent = window.localStorage.getItem("musicmanager-accent-index");
    if (savedAccent) {
      const parsed = Number(savedAccent);
      if (Number.isInteger(parsed) && parsed >= 0) {
        setAccentIndex(parsed % ACCENT_THEMES.length);
      }
    }

    const savedRenameFields = window.localStorage.getItem("musicmanager-rename-fields");
    if (savedRenameFields) {
      try {
        const parsed = JSON.parse(savedRenameFields);
        if (Array.isArray(parsed)) {
          const valid = parsed
            .map((value) => String(value))
            .filter((value): value is RenameField => RENAME_FIELD_KEYS.has(value as RenameField));
          if (valid.length) {
            setRenameFields(valid);
          }
        }
      } catch {
        // Ignore invalid persisted value.
      }
    }

    const savedRenameSeparator = window.localStorage.getItem("musicmanager-rename-separator");
    if (savedRenameSeparator !== null) {
      setRenameSeparator(savedRenameSeparator);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-color-mode", colorMode);
  }, [colorMode]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-accent-index", String(accentIndex));
  }, [accentIndex]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-rename-fields", JSON.stringify(renameFields));
  }, [renameFields]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-rename-separator", renameSeparator);
  }, [renameSeparator]);
  const selectedFileName = editableTrack ? getFileName(editableTrack.path) : "No file selected";
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedTrack || !editableTrack || selectedTrack.id !== editableTrack.id) {
      return false;
    }
    return !areTracksEqual(selectedTrack, editableTrack);
  }, [selectedTrack, editableTrack]);
  const folderCount = useMemo(() => countFoldersAndSubfolders(tracks, folderPath), [tracks, folderPath]);
  const librarySummary = useMemo(() => {
    if (!tracks.length) {
      return "No audio files";
    }
    return `Found ${tracks.length} audio files in ${folderCount} folders/subfolders`;
  }, [tracks.length, folderCount]);
  const renamePreview = useMemo(() => {
    if (!editableTrack) {
      return "";
    }
    return buildRenamePreview(editableTrack, renameFields, renameSeparator);
  }, [editableTrack, renameFields, renameSeparator]);

  useEffect(() => {
    setTrackDraft(selectedTrack ? { ...selectedTrack } : null);
  }, [selectedTrackId, tracks]);

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
  }, [libraryViewMode]);

  useEffect(() => {
    const list = trackListRef.current;
    if (list) {
      list.scrollTop = 0;
    }
    setTrackListScrollTop(0);
  }, [query, libraryViewMode, tracks.length]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setAudioError("Playback unavailable for this track.");

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    let cancelled = false;
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const path = playbackTrack?.path;
    if (!path) {
      setAudioSrc("");
      setAudioTrackId("");
      setAudioError("");
      setShouldAutoplay(false);
      return;
    }

    (async () => {
      try {
        const src = await adapter.getAudioSource(path);
        if (cancelled) {
          return;
        }
        setAudioSrc(src);
        setAudioTrackId(playbackTrackId);
        setAudioError("");
      } catch {
        if (cancelled) {
          return;
        }
        setAudioSrc("");
        setAudioTrackId("");
        setAudioError("Playback unavailable for this track.");
        setShouldAutoplay(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playbackTrack?.path, playbackTrackId]);

  useEffect(() => {
    if (!shouldAutoplay || !audioSrc || !audioTrackId || audioTrackId !== playbackTrackId) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await audio.play();
        if (cancelled) {
          return;
        }
        setIsPlaying(true);
        setAudioError("");
      } catch {
        if (cancelled) {
          return;
        }
        setAudioError("Unable to start playback in this environment.");
        setIsPlaying(false);
      } finally {
        if (!cancelled) {
          setShouldAutoplay(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioSrc, shouldAutoplay, audioTrackId, playbackTrackId]);

  useEffect(() => {
    let cancelled = false;
    const path = editableTrack?.path;
    if (!path) {
      setTrackTechnicalInfo(null);
      return;
    }

    (async () => {
      try {
        const info = await adapter.getTrackTechnicalInfo(path);
        if (!cancelled) {
          setTrackTechnicalInfo(info);
        }
      } catch {
        if (!cancelled) {
          setTrackTechnicalInfo(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editableTrack?.path]);

  const filteredTracks = useMemo(() => {
    if (!query.trim()) {
      return tracks;
    }
    const q = query.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.path.toLowerCase().includes(q)
    );
  }, [tracks, query]);
  const virtualTrackWindow = useMemo(() => {
    const isCompact = libraryViewMode === "compact";
    const gap = isCompact ? TRACK_LIST_COMPACT_GAP : TRACK_LIST_CARD_GAP;
    const rowHeight = isCompact ? TRACK_LIST_COMPACT_ROW_HEIGHT : TRACK_LIST_CARD_ROW_HEIGHT;
    const columns = isCompact
      ? 1
      : Math.max(1, Math.floor((trackListWidth + gap) / (TRACK_LIST_CARD_MIN_WIDTH + gap)));
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
  const playbackTrackIndex = useMemo(
    () => filteredTracks.findIndex((t) => t.id === playbackTrackId),
    [filteredTracks, playbackTrackId]
  );

  function cancelOnlineSearch(reason = "Online search canceled.") {
    const activeSearch = searchRequestRef.current;
    if (!activeSearch) {
      return;
    }
    activeSearch.canceled = true;
    searchRequestRef.current = null;
    setIsLoadingSearch(false);
    setSearchStatus(reason);
  }

  async function handleScan() {
    cancelOnlineSearch();
    setIsLoadingScan(true);
    try {
      const result = await adapter.selectFolderAndScan();
      if (!result.folderPath) {
        return;
      }
      setFolderPath(result.folderPath);
      setTracks(result.tracks);
      setSelectedTrackId(result.tracks[0]?.id ?? "");
      setPlaybackTrackId("");
      setShouldAutoplay(false);
      const firstTrack = result.tracks[0];
      if (firstTrack) {
        setSearchTitle(firstTrack.title);
        setSearchArtist(firstTrack.artist);
        setSearchAlbum(firstTrack.album);
      }
      setOnlineResults([]);
      setSelectedResultId("");
      setSearchStatus("Ready");
    } catch (error) {
      setSearchStatus(`Scan error: ${formatError(error)}`);
    } finally {
      setIsLoadingScan(false);
    }
  }

  async function runOnlineSearch(query: SearchQuery) {
    const activeSearch = {
      id: searchRequestCounterRef.current + 1,
      canceled: false,
    };
    searchRequestCounterRef.current = activeSearch.id;
    searchRequestRef.current = activeSearch;

    setIsLoadingSearch(true);
    setSearchStatus("Online search in progress...");
    try {
      const result = await adapter.searchOnline(query);
      if (activeSearch.canceled || searchRequestRef.current?.id !== activeSearch.id) {
        return;
      }
      setOnlineResults(result);
      setSelectedResultId("");
      setSearchStatus(
        `Search: "${query.artist} ${query.title} ${query.album}". Online results: ${result.length}`
      );
    } catch (error) {
      if (activeSearch.canceled || searchRequestRef.current?.id !== activeSearch.id) {
        return;
      }
      setSearchStatus(`Online search error: ${formatError(error)}`);
    } finally {
      if (searchRequestRef.current?.id === activeSearch.id) {
        searchRequestRef.current = null;
        setIsLoadingSearch(false);
      }
    }
  }

  async function handleSearchOnline() {
    if (!selectedTrack) {
      return;
    }
    await runOnlineSearch({
      title: searchTitle,
      artist: searchArtist,
      album: searchAlbum,
    });
  }

  function handleSearchButtonClick() {
    if (isLoadingSearch) {
      cancelOnlineSearch();
      return;
    }
    void handleSearchOnline();
  }

  function handleQuickSearchTrack(track: Track) {
    selectTrack(track);
    void runOnlineSearch({
      title: track.title,
      artist: track.artist,
      album: track.album,
    });
  }

  function handleTrackFieldChange(field: keyof Track, value: string) {
    if (!editableTrack) {
      return;
    }
    setTrackDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSaveTrack() {
    if (!editableTrack) {
      return;
    }
    const shouldRemoveCover = Boolean(selectedTrack?.hasCover) && !editableTrack.hasCover && !editableTrack.coverUrl;
    try {
      const result = await adapter.saveTrack(
        editableTrack.id,
        editableTrack.path,
        {
          title: editableTrack.title,
          artist: editableTrack.artist,
          album: editableTrack.album,
          tracknumber: editableTrack.tracknumber,
          year: editableTrack.year,
          genre: editableTrack.genre,
        },
        editableTrack.coverUrl,
        undefined,
        shouldRemoveCover
      );
      commitTrackAfterTagSave(editableTrack.id, editableTrack, result.path);
      setSearchStatus("Tags saved to track");
    } catch (error) {
      setSearchStatus(`Save error: ${formatError(error)}`);
    }
  }

  async function handleSaveAndRenameTrack() {
    if (!editableTrack) {
      return;
    }
    const shouldRemoveCover = Boolean(selectedTrack?.hasCover) && !editableTrack.hasCover && !editableTrack.coverUrl;
    try {
      const result = await adapter.saveTrack(
        editableTrack.id,
        editableTrack.path,
        {
          title: editableTrack.title,
          artist: editableTrack.artist,
          album: editableTrack.album,
          tracknumber: editableTrack.tracknumber,
          year: editableTrack.year,
          genre: editableTrack.genre,
        },
        editableTrack.coverUrl,
        {
          fields: renameFields,
          separator: renameSeparator,
        },
        shouldRemoveCover
      );
      commitTrackAfterTagSave(editableTrack.id, editableTrack, result.path);
      setSearchStatus("Tags saved and file renamed");
    } catch (error) {
      setSearchStatus(`Save/rename error: ${formatError(error)}`);
    }
  }

  async function handleRenameOnlyTrack() {
    if (!editableTrack) {
      return;
    }
    try {
      const result = await adapter.renameTrack(
        editableTrack.path,
        {
          title: editableTrack.title,
          artist: editableTrack.artist,
          album: editableTrack.album,
          tracknumber: editableTrack.tracknumber,
          year: editableTrack.year,
          genre: editableTrack.genre,
        },
        {
          fields: renameFields,
          separator: renameSeparator,
        }
      );
      commitPathAfterRename(editableTrack.id, result.path);
      setSearchStatus("File renamed");
    } catch (error) {
      setSearchStatus(`Rename error: ${formatError(error)}`);
    }
  }

  function applyOnlineResultToTrack(result: OnlineMatch): Track | null {
    const baseTrack = editableTrack;
    if (!baseTrack) {
      return null;
    }

    const nextTrack: Track = {
      ...baseTrack,
      title: result.title,
      artist: result.artist,
      album: result.album,
      tracknumber: result.tracknumber ?? baseTrack.tracknumber,
      year: result.date.slice(0, 4),
      coverUrl: result.coverUrl,
      hasCover: Boolean(result.coverUrl),
    };

    setTrackDraft(nextTrack);

    return nextTrack;
  }

  function handleApplyOnlineResult(result: OnlineMatch) {
    if (!editableTrack) {
      return;
    }
    applyOnlineResultToTrack(result);
    setSearchStatus("Result applied. Save the track to confirm changes.");
  }

  async function handleApplyAndSaveOnlineResult(result: OnlineMatch) {
    if (!editableTrack) {
      return;
    }

    const nextTrack = applyOnlineResultToTrack(result);
    if (!nextTrack) {
      return;
    }

    const shouldRemoveCover = Boolean(selectedTrack?.hasCover) && !nextTrack.hasCover && !nextTrack.coverUrl;
    try {
      const result = await adapter.saveTrack(
        nextTrack.id,
        nextTrack.path,
        {
          title: nextTrack.title,
          artist: nextTrack.artist,
          album: nextTrack.album,
          tracknumber: nextTrack.tracknumber,
          year: nextTrack.year,
          genre: nextTrack.genre,
        },
        nextTrack.coverUrl,
        undefined,
        shouldRemoveCover
      );
      commitTrackAfterTagSave(editableTrack.id, nextTrack, result.path);
      setSearchStatus("Result applied and tags saved to track");
    } catch (error) {
      setSearchStatus(`Apply and save error: ${formatError(error)}`);
    }
  }

  function handleInfoClick() {
    setShowInfoModal(true);
  }

  async function handleOpenExternalLink(
    event: { preventDefault: () => void },
    url: string
  ) {
    event.preventDefault();
    const invoke = (
      window as Window & {
        __TAURI_INTERNALS__?: { invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T> };
      }
    ).__TAURI_INTERNALS__?.invoke;

    if (invoke) {
      try {
        await invoke<void>("open_external_url", { url });
        return;
      } catch {
        // Fall through to browser default opener.
      }
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleTogglePlayPause() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const targetTrack = selectedTrack ?? playbackTrack;
    if (targetTrack && targetTrack.id !== playbackTrackId) {
      setPlaybackTrackId(targetTrack.id);
      setShouldAutoplay(true);
      return;
    }

    if (!audioSrc || !audioTrackId || audioTrackId !== playbackTrackId) {
      if (targetTrack) {
        setShouldAutoplay(true);
      }
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setAudioError("");
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
    }
  }

  function handlePlayFromLibraryCover(event: MouseEvent<HTMLElement>, track: Track) {
    event.stopPropagation();
    if (track.id !== selectedTrackId) {
      selectTrack(track);
    }

    if (track.id !== playbackTrackId) {
      setPlaybackTrackId(track.id);
      setShouldAutoplay(true);
      return;
    }

    const audio = audioRef.current;
    if (!audio || !audioSrc || audioTrackId !== track.id) {
      setShouldAutoplay(true);
      return;
    }

    void audio.play().then(
      () => {
        setIsPlaying(true);
        setAudioError("");
      },
      () => {
        setAudioError("Unable to start playback in this environment.");
        setIsPlaying(false);
      }
    );
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = value;
    setCurrentTime(value);
  }

  function handleTrackListScroll(event: UIEvent<HTMLUListElement>) {
    setTrackListScrollTop(event.currentTarget.scrollTop);
  }

  function handleSelectCoverClick() {
    if (!editableTrack) {
      return;
    }
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
      coverInputRef.current.click();
    }
  }

  function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editableTrack) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSearchStatus("Invalid cover format. Select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        setSearchStatus("Unable to read cover file.");
        return;
      }
      setTrackDraft((prev) => (prev ? { ...prev, coverUrl: dataUrl, hasCover: true } : prev));
      setSearchStatus("Cover loaded. Save the track to persist changes.");
    };
    reader.onerror = () => {
      setSearchStatus("Unable to read cover file.");
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveCover() {
    if (!editableTrack) {
      return;
    }
    setTrackDraft((prev) => (prev ? { ...prev, coverUrl: undefined, hasCover: false } : prev));
    setSearchStatus("Cover removed from draft. Save the track to persist changes.");
  }

  function selectTrack(track: Track) {
    const isNewTrack = track.id !== selectedTrackId;
    if (isNewTrack) {
      setTrackDraft({ ...track });
    }
    setSelectedTrackId(track.id);
    setSearchTitle(track.title);
    setSearchArtist(track.artist);
    setSearchAlbum(track.album);
    if (isNewTrack) {
      cancelOnlineSearch("Online search canceled: track changed.");
      setOnlineResults([]);
      setSelectedResultId("");
      setSearchStatus("Ready");
    }
  }

  function handlePrevTrack() {
    if (playbackTrackIndex <= 0) {
      return;
    }
    const prev = filteredTracks[playbackTrackIndex - 1];
    if (prev) {
      setPlaybackTrackId(prev.id);
      setShouldAutoplay(true);
      selectTrack(prev);
    }
  }

  function handleNextTrack() {
    if (playbackTrackIndex < 0 || playbackTrackIndex >= filteredTracks.length - 1) {
      return;
    }
    const next = filteredTracks[playbackTrackIndex + 1];
    if (next) {
      setPlaybackTrackId(next.id);
      setShouldAutoplay(true);
      selectTrack(next);
    }
  }

  function commitTrackAfterTagSave(currentId: string, source: Track, newPath: string) {
    const finalPath = newPath || source.path;
    const committed: Track = {
      ...source,
      id: finalPath,
      path: finalPath,
    };
    setTracks((prev) => prev.map((track) => (track.id === currentId ? committed : track)));
    setTrackDraft(committed);
    setSelectedTrackId(finalPath);
    if (playbackTrackId === currentId) {
      setPlaybackTrackId(finalPath);
    }
  }

  function commitPathAfterRename(currentId: string, newPath: string) {
    if (!newPath) {
      return;
    }

    setTracks((prev) =>
      prev.map((track) => (track.id === currentId ? { ...track, id: newPath, path: newPath } : track))
    );
    setTrackDraft((prev) => (prev ? { ...prev, id: newPath, path: newPath } : prev));
    setSelectedTrackId(newPath);
    if (playbackTrackId === currentId) {
      setPlaybackTrackId(newPath);
    }
  }

  function toggleRenameField(field: RenameField) {
    setRenameFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((f) => f !== field);
      }
      return [...prev, field];
    });
  }

  function moveRenameField(field: RenameField, direction: -1 | 1) {
    setRenameFields((prev) => {
      const index = prev.indexOf(field);
      if (index < 0) {
        return prev;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  }

  return (
    <div className={colorMode === "dark" ? "app-shell theme-dark" : "app-shell"} style={appStyle}>
      <header className="top-bar">
        <h1
          onClick={() => setAccentIndex((prev) => (prev + 1) % ACCENT_THEMES.length)}
          title="Change accent color"
        >
          DiscoBalls
        </h1>
        <div className="top-player">
          <audio ref={audioRef} src={audioSrc} preload="metadata" />
          <div className="player-now-playing" title={playerInfoTrack ? `${playerInfoTrack.artist} - ${playerInfoTrack.title}` : "No track selected"}>
            {playerInfoTrack?.coverUrl ? (
              <img
                src={playerInfoTrack.coverUrl}
                alt={`Cover ${playerInfoTrack.album || playerInfoTrack.title}`}
                className="player-now-cover"
              />
            ) : (
              <div className="player-now-cover-placeholder">♪</div>
            )}
            <span className="player-now-text">
              <strong className="player-now-title">{playerInfoTrack?.title || "No track selected"}</strong>
              <small className="player-now-artist">{playerInfoTrack?.artist || "Select a track from library"}</small>
            </span>
          </div>
          <button className="ghost-button player-btn" onClick={handlePrevTrack} disabled={playbackTrackIndex <= 0} title="Previous track" aria-label="Previous track">
            <span className="btn-content"><IconPrev className="btn-icon" /></span>
          </button>
          <button
            className="player-btn"
            onClick={handleTogglePlayPause}
            disabled={!selectedTrack && !audioSrc}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <span className="btn-content">
              {isPlaying ? <IconPause className="btn-icon" /> : <IconPlay className="btn-icon" />}
            </span>
          </button>
          <button
            className="ghost-button player-btn"
            onClick={handleNextTrack}
            disabled={playbackTrackIndex < 0 || playbackTrackIndex >= filteredTracks.length - 1}
            title="Next track"
            aria-label="Next track"
          >
            <span className="btn-content"><IconNext className="btn-icon" /></span>
          </button>
          <div className="player-progress">
            <span className="player-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0)}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              disabled={!audioSrc || audioTrackId !== playbackTrackId || duration <= 0}
            />
            <span className="player-time">{formatTime(duration)}</span>
          </div>
          <div className="player-volume">
            <button className="ghost-button player-btn" onClick={() => setIsMuted((v) => !v)} title={isMuted || volume === 0 ? "Unmute" : "Mute"} aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}>
              <span className="btn-content">
                {isMuted || volume === 0 ? <IconMute className="btn-icon" /> : <IconVolume className="btn-icon" />}
              </span>
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>
          {audioError && <span className="player-error">{audioError}</span>}
        </div>
        <div className="top-actions">
          <button
            className="ghost-button"
            onClick={() => setColorMode((prev) => (prev === "light" ? "dark" : "light"))}
            title={colorMode === "light" ? "Enable dark mode" : "Enable light mode"}
            aria-label={colorMode === "light" ? "Enable dark mode" : "Enable light mode"}
          >
            <span className="btn-content">
              {colorMode === "light" ? <IconMoon className="btn-icon" /> : <IconSun className="btn-icon" />}
            </span>
          </button>
          <button className="ghost-button" onClick={handleInfoClick} title="Info" aria-label="Info">
            <span className="btn-content"><IconInfo className="btn-icon" /></span>
          </button>
        </div>
      </header>

      <main className="two-col">
        <div className="col col-left">
          <LibrarySection
            folderPath={folderPath}
            isLoadingScan={isLoadingScan}
            onScan={handleScan}
            query={query}
            onQueryChange={setQuery}
            libraryViewMode={libraryViewMode}
            onLibraryViewModeChange={setLibraryViewMode}
            librarySummary={librarySummary}
            trackListRef={trackListRef}
            onTrackListScroll={handleTrackListScroll}
            virtualTrackWindow={virtualTrackWindow}
            selectedTrackId={selectedTrackId}
            onSelectTrack={selectTrack}
            onSearchTrack={handleQuickSearchTrack}
            onPlayFromLibraryCover={handlePlayFromLibraryCover}
            getFileName={getFileName}
            IconFolder={IconFolder}
            IconGrid={IconGrid}
            IconListCompact={IconListCompact}
            IconPlay={IconPlay}
            IconSearch={IconSearch}
          />
        </div>

        <div className="col col-right">
          <TrackDetailsSection
            selectedFileName={selectedFileName}
            hasUnsavedChanges={hasUnsavedChanges}
            technicalBadge={trackTechnicalBadge}
            technicalSummary={trackTechnicalSummary}
            coverInputRef={coverInputRef}
            onCoverFileChange={handleCoverFileChange}
            editableTrack={editableTrack}
            onSelectCoverClick={handleSelectCoverClick}
            onRemoveCover={handleRemoveCover}
            onTrackFieldChange={handleTrackFieldChange}
            onSaveTrack={handleSaveTrack}
            onSaveAndRenameTrack={handleSaveAndRenameTrack}
            renamePreview={renamePreview}
            onRenameOnlyTrack={handleRenameOnlyTrack}
            onOpenRenameSettings={() => setShowRenameSettings(true)}
            IconPlus={IconPlus}
            IconTrash={IconTrash}
            IconSave={IconSave}
            IconSaveRename={IconSaveRename}
            IconRename={IconRename}
            IconSettings={IconSettings}
          />

          <OnlineSearchSection
            searchStatus={searchStatus}
            searchTitle={searchTitle}
            onSearchTitleChange={setSearchTitle}
            searchArtist={searchArtist}
            onSearchArtistChange={setSearchArtist}
            searchAlbum={searchAlbum}
            onSearchAlbumChange={setSearchAlbum}
            onSearchButtonClick={handleSearchButtonClick}
            canSearch={Boolean(selectedTrack)}
            isLoadingSearch={isLoadingSearch}
            sortedOnlineResults={sortedOnlineResults}
            selectedResultId={selectedResultId}
            onSelectResult={setSelectedResultId}
            bestMatchResultId={bestMatchResultId}
            formatResultDate={(date) => formatOnlineMatchDate(date, userLocale)}
            onApplyOnlineResult={handleApplyOnlineResult}
            onApplyAndSaveOnlineResult={(result) => {
              void handleApplyAndSaveOnlineResult(result);
            }}
            IconSearch={IconSearch}
            IconClose={IconClose}
            IconCheck={IconCheck}
            IconSave={IconSave}
          />
        </div>
      </main>

      {showInfoModal && (
        <div className="modal-backdrop" onClick={() => setShowInfoModal(false)}>
          <div className="modal-card info-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>About DiscoBalls</h3>
              <button className="ghost-button" onClick={() => setShowInfoModal(false)} title="Close" aria-label="Close">
                <span className="btn-content"><IconClose className="btn-icon" /></span>
              </button>
            </div>

            <div className="info-meta">
              <p><strong>App:</strong> DiscoBalls</p>
              <p><strong>Version:</strong> 1.2.0</p>
              <p>
                <strong>Website:</strong>{" "}
                <a
                  href="https://a55mage.github.io/discoballs/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => void handleOpenExternalLink(e, "https://a55mage.github.io/discoballs/")}
                >
                  https://a55mage.github.io/discoballs/
                </a>
              </p>
              <p>
                <strong>Developer:</strong>{" "}
                <a
                  href="https://a55mage.github.io/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => void handleOpenExternalLink(e, "https://a55mage.github.io/")}
                >
                  https://a55mage.github.io/
                </a>
              </p>
            </div>

            <h4>Quick Manual</h4>
            <ul className="info-manual">
              <li>Select a folder to load your audio files library.</li>
              <li>Pick a track, edit fields in Track details, then save tags.</li>
              <li>Use rename actions to rename with your configured pattern.</li>
              <li>Run online search to fetch metadata and cover art from MusicBrainz/iTunes.</li>
              <li>Apply an online result, then save to persist metadata to file.</li>
            </ul>
          </div>
        </div>
      )}

      {showRenameSettings && (
        <div className="modal-backdrop" onClick={() => setShowRenameSettings(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File rename settings</h3>
              <button className="ghost-button" onClick={() => setShowRenameSettings(false)} title="Close" aria-label="Close">
                <span className="btn-content"><IconClose className="btn-icon" /></span>
              </button>
            </div>
            <p className="muted compact">Choose fields, order, and separator for the final filename.</p>

            <div className="rename-fields">
              {renameFields.map((field) => (
                <div key={field} className="rename-field-row">
                  <label className="rename-field-check">{renameFieldLabel(field)}</label>
                  <div className="rename-field-controls">
                    <button className="ghost-button" onClick={() => moveRenameField(field, -1)} title="Move up" aria-label="Move up">
                      <span className="btn-content"><IconArrowUp className="btn-icon" /></span>
                    </button>
                    <button className="ghost-button" onClick={() => moveRenameField(field, 1)} title="Move down" aria-label="Move down">
                      <span className="btn-content"><IconArrowDown className="btn-icon" /></span>
                    </button>
                    <button className="ghost-button" onClick={() => toggleRenameField(field)} disabled={renameFields.length <= 1} title="Remove" aria-label="Remove">
                      <span className="btn-content"><IconClose className="btn-icon" /></span>
                    </button>
                  </div>
                </div>
              ))}
              {RENAME_FIELD_OPTIONS.filter((opt) => !renameFields.includes(opt.key)).map((opt) => (
                <div key={opt.key} className="rename-field-row">
                  <label className="rename-field-check">{opt.label}</label>
                  <div className="rename-field-controls">
                    <button className="ghost-button" onClick={() => toggleRenameField(opt.key)} title="Add" aria-label="Add">
                      <span className="btn-content"><IconCheck className="btn-icon" /></span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <label>
              Separator
              <input className="input input-short" value={renameSeparator} onChange={(e) => setRenameSeparator(e.target.value)} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return normalized;
  }
  return normalized.slice(index + 1);
}

function areTracksEqual(a: Track, b: Track): boolean {
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

function buildRenamePreview(track: Track, fields: RenameField[], separator: string): string {
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

function getExtension(path: string): string {
  const file = getFileName(path);
  const index = file.lastIndexOf(".");
  if (index < 0) {
    return "";
  }
  return file.slice(index);
}

function sanitizeFilePart(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.replace(/[.\s]+$/g, "");
}

function renameFieldLabel(field: RenameField): string {
  const found = RENAME_FIELD_OPTIONS.find((f) => f.key === field);
  return found?.label ?? field;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTrackTechnicalBadge(info: TrackTechnicalInfo | null, path?: string): string {
  const format =
    info?.format?.trim() ||
    getExtension(path || "")
      .replace(/^\./, "")
      .toUpperCase() ||
    "N/A";
  const bitrate = info?.bitrateKbps ? `${Math.round(info.bitrateKbps)} kbps` : "bitrate n/a";
  return `${format} · ${bitrate}`;
}

function formatTrackTechnicalSummary(info: TrackTechnicalInfo | null): string {
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

function formatDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "n/a";
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatSampleRate(sampleRateHz: number): string {
  const khz = sampleRateHz / 1000;
  const decimals = sampleRateHz % 1000 === 0 ? 0 : 1;
  return `${khz.toFixed(decimals)} kHz`;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "n/a";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const decimals = value >= 100 || index === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

function getOnlineMatchDateSortKey(date: string): number {
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

function isOnlineMatchBestMatchCandidate(result: OnlineMatch): boolean {
  return Boolean(result.coverUrl?.trim()) && hasCompleteOnlineMatchDate(result.date);
}

function hasCompleteOnlineMatchDate(date: string): boolean {
  return parseOnlineMatchDate(date)?.precision === "day";
}

function formatOnlineMatchDate(date: string, locale: string): string {
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
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function getUserLocale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}

function formatError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; toString?: () => string };
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.toString === "function") {
      const text = candidate.toString();
      if (text && text !== "[object Object]") {
        return text;
      }
    }
  }
  return "Unknown error";
}

function countFoldersAndSubfolders(items: Track[], rootPath: string): number {
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
