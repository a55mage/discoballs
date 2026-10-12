import { type ChangeEvent, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createAdapter } from "./api/tauriAdapter";
import { mockAdapter } from "./api/mockAdapter";
import appIcon from "./assets/discoballs-icon.png";
import {
  IconArrowDown,
  IconArrowUp,
  IconAutoEq,
  IconCheck,
  IconClose,
  IconCover,
  IconExternalLink,
  IconFolder,
  IconGlobe,
  IconGrid,
  IconHeart,
  IconListCompact,
  IconMic,
  IconMusicNote,
  IconMusicArrowRight,
  IconPlaylist,
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
  IconShuffle,
  IconSettings,
  IconSortAdded,
  IconSortArtist,
  IconSortRelease,
  IconSortTitle,
  IconTag,
  IconTrash,
  IconRepeatOne,
  IconUser,
  IconVisualizerBars,
  IconVolume,
} from "./components/icons";
import { DashboardSection } from "./sections/DashboardSection";
import { LibraryBrowserSection, type LibraryAlbumSummary, type LibraryArtistSummary } from "./sections/LibraryBrowserSection";
import { LibrarySection } from "./sections/LibrarySection";
import type { VisualizerPresetId } from "./sections/MusicVisualizerSection";
import { OnlineSearchSection } from "./sections/OnlineSearchSection";
import { PlayerSection } from "./sections/PlayerSection";
import { RenameSettingsModal } from "./sections/RenameSettingsModal";
import { SettingsSection } from "./sections/SettingsSection";
import { TopBarSection } from "./sections/TopBarSection";
import { TrackDetailsSection } from "./sections/TrackDetailsSection";
import type { AppScreen, NavidromeBookmark, NavidromeConnectionInput, OnlineMatch, RenameField, SearchQuery, Track, TrackTechnicalInfo } from "./types";
import { useEqualizerStore } from "./store/equalizerStore";
import { useLibraryStore } from "./store/libraryStore";
import { consumePendingStartupConnection, useNavidromeStore } from "./store/navidromeStore";
import { PLAYER_QUEUE_HISTORY_SIZE, PLAYER_QUEUE_PAGE_SIZE, usePlayerStore } from "./store/playerStore";
import { useTagEditorStore } from "./store/tagEditorStore";
import { buildNavidromeBookmarkId, defaultNavidromeBookmarkName } from "./domain/navidrome";
import { usePlaylistStore } from "./store/playlistStore";
import { useSettingsStore } from "./store/settingsStore";
import { BUILTIN_EQ_PRESET_IDS, buildUniqueEqualizerPresetName } from "./domain/equalizer";
import {
  areTrackIdListsEqual,
  buildLibraryQueueOrder,
  buildPlaylistQueueOrder,
  buildUniquePlaylistName,
  normalizePlaylistName,
  shuffleTrackIds,
  type Playlist,
  type PlaylistEntry,
} from "./domain/playlist";
import { RENAME_FIELD_KEYS, RENAME_FIELD_OPTIONS, renameFieldLabel } from "./domain/rename";
import { ACCENT_THEMES, buildSoftAccent, buildStrongAccent, type AccentTheme } from "./domain/theme";
import { useLibraryView } from "./hooks/useLibraryView";
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
  inferGenrePresetId,
  NO_GENRE_EQ_KEY,
  normalizeGenreKey,
  scoreOnlineMatch,
} from "./utils/appHelpers";
import { fetchLyrics, getActiveLyricIndex, type LyricLine } from "./utils/lyrics";

const adapter = createAdapter(mockAdapter);
const STORAGE_PLAYER_COLUMNS_KEY = "musicmanager-player-columns";
const STORAGE_PLAYER_VISUALIZER_PRESET_KEY = "musicmanager-player-visualizer-preset";
const STORAGE_PLAYER_SHOW_LYRICS_KEY = "musicmanager-player-show-lyrics";
const STORAGE_STARTUP_SCREEN_KEY = "musicmanager-startup-screen";

