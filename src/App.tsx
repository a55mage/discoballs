import { type ChangeEvent, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type UIEvent, useEffect, useMemo, useRef, useState } from "react";
import { createAdapter } from "./api/tauriAdapter";
import { mockAdapter } from "./api/mockAdapter";
import appIcon from "./assets/discoballs-icon.png";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconClose,
  IconCover,
  IconFolder,
  IconGrid,
  IconListCompact,
  IconMusicNote,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPlus,
  IconPrev,
  IconRename,
  IconSave,
  IconSaveRename,
  IconSearch,
  IconSettings,
  IconSortAdded,
  IconSortArtist,
  IconSortRelease,
  IconSortTitle,
  IconTrash,
  IconVolume,
} from "./components/icons";
import { DashboardSection } from "./sections/DashboardSection";
import { LibrarySection } from "./sections/LibrarySection";
import { OnlineSearchSection } from "./sections/OnlineSearchSection";
import { PlayerSection } from "./sections/PlayerSection";
import { RenameSettingsModal } from "./sections/RenameSettingsModal";
import { SettingsSection } from "./sections/SettingsSection";
import { TopBarSection } from "./sections/TopBarSection";
import { TrackDetailsSection } from "./sections/TrackDetailsSection";
import type { OnlineMatch, RenameField, SearchQuery, Track, TrackTechnicalInfo } from "./types";
import { formatError, getFileName, getUserLocale } from "./utils/common";
import {
  applyEqualizerSettings,
  DEFAULT_EQUALIZER_PRESET,
  EQUALIZER_PRESETS,
  EQUALIZER_FREQUENCIES,
  getOrCreateMediaAudioGraph,
  type EqualizerPreset,
} from "./utils/audioGraph";
import {
  areTracksEqual,
  buildRenamePreview,
  countFoldersAndSubfolders,
  formatOnlineMatchDate,
  formatTrackTechnicalBadge,
  formatTrackTechnicalSummary,
  getOnlineMatchDateSortKey,
  getTrackReleaseSortKey,
  scoreOnlineMatch,
} from "./utils/appHelpers";

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
const TRACK_LIST_COMPACT_MIN_WIDTH = 320;
const TRACK_LIST_CARD_ROW_HEIGHT = 68;
const TRACK_LIST_COMPACT_ROW_HEIGHT = 32;
const TRACK_LIST_CARD_GAP = 8;
const TRACK_LIST_COMPACT_GAP = 4;
const TRACK_LIST_VIRTUALIZE_AFTER = 120;
const STORAGE_PLAYLISTS_KEY = "musicmanager-playlists";
const STORAGE_ACTIVE_PLAYLIST_ID_KEY = "musicmanager-active-playlist-id";
type LibrarySortMode = "title" | "artist" | "added" | "release";
type SortDirection = "asc" | "desc";
type AppScreen = "tagging" | "dashboard" | "settings" | "player";
type PlaylistEntry = { id: string; trackId: string };
type Playlist = { id: string; name: string; entries: PlaylistEntry[] };
const BUILTIN_EQ_PRESET_IDS = new Set(EQUALIZER_PRESETS.map((preset) => preset.id));

function normalizePlaylistName(value: string): string {
  return value.trim().toLowerCase();
}

function buildUniquePlaylistName(playlists: Playlist[], baseName: string, excludeId?: string): string {
  const fallbackBase = baseName.trim() || "New Playlist";
  const usedNames = new Set(
    playlists
      .filter((playlist) => playlist.id !== excludeId)
      .map((playlist) => normalizePlaylistName(playlist.name))
  );
  if (!usedNames.has(normalizePlaylistName(fallbackBase))) {
    return fallbackBase;
  }
  let index = 2;
  while (usedNames.has(normalizePlaylistName(`${fallbackBase} (${index})`))) {
    index += 1;
  }
  return `${fallbackBase} (${index})`;
}

function normalizeEqualizerPresetName(value: string): string {
  return value.trim().toLowerCase();
}

function buildUniqueEqualizerPresetName(presets: EqualizerPreset[], baseName: string, excludeId?: string): string {
  const fallbackBase = baseName.trim() || "New Preset";
  const usedNames = new Set(
    presets
      .filter((preset) => preset.id !== excludeId)
      .map((preset) => normalizeEqualizerPresetName(preset.name))
  );
  if (!usedNames.has(normalizeEqualizerPresetName(fallbackBase))) {
    return fallbackBase;
  }
  let index = 2;
  while (usedNames.has(normalizeEqualizerPresetName(`${fallbackBase} (${index})`))) {
    index += 1;
  }
  return `${fallbackBase} (${index})`;
}

