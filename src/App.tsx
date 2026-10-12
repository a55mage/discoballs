import { type ChangeEvent, type CSSProperties, type KeyboardEvent, type MouseEvent, useMemo, useRef } from "react";
import {
  cancelOnlineSearch,
  searchOnlineForCurrentQuery,
} from "./actions/onlineSearch";
import {
  chooseDefaultFolder as handleChooseDefaultFolder,
  openLibraryFolder as handleOpenLibraryFolder,
  openTrackInFileManager,
  scanLibraryWithPicker as handleScan,
  searchOnlineForTrack as handleQuickSearchTrack,
  selectTrack,
} from "./actions/library";
import {
  applyAndSaveOnlineResult as handleApplyAndSaveOnlineResult,
  applyOnlineCoverOnly as handleApplyOnlineCoverOnly,
  applyOnlineResult as handleApplyOnlineResult,
  changeDraftField as handleTrackFieldChange,
  loadDraftCoverFromFile,
  removeDraftCover as handleRemoveCover,
  renameTrackFileOnly as handleRenameOnlyTrack,
  saveTrackTags as handleSaveTrack,
  saveTrackTagsAndRename as handleSaveAndRenameTrack,
} from "./actions/tagEditor";
import {
  connectNavidromeBookmark as handleConnectNavidromeBookmark,
  connectNavidromeFromForm as handleConnectNavidrome,
  deleteNavidromeBookmark as handleDeleteNavidromeBookmark,
  saveNavidromeBookmark as handleSaveNavidromeBookmark,
  setNavidromeBookmarkConnectOnOpen as handleToggleNavidromeBookmarkConnectOnOpen,
} from "./actions/navidrome";
import { orderOnlineResults } from "./domain/onlineResults";
import {
  summarizeGenres,
} from "./domain/library";
import { useDashboardDrag } from "./hooks/useDashboardDrag";
import { useLibrarySession } from "./hooks/useLibrarySession";
import { useLyrics } from "./hooks/useLyrics";
import { useTrackTechnicalInfo } from "./hooks/useTrackTechnicalInfo";
import {
  clearPlayerQueue,
  enqueueTrack,
  enqueueTracks,
  loadMoreQueueTracks,
  playFromLibraryCover,
  playPlaylist,
  playTrackFromPlaylist,
  playTrackFromQueue,
  removeTrackFromPlayerQueue,
  togglePlayPause,
} from "./actions/playback";
import { audioRef } from "./audio/audioRef";
import { usePlaybackEngine } from "./hooks/usePlaybackEngine";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconClose,
  IconCover,
  IconExternalLink,
  IconFolder,
  IconGlobe,
  IconGrid,
  IconListCompact,
  IconMusicNote,
  IconMusicArrowRight,
  IconPlay,
  IconPlus,
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
} from "./components/icons";
import { DashboardSection } from "./sections/DashboardSection";
import { LibraryInspector } from "./screens/library/LibraryInspector";
import { LibraryScreen } from "./screens/library/LibraryScreen";
import { LibrarySection } from "./sections/LibrarySection";
import { OnlineSearchSection } from "./sections/OnlineSearchSection";
import { PlayerSection } from "./sections/PlayerSection";
import { RenameSettingsModal } from "./sections/RenameSettingsModal";
import { SettingsSection } from "./sections/SettingsSection";
import { TrackDetailsSection } from "./sections/TrackDetailsSection";
import type { Track } from "./types";
import { useEqualizerStore } from "./store/equalizerStore";
import { useLibraryStore } from "./store/libraryStore";
import { useNavidromeStore } from "./store/navidromeStore";
import { usePlayerStore } from "./store/playerStore";
import { useTagEditorStore } from "./store/tagEditorStore";
import { usePlaylistStore } from "./store/playlistStore";
import { useSettingsStore } from "./store/settingsStore";
import { useUiStore } from "./store/uiStore";
import { getVisibleLibraryTracks } from "./store/selectors";
import { AppShell } from "./shell/AppShell";
import { useApplyTheme } from "./ui/useApplyTheme";
import { useAutoEqualizer } from "./hooks/useAutoEqualizer";
import { usePlaybackQueueView } from "./hooks/usePlaybackQueueView";
import { useTagDraftSync } from "./hooks/useTagDraftSync";
import { BUILTIN_EQ_PRESET_IDS } from "./domain/equalizer";
import { RENAME_FIELD_OPTIONS, renameFieldLabel } from "./domain/rename";
import { ACCENT_THEMES } from "./domain/theme";
import { useLibraryView } from "./hooks/useLibraryView";
import { getFileName, getUserLocale } from "./utils/common";
import {
  areTracksEqual,
  buildRenamePreview,
  countFoldersAndSubfolders,
  formatOnlineMatchDate,
  formatTrackTechnicalBadge,
  formatTrackTechnicalSummary,
} from "./utils/appHelpers";
import { getActiveLyricIndex, } from "./utils/lyrics";


