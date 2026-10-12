import { type CSSProperties, type KeyboardEvent, type MouseEvent, useMemo, } from "react";
import {
  chooseDefaultFolder as handleChooseDefaultFolder,
  openLibraryFolder as handleOpenLibraryFolder,
  scanLibraryWithPicker as handleScan,
  searchOnlineForTrack as handleQuickSearchTrack,
  selectTrack,
} from "./actions/library";
import {
  connectNavidromeBookmark as handleConnectNavidromeBookmark,
  connectNavidromeFromForm as handleConnectNavidrome,
  deleteNavidromeBookmark as handleDeleteNavidromeBookmark,
  saveNavidromeBookmark as handleSaveNavidromeBookmark,
  setNavidromeBookmarkConnectOnOpen as handleToggleNavidromeBookmarkConnectOnOpen,
} from "./actions/navidrome";
import { } from "./domain/onlineResults";
import {
  summarizeGenres,
} from "./domain/library";
import { useDashboardDrag } from "./hooks/useDashboardDrag";
import { useLibrarySession } from "./hooks/useLibrarySession";
import { } from "./hooks/useLyrics";
import { } from "./hooks/useTrackTechnicalInfo";
import {
  playFromLibraryCover,
  playPlaylist,
  playTrackFromPlaylist,
  togglePlayPause,
} from "./actions/playback";
import { audioRef } from "./audio/audioRef";
import { usePlaybackEngine } from "./hooks/usePlaybackEngine";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconClose,
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
  IconSearch,
  IconSortAdded,
  IconSortArtist,
  IconSortRelease,
  IconSortTitle,
  IconTrash,
} from "./components/icons";
import { DashboardSection } from "./sections/DashboardSection";
import { LibraryInspector } from "./screens/library/LibraryInspector";
import { LibraryScreen } from "./screens/library/LibraryScreen";
import { NowPlayingScreen } from "./screens/nowPlaying/NowPlayingScreen";
import { TagEditorScreen } from "./screens/tagEditor/TagEditorScreen";
import { } from "./sections/LibrarySection";
import { RenameSettingsModal } from "./sections/RenameSettingsModal";
import { SettingsSection } from "./sections/SettingsSection";
import type { Track } from "./types";
import { useEqualizerStore } from "./store/equalizerStore";
import { useLibraryStore } from "./store/libraryStore";
import { useNavidromeStore } from "./store/navidromeStore";
import { } from "./store/playerStore";
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
import {
  countFoldersAndSubfolders,
} from "./utils/appHelpers";
import { } from "./utils/lyrics";


export function App() {
  useApplyTheme();
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
  } = usePlaybackQueueView();
  useLibrarySession(virtualTrackWindow.visibleTracks);
  const dashboardDrag = useDashboardDrag(activeScreen);
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


  const accentTheme = accentThemes[Math.max(0, accentIndex % Math.max(1, accentThemes.length))] ?? ACCENT_THEMES[0];
  const appStyle: CSSProperties = {
    "--accent": accentTheme.accent,
    "--accent-soft": accentTheme.soft,
    "--accent-strong": accentTheme.strong,
  } as CSSProperties;

  const folderCount = useMemo(() => countFoldersAndSubfolders(tracks, folderPath), [tracks, folderPath]);

  const getVisibleTrackIds = () => (activeScreen === "library" ? getVisibleLibraryTracks() : filteredTracks).map((track) => track.id);
  const handleTogglePlayPause = () => togglePlayPause(getVisibleTrackIds());
  const handlePlayTrackFromPlaylist = playTrackFromPlaylist;

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
      {activeScreen === "tagging" && <TagEditorScreen />}

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

      {activeScreen === "player" && <NowPlayingScreen onTogglePlayPause={handleTogglePlayPause} />}

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