export function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const trackListRef = useRef<HTMLUListElement | null>(null);
  const searchRequestRef = useRef<{ id: number; canceled: boolean } | null>(null);
  const searchRequestCounterRef = useRef(0);
  const pointerDragStateRef = useRef<{
    kind: "none" | "library-track" | "playlist-entry";
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ kind: "none", id: "", startX: 0, startY: 0, moved: false });
  const suppressNextPlaylistItemClickRef = useRef(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [activeScreen, setActiveScreen] = useState<AppScreen>("tagging");
  const [query, setQuery] = useState("");
  const [librarySortMode, setLibrarySortMode] = useState<LibrarySortMode>("added");
  const [librarySortDirection, setLibrarySortDirection] = useState<SortDirection>("asc");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [playbackTrackId, setPlaybackTrackId] = useState<string>("");
  const [playbackPlaylistId, setPlaybackPlaylistId] = useState<string>("");
  const [trackDraft, setTrackDraft] = useState<Track | null>(null);
  const [onlineResults, setOnlineResults] = useState<OnlineMatch[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchStatus, setSearchStatus] = useState("Ready");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchAlbum, setSearchAlbum] = useState("");
  const [showRenameSettings, setShowRenameSettings] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState("");
  const [playlistNameDraft, setPlaylistNameDraft] = useState("");
  const [isPlaylistRenaming, setIsPlaylistRenaming] = useState(false);
  const [autoOpenDefaultFolder, setAutoOpenDefaultFolder] = useState(false);
  const [defaultFolderPath, setDefaultFolderPath] = useState("");
  const [accentRotateOnLaunch, setAccentRotateOnLaunch] = useState(false);
  const [audioNormalizeVolume, setAudioNormalizeVolume] = useState(false);
  const [audioSmartCrossfade, setAudioSmartCrossfade] = useState(false);
  const [equalizerPresets, setEqualizerPresets] = useState<EqualizerPreset[]>(EQUALIZER_PRESETS.map((preset) => ({ ...preset, bandGains: [...preset.bandGains] })));
  const [equalizerPresetId, setEqualizerPresetId] = useState(DEFAULT_EQUALIZER_PRESET.id);
  const [equalizerPresetName, setEqualizerPresetName] = useState(DEFAULT_EQUALIZER_PRESET.name);
  const [equalizerBandGains, setEqualizerBandGains] = useState<number[]>([...DEFAULT_EQUALIZER_PRESET.bandGains]);
  const [equalizerPreampDb, setEqualizerPreampDb] = useState(0);
  const [equalizerWetMixPercent, setEqualizerWetMixPercent] = useState(100);
  const [isEqualizerPresetRenaming, setIsEqualizerPresetRenaming] = useState(false);
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
  const [isDashboardDragging, setIsDashboardDragging] = useState(false);
  const [dashboardDropArea, setDashboardDropArea] = useState<"none" | "dropzone" | "playlist">("none");
  const [dashboardDropEntryId, setDashboardDropEntryId] = useState("");
  const userLocale = useMemo(() => getUserLocale(), []);
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId]
  );
  const playbackPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === playbackPlaylistId) ?? null,
    [playlists, playbackPlaylistId]
  );
  const activeEqualizerPreset = useMemo(
    () => equalizerPresets.find((preset) => preset.id === equalizerPresetId) ?? null,
    [equalizerPresets, equalizerPresetId]
  );
  const canRenameDeleteEqualizerPreset = Boolean(activeEqualizerPreset && !BUILTIN_EQ_PRESET_IDS.has(activeEqualizerPreset.id));

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
  const bestMatchResultId = useMemo(() => {
    let bestMatch: OnlineMatch | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const result of onlineResults) {
      const score = scoreOnlineMatch(result, {
        title: searchTitle,
        artist: searchArtist,
        album: searchAlbum,
      });
      if (score === null || score < bestScore) {
        continue;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
        continue;
      }
      if (!bestMatch) {
        bestMatch = result;
        continue;
      }
      const dateSortKey = getOnlineMatchDateSortKey(result.date);
      const bestDateSortKey = getOnlineMatchDateSortKey(bestMatch.date);
      if (dateSortKey < bestDateSortKey) {
        bestMatch = result;
      }
    }
    return bestMatch?.id ?? "";
  }, [onlineResults, searchTitle, searchArtist, searchAlbum]);
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

    const savedPlaylists = window.localStorage.getItem(STORAGE_PLAYLISTS_KEY);
    if (savedPlaylists) {
      try {
        const parsed = JSON.parse(savedPlaylists) as Playlist[];
        if (Array.isArray(parsed) && parsed.length) {
          const savedActivePlaylistId = window.localStorage.getItem(STORAGE_ACTIVE_PLAYLIST_ID_KEY) || "";
          const restoredActivePlaylistId = parsed.some((playlist) => playlist.id === savedActivePlaylistId)
            ? savedActivePlaylistId
            : parsed[0].id;
          const restoredActivePlaylist = parsed.find((playlist) => playlist.id === restoredActivePlaylistId) ?? parsed[0];
          setPlaylists(parsed);
          setActivePlaylistId(restoredActivePlaylistId);
          setPlaylistNameDraft(restoredActivePlaylist?.name ?? "");
        }
      } catch {
        // Ignore invalid playlists.
      }
    }

    const savedAutoOpen = window.localStorage.getItem("musicmanager-auto-open-default-folder");
    if (savedAutoOpen === "true") {
      setAutoOpenDefaultFolder(true);
    }

    const savedDefaultFolderPath = window.localStorage.getItem("musicmanager-default-folder-path");
    if (savedDefaultFolderPath) {
      setDefaultFolderPath(savedDefaultFolderPath);
    }

    const savedAccentRotate = window.localStorage.getItem("musicmanager-accent-rotate-on-launch");
    if (savedAccentRotate === "true") {
      setAccentRotateOnLaunch(true);
      setAccentIndex((prev) => (prev + 1) % ACCENT_THEMES.length);
    }

    const savedNormalizeVolume = window.localStorage.getItem("musicmanager-audio-normalize-volume");
    if (savedNormalizeVolume === "true") {
      setAudioNormalizeVolume(true);
    }

    const savedSmartCrossfade = window.localStorage.getItem("musicmanager-audio-smart-crossfade");
    if (savedSmartCrossfade === "true") {
      setAudioSmartCrossfade(true);
    }

    let restoredEqPresets = EQUALIZER_PRESETS.map((preset) => ({ ...preset, bandGains: [...preset.bandGains] }));
    const savedEqPresets = window.localStorage.getItem("musicmanager-eq-presets");
    if (savedEqPresets) {
      try {
        const parsed = JSON.parse(savedEqPresets);
        if (Array.isArray(parsed) && parsed.length) {
          const normalized = parsed
            .map((item) => {
              if (!item || typeof item !== "object") {
                return null;
              }
              const candidate = item as Record<string, unknown>;
              const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
              const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
              const bandGainsRaw = Array.isArray(candidate.bandGains) ? candidate.bandGains : null;
              if (!id || !name || !bandGainsRaw || bandGainsRaw.length !== EQUALIZER_FREQUENCIES.length) {
                return null;
              }
              const bandGains = bandGainsRaw.map((value) => {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                  return 0;
                }
                return Math.max(-12, Math.min(12, numeric));
              });
              const preampDbRaw = Number(candidate.preampDb);
              const wetMixRaw = Number(candidate.wetMixPercent);
              return {
                id,
                name,
                bandGains,
                preampDb: Number.isFinite(preampDbRaw) ? Math.max(-12, Math.min(12, preampDbRaw)) : 0,
                wetMixPercent: Number.isFinite(wetMixRaw) ? Math.max(0, Math.min(100, Math.round(wetMixRaw))) : 100,
              } satisfies EqualizerPreset;
            })
            .filter((item): item is EqualizerPreset => Boolean(item));
          if (normalized.length) {
            restoredEqPresets = normalized;
          }
        }
      } catch {
        // Ignore invalid persisted presets.
      }
    }
    setEqualizerPresets(restoredEqPresets);

    const savedEqPresetId = window.localStorage.getItem("musicmanager-eq-preset-id");
    if (savedEqPresetId && restoredEqPresets.some((preset) => preset.id === savedEqPresetId)) {
      setEqualizerPresetId(savedEqPresetId);
    }

    const savedEqPresetName = window.localStorage.getItem("musicmanager-eq-preset-name");
    if (savedEqPresetName) {
      setEqualizerPresetName(savedEqPresetName);
    }

    const savedEqBandGains = window.localStorage.getItem("musicmanager-eq-band-gains");
    if (savedEqBandGains) {
      try {
        const parsed = JSON.parse(savedEqBandGains);
        if (Array.isArray(parsed) && parsed.length === EQUALIZER_FREQUENCIES.length) {
          const nextValues = parsed.map((value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
              return 0;
            }
            return Math.max(-12, Math.min(12, numeric));
          });
          setEqualizerBandGains(nextValues);
        }
      } catch {
        // Ignore invalid stored EQ values.
      }
    }

    const savedEqPreamp = window.localStorage.getItem("musicmanager-eq-preamp-db");
    if (savedEqPreamp !== null) {
      const numeric = Number(savedEqPreamp);
      if (Number.isFinite(numeric)) {
        setEqualizerPreampDb(Math.max(-12, Math.min(12, numeric)));
      }
    }

    const savedEqWetMix = window.localStorage.getItem("musicmanager-eq-wet-mix");
    if (savedEqWetMix !== null) {
      const numeric = Number(savedEqWetMix);
      if (Number.isFinite(numeric)) {
        setEqualizerWetMixPercent(Math.max(0, Math.min(100, Math.round(numeric))));
      }
    }

    const savedLibrarySnapshot = window.localStorage.getItem("musicmanager-library-snapshot");
    if (savedAutoOpen === "true" && savedLibrarySnapshot) {
      try {
        const snapshot = JSON.parse(savedLibrarySnapshot) as { folderPath?: unknown; tracks?: unknown };
        if (typeof snapshot.folderPath === "string" && Array.isArray(snapshot.tracks)) {
          const restoredTracks = snapshot.tracks as Track[];
          setFolderPath(snapshot.folderPath);
          setTracks(restoredTracks);
          setSelectedTrackId(restoredTracks[0]?.id ?? "");
          setPlaybackTrackId("");
          setShouldAutoplay(false);
          setSearchStatus("Ready");
        }
      } catch {
        // Ignore invalid snapshot.
      }
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

  useEffect(() => {
    window.localStorage.setItem(STORAGE_PLAYLISTS_KEY, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (activePlaylistId) {
      window.localStorage.setItem(STORAGE_ACTIVE_PLAYLIST_ID_KEY, activePlaylistId);
      return;
    }
    window.localStorage.removeItem(STORAGE_ACTIVE_PLAYLIST_ID_KEY);
  }, [activePlaylistId]);

  useEffect(() => {
    if (!playlists.length) {
      if (activePlaylistId) {
        setActivePlaylistId("");
      }
      setPlaylistNameDraft("");
      setIsPlaylistRenaming(false);
      return;
    }
    const active = playlists.find((playlist) => playlist.id === activePlaylistId);
    if (!active) {
      setActivePlaylistId(playlists[0].id);
      setPlaylistNameDraft(playlists[0].name);
    }
  }, [playlists, activePlaylistId]);

  useEffect(() => {
    if (!playbackPlaylistId) {
      return;
    }
    const stillExists = playlists.some((playlist) => playlist.id === playbackPlaylistId);
    if (!stillExists) {
      setPlaybackPlaylistId("");
    }
  }, [playbackPlaylistId, playlists]);

  useEffect(() => {
    if (!equalizerPresetId) {
      return;
    }
    const stillExists = equalizerPresets.some((preset) => preset.id === equalizerPresetId);
    if (!stillExists) {
      setEqualizerPresetId("");
      setIsEqualizerPresetRenaming(false);
    }
  }, [equalizerPresetId, equalizerPresets]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-auto-open-default-folder", String(autoOpenDefaultFolder));
  }, [autoOpenDefaultFolder]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-default-folder-path", defaultFolderPath);
  }, [defaultFolderPath]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-accent-rotate-on-launch", String(accentRotateOnLaunch));
  }, [accentRotateOnLaunch]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-audio-normalize-volume", String(audioNormalizeVolume));
  }, [audioNormalizeVolume]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-audio-smart-crossfade", String(audioSmartCrossfade));
  }, [audioSmartCrossfade]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-eq-preset-id", equalizerPresetId);
  }, [equalizerPresetId]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-eq-preset-name", equalizerPresetName);
  }, [equalizerPresetName]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-eq-band-gains", JSON.stringify(equalizerBandGains));
  }, [equalizerBandGains]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-eq-preamp-db", String(equalizerPreampDb));
  }, [equalizerPreampDb]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-eq-wet-mix", String(equalizerWetMixPercent));
  }, [equalizerWetMixPercent]);

  useEffect(() => {
    window.localStorage.setItem("musicmanager-eq-presets", JSON.stringify(equalizerPresets));
  }, [equalizerPresets]);

  useEffect(() => {
    if (!folderPath || !tracks.length) {
      return;
    }
    try {
      // Keep snapshot lightweight to avoid localStorage quota crashes on large libraries/covers.
      const snapshotTracks = tracks.map(({ coverUrl: _coverUrl, ...track }) => track);
      window.localStorage.setItem("musicmanager-library-snapshot", JSON.stringify({ folderPath, tracks: snapshotTracks }));
    } catch {
      // Ignore quota/serialization failures to keep UI responsive.
    }
  }, [folderPath, tracks]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const state = pointerDragStateRef.current;
      if (state.kind === "none") {
        return;
      }
      const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (!state.moved && distance > 6) {
        state.moved = true;
        setIsDashboardDragging(true);
      }
      if (!state.moved || activeScreen !== "dashboard") {
        return;
      }
      const hoveredElement = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const hoveredEntry = hoveredElement?.closest<HTMLElement>("[data-playlist-entry-id]");
      const hoveredDropzone = hoveredElement?.closest<HTMLElement>("[data-playlist-dropzone]");
      const hoveredList = hoveredElement?.closest<HTMLElement>("[data-playlist-list]");
      const nextDropArea = hoveredDropzone ? "dropzone" : hoveredList ? "playlist" : "none";
      const nextDropEntryId = hoveredEntry?.dataset.playlistEntryId ?? "";
      setDashboardDropArea((prev) => (prev === nextDropArea ? prev : nextDropArea));
      setDashboardDropEntryId((prev) => (prev === nextDropEntryId ? prev : nextDropEntryId));
    };

    const onPointerUp = (event: PointerEvent) => {
      const state = pointerDragStateRef.current;
      if (activeScreen !== "dashboard" || state.kind === "none") {
        clearDragState();
        return;
      }
      if (!state.moved) {
        clearDragState();
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const payload =
        state.kind === "library-track"
          ? ({ kind: "library-track", trackId: state.id } as const)
          : ({ kind: "playlist-entry", entryId: state.id } as const);
      const applied = applyDashboardPointerDrop(payload, target);
      if (applied) {
        suppressNextPlaylistItemClickRef.current = true;
      }
      clearDragState();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [activeScreen, activePlaylistId, playlists.length]);
  const selectedFileName = editableTrack ? getFileName(editableTrack.path) : "No file selected";
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedTrack || !editableTrack || selectedTrack.id !== editableTrack.id) {
      return false;
    }
    return !areTracksEqual(selectedTrack, editableTrack);
  }, [selectedTrack, editableTrack]);
  const folderCount = useMemo(() => countFoldersAndSubfolders(tracks, folderPath), [tracks, folderPath]);
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
  }, [libraryViewMode, activeScreen]);

  useEffect(() => {
    const list = trackListRef.current;
    if (list) {
      list.scrollTop = 0;
    }
    setTrackListScrollTop(0);
  }, [query, libraryViewMode, tracks.length, activeScreen]);
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
  }, [volume, audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.muted = isMuted;
  }, [isMuted, audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const graph = getOrCreateMediaAudioGraph(audio);
    if (!graph) {
      return;
    }
    applyEqualizerSettings(graph, {
      bandGains: equalizerBandGains,
      preampDb: equalizerPreampDb,
      wetMixPercent: equalizerWetMixPercent,
    });
  }, [equalizerBandGains, equalizerPreampDb, equalizerWetMixPercent, audioSrc]);

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

  function handleLibrarySortClick(mode: LibrarySortMode) {
    if (mode === librarySortMode) {
      setLibrarySortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setLibrarySortMode(mode);
    setLibrarySortDirection("asc");
  }
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
  const playbackQueueTracks = useMemo(() => {
    if (!playbackPlaylist) {
      return filteredTracks;
    }
    return playbackPlaylist.entries
      .map((entry) => tracks.find((track) => track.id === entry.trackId) ?? null)
      .filter((track): track is Track => Boolean(track));
  }, [playbackPlaylist, filteredTracks, tracks]);
  const playbackTrackIndex = useMemo(
    () => playbackQueueTracks.findIndex((t) => t.id === playbackTrackId),
    [playbackQueueTracks, playbackTrackId]
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
      if (!defaultFolderPath) {
        setDefaultFolderPath(result.folderPath);
      }
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

  function handleApplyOnlineCoverOnly(result: OnlineMatch) {
    if (!editableTrack) {
      return;
    }
    if (!result.coverUrl?.trim()) {
      setSearchStatus("Selected result has no cover image.");
      return;
    }
    setTrackDraft((prev) => (prev ? { ...prev, coverUrl: result.coverUrl, hasCover: true } : prev));
    setSearchStatus("Cover applied. Save the track to persist changes.");
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

  async function handleOpenTrackFolder() {
    if (!editableTrack?.path) {
      return;
    }
    try {
      await adapter.openTrackInFileManager(editableTrack.path);
    } catch (error) {
      setSearchStatus(`Open folder error: ${formatError(error)}`);
    }
  }

  async function handleOpenLibraryFolder() {
    if (!folderPath) {
      return;
    }
    try {
      await adapter.openTrackInFileManager(folderPath);
    } catch (error) {
      setSearchStatus(`Open folder error: ${formatError(error)}`);
    }
  }

  function ensureAudioGraphReady() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const graph = getOrCreateMediaAudioGraph(audio);
    if (!graph) {
      return;
    }
    applyEqualizerSettings(graph, {
      bandGains: equalizerBandGains,
      preampDb: equalizerPreampDb,
      wetMixPercent: equalizerWetMixPercent,
    });
    void graph.context.resume().catch(() => {
      // Resume may fail without a user gesture in some environments.
    });
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
    ensureAudioGraphReady();

    const targetTrack = playbackTrack ?? selectedTrack;
    if (targetTrack && targetTrack.id !== playbackTrackId) {
      if (selectedTrack && targetTrack.id === selectedTrack.id) {
        // Explicit single-track playback from library selection interrupts playlist mode.
        setPlaybackPlaylistId("");
      }
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
    ensureAudioGraphReady();
    setPlaybackPlaylistId("");
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

  function handleVolumeChange(value: number) {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = clamped;
    if (clamped > 0 && audio.muted) {
      audio.muted = false;
    }
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
    ensureAudioGraphReady();
    const prev = playbackQueueTracks[playbackTrackIndex - 1];
    if (prev) {
      setPlaybackTrackId(prev.id);
      setShouldAutoplay(true);
      selectTrack(prev);
    }
  }

  function handleNextTrack() {
    if (playbackTrackIndex < 0 || playbackTrackIndex >= playbackQueueTracks.length - 1) {
      return;
    }
    ensureAudioGraphReady();
    const next = playbackQueueTracks[playbackTrackIndex + 1];
    if (next) {
      setPlaybackTrackId(next.id);
      setShouldAutoplay(true);
      selectTrack(next);
    }
  }

  function handlePlayTrackFromQueue(track: Track, playlistId?: string) {
    ensureAudioGraphReady();
    setPlaybackPlaylistId(playlistId ?? "");
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

  function handlePlayActivePlaylist() {
    if (!activePlaylist) {
      return;
    }
    ensureAudioGraphReady();
    const firstPlayableTrack = activePlaylist.entries
      .map((entry) => tracks.find((track) => track.id === entry.trackId) ?? null)
      .find((track): track is Track => Boolean(track));
    if (!firstPlayableTrack) {
      return;
    }
    setPlaybackPlaylistId(activePlaylist.id);
    selectTrack(firstPlayableTrack);
    setPlaybackTrackId(firstPlayableTrack.id);
    setShouldAutoplay(true);
  }

  function handleEqualizerPresetChange(presetId: string) {
    const preset = equalizerPresets.find((item) => item.id === presetId);
    if (!preset) {
      setEqualizerPresetId("");
      return;
    }
    handleApplyEqualizerPreset(
      preset.id,
      preset.name,
      preset.bandGains,
      preset.preampDb,
      preset.wetMixPercent
    );
  }

  function handleEqualizerBandGainChange(index: number, value: number) {
    const nextValue = Math.max(-12, Math.min(12, value));
    setEqualizerBandGains((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }
      return prev.map((current, currentIndex) => (currentIndex === index ? nextValue : current));
    });
  }

  function handleApplyEqualizerPreset(
    presetId: string,
    presetName: string,
    bandGains: number[],
    preampDb = 0,
    wetMixPercent = 100
  ) {
    setEqualizerPresetId(presetId);
    setEqualizerPresetName(presetName);
    const normalized = EQUALIZER_FREQUENCIES.map((_, index) => Math.max(-12, Math.min(12, Number(bandGains[index] ?? 0))));
    setEqualizerBandGains(normalized);
    setEqualizerPreampDb(Math.max(-12, Math.min(12, preampDb)));
    setEqualizerWetMixPercent(Math.max(0, Math.min(100, Math.round(wetMixPercent))));
    setIsEqualizerPresetRenaming(false);
  }

  function handleCreateEqualizerPreset() {
    const baseName = "new preset";
    const name = buildUniqueEqualizerPresetName(equalizerPresets, baseName);
    const nextPreset: EqualizerPreset = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      bandGains: [...equalizerBandGains],
      preampDb: equalizerPreampDb,
      wetMixPercent: equalizerWetMixPercent,
    };
    setEqualizerPresets((prev) => [...prev, nextPreset]);
    setEqualizerPresetId(nextPreset.id);
    setEqualizerPresetName(nextPreset.name);
    setIsEqualizerPresetRenaming(true);
  }

  function handleSaveEqualizerPreset() {
    if (!equalizerPresetId || BUILTIN_EQ_PRESET_IDS.has(equalizerPresetId)) {
      handleCreateEqualizerPreset();
      return;
    }
    const trimmedName = equalizerPresetName.trim();
    const uniqueName = buildUniqueEqualizerPresetName(equalizerPresets, trimmedName || "Preset", equalizerPresetId);
    setEqualizerPresets((prev) => prev.map((preset) => (
      preset.id === equalizerPresetId
        ? {
          ...preset,
          name: uniqueName,
          bandGains: [...equalizerBandGains],
          preampDb: equalizerPreampDb,
          wetMixPercent: equalizerWetMixPercent,
        }
        : preset
    )));
    setEqualizerPresetName(uniqueName);
    setIsEqualizerPresetRenaming(false);
  }

  function handleRenameEqualizerPresetButtonClick() {
    if (!equalizerPresetId || BUILTIN_EQ_PRESET_IDS.has(equalizerPresetId)) {
      return;
    }
    if (!isEqualizerPresetRenaming) {
      setIsEqualizerPresetRenaming(true);
      return;
    }
    const trimmedName = equalizerPresetName.trim();
    if (!trimmedName) {
      return;
    }
    const uniqueName = buildUniqueEqualizerPresetName(equalizerPresets, trimmedName, equalizerPresetId);
    setEqualizerPresets((prev) => prev.map((preset) => (
      preset.id === equalizerPresetId ? { ...preset, name: uniqueName } : preset
    )));
    setEqualizerPresetName(uniqueName);
    setIsEqualizerPresetRenaming(false);
  }

  function handleEqualizerPresetNameInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameEqualizerPresetButtonClick();
    }
  }

  function handleDeleteEqualizerPreset() {
    if (!equalizerPresetId || BUILTIN_EQ_PRESET_IDS.has(equalizerPresetId)) {
      return;
    }
    setEqualizerPresets((prev) => {
      const next = prev.filter((preset) => preset.id !== equalizerPresetId);
      const fallback = next.find((preset) => preset.id === DEFAULT_EQUALIZER_PRESET.id) ?? next[0] ?? DEFAULT_EQUALIZER_PRESET;
      setEqualizerPresetId(fallback.id);
      setEqualizerPresetName(fallback.name);
      setEqualizerBandGains([...fallback.bandGains]);
      setEqualizerPreampDb(fallback.preampDb);
      setEqualizerWetMixPercent(fallback.wetMixPercent);
      return next;
    });
    setIsEqualizerPresetRenaming(false);
  }

  function handleResetEqualizer() {
    const flatPreset = equalizerPresets.find((preset) => preset.id === DEFAULT_EQUALIZER_PRESET.id) ?? DEFAULT_EQUALIZER_PRESET;
    setEqualizerPresetId(flatPreset.id);
    setEqualizerPresetName(flatPreset.name);
    setEqualizerBandGains([...flatPreset.bandGains]);
    setEqualizerPreampDb(flatPreset.preampDb);
    setEqualizerWetMixPercent(flatPreset.wetMixPercent);
    setIsEqualizerPresetRenaming(false);
  }

  function handleCreatePlaylist() {
    const trimmedName = playlistNameDraft.trim();
    const hasNameConflict = trimmedName
      ? playlists.some((playlist) => normalizePlaylistName(playlist.name) === normalizePlaylistName(trimmedName))
      : false;
    const baseName = !trimmedName || hasNameConflict ? "New Playlist" : trimmedName;
    const name = buildUniquePlaylistName(playlists, baseName);
    const nextPlaylist: Playlist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      entries: [],
    };
    setPlaylists((prev) => [...prev, nextPlaylist]);
    setActivePlaylistId(nextPlaylist.id);
    setPlaylistNameDraft(nextPlaylist.name);
    setIsPlaylistRenaming(false);
  }

  function handleRenamePlaylist() {
    if (!activePlaylist) {
      return;
    }
    const nextName = playlistNameDraft.trim();
    if (!nextName) {
      return;
    }
    const uniqueName = buildUniquePlaylistName(playlists, nextName, activePlaylist.id);
    setPlaylists((prev) => prev.map((playlist) => (
      playlist.id === activePlaylist.id ? { ...playlist, name: uniqueName } : playlist
    )));
    setPlaylistNameDraft(uniqueName);
  }

  function handleRenamePlaylistButtonClick() {
    if (!activePlaylist) {
      return;
    }
    if (!isPlaylistRenaming) {
      setPlaylistNameDraft(activePlaylist.name);
      setIsPlaylistRenaming(true);
      return;
    }
    handleRenamePlaylist();
    setIsPlaylistRenaming(false);
  }

  function handleDeletePlaylist() {
    if (!activePlaylist) {
      return;
    }
    setPlaylists((prev) => {
      const next = prev.filter((playlist) => playlist.id !== activePlaylist.id);
      setActivePlaylistId(next[0]?.id ?? "");
      setPlaylistNameDraft(next[0]?.name ?? "");
      setIsPlaylistRenaming(false);
      return next;
    });
  }

  function handlePlaylistDraftChange(value: string) {
    setPlaylistNameDraft(value);
  }

  function handleActivePlaylistChange(playlistId: string) {
    setIsPlaylistRenaming(false);
    setActivePlaylistId(playlistId);
    const matchedPlaylist = playlists.find((playlist) => playlist.id === playlistId);
    setPlaylistNameDraft(matchedPlaylist?.name ?? "");
  }

  function handlePlaylistRenameInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    handleRenamePlaylist();
    setIsPlaylistRenaming(false);
  }

  function handleLibraryTrackPointerDown(event: PointerEvent<HTMLElement>, track: Track) {
    pointerDragStateRef.current = {
      kind: "library-track",
      id: track.id,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  function handlePlaylistEntryPointerDown(event: PointerEvent<HTMLElement>, entryId: string) {
    pointerDragStateRef.current = {
      kind: "playlist-entry",
      id: entryId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  function insertTrackIntoActivePlaylist(trackId: string, beforeEntryId?: string | null) {
    const nextEntry: PlaylistEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trackId,
    };
    if (!activePlaylist) {
      const playlistName = buildUniquePlaylistName(playlists, "New Playlist");
      const nextPlaylist: Playlist = {
        id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: playlistName,
        entries: [nextEntry],
      };
      setPlaylists((prev) => [...prev, nextPlaylist]);
      setActivePlaylistId(nextPlaylist.id);
      setPlaylistNameDraft(nextPlaylist.name);
      return;
    }
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== activePlaylist.id) {
          return playlist;
        }
        if (!beforeEntryId) {
          return { ...playlist, entries: [...playlist.entries, nextEntry] };
        }
        const atIndex = playlist.entries.findIndex((entry) => entry.id === beforeEntryId);
        if (atIndex < 0) {
          return { ...playlist, entries: [...playlist.entries, nextEntry] };
        }
        const nextEntries = [...playlist.entries];
        nextEntries.splice(atIndex, 0, nextEntry);
        return { ...playlist, entries: nextEntries };
      })
    );
  }

  function appendTrackToActivePlaylist(trackId: string) {
    insertTrackIntoActivePlaylist(trackId, null);
  }

  function movePlaylistEntry(draggedEntryId: string, targetEntryId?: string | null) {
    if (!activePlaylist) {
      return;
    }
    setPlaylists((prev) => prev.map((playlist) => {
      if (playlist.id !== activePlaylist.id) {
        return playlist;
      }
      const fromIndex = playlist.entries.findIndex((entry) => entry.id === draggedEntryId);
      if (fromIndex < 0) {
        return playlist;
      }
      let toIndex = targetEntryId
        ? playlist.entries.findIndex((entry) => entry.id === targetEntryId)
        : playlist.entries.length - 1;
      if (toIndex < 0) {
        toIndex = playlist.entries.length - 1;
      }
      if (fromIndex === toIndex) {
        return playlist;
      }
      const nextEntries = [...playlist.entries];
      const [moved] = nextEntries.splice(fromIndex, 1);
      nextEntries.splice(toIndex, 0, moved);
      return { ...playlist, entries: nextEntries };
    }));
  }

  function removePlaylistEntry(entryId: string) {
    if (!activePlaylist) {
      return;
    }
    setPlaylists((prev) => prev.map((playlist) => {
      if (playlist.id !== activePlaylist.id) {
        return playlist;
      }
      return {
        ...playlist,
        entries: playlist.entries.filter((entry) => entry.id !== entryId),
      };
    }));
  }

  function applyDashboardPointerDrop(
    payload: { kind: "library-track"; trackId: string } | { kind: "playlist-entry"; entryId: string },
    target: Element | null
  ): boolean {
    if (activeScreen !== "dashboard") {
      return false;
    }
    const targetElement = target instanceof HTMLElement ? target : null;
    if (!targetElement) {
      return false;
    }
    const entryElement = targetElement.closest<HTMLElement>("[data-playlist-entry-id]");
    const listElement = targetElement.closest<HTMLElement>("[data-playlist-list]");
    const dropzoneElement = targetElement.closest<HTMLElement>("[data-playlist-dropzone]");
    if (!entryElement && !listElement && !dropzoneElement) {
      return false;
    }
    const targetEntryId = entryElement?.dataset.playlistEntryId ?? null;
    if (payload.kind === "library-track") {
      insertTrackIntoActivePlaylist(payload.trackId, targetEntryId);
      return true;
    }
    if (payload.kind === "playlist-entry") {
      movePlaylistEntry(payload.entryId, targetEntryId);
      return true;
    }
    return false;
  }

  function clearDragState() {
    pointerDragStateRef.current = { kind: "none", id: "", startX: 0, startY: 0, moved: false };
    setIsDashboardDragging(false);
    setDashboardDropArea("none");
    setDashboardDropEntryId("");
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

  const hasAudioLoaded = Boolean(audioSrc && audioTrackId === playbackTrackId);

  return (
    <div className={colorMode === "dark" ? "app-shell theme-dark" : "app-shell"} style={appStyle}>
      <TopBarSection
        activeScreen={activeScreen}
        appIconSrc={appIcon}
        audioRef={audioRef}
        audioSrc={audioSrc}
        playerInfoTrack={playerInfoTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        audioError={audioError}
        showAudioError={Boolean(selectedTrack || playbackTrack)}
        isPrevDisabled={playbackTrackIndex <= 0}
        isNextDisabled={playbackTrackIndex < 0 || playbackTrackIndex >= playbackQueueTracks.length - 1}
        isPlayDisabled={!selectedTrack && !audioSrc}
        canSeek={Boolean(audioSrc && audioTrackId === playbackTrackId && duration > 0)}
        onScreenChange={setActiveScreen}
        onRotateAccent={() => setAccentIndex((prev) => (prev + 1) % ACCENT_THEMES.length)}
        onPrev={handlePrevTrack}
        onPlayPause={() => {
          void handleTogglePlayPause();
        }}
        onNext={handleNextTrack}
        onSeek={handleSeek}
        onToggleMute={() => setIsMuted((prev) => !prev)}
        onVolumeChange={handleVolumeChange}
        IconPrev={IconPrev}
        IconPause={IconPause}
        IconPlay={IconPlay}
        IconNext={IconNext}
        IconMute={IconMute}
        IconVolume={IconVolume}
        IconDashboard={IconGrid}
        IconTagging={IconMusicNote}
        IconPlayer={IconPlay}
        IconSettings={IconSettings}
      />

      {activeScreen === "tagging" && (
        <main className="two-col">
          <div className="col col-left">
            <LibrarySection
              folderPath={folderPath}
              onOpenFolderPathClick={() => {
                void handleOpenLibraryFolder();
              }}
              isLoadingScan={isLoadingScan}
              onScan={handleScan}
              query={query}
              onQueryChange={setQuery}
              libraryViewMode={libraryViewMode}
              onLibraryViewModeChange={setLibraryViewMode}
              librarySortMode={librarySortMode}
              librarySortDirection={librarySortDirection}
              onLibrarySortClick={handleLibrarySortClick}
              trackCount={tracks.length}
              folderCount={folderCount}
              trackListRef={trackListRef}
              onTrackListScroll={handleTrackListScroll}
              virtualTrackWindow={virtualTrackWindow}
              selectedTrackId={selectedTrackId}
              onSelectTrack={selectTrack}
              onSearchTrack={handleQuickSearchTrack}
              onPlayFromLibraryCover={handlePlayFromLibraryCover}
              IconFolder={IconFolder}
              IconMusicNote={IconMusicNote}
              IconSortTitle={IconSortTitle}
              IconSortArtist={IconSortArtist}
              IconSortAdded={IconSortAdded}
              IconSortRelease={IconSortRelease}
              IconGrid={IconGrid}
              IconListCompact={IconListCompact}
              IconPlay={IconPlay}
              IconSearch={IconSearch}
            />
          </div>

          <div className="col col-right">
            <TrackDetailsSection
              selectedFileName={selectedFileName}
              selectedFilePath={editableTrack?.path ?? ""}
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
              onOpenTrackPathClick={() => {
                void handleOpenTrackFolder();
              }}
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
              onApplyOnlineCoverOnly={handleApplyOnlineCoverOnly}
              onApplyAndSaveOnlineResult={(result) => {
                void handleApplyAndSaveOnlineResult(result);
              }}
              IconSearch={IconSearch}
              IconClose={IconClose}
              IconCheck={IconCheck}
              IconCover={IconCover}
              IconSave={IconSave}
            />
          </div>
        </main>
      )}

      {activeScreen === "dashboard" && (
        <DashboardSection
          activePlaylistId={activePlaylistId}
          isPlaylistRenaming={isPlaylistRenaming}
          libraryProps={{
            folderPath,
            onOpenFolderPathClick: () => {
              void handleOpenLibraryFolder();
            },
            isLoadingScan,
            onScan: handleScan,
            query,
            onQueryChange: setQuery,
            libraryViewMode,
            onLibraryViewModeChange: setLibraryViewMode,
            librarySortMode,
            librarySortDirection,
            onLibrarySortClick: handleLibrarySortClick,
            trackCount: tracks.length,
            folderCount,
            trackListRef,
            onTrackListScroll: handleTrackListScroll,
            virtualTrackWindow,
            selectedTrackId,
            onSelectTrack: selectTrack,
            onSearchTrack: handleQuickSearchTrack,
            onTrackAction: (track) => appendTrackToActivePlaylist(track.id),
            trackActionTitle: "Add track to playlist",
            trackActionAriaLabel: "Add track to playlist",
            onPlayFromLibraryCover: handlePlayFromLibraryCover,
            enableTrackDrag: true,
            useNativeTrackDrag: false,
            onTrackPointerDown: handleLibraryTrackPointerDown,
            draggingTrackId:
              isDashboardDragging && pointerDragStateRef.current.kind === "library-track"
                ? pointerDragStateRef.current.id
                : "",
            IconFolder,
            IconMusicNote,
            IconSortTitle,
            IconSortArtist,
            IconSortAdded,
            IconSortRelease,
            IconGrid,
            IconListCompact,
            IconPlay,
            IconSearch,
            IconTrackAction: IconPlus,
          }}
          playlistNameDraft={playlistNameDraft}
          playlists={playlists}
          hasActivePlaylist={Boolean(activePlaylist)}
          canPlayActivePlaylist={Boolean(activePlaylist?.entries.length)}
          activePlaylistEntries={activePlaylist?.entries ?? []}
          tracks={tracks}
          isDashboardDragging={isDashboardDragging}
          dashboardDropArea={dashboardDropArea}
          dashboardDropEntryId={dashboardDropEntryId}
          draggingPlaylistEntryId={
            isDashboardDragging && pointerDragStateRef.current.kind === "playlist-entry"
              ? pointerDragStateRef.current.id
              : ""
          }
          onActivePlaylistChange={handleActivePlaylistChange}
          onPlaylistDraftChange={handlePlaylistDraftChange}
          onCreatePlaylist={handleCreatePlaylist}
          onRenamePlaylist={handleRenamePlaylistButtonClick}
          onPlaylistRenameInputKeyDown={handlePlaylistRenameInputKeyDown}
          onDeletePlaylist={handleDeletePlaylist}
          onPlayActivePlaylist={handlePlayActivePlaylist}
          onPlaylistEntryPointerDown={handlePlaylistEntryPointerDown}
          onPlaylistEntryClick={(track) => {
            if (suppressNextPlaylistItemClickRef.current) {
              suppressNextPlaylistItemClickRef.current = false;
              return;
            }
            handlePlayTrackFromQueue(track, activePlaylist?.id);
          }}
          onRemovePlaylistEntry={removePlaylistEntry}
          IconPlus={IconPlus}
          IconRename={IconRename}
          IconTrash={IconTrash}
          IconPlay={IconPlay}
        />
      )}

      {activeScreen === "player" && (
        <PlayerSection
          audioRef={audioRef}
          isActive={activeScreen === "player"}
          hasAudio={hasAudioLoaded}
          isPlaying={isPlaying}
          coverUrl={playerInfoTrack?.coverUrl}
          currentTime={currentTime}
          duration={duration}
          title={playerInfoTrack?.title || ""}
          artist={playerInfoTrack?.artist || ""}
          accentColor={accentTheme.accent}
          isDarkMode={colorMode === "dark"}
          queueTracks={filteredTracks}
          playbackTrackId={playbackTrackId}
          onQueueTrackClick={(track) => handlePlayTrackFromQueue(track)}
        />
      )}

      {activeScreen === "settings" && (
        <SettingsSection
          autoOpenDefaultFolder={autoOpenDefaultFolder}
          onAutoOpenDefaultFolderChange={setAutoOpenDefaultFolder}
          defaultFolderPath={defaultFolderPath}
          onDefaultFolderPathChange={setDefaultFolderPath}
          folderPath={folderPath}
          audioRef={audioRef}
          accentColor={accentTheme.accent}
          onUseCurrentLibraryFolder={() => setDefaultFolderPath(folderPath)}
          audioNormalizeVolume={audioNormalizeVolume}
          onAudioNormalizeVolumeChange={setAudioNormalizeVolume}
          audioSmartCrossfade={audioSmartCrossfade}
          onAudioSmartCrossfadeChange={setAudioSmartCrossfade}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          accentRotateOnLaunch={accentRotateOnLaunch}
          onAccentRotateOnLaunchChange={setAccentRotateOnLaunch}
          onRotateAccentNow={() => setAccentIndex((prev) => (prev + 1) % ACCENT_THEMES.length)}
          equalizerPresets={equalizerPresets}
          equalizerPresetId={equalizerPresetId}
          onEqualizerPresetIdChange={(value) => {
            setEqualizerPresetId(value);
            setIsEqualizerPresetRenaming(false);
          }}
          onEqualizerPresetChange={handleEqualizerPresetChange}
          equalizerPresetName={equalizerPresetName}
          onEqualizerPresetNameChange={setEqualizerPresetName}
          isEqualizerPresetRenaming={isEqualizerPresetRenaming}
          onEqualizerPresetNameInputKeyDown={handleEqualizerPresetNameInputKeyDown}
          equalizerBandGains={equalizerBandGains}
          onEqualizerBandGainChange={handleEqualizerBandGainChange}
          equalizerPreampDb={equalizerPreampDb}
          onEqualizerPreampDbChange={(value) => {
            setEqualizerPreampDb(Math.max(-12, Math.min(12, value)));
          }}
          equalizerWetMixPercent={equalizerWetMixPercent}
          onEqualizerWetMixPercentChange={(value) => {
            setEqualizerWetMixPercent(Math.max(0, Math.min(100, Math.round(value))));
          }}
          canRenameDeleteEqualizerPreset={canRenameDeleteEqualizerPreset}
          onCreateEqualizerPreset={handleCreateEqualizerPreset}
          onRenameEqualizerPreset={handleRenameEqualizerPresetButtonClick}
          onDeleteEqualizerPreset={handleDeleteEqualizerPreset}
          onSaveEqualizerPreset={handleSaveEqualizerPreset}
          onResetEqualizer={handleResetEqualizer}
          onOpenExternalLink={(event, url) => {
            void handleOpenExternalLink(event, url);
          }}
          IconPlus={IconPlus}
          IconRename={IconRename}
          IconTrash={IconTrash}
          IconSave={IconSave}
        />
      )}

      <RenameSettingsModal
        show={showRenameSettings}
        renameFields={renameFields}
        renameFieldOptions={RENAME_FIELD_OPTIONS}
        renameSeparator={renameSeparator}
        onClose={() => setShowRenameSettings(false)}
        onMoveRenameField={moveRenameField}
        onToggleRenameField={toggleRenameField}
        onRenameSeparatorChange={setRenameSeparator}
        renameFieldLabel={renameFieldLabel}
        IconClose={IconClose}
        IconArrowUp={IconArrowUp}
        IconArrowDown={IconArrowDown}
        IconCheck={IconCheck}
      />
    </div>
  );
}

function renameFieldLabel(field: RenameField): string {
  const found = RENAME_FIELD_OPTIONS.find((f) => f.key === field);
  return found?.label ?? field;
}