export function App() {
  useApplyTheme();
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const { activeScreen, showRenameSettings, setShowRenameSettings } = useUiStore();
  const {
    playlists,
    activePlaylistId,
    insertTrack: insertTrackIntoActivePlaylist,
    appendTracks,
    removeEntry: removePlaylistEntry,
  } = usePlaylistStore();
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
    playerVisualizerPresetId,
    showPlayerLyricsSection,
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
    setGenreEqPreset: handleGenreEqPresetChange,
    createPreset: handleCreateEqualizerPreset,
    savePreset: handleSaveEqualizerPreset,
    renameButtonClick: handleRenameEqualizerPresetButtonClick,
    deletePreset: handleDeleteEqualizerPreset,
    reset: handleResetEqualizer,
  } = useEqualizerStore();
  const { tracks, folderPath, selectedTrackId, isLoadingScan, } =
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
    setSelectedResultId,
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
  } = useNavidromeStore();
  const {
    playbackTrackId,
    playbackQueueTrackIds,
    isPlaying,
    currentTime,
    duration,
    audioSrc,
    audioTrackId,
  } = usePlayerStore();
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
  usePlaybackEngine();
  useAutoEqualizer();
  useTagDraftSync();
  const {
    trackById,
    upcomingTracks: playerQueueUpcomingTracks,
    historyTracks: playerQueueHistoryTracks,
    hasMoreUpcomingTracks: hasMorePlayerQueueTracks,
  } = usePlaybackQueueView();
  useLibrarySession(virtualTrackWindow.visibleTracks);
  const dashboardDrag = useDashboardDrag(activeScreen);
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
  const libraryGenres = useMemo(() => summarizeGenres(tracks), [tracks]);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const playbackTrack = tracks.find((t) => t.id === playbackTrackId) ?? null;
  const lyricsTrack = playbackTrack ?? selectedTrack;
  const playerInfoTrack = playbackTrack ?? selectedTrack;
  const { lines: lyricsLines, isSynced: lyricsIsSynced, status: lyricsStatus } = useLyrics(lyricsTrack);
  const lyricsActiveIndex = useMemo(
    () => getActiveLyricIndex(lyricsLines, currentTime),
    [lyricsLines, currentTime]
  );
  const editableTrack = trackDraft ?? selectedTrack;

  const trackTechnicalInfo = useTrackTechnicalInfo(editableTrack);
  const trackTechnicalBadge = useMemo(
    () => formatTrackTechnicalBadge(trackTechnicalInfo, editableTrack?.path),
    [trackTechnicalInfo, editableTrack?.path]
  );
  const trackTechnicalSummary = useMemo(
    () => formatTrackTechnicalSummary(trackTechnicalInfo),
    [trackTechnicalInfo]
  );
  const { sorted: sortedOnlineResults, bestMatchId: bestMatchResultId } = useMemo(
    () => orderOnlineResults(onlineResults, { title: searchTitle, artist: searchArtist, album: searchAlbum }),
    [onlineResults, searchTitle, searchArtist, searchAlbum]
  );
  const accentTheme = accentThemes[Math.max(0, accentIndex % Math.max(1, accentThemes.length))] ?? ACCENT_THEMES[0];
  const appStyle: CSSProperties = {
    "--accent": accentTheme.accent,
    "--accent-soft": accentTheme.soft,
    "--accent-strong": accentTheme.strong,
  } as CSSProperties;

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

  function handleSearchButtonClick() {
    if (isLoadingSearch) {
      cancelOnlineSearch();
      return;
    }
    if (!selectedTrack) {
      return;
    }
    void searchOnlineForCurrentQuery();
  }

  async function handleOpenTrackFolder() {
    if (!editableTrack?.path) {
      return;
    }
    await openTrackInFileManager(editableTrack.path);
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
    if (file) {
      loadDraftCoverFromFile(file);
    }
  }

  const getVisibleTrackIds = () => (activeScreen === "library" ? getVisibleLibraryTracks() : filteredTracks).map((track) => track.id);
  const handleTogglePlayPause = () => togglePlayPause(getVisibleTrackIds());
  const handlePlayTrackFromPlaylist = playTrackFromPlaylist;
  const handlePlayTrackFromPlayerQueue = playTrackFromQueue;
  const handleLoadMorePlayerQueueTracks = loadMoreQueueTracks;
  const handleClearPlayerQueue = clearPlayerQueue;
  const handleRemoveTrackFromPlayerQueue = removeTrackFromPlayerQueue;
  const handleEnqueueFilteredTracks = () => enqueueTracks(getVisibleTrackIds());

  async function handlePlayFromLibraryCover(event: MouseEvent<HTMLElement>, track: Track) {
    event.stopPropagation();
    await playFromLibraryCover(track, getVisibleTrackIds());
  }

  async function handlePlayActivePlaylist() {
    if (activePlaylist) {
      await playPlaylist(activePlaylist.id);
    }
  }

  function handleEqualizerPresetNameInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameEqualizerPresetButtonClick();
    }
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
    <AppShell
      inspector={activeScreen === "library" && tracks.length > 0 ? <LibraryInspector /> : undefined}
      onBrandClick={rotateAccent}
      onTogglePlayPause={handleTogglePlayPause}
      onPlayActivePlaylist={() => void handlePlayActivePlaylist()}
    >
    <div className={colorMode === "dark" ? "app-shell theme-dark" : "app-shell"} style={appStyle}>
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
            onTrackPointerDown: dashboardDrag.onLibraryTrackPointerDown,
            draggingTrackId: dashboardDrag.draggingTrackId,
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
          isDashboardDragging={dashboardDrag.isDragging}
          dashboardDropArea={dashboardDrag.dropArea}
          dashboardDropEntryId={dashboardDrag.dropEntryId}
          draggingPlaylistEntryId={dashboardDrag.draggingPlaylistEntryId}
          onPlaylistEntryPointerDown={dashboardDrag.onPlaylistEntryPointerDown}
          onPlaylistEntryClick={(track) => {
            if (dashboardDrag.consumeSuppressedClick()) {
              return;
            }
            handlePlayTrackFromPlaylist(track, activePlaylist?.id);
          }}
          onRemovePlaylistEntry={removePlaylistEntry}
          IconTrash={IconTrash}
          IconPlay={IconPlay}
        />
      )}

      {activeScreen === "library" && <LibraryScreen onTogglePlayPause={handleTogglePlayPause} />}

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
    </AppShell>
  );
}