export function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const selectTrackRef = useRef<(track: Track) => void>(() => undefined);
  const playbackQueueTracksRef = useRef<Track[]>([]);
  const playbackTrackIdRef = useRef("");
  const playbackTrackIndexRef = useRef(-1);
  const isRepeatTrackEnabledRef = useRef(false);
  const previousPlaybackTrackIdRef = useRef("");
  const previousShuffleEnabledRef = useRef(false);
  const searchRequestRef = useRef<{ id: number; canceled: boolean } | null>(null);
  const searchRequestCounterRef = useRef(0);
  const hasAutoOpenedDefaultFolderRef = useRef(false);
  const didAutoConnectNavidromeRef = useRef(false);
  const shouldRunNavidromeStartupConnectionRef = useRef(consumePendingStartupConnection());
  const didRestoreLibrarySnapshotRef = useRef(false);
  const coverRequestIdsRef = useRef<Set<string>>(new Set());
  const coverCacheRef = useRef<Map<string, string | null>>(new Map());
  const pointerDragStateRef = useRef<{
    kind: "none" | "library-track" | "playlist-entry";
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ kind: "none", id: "", startX: 0, startY: 0, moved: false });
  const suppressNextPlaylistItemClickRef = useRef(false);
  const [activeScreen, setActiveScreen] = useState<AppScreen>(() => useSettingsStore.getState().startupScreen);
  const [showRenameSettings, setShowRenameSettings] = useState(false);
  const {
    playlists,
    activePlaylistId,
    playlistNameDraft,
    isPlaylistRenaming,
    setPlaylistNameDraft: handlePlaylistDraftChange,
    setActivePlaylist: handleActivePlaylistChange,
    createPlaylist: handleCreatePlaylist,
    renameButtonClick: handleRenamePlaylistButtonClick,
    confirmRename: confirmPlaylistRename,
    deleteActivePlaylist: handleDeletePlaylist,
    insertTrack: insertTrackIntoActivePlaylist,
    appendTracks,
    moveEntry: movePlaylistEntry,
    removeEntry: removePlaylistEntry,
  } = usePlaylistStore();
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [lyricsIsSynced, setLyricsIsSynced] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState("Select a track to load lyrics.");
  const [trackTechnicalInfo, setTrackTechnicalInfo] = useState<TrackTechnicalInfo | null>(null);
  const {
    startupScreen,
    setStartupScreen,
    autoOpenDefaultFolder,
    setAutoOpenDefaultFolder,
    defaultFolderPath,
    setDefaultFolderPath,
    accentRotateOnLaunch,
    setAccentRotateOnLaunch,
    audioAutoEq,
    setAudioAutoEq,
    audioNormalizeVolume,
    setAudioNormalizeVolume,
    audioSmartCrossfade,
    setAudioSmartCrossfade,
    renameFields,
    renameSeparator,
    setRenameSeparator,
    toggleRenameField,
    moveRenameField,
    accentThemes,
    accentIndex,
    setAccentIndex,
    rotateAccent,
    addAccentTheme: handleAddAccentTheme,
    removeAccentTheme: handleRemoveAccentTheme,
    changeAccentColor: handleAccentColorChange,
    resetAccentThemes: handleResetAccentThemes,
    colorMode,
    setColorMode,
    playerColumnVisibility,
    togglePlayerColumn,
    playerVisualizerPresetId,
    setPlayerVisualizerPresetId,
    showPlayerLyricsSection,
    toggleShowPlayerLyrics: handleTogglePlayerLyricsSection,
  } = useSettingsStore();
  const {
    equalizerPresets,
    equalizerPresetId,
    startupEqualizerPresetId,
    equalizerPresetName,
    equalizerBandGains,
    equalizerPreampDb,
    equalizerWetMixPercent,
    isEqualizerPresetRenaming,
    genreEqPresetMap,
    setEqualizerPresetIdRaw,
    setStartupEqualizerPresetId,
    setEqualizerPresetName,
    setEqualizerPreampDb,
    setEqualizerWetMixPercent,
    setEqualizerBandGain: handleEqualizerBandGainChange,
    changePreset: handleEqualizerPresetChange,
    applyPreset: applyEqualizerPreset,
    setGenreEqPreset: handleGenreEqPresetChange,
    syncGenreEqMap,
    createPreset: handleCreateEqualizerPreset,
    savePreset: handleSaveEqualizerPreset,
    renameButtonClick: handleRenameEqualizerPresetButtonClick,
    deletePreset: handleDeleteEqualizerPreset,
    reset: handleResetEqualizer,
  } = useEqualizerStore();
  const { tracks, folderPath, selectedTrackId, isLoadingScan, setTracks, setFolderPath, setSelectedTrackId, setIsLoadingScan } =
    useLibraryStore();
  const {
    trackDraft,
    onlineResults,
    selectedResultId,
    isLoadingSearch,
    searchStatus,
    searchTitle,
    searchArtist,
    searchAlbum,
    setTrackDraft,
    setOnlineResults,
    setSelectedResultId,
    setIsLoadingSearch,
    setSearchStatus,
    setSearchTitle,
    setSearchArtist,
    setSearchAlbum,
  } = useTagEditorStore();
  const {
    isNavidromePanelOpen,
    navidromeName,
    navidromeBaseUrl,
    navidromeUsername,
    navidromePassword,
    navidromeConnectOnOpen,
    navidromeBookmarks,
    connectedNavidromeBookmarkId,
    navidromeStatus,
    isConnectingNavidrome,
    setIsNavidromePanelOpen,
    setNavidromeName,
    setNavidromeBaseUrl,
    setNavidromeUsername,
    setNavidromePassword,
    setNavidromeConnectOnOpen,
    setNavidromeBookmarks,
    setConnectedNavidromeBookmarkId,
    setNavidromeStatus,
    setIsConnectingNavidrome,
  } = useNavidromeStore();
  const {
    playbackTrackId,
    playbackPlaylistId,
    playbackQueueTrackIds,
    playbackHistoryTrackIds,
    playerQueueVisibleCount,
    isPlaying,
    isShuffleEnabled,
    isRepeatTrackEnabled,
    currentTime,
    duration,
    volume,
    isMuted,
    audioSrc,
    audioTrackId,
    audioError,
    shouldAutoplay,
    setPlaybackTrackId,
    setPlaybackPlaylistId,
    setPlaybackQueueTrackIds,
    setPlaybackHistoryTrackIds,
    setPlayerQueueVisibleCount,
    setIsPlaying,
    setIsShuffleEnabled,
    setIsRepeatTrackEnabled,
    setCurrentTime,
    setDuration,
    setVolume,
    setIsMuted,
    setAudioSrc,
    setAudioTrackId,
    setAudioError,
    setShouldAutoplay,
  } = usePlayerStore();
  const [isDashboardDragging, setIsDashboardDragging] = useState(false);
  const [dashboardDropArea, setDashboardDropArea] = useState<"none" | "dropzone" | "playlist">("none");
  const [dashboardDropEntryId, setDashboardDropEntryId] = useState("");
  const {
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
    canGoUpFileSystemFolder,
    openFileSystemFolder,
    goUpFileSystemFolder,
    trackListRef,
    handleTrackListScroll,
    handleLibrarySortClick,
    filteredTracks,
    virtualTrackWindow,
  } = useLibraryView(tracks, activeScreen, folderPath);
  const userLocale = useMemo(() => getUserLocale(), []);
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId]
  );
  const activeEqualizerPreset = useMemo(
    () => equalizerPresets.find((preset) => preset.id === equalizerPresetId) ?? null,
    [equalizerPresets, equalizerPresetId]
  );
  const canRenameDeleteEqualizerPreset = Boolean(activeEqualizerPreset && !BUILTIN_EQ_PRESET_IDS.has(activeEqualizerPreset.id));
  const libraryGenres = useMemo(() => {
    const genreMap = new Map<string, string>();
    for (const track of tracks) {
      const rawGenre = String(track.genre || "").trim();
      if (!rawGenre) {
        continue;
      }
      const genreKey = normalizeGenreKey(rawGenre);
      if (!genreKey || genreMap.has(genreKey)) {
        continue;
      }
      genreMap.set(genreKey, rawGenre);
    }
    return [...genreMap.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [tracks]);
  const libraryArtists = useMemo<LibraryArtistSummary[]>(() => {
    const artists = new Map<string, {
      name: string;
      trackCount: number;
      albums: Set<string>;
      coverUrl?: string;
    }>();
    for (const track of tracks) {
      const name = track.artist.trim() || "Unknown artist";
      const key = name.toLowerCase();
      const artist = artists.get(key) ?? {
        name,
        trackCount: 0,
        albums: new Set<string>(),
        coverUrl: undefined,
      };
      artist.trackCount += 1;
      artist.albums.add((track.album.trim() || "Unknown album").toLowerCase());
      if (!artist.coverUrl && track.coverUrl) {
        artist.coverUrl = track.coverUrl;
      }
      artists.set(key, artist);
    }
    return [...artists.entries()]
      .map(([id, artist]) => ({
        id,
        name: artist.name,
        trackCount: artist.trackCount,
        albumCount: artist.albums.size,
        coverUrl: artist.coverUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [tracks]);
  const libraryAlbums = useMemo<LibraryAlbumSummary[]>(() => {
    const albums = new Map<string, {
      title: string;
      artist: string;
      year: string;
      trackCount: number;
      coverUrl?: string;
    }>();
    for (const track of tracks) {
      const title = track.album.trim() || "Unknown album";
      const artist = track.artist.trim() || "Unknown artist";
      const key = `${artist.toLowerCase()}|${title.toLowerCase()}`;
      const album = albums.get(key) ?? {
        title,
        artist,
        year: track.year,
        trackCount: 0,
        coverUrl: undefined,
      };
      album.trackCount += 1;
      if (!album.year && track.year) {
        album.year = track.year;
      }
      if (!album.coverUrl && track.coverUrl) {
        album.coverUrl = track.coverUrl;
      }
      albums.set(key, album);
    }
    return [...albums.entries()]
      .map(([id, album]) => ({
        id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        trackCount: album.trackCount,
        coverUrl: album.coverUrl,
      }))
      .sort((a, b) => (
        a.artist.localeCompare(b.artist, undefined, { sensitivity: "base" }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      ));
  }, [tracks]);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const playbackTrack = tracks.find((t) => t.id === playbackTrackId) ?? null;
  function getRemoteCoverCacheKey(track: Track): string {
    if (track.source?.type === "navidrome" && track.source.coverArtId) {
      return `${track.source.baseUrl}:${track.source.coverArtId}`;
    }
    return track.id;
  }
  const lyricsTrack = playbackTrack ?? selectedTrack;
  const playerInfoTrack = playbackTrack ?? selectedTrack;
  const lyricsActiveIndex = useMemo(
    () => getActiveLyricIndex(lyricsLines, currentTime),
    [lyricsLines, currentTime]
  );
  const editableTrack = trackDraft ?? selectedTrack;

  useEffect(() => {
    const candidates = [
      playbackTrack,
      selectedTrack,
      ...virtualTrackWindow.visibleTracks.slice(0, 30),
    ].filter((track): track is Track => Boolean(track?.source?.type === "navidrome" && track.hasCover && !track.coverUrl));
    const uniqueCandidates = new Map<string, Track>();
    for (const track of candidates) {
      uniqueCandidates.set(getRemoteCoverCacheKey(track), track);
    }
    const pending = [...uniqueCandidates.entries()].filter(([cacheKey]) => (
      !coverRequestIdsRef.current.has(cacheKey) && !coverCacheRef.current.has(cacheKey)
    ));
    if (!pending.length) {
      return;
    }

    let cancelled = false;
    for (const [cacheKey, track] of pending.slice(0, 8)) {
      coverRequestIdsRef.current.add(cacheKey);
      void (async () => {
        try {
          const coverUrl = await adapter.getTrackCoverSource(track);
          coverCacheRef.current.set(cacheKey, coverUrl);
          if (cancelled || !coverUrl) {
            return;
          }
          setTracks((prev) => prev.map((item) => (
            getRemoteCoverCacheKey(item) === cacheKey ? { ...item, coverUrl } : item
          )));
          setTrackDraft((prev) => (
            prev && getRemoteCoverCacheKey(prev) === cacheKey ? { ...prev, coverUrl } : prev
          ));
        } catch {
          coverCacheRef.current.set(cacheKey, null);
        } finally {
          coverRequestIdsRef.current.delete(cacheKey);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [playbackTrack, selectedTrack, virtualTrackWindow.visibleTracks]);
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
  const accentTheme = accentThemes[Math.max(0, accentIndex % Math.max(1, accentThemes.length))] ?? ACCENT_THEMES[0];
  const appStyle: CSSProperties = {
    "--accent": accentTheme.accent,
    "--accent-soft": accentTheme.soft,
    "--accent-strong": accentTheme.strong,
  } as CSSProperties;

  useEffect(() => {
    const savedLibrarySnapshot = window.localStorage.getItem("musicmanager-library-snapshot");
    if (useSettingsStore.getState().autoOpenDefaultFolder && savedLibrarySnapshot) {
      try {
        const snapshot = JSON.parse(savedLibrarySnapshot) as { folderPath?: unknown; tracks?: unknown };
        if (typeof snapshot.folderPath === "string" && Array.isArray(snapshot.tracks)) {
          const restoredTracks = snapshot.tracks as Track[];
          didRestoreLibrarySnapshotRef.current = true;
          setFolderPath(snapshot.folderPath);
          setTracks(restoredTracks);
          setSelectedTrackId(restoredTracks[0]?.id ?? "");
          setPlaybackPlaylistId("");
          setPlaybackTrackId("");
          clearPlaybackQueueState();
          setShouldAutoplay(false);
          setSearchStatus("Ready");
        }
      } catch {
        // Ignore invalid snapshot.
      }
    }
  }, []);

  useEffect(() => {
    if (!autoOpenDefaultFolder || !defaultFolderPath || hasAutoOpenedDefaultFolderRef.current) {
      return;
    }
    hasAutoOpenedDefaultFolderRef.current = true;
    let canceled = false;
    const shouldHydrateFromSnapshot =
      didRestoreLibrarySnapshotRef.current && folderPath === defaultFolderPath && tracks.length > 0;
    cancelOnlineSearch();
    if (!shouldHydrateFromSnapshot) {
      setIsLoadingScan(true);
    }
    void (async () => {
      try {
        const result = await adapter.scanFolder(defaultFolderPath);
        if (canceled || !result.folderPath) {
          return;
        }
        if (shouldHydrateFromSnapshot) {
          const scannedById = new Map(result.tracks.map((track) => [track.id, track] as const));
          setTracks((prev) => prev.map((track) => {
            const scanned = scannedById.get(track.id);
            if (!scanned) {
              return track;
            }
            return {
              ...track,
              hasCover: scanned.hasCover,
              coverUrl: scanned.coverUrl,
            };
          }));
          setFolderPath(result.folderPath);
        } else {
          setFolderPath(result.folderPath);
          setTracks(result.tracks);
          const preferredTrackId = result.tracks.some((track) => track.id === selectedTrackId)
            ? selectedTrackId
            : result.tracks[0]?.id ?? "";
          setSelectedTrackId(preferredTrackId);
          const preferredTrack = result.tracks.find((track) => track.id === preferredTrackId) ?? result.tracks[0] ?? null;
          setPlaybackPlaylistId("");
          setPlaybackTrackId("");
          clearPlaybackQueueState();
          setShouldAutoplay(false);
          if (preferredTrack) {
            setSearchTitle(preferredTrack.title);
            setSearchArtist(preferredTrack.artist);
            setSearchAlbum(preferredTrack.album);
          }
          setOnlineResults([]);
          setSelectedResultId("");
        }
        setSearchStatus("Ready");
      } catch (error) {
        if (!canceled) {
          setSearchStatus(`Auto-open scan error: ${formatError(error)}`);
        }
      } finally {
        if (!canceled) {
          setIsLoadingScan(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [autoOpenDefaultFolder, defaultFolderPath, folderPath, selectedTrackId, tracks.length]);

  useEffect(() => {
    if (
      didAutoConnectNavidromeRef.current ||
      !shouldRunNavidromeStartupConnectionRef.current ||
      !navidromeBookmarks.length
    ) {
      return;
    }
    const startupBookmark = navidromeBookmarks.find((bookmark) => bookmark.connectOnOpen);
    if (!startupBookmark) {
      didAutoConnectNavidromeRef.current = true;
      shouldRunNavidromeStartupConnectionRef.current = false;
      return;
    }
    didAutoConnectNavidromeRef.current = true;
    shouldRunNavidromeStartupConnectionRef.current = false;
    setIsNavidromePanelOpen(true);
    handleConnectNavidromeBookmark(startupBookmark);
  }, [navidromeBookmarks]);

  useEffect(() => {
    if (!playbackPlaylistId) {
      return;
    }
    const stillExists = playlists.some((playlist) => playlist.id === playbackPlaylistId);
    if (!stillExists) {
      setPlaybackPlaylistId("");
      clearPlaybackQueueState();
    }
  }, [playbackPlaylistId, playlists]);

  useEffect(() => {
    syncGenreEqMap(libraryGenres);
  }, [equalizerPresets, libraryGenres]);

  useEffect(() => {
    if (!audioAutoEq) {
      return;
    }
    const currentTrack = playbackTrack ?? selectedTrack;
    if (!currentTrack) {
      return;
    }
    const currentGenre = String(currentTrack.genre || "");
    const genreKey = normalizeGenreKey(currentGenre);
    const mapKey = genreKey || NO_GENRE_EQ_KEY;
    const presetId = genreEqPresetMap[mapKey] || inferGenrePresetId(currentGenre);
    if (!presetId) {
      return;
    }
    const preset = equalizerPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    const hasSameBandGains =
      equalizerBandGains.length === preset.bandGains.length &&
      equalizerBandGains.every((value, index) => value === preset.bandGains[index]);
    if (
      equalizerPresetId === preset.id &&
      equalizerPresetName === preset.name &&
      hasSameBandGains &&
      equalizerPreampDb === preset.preampDb &&
      equalizerWetMixPercent === preset.wetMixPercent
    ) {
      return;
    }
    applyEqualizerPreset(preset.id, preset.name, preset.bandGains, preset.preampDb, preset.wetMixPercent);
  }, [
    audioAutoEq,
    playbackTrack,
    selectedTrack,
    genreEqPresetMap,
    equalizerPresets,
    equalizerPresetId,
    equalizerPresetName,
    equalizerBandGains,
    equalizerPreampDb,
    equalizerWetMixPercent,
  ]);

  useEffect(() => {
    if (!folderPath || !tracks.length || folderPath.startsWith("Navidrome/")) {
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
    const onPointerMove = (event: globalThis.PointerEvent) => {
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

    const onPointerUp = (event: globalThis.PointerEvent) => {
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
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = async () => {
      const queueTracks = playbackQueueTracksRef.current;
      const currentTrackId = playbackTrackIdRef.current;
      const currentTrackIndex = playbackTrackIndexRef.current;
      if (isRepeatTrackEnabledRef.current && currentTrackId) {
        audio.currentTime = 0;
        try {
          await ensureAudioGraphReady();
          await audio.play();
          setIsPlaying(true);
          setAudioError("");
          return;
        } catch {
          setIsPlaying(false);
          setAudioError("Unable to start playback in this environment.");
          return;
        }
      }
      if (currentTrackIndex >= 0 && currentTrackIndex < queueTracks.length - 1) {
        const nextTrack = queueTracks[currentTrackIndex + 1];
        if (nextTrack) {
          setPlaybackTrackId(nextTrack.id);
          setShouldAutoplay(true);
          selectTrackRef.current(nextTrack);
          return;
        }
      }
      setIsPlaying(false);
    };
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
    const graph = getOrCreateMediaAudioGraph(audio);
    const targetGain = isMuted ? 0 : volume;
    if (graph) {
      const now = graph.context.currentTime;
      graph.outputGain.gain.cancelScheduledValues(now);
      graph.outputGain.gain.setTargetAtTime(targetGain, now, 0.015);
      audio.volume = 1;
      audio.muted = false;
      return;
    }
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted, audioSrc]);

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

    if (!playbackTrack?.path) {
      setAudioSrc("");
      setAudioTrackId("");
      setAudioError("");
      setShouldAutoplay(false);
      return;
    }

    (async () => {
      try {
        const src = await adapter.getAudioSource(playbackTrack);
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
        await ensureAudioGraphReady();
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
    if (!editableTrack?.path || editableTrack.source?.type === "navidrome") {
      setTrackTechnicalInfo(null);
      return;
    }
    const path = editableTrack.path;

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

  useEffect(() => {
    const track = lyricsTrack;
    if (!track) {
      setLyricsLines([]);
      setLyricsIsSynced(false);
      setLyricsStatus("Select a track to load lyrics.");
      return;
    }
    const title = track.title.trim();
    const artist = track.artist.trim();
    if (!title || !artist) {
      setLyricsLines([]);
      setLyricsIsSynced(false);
      setLyricsStatus("Missing title or artist metadata.");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLyricsIsSynced(false);
    setLyricsStatus("Loading lyrics...");
    (async () => {
      try {
        const result = await fetchLyrics(title, artist, track.album, controller.signal);
        if (cancelled) {
          return;
        }
        setLyricsLines(result.lines);
        setLyricsIsSynced(result.isSynced);
        setLyricsStatus(result.lines.length ? "" : "No lyrics found.");
      } catch {
        if (cancelled) {
          return;
        }
        setLyricsLines([]);
        setLyricsIsSynced(false);
        setLyricsStatus("Lyrics unavailable for this track.");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lyricsTrack?.id]);

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const playbackQueueTracks = useMemo(
    () =>
      playbackQueueTrackIds
        .map((trackId) => trackById.get(trackId) ?? null)
        .filter((track): track is Track => Boolean(track)),
    [playbackQueueTrackIds, trackById]
  );
  const playbackTrackIndex = useMemo(
    () => playbackQueueTracks.findIndex((t) => t.id === playbackTrackId),
    [playbackQueueTracks, playbackTrackId]
  );
  const playerQueueStartIndex = playbackTrackIndex >= 0 ? playbackTrackIndex : 0;
  const playerQueueUpcomingTracks = useMemo(
    () => playbackQueueTracks.slice(playerQueueStartIndex, playerQueueStartIndex + playerQueueVisibleCount),
    [playbackQueueTracks, playerQueueStartIndex, playerQueueVisibleCount]
  );
  const hasMorePlayerQueueTracks = playerQueueStartIndex + playerQueueVisibleCount < playbackQueueTracks.length;
  const playerQueueHistoryTracks = useMemo(
    () =>
      playbackHistoryTrackIds
        .map((trackId) => trackById.get(trackId) ?? null)
        .filter((track): track is Track => Boolean(track)),
    [playbackHistoryTrackIds, trackById]
  );

  useEffect(() => {
    selectTrackRef.current = selectTrack;
  });

  useEffect(() => {
    playbackQueueTracksRef.current = playbackQueueTracks;
    playbackTrackIdRef.current = playbackTrackId;
    playbackTrackIndexRef.current = playbackTrackIndex;
    isRepeatTrackEnabledRef.current = isRepeatTrackEnabled;
  }, [playbackQueueTracks, playbackTrackId, playbackTrackIndex, isRepeatTrackEnabled]);

  useEffect(() => {
    setPlaybackQueueTrackIds((prev) => {
      const next = prev.filter((trackId) => trackById.has(trackId));
      if (next.length === prev.length && next.every((trackId, index) => trackId === prev[index])) {
        return prev;
      }
      return next;
    });
    setPlaybackHistoryTrackIds((prev) => {
      const next = prev.filter((trackId) => trackById.has(trackId));
      if (next.length === prev.length && next.every((trackId, index) => trackId === prev[index])) {
        return prev;
      }
      return next.slice(-PLAYER_QUEUE_HISTORY_SIZE);
    });
  }, [trackById]);

  useEffect(() => {
    if (!playbackTrackId) {
      previousPlaybackTrackIdRef.current = "";
      return;
    }
    const previousTrackId = previousPlaybackTrackIdRef.current;
    if (previousTrackId && previousTrackId !== playbackTrackId) {
      setPlaybackHistoryTrackIds((prev) => {
        const withoutPreviousTrack = prev.filter((trackId) => trackId !== previousTrackId);
        return [...withoutPreviousTrack, previousTrackId].slice(-PLAYER_QUEUE_HISTORY_SIZE);
      });
    }
    previousPlaybackTrackIdRef.current = playbackTrackId;
  }, [playbackTrackId]);

  useEffect(() => {
    const previousShuffleEnabled = previousShuffleEnabledRef.current;
    if (previousShuffleEnabled === isShuffleEnabled) {
      return;
    }
    previousShuffleEnabledRef.current = isShuffleEnabled;
    if (!isShuffleEnabled) {
      return;
    }
    if (!playbackQueueTrackIds.length) {
      return;
    }

    if (playbackPlaylistId) {
      const playlist = playlists.find((item) => item.id === playbackPlaylistId);
      if (playlist) {
        const playlistTrackIds = playlist.entries
          .map((entry) => entry.trackId)
          .filter((trackId) => trackById.has(trackId));
        const startTrackId = playbackTrackId && playlistTrackIds.includes(playbackTrackId)
          ? playbackTrackId
          : playlistTrackIds[0];
        const nextQueueTrackIds = buildPlaylistQueueOrder(playlistTrackIds, true, startTrackId);
        if (nextQueueTrackIds.length) {
          setPlaybackQueueTrackIds(nextQueueTrackIds);
          setPlaybackHistoryTrackIds([]);
          setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
          previousPlaybackTrackIdRef.current = playbackTrackId || "";
        }
        return;
      }
    }

    const startTrackId = playbackTrackId && playbackQueueTrackIds.includes(playbackTrackId)
      ? playbackTrackId
      : playbackQueueTrackIds[0];
    if (!startTrackId) {
      return;
    }
    const remainingTrackIds = playbackQueueTrackIds.filter((trackId) => trackId !== startTrackId);
    const nextQueueTrackIds = [startTrackId, ...shuffleTrackIds(remainingTrackIds)];
    setPlaybackQueueTrackIds(nextQueueTrackIds);
    setPlaybackHistoryTrackIds([]);
    setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
    previousPlaybackTrackIdRef.current = playbackTrackId || startTrackId;
  }, [isShuffleEnabled, playbackPlaylistId, playbackTrackId, playbackQueueTrackIds, playlists, trackById]);

  useEffect(() => {
    if (!playbackPlaylistId) {
      return;
    }
    const playlist = playlists.find((item) => item.id === playbackPlaylistId);
    if (!playlist) {
      return;
    }
    const playlistTrackIds = playlist.entries
      .map((entry) => entry.trackId)
      .filter((trackId) => trackById.has(trackId));
    if (!playlistTrackIds.length) {
      setPlaybackQueueTrackIds([]);
      setPlaybackHistoryTrackIds([]);
      setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
      return;
    }

    const playlistTrackIdSet = new Set(playlistTrackIds);
    const currentTrackId = playbackTrackId && playlistTrackIdSet.has(playbackTrackId) ? playbackTrackId : "";

    let nextQueueTrackIds: string[] = [];
    if (isShuffleEnabled) {
      const startTrackId = currentTrackId || playbackQueueTrackIds.find((trackId) => playlistTrackIdSet.has(trackId)) || playlistTrackIds[0];
      if (!startTrackId) {
        return;
      }
      const preservedTrackIds = playbackQueueTrackIds.filter(
        (trackId) => trackId !== startTrackId && playlistTrackIdSet.has(trackId)
      );
      const newTrackIds = playlistTrackIds.filter(
        (trackId) => trackId !== startTrackId && !preservedTrackIds.includes(trackId)
      );
      nextQueueTrackIds = [startTrackId, ...preservedTrackIds, ...shuffleTrackIds(newTrackIds)];
    } else {
      const startTrackId = currentTrackId || playlistTrackIds[0];
      const startIndex = playlistTrackIds.indexOf(startTrackId);
      nextQueueTrackIds = playlistTrackIds.slice(Math.max(0, startIndex));
    }

    if (!areTrackIdListsEqual(nextQueueTrackIds, playbackQueueTrackIds)) {
      setPlaybackQueueTrackIds(nextQueueTrackIds);
    }

    if (!currentTrackId) {
      const fallbackTrackId = nextQueueTrackIds[0];
      if (!fallbackTrackId || fallbackTrackId === playbackTrackId) {
        return;
      }
      const fallbackTrack = trackById.get(fallbackTrackId);
      if (fallbackTrack) {
        selectTrack(fallbackTrack);
      }
      setPlaybackTrackId(fallbackTrackId);
      setShouldAutoplay(true);
    }
  }, [playbackPlaylistId, playlists, trackById, playbackTrackId, playbackQueueTrackIds, isShuffleEnabled]);

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

  function clearPlaybackQueueState() {
    previousPlaybackTrackIdRef.current = "";
    setPlaybackQueueTrackIds([]);
    setPlaybackHistoryTrackIds([]);
    setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
  }

  function startPlaybackSession(queueTrackIds: string[], startTrackId: string, playlistId = ""): boolean {
    const startTrack = trackById.get(startTrackId);
    if (!startTrack || !queueTrackIds.length) {
      return false;
    }
    previousPlaybackTrackIdRef.current = "";
    setPlaybackQueueTrackIds(queueTrackIds);
    setPlaybackHistoryTrackIds([]);
    setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
    setPlaybackPlaylistId(playlistId);
    if (startTrack.id !== selectedTrackId) {
      selectTrack(startTrack);
    }
    setPlaybackTrackId(startTrack.id);
    setShouldAutoplay(true);
    return true;
  }

  function startPlaybackFromPlaylist(playlistId: string, startTrackId?: string): boolean {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return false;
    }
    const playlistTrackIds = playlist.entries
      .map((entry) => entry.trackId)
      .filter((trackId) => trackById.has(trackId));
    const queueTrackIds = buildPlaylistQueueOrder(playlistTrackIds, isShuffleEnabled, startTrackId);
    const firstTrackId = queueTrackIds[0];
    if (!firstTrackId) {
      return false;
    }
    return startPlaybackSession(queueTrackIds, firstTrackId, playlistId);
  }

  function startPlaybackFromLibrary(track: Track): boolean {
    const filteredTrackIds = filteredTracks.map((item) => item.id);
    const queueTrackIds = buildLibraryQueueOrder(filteredTrackIds, track.id);
    const normalizedQueueTrackIds = queueTrackIds.length ? queueTrackIds : [track.id];
    return startPlaybackSession(normalizedQueueTrackIds, track.id, "");
  }

  function getNavidromeFormInput(): NavidromeConnectionInput | null {
    const baseUrl = navidromeBaseUrl.trim();
    const username = navidromeUsername.trim();
    if (!baseUrl || !username || !navidromePassword) {
      setNavidromeStatus("Server URL, username and password are required.");
      return null;
    }
    return {
      name: navidromeName.trim() || defaultNavidromeBookmarkName(baseUrl),
      baseUrl,
      username,
      password: navidromePassword,
    };
  }

  async function connectToNavidrome(input: NavidromeConnectionInput, bookmarkId = "") {
    setIsConnectingNavidrome(true);
    setNavidromeStatus(`Connecting to ${input.name || input.baseUrl}...`);
    try {
      const result = await adapter.connectNavidrome(input);
      if (!result.ok) {
        setConnectedNavidromeBookmarkId("");
        setNavidromeStatus(result.message || "Navidrome connection rejected.");
        return;
      }

      const library = await adapter.scanNavidromeLibrary(input);
      const connectedAt = new Date().toLocaleString(userLocale, {
        dateStyle: "short",
        timeStyle: "short",
      });
      setConnectedNavidromeBookmarkId(bookmarkId);
      if (bookmarkId) {
        setNavidromeBookmarks((prev) => prev.map((bookmark) => (
          bookmark.id === bookmarkId
            ? { ...bookmark, lastConnectedAt: connectedAt }
            : bookmark
        )));
      }
      setFolderPath(library.folderPath);
      setTracks(library.tracks);
      const firstTrack = library.tracks[0];
      setSelectedTrackId(firstTrack?.id ?? "");
      setPlaybackPlaylistId("");
      setPlaybackTrackId("");
      clearPlaybackQueueState();
      setShouldAutoplay(false);
      if (firstTrack) {
        setSearchTitle(firstTrack.title);
        setSearchArtist(firstTrack.artist);
        setSearchAlbum(firstTrack.album);
      }
      setOnlineResults([]);
      setSelectedResultId("");
      setIsNavidromePanelOpen(false);
      setNavidromeStatus(
        `Connected to ${input.name || input.baseUrl} · loaded ${library.tracks.length} tracks${result.serverVersion ? ` · server ${result.serverVersion}` : ""}${result.apiVersion ? ` · API ${result.apiVersion}` : ""}`
      );
      setSearchStatus(`Navidrome library loaded: ${library.tracks.length} tracks.`);
    } catch (error) {
      setConnectedNavidromeBookmarkId("");
      setNavidromeStatus(`Navidrome connection error: ${formatError(error)}`);
    } finally {
      setIsConnectingNavidrome(false);
    }
  }

  function handleSaveNavidromeBookmark() {
    const input = getNavidromeFormInput();
    if (!input) {
      return;
    }
    setNavidromeBookmarks((prev) => {
      const existing = prev.find((bookmark) => (
        bookmark.baseUrl === input.baseUrl && bookmark.username === input.username
      ));
      const nextBookmark: NavidromeBookmark = {
        ...(existing ?? { id: buildNavidromeBookmarkId() }),
        ...input,
        connectOnOpen: navidromeConnectOnOpen,
      };
      const next = existing
        ? prev.map((bookmark) => (bookmark.id === existing.id ? nextBookmark : bookmark))
        : [...prev, nextBookmark];
      if (!navidromeConnectOnOpen) {
        return next;
      }
      return next.map((bookmark) => ({
        ...bookmark,
        connectOnOpen: bookmark.id === nextBookmark.id,
      }));
    });
    setNavidromeStatus(`Saved bookmark ${input.name}.`);
  }

  function handleConnectNavidrome() {
    const input = getNavidromeFormInput();
    if (!input) {
      return;
    }
    const matchingBookmark = navidromeBookmarks.find((bookmark) => (
      bookmark.baseUrl === input.baseUrl && bookmark.username === input.username
    ));
    void connectToNavidrome(input, matchingBookmark?.id ?? "");
  }

  function handleConnectNavidromeBookmark(bookmark: NavidromeBookmark) {
    setNavidromeName(bookmark.name);
    setNavidromeBaseUrl(bookmark.baseUrl);
    setNavidromeUsername(bookmark.username);
    setNavidromePassword(bookmark.password);
    setNavidromeConnectOnOpen(bookmark.connectOnOpen);
    void connectToNavidrome(bookmark, bookmark.id);
  }

  function handleDeleteNavidromeBookmark(bookmarkId: string) {
    setNavidromeBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== bookmarkId));
    if (connectedNavidromeBookmarkId === bookmarkId) {
      setConnectedNavidromeBookmarkId("");
      setNavidromeStatus("Navidrome bookmark removed.");
    }
  }

  function handleToggleNavidromeBookmarkConnectOnOpen(bookmarkId: string, enabled: boolean) {
    setNavidromeBookmarks((prev) => prev.map((bookmark) => ({
      ...bookmark,
      connectOnOpen: enabled ? bookmark.id === bookmarkId : bookmark.id === bookmarkId ? false : bookmark.connectOnOpen,
    })));
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
      setPlaybackPlaylistId("");
      setPlaybackTrackId("");
      clearPlaybackQueueState();
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
    if (folderPath.startsWith("Navidrome/")) {
      setSearchStatus("Navidrome libraries are remote, no local folder to open.");
      return;
    }
    try {
      await adapter.openTrackInFileManager(folderPath);
    } catch (error) {
      setSearchStatus(`Open folder error: ${formatError(error)}`);
    }
  }

  async function handleChooseDefaultFolder() {
    try {
      const picked = await adapter.pickFolder();
      if (!picked) {
        return;
      }
      setDefaultFolderPath(picked);
    } catch (error) {
      setSearchStatus(`Pick folder error: ${formatError(error)}`);
    }
  }

  async function ensureAudioGraphReady() {
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
    if (graph.context.state === "suspended") {
      await graph.context.resume();
    }
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
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }

    const targetTrack = playbackTrack ?? selectedTrack;
    if (targetTrack && targetTrack.id !== playbackTrackId) {
      if (selectedTrack && targetTrack.id === selectedTrack.id) {
        startPlaybackFromLibrary(targetTrack);
        return;
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
      await ensureAudioGraphReady();
      await audio.play();
      setIsPlaying(true);
      setAudioError("");
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
    }
  }

  async function handlePlayFromLibraryCover(event: MouseEvent<HTMLElement>, track: Track) {
    event.stopPropagation();
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }
    if (!startPlaybackFromLibrary(track)) {
      return;
    }

    const audio = audioRef.current;
    if (!audio || !audioSrc || audioTrackId !== track.id) {
      setShouldAutoplay(true);
      return;
    }

    try {
      await ensureAudioGraphReady();
      await audio.play();
      setIsPlaying(true);
      setAudioError("");
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
    }
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
    const graph = getOrCreateMediaAudioGraph(audio);
    if (graph) {
      const now = graph.context.currentTime;
      graph.outputGain.gain.cancelScheduledValues(now);
      graph.outputGain.gain.setTargetAtTime(clamped, now, 0.015);
      audio.volume = 1;
      audio.muted = false;
      return;
    }
    audio.volume = clamped;
    if (clamped > 0 && audio.muted) {
      audio.muted = false;
    }
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

  function handleLibraryArtistClick(artist: LibraryArtistSummary) {
    setIsNavidromePanelOpen(false);
    setQuery(artist.name === "Unknown artist" ? "" : artist.name);
    const firstTrack = tracks.find((track) => (track.artist.trim() || "Unknown artist") === artist.name);
    if (firstTrack) {
      selectTrack(firstTrack);
    }
  }

  function handleLibraryAlbumClick(album: LibraryAlbumSummary) {
    setIsNavidromePanelOpen(false);
    setQuery(album.title === "Unknown album" ? "" : album.title);
    const firstTrack = tracks.find((track) => (
      (track.album.trim() || "Unknown album") === album.title &&
      (track.artist.trim() || "Unknown artist") === album.artist
    ));
    if (firstTrack) {
      selectTrack(firstTrack);
    }
  }

  async function handlePrevTrack() {
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }
    const prev = playbackTrackIndex > 0 ? playbackQueueTracks[playbackTrackIndex - 1] ?? null : null;
    if (prev) {
      setPlaybackTrackId(prev.id);
      setShouldAutoplay(true);
      selectTrack(prev);
    }
  }

  async function handleNextTrack() {
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }
    const next =
      playbackTrackIndex >= 0 && playbackTrackIndex < playbackQueueTracks.length - 1
        ? playbackQueueTracks[playbackTrackIndex + 1] ?? null
        : null;
    if (next) {
      setPlaybackTrackId(next.id);
      setShouldAutoplay(true);
      selectTrack(next);
    }
  }

  async function handlePlayTrackFromPlaylist(track: Track, playlistId?: string) {
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }
    if (!playlistId) {
      await handlePlayTrackFromPlayerQueue(track);
      return;
    }
    startPlaybackFromPlaylist(playlistId, track.id);
  }

  async function handlePlayTrackFromPlayerQueue(track: Track) {
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }
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
    try {
      await ensureAudioGraphReady();
      await audio.play();
      setIsPlaying(true);
      setAudioError("");
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
    }
  }

  async function handlePlayActivePlaylist() {
    if (!activePlaylist) {
      return;
    }
    try {
      await ensureAudioGraphReady();
    } catch {
      setAudioError("Unable to start playback in this environment.");
      setIsPlaying(false);
      return;
    }
    startPlaybackFromPlaylist(activePlaylist.id);
  }

  function handleLoadMorePlayerQueueTracks() {
    setPlayerQueueVisibleCount((prev) => prev + PLAYER_QUEUE_PAGE_SIZE);
  }

  function handleClearPlayerQueue() {
    setPlaybackPlaylistId("");
    if (!playbackTrackId) {
      setPlaybackQueueTrackIds([]);
      setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
      return;
    }
    setPlaybackQueueTrackIds((prev) => (prev.includes(playbackTrackId) ? [playbackTrackId] : []));
    setPlayerQueueVisibleCount(PLAYER_QUEUE_PAGE_SIZE);
  }

  function handleRemoveTrackFromPlayerQueue(trackId: string) {
    setPlaybackPlaylistId("");
    setPlaybackHistoryTrackIds((prev) => prev.filter((id) => id !== trackId));
    const currentIndex = playbackQueueTrackIds.indexOf(trackId);
    if (currentIndex < 0) {
      return;
    }
    const nextQueueTrackIds = playbackQueueTrackIds.filter((id) => id !== trackId);
    setPlaybackQueueTrackIds(nextQueueTrackIds);
    if (trackId !== playbackTrackId) {
      return;
    }
    const fallbackTrackId = nextQueueTrackIds[currentIndex] ?? nextQueueTrackIds[currentIndex - 1] ?? "";
    if (!fallbackTrackId) {
      setPlaybackTrackId("");
      setShouldAutoplay(false);
      return;
    }
    setPlaybackTrackId(fallbackTrackId);
    const fallbackTrack = trackById.get(fallbackTrackId);
    if (fallbackTrack) {
      selectTrack(fallbackTrack);
    }
    setShouldAutoplay(isPlaying);
  }

  function handleEqualizerPresetNameInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameEqualizerPresetButtonClick();
    }
  }

  function handlePlaylistRenameInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    confirmPlaylistRename();
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

  function appendTrackToActivePlaylist(trackId: string) {
    insertTrackIntoActivePlaylist(trackId, null);
  }

  function appendTracksToActivePlaylist(trackIds: string[]) {
    appendTracks(trackIds.filter((trackId) => trackId && trackById.has(trackId)));
  }

  function handleAddFilteredTracksToActivePlaylist() {
    appendTracksToActivePlaylist(filteredTracks.map((track) => track.id));
  }

  function enqueueTrack(trackId: string) {
    const track = trackById.get(trackId);
    if (!track) {
      return;
    }
    setPlaybackPlaylistId("");
    setPlaybackQueueTrackIds((prev) => {
      if (prev.includes(trackId)) {
        return prev;
      }
      return [...prev, trackId];
    });
    setPlayerQueueVisibleCount((prev) => Math.max(prev, PLAYER_QUEUE_PAGE_SIZE));
    if (!playbackTrackId) {
      setPlaybackTrackId(trackId);
      selectTrack(track);
    }
  }

  function handleEnqueueFilteredTracks() {
    const filteredTrackIds = filteredTracks.map((track) => track.id).filter((trackId) => trackById.has(trackId));
    if (!filteredTrackIds.length) {
      return;
    }
    setPlaybackPlaylistId("");
    setPlaybackQueueTrackIds((prev) => {
      const existing = new Set(prev);
      const nextTrackIds = filteredTrackIds.filter((trackId) => !existing.has(trackId));
      if (!nextTrackIds.length) {
        return prev;
      }
      return [...prev, ...nextTrackIds];
    });
    setPlayerQueueVisibleCount((prev) => Math.max(prev, PLAYER_QUEUE_PAGE_SIZE));
    if (!playbackTrackId) {
      const firstTrack = trackById.get(filteredTrackIds[0]);
      if (firstTrack) {
        setPlaybackTrackId(firstTrack.id);
        selectTrack(firstTrack);
      }
    }
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

  const hasAudioLoaded = Boolean(audioSrc && audioTrackId === playbackTrackId);
  const libraryNavidromeProps = {
    isNavidromePanelOpen,
    onToggleNavidromePanel: () => setIsNavidromePanelOpen((prev) => !prev),
    navidromeName,
    onNavidromeNameChange: setNavidromeName,
    navidromeBaseUrl,
    onNavidromeBaseUrlChange: setNavidromeBaseUrl,
    navidromeUsername,
    onNavidromeUsernameChange: setNavidromeUsername,
    navidromePassword,
    onNavidromePasswordChange: setNavidromePassword,
    navidromeConnectOnOpen,
    onNavidromeConnectOnOpenChange: setNavidromeConnectOnOpen,
    navidromeBookmarks,
    connectedNavidromeBookmarkId,
    navidromeStatus,
    isConnectingNavidrome,
    onConnectNavidrome: handleConnectNavidrome,
    onSaveNavidromeBookmark: handleSaveNavidromeBookmark,
    onConnectNavidromeBookmark: handleConnectNavidromeBookmark,
    onDeleteNavidromeBookmark: handleDeleteNavidromeBookmark,
    onToggleNavidromeBookmarkConnectOnOpen: handleToggleNavidromeBookmarkConnectOnOpen,
    IconGlobe,
    IconSave,
    IconTrash,
  };

  return (
    <div className={colorMode === "dark" ? "app-shell theme-dark" : "app-shell"} style={appStyle}>
      <TopBarSection
        activeScreen={activeScreen}
        appIconSrc={appIcon}
        audioRef={audioRef}
        audioSrc={audioSrc}
        playerInfoTrack={playerInfoTrack}
        playerTechnicalBadge={trackTechnicalBadge}
        playerTechnicalSummary={trackTechnicalSummary}
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
        isShuffleEnabled={isShuffleEnabled}
        isRepeatTrackEnabled={isRepeatTrackEnabled}
        canSeek={Boolean(audioSrc && audioTrackId === playbackTrackId && duration > 0)}
        onScreenChange={setActiveScreen}
        onRotateAccent={rotateAccent}
        onToggleShuffle={() => setIsShuffleEnabled((prev) => !prev)}
        onPrev={handlePrevTrack}
        onPlayPause={() => {
          void handleTogglePlayPause();
        }}
        onNext={handleNextTrack}
        onToggleRepeatTrack={() => setIsRepeatTrackEnabled((prev) => !prev)}
        onSeek={handleSeek}
        onToggleMute={() => setIsMuted((prev) => !prev)}
        onVolumeChange={handleVolumeChange}
        equalizerPresets={equalizerPresets}
        equalizerPresetId={equalizerPresetId}
        onEqualizerPresetChange={handleEqualizerPresetChange}
        autoEqEnabled={audioAutoEq}
        onToggleAutoEq={() => setAudioAutoEq(!audioAutoEq)}
        showLibraryColumn={playerColumnVisibility.library}
        showVisualizerColumn={playerColumnVisibility.visualizer}
        showQueueColumn={playerColumnVisibility.queue}
        showLyricsSection={showPlayerLyricsSection}
        onToggleLibraryColumn={() => togglePlayerColumn("library")}
        onToggleVisualizerColumn={() => togglePlayerColumn("visualizer")}
        onToggleQueueColumn={() => togglePlayerColumn("queue")}
        onToggleLyricsSection={handleTogglePlayerLyricsSection}
        visualizerPresetId={playerVisualizerPresetId}
        onVisualizerPresetChange={setPlayerVisualizerPresetId}
        activePlaylistId={activePlaylistId}
        isPlaylistRenaming={isPlaylistRenaming}
        playlistNameDraft={playlistNameDraft}
        playlists={playlists}
        hasActivePlaylist={Boolean(activePlaylist)}
        canPlayActivePlaylist={Boolean(activePlaylist?.entries.length)}
        onActivePlaylistChange={handleActivePlaylistChange}
        onPlaylistDraftChange={handlePlaylistDraftChange}
        onCreatePlaylist={handleCreatePlaylist}
        onRenamePlaylist={handleRenamePlaylistButtonClick}
        onPlaylistRenameInputKeyDown={handlePlaylistRenameInputKeyDown}
        onDeletePlaylist={handleDeletePlaylist}
        onPlayActivePlaylist={handlePlayActivePlaylist}
        onOpenExternalLink={(url) => {
          void handleOpenExternalLink({ preventDefault: () => {} }, url);
        }}
        IconShuffle={IconShuffle}
        IconPrev={IconPrev}
        IconPause={IconPause}
        IconPlay={IconPlay}
        IconNext={IconNext}
        IconRepeatTrack={IconRepeatOne}
        IconMute={IconMute}
        IconVolume={IconVolume}
        IconAutoEq={IconAutoEq}
        IconLibrary={IconFolder}
        IconVisualizer={IconVisualizerBars}
        IconQueue={IconListCompact}
        IconLyrics={IconMic}
        IconPlus={IconPlus}
        IconRename={IconRename}
        IconTrash={IconTrash}
        IconGlobe={IconGlobe}
        IconUser={IconUser}
        IconHeart={IconHeart}
        IconDashboard={IconPlaylist}
        IconTagging={IconTag}
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
              {...libraryNavidromeProps}
              query={query}
              onQueryChange={setQuery}
              libraryViewMode={libraryViewMode}
              onLibraryViewModeChange={setLibraryViewMode}
              isFileSystemView={isFileSystemView}
              onFileSystemViewChange={setIsFileSystemView}
              fileSystemEntries={fileSystemEntries}
              fileSystemCurrentPath={fileSystemCurrentPath}
              canGoUpFileSystemFolder={canGoUpFileSystemFolder}
              onOpenFileSystemFolder={openFileSystemFolder}
              onGoUpFileSystemFolder={goUpFileSystemFolder}
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
              IconArrowUp={IconArrowUp}
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
          libraryProps={{
            folderPath,
            onOpenFolderPathClick: () => {
              void handleOpenLibraryFolder();
            },
            isLoadingScan,
            onScan: handleScan,
            ...libraryNavidromeProps,
            query,
            onQueryChange: setQuery,
            libraryViewMode,
            onLibraryViewModeChange: setLibraryViewMode,
            isFileSystemView,
            onFileSystemViewChange: setIsFileSystemView,
            fileSystemEntries,
            fileSystemCurrentPath,
            canGoUpFileSystemFolder,
            onOpenFileSystemFolder: openFileSystemFolder,
            onGoUpFileSystemFolder: goUpFileSystemFolder,
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
            onBulkTrackAction: handleAddFilteredTracksToActivePlaylist,
            bulkTrackActionTitle: "Add all visible tracks to playlist",
            bulkTrackActionAriaLabel: "Add all visible tracks to playlist",
            onPlayFromLibraryCover: handlePlayFromLibraryCover,
            enableTrackDrag: true,
            useNativeTrackDrag: false,
            onTrackPointerDown: handleLibraryTrackPointerDown,
            draggingTrackId:
              isDashboardDragging && pointerDragStateRef.current.kind === "library-track"
                ? pointerDragStateRef.current.id
                : "",
            IconFolder,
            IconArrowUp,
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
            IconBulkTrackAction: IconMusicArrowRight,
          }}
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
          onPlaylistEntryPointerDown={handlePlaylistEntryPointerDown}
          onPlaylistEntryClick={(track) => {
            if (suppressNextPlaylistItemClickRef.current) {
              suppressNextPlaylistItemClickRef.current = false;
              return;
            }
            handlePlayTrackFromPlaylist(track, activePlaylist?.id);
          }}
          onRemovePlaylistEntry={removePlaylistEntry}
          IconTrash={IconTrash}
          IconPlay={IconPlay}
        />
      )}

      {activeScreen === "library" && (
        <LibraryBrowserSection
          libraryProps={{
            folderPath,
            onOpenFolderPathClick: () => {
              void handleOpenLibraryFolder();
            },
            isLoadingScan,
            onScan: handleScan,
            ...libraryNavidromeProps,
            query,
            onQueryChange: setQuery,
            libraryViewMode,
            onLibraryViewModeChange: setLibraryViewMode,
            isFileSystemView,
            onFileSystemViewChange: setIsFileSystemView,
            fileSystemEntries,
            fileSystemCurrentPath,
            canGoUpFileSystemFolder,
            onOpenFileSystemFolder: openFileSystemFolder,
            onGoUpFileSystemFolder: goUpFileSystemFolder,
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
            onPlayFromLibraryCover: handlePlayFromLibraryCover,
            IconFolder,
            IconArrowUp,
            IconMusicNote,
            IconSortTitle,
            IconSortArtist,
            IconSortAdded,
            IconSortRelease,
            IconGrid,
            IconListCompact,
            IconPlay,
            IconSearch,
          }}
          artists={libraryArtists}
          albums={libraryAlbums}
          tracks={tracks}
          onArtistClick={handleLibraryArtistClick}
          onAlbumClick={handleLibraryAlbumClick}
          IconArtist={IconSortArtist}
          IconAlbum={IconCover}
          IconMusicNote={IconMusicNote}
        />
      )}

      {activeScreen === "player" && (
        <PlayerSection
          libraryProps={{
            folderPath,
            onOpenFolderPathClick: () => {
              void handleOpenLibraryFolder();
            },
            isLoadingScan,
            onScan: handleScan,
            ...libraryNavidromeProps,
            query,
            onQueryChange: setQuery,
            libraryViewMode,
            onLibraryViewModeChange: setLibraryViewMode,
            isFileSystemView,
            onFileSystemViewChange: setIsFileSystemView,
            fileSystemEntries,
            fileSystemCurrentPath,
            canGoUpFileSystemFolder,
            onOpenFileSystemFolder: openFileSystemFolder,
            onGoUpFileSystemFolder: goUpFileSystemFolder,
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
            onTrackAction: (track) => enqueueTrack(track.id),
            trackActionTitle: "Add track to queue",
            trackActionAriaLabel: "Add track to queue",
            onBulkTrackAction: handleEnqueueFilteredTracks,
            bulkTrackActionTitle: "Add all visible tracks to queue",
            bulkTrackActionAriaLabel: "Add all visible tracks to queue",
            onPlayFromLibraryCover: handlePlayFromLibraryCover,
            IconFolder,
            IconArrowUp,
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
            IconBulkTrackAction: IconMusicArrowRight,
          }}
          audioRef={audioRef}
          isActive={activeScreen === "player"}
          hasAudio={hasAudioLoaded}
          isPlaying={isPlaying}
          coverUrl={playerInfoTrack?.coverUrl}
          currentTime={currentTime}
          duration={duration}
          accentColor={accentTheme.accent}
          isDarkMode={colorMode === "dark"}
          showLibraryColumn={playerColumnVisibility.library}
          showVisualizerColumn={playerColumnVisibility.visualizer}
          showQueueColumn={playerColumnVisibility.queue}
          showLyricsSection={showPlayerLyricsSection}
          visualizerPresetId={playerVisualizerPresetId}
          queueHistoryTracks={playerQueueHistoryTracks}
          queueTracks={playerQueueUpcomingTracks}
          hasMoreQueueTracks={hasMorePlayerQueueTracks}
          playbackTrackId={playbackTrackId}
          onQueueTrackClick={handlePlayTrackFromPlayerQueue}
          onLoadMoreQueueTracks={handleLoadMorePlayerQueueTracks}
          onQueueRemoveTrack={handleRemoveTrackFromPlayerQueue}
          onQueueClear={handleClearPlayerQueue}
          canClearQueue={playbackQueueTrackIds.length > 0}
          IconPlay={IconPlay}
          IconTrash={IconTrash}
          lyricsStatus={lyricsStatus}
          lyricsIsSynced={lyricsIsSynced}
          lyricsLines={lyricsLines}
          lyricsActiveIndex={lyricsActiveIndex}
        />
      )}

      {activeScreen === "settings" && (
        <SettingsSection
          autoOpenDefaultFolder={autoOpenDefaultFolder}
          onAutoOpenDefaultFolderChange={setAutoOpenDefaultFolder}
          startupScreen={startupScreen}
          onStartupScreenChange={setStartupScreen}
          defaultFolderPath={defaultFolderPath}
          onChooseDefaultFolder={handleChooseDefaultFolder}
          folderPath={folderPath}
          audioRef={audioRef}
          accentColor={accentTheme.accent}
          onUseCurrentLibraryFolder={() => setDefaultFolderPath(folderPath)}
          audioAutoEq={audioAutoEq}
          onAudioAutoEqChange={setAudioAutoEq}
          audioNormalizeVolume={audioNormalizeVolume}
          onAudioNormalizeVolumeChange={setAudioNormalizeVolume}
          audioSmartCrossfade={audioSmartCrossfade}
          onAudioSmartCrossfadeChange={setAudioSmartCrossfade}
          libraryGenres={libraryGenres}
          genreEqPresetMap={genreEqPresetMap}
          onGenreEqPresetChange={handleGenreEqPresetChange}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          accentThemes={accentThemes}
          activeAccentIndex={accentIndex}
          onActiveAccentIndexChange={setAccentIndex}
          onAccentColorChange={handleAccentColorChange}
          onAddAccentTheme={handleAddAccentTheme}
          onRemoveAccentTheme={handleRemoveAccentTheme}
          onResetAccentThemes={handleResetAccentThemes}
          accentRotateOnLaunch={accentRotateOnLaunch}
          onAccentRotateOnLaunchChange={setAccentRotateOnLaunch}
          equalizerPresets={equalizerPresets}
          startupEqualizerPresetId={startupEqualizerPresetId}
          onStartupEqualizerPresetIdChange={setStartupEqualizerPresetId}
          equalizerPresetId={equalizerPresetId}
          onEqualizerPresetIdChange={setEqualizerPresetIdRaw}
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
          IconPlus={IconPlus}
          IconRename={IconRename}
          IconTrash={IconTrash}
          IconSave={IconSave}
          IconFolder={IconFolder}
          IconExternalLink={IconExternalLink}
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
