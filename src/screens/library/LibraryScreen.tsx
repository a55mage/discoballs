import { type MouseEvent, useMemo } from "react";
import { IconClose, IconFolder, IconGlobe, IconGrid, IconListCompact, IconSearch } from "../../components/icons";
import { scanLibraryWithPicker } from "../../actions/library";
import { moveSelection, selectOnly, selectRangeTo, toggleSelectAll, toggleSelected } from "../../actions/librarySelection";
import { playFromLibraryCover } from "../../actions/playback";
import { summarizeAlbums, summarizeArtists, type LibraryAlbumSummary, type LibraryArtistSummary } from "../../domain/library";
import type { HealthFilter, LibraryTab } from "../../domain/libraryView";
import { useVisibleTracks } from "../../hooks/useVisibleTracks";
import { useLibraryStore } from "../../store/libraryStore";
import { useLibraryViewStore } from "../../store/libraryViewStore";
import { useNavidromeStore } from "../../store/navidromeStore";
import { usePlayerStore } from "../../store/playerStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import type { Track } from "../../types";
import { Button, Chip, IconButton, Segmented, TextInput } from "../../ui";
import { AlbumGrid, ArtistList, FolderBrowser } from "./CollectionViews";
import { TrackTable } from "./TrackTable";
import "./library.css";

const TAB_OPTIONS: Array<{ value: LibraryTab; label: string }> = [
  { value: "tracks", label: "Tracks" },
  { value: "albums", label: "Albums" },
  { value: "artists", label: "Artists" },
  { value: "folders", label: "Folders" },
];

type LibraryScreenProps = {
  /** Play/pause of the player bar; used when a row of the current track is clicked. */
  onTogglePlayPause: () => void;
};

export function LibraryScreen({ onTogglePlayPause }: LibraryScreenProps) {
  const view = useLibraryViewStore();
  const folderPath = useLibraryStore((state) => state.folderPath);
  const isLoadingScan = useLibraryStore((state) => state.isLoadingScan);
  const { playbackTrackId, isPlaying } = usePlayerStore();
  const { listDensity, setListDensity } = useSettingsStore();
  const setNavidromePanelOpen = useNavidromeStore((state) => state.setIsNavidromePanelOpen);
  const setDuplicatesOpen = useUiStore((state) => state.setDuplicatesOpen);
  const { tracks, visibleTracks, unscopedTracks, duplicateIds, health } = useVisibleTracks();

  const albums = useMemo(() => summarizeAlbums(unscopedTracks), [unscopedTracks]);
  const artists = useMemo(() => summarizeArtists(unscopedTracks), [unscopedTracks]);
  const visibleIds = useMemo(() => visibleTracks.map((track) => track.id), [visibleTracks]);

  function playTrack(track: Track) {
    if (track.id === playbackTrackId) {
      onTogglePlayPause();
    } else {
      void playFromLibraryCover(track, visibleIds);
    }
  }

  function onRowClick(track: Track, event: MouseEvent) {
    if (event.shiftKey) selectRangeTo(track.id);
    else if (event.metaKey || event.ctrlKey) toggleSelected(track.id);
    else selectOnly(track.id);
  }

  function openAlbum(album: LibraryAlbumSummary) {
    view.setScope({ kind: "album", artist: album.artist, album: album.title });
    view.setTab("tracks");
  }

  function openArtist(artist: LibraryArtistSummary) {
    view.setScope({ kind: "artist", artist: artist.name });
    view.setTab("tracks");
  }

  if (tracks.length === 0) {
    return (
      <div className="lib-screen lib-screen--empty">
        <div className="lib-welcome">
          <h2 className="db-text-display">{isLoadingScan ? "Scanning your music…" : "Your library is empty"}</h2>
          <p>Open a folder with music files to read, edit and play them, or connect a Navidrome server.</p>
          <div className="lib-welcome__actions">
            <Button variant="primary" size="lg" icon={<IconFolder />} disabled={isLoadingScan} onClick={() => void scanLibraryWithPicker()}>
              Open music folder
            </Button>
            <Button size="lg" icon={<IconGlobe />} onClick={() => setNavidromePanelOpen(true)}>Connect Navidrome</Button>
          </div>
        </div>
      </div>
    );
  }

  const chips: Array<{ value: HealthFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: health.all },
    { value: "cover", label: "Missing cover", count: health.cover },
    { value: "tags", label: "Missing tags", count: health.tags },
    { value: "duplicates", label: "Duplicates", count: health.duplicates },
  ];
  const scopeLabel = view.scope ? (view.scope.kind === "album" ? `${view.scope.album} · ${view.scope.artist}` : view.scope.artist) : "";

  return (
    <div className="lib-screen">
      <div className="lib-toolbar">
        <Segmented label="Library view" value={view.tab} options={TAB_OPTIONS} onChange={view.setTab} />
        <div className="lib-chips" role="group" aria-label="Library health filters">
          {chips.map((chip) => (
            <Chip key={chip.value} on={view.filter === chip.value} count={chip.value === "all" ? undefined : chip.count} onClick={() => view.setFilter(chip.value)}>
              {chip.label}
            </Chip>
          ))}
          {health.duplicates > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setDuplicatesOpen(true)}>Review duplicates…</Button>
          ) : null}
          {view.scope ? (
            <Chip on onClick={() => view.setScope(null)} aria-label={`Remove filter ${scopeLabel}`}>
              {scopeLabel}
              <IconClose aria-hidden="true" width={12} height={12} />
            </Chip>
          ) : null}
        </div>
        <div className="lib-toolbar__end">
          <label className="lib-search">
            <IconSearch aria-hidden="true" />
            <TextInput placeholder="Filter this list…" aria-label="Filter library" value={view.query} onChange={(event) => view.setQuery(event.target.value)} />
          </label>
          <IconButton
            label={listDensity === "compact" ? "Use comfortable rows" : "Use compact rows"}
            active={listDensity === "compact"}
            onClick={() => setListDensity(listDensity === "compact" ? "comfortable" : "compact")}
          >
            {listDensity === "compact" ? <IconListCompact /> : <IconGrid />}
          </IconButton>
          <IconButton label="Connect a Navidrome server" onClick={() => setNavidromePanelOpen(true)}><IconGlobe /></IconButton>
        </div>
      </div>

      <div className="lib-body">
        {view.tab === "tracks" ? (
          <TrackTable
            tracks={visibleTracks}
            duplicateIds={duplicateIds}
            density={listDensity}
            selectedIds={view.selectedIds}
            cursorId={view.anchorId}
            playingTrackId={playbackTrackId}
            isPlaying={isPlaying}
            sortKey={view.sortKey}
            sortDirection={view.sortDirection}
            onSort={view.clickSort}
            onRowClick={onRowClick}
            onToggleSelected={(track) => toggleSelected(track.id)}
            onToggleAll={toggleSelectAll}
            onPlay={playTrack}
            onKeyNavigate={moveSelection}
            onSelectAll={toggleSelectAll}
          />
        ) : null}
        {view.tab === "albums" ? <AlbumGrid albums={albums} onOpen={openAlbum} /> : null}
        {view.tab === "artists" ? <ArtistList artists={artists} onOpen={openArtist} /> : null}
        {view.tab === "folders" ? (
          <FolderBrowser
            tracks={unscopedTracks}
            rootPath={folderPath}
            segments={view.folderSegments}
            query=""
            selectedIds={view.selectedIds}
            onNavigate={view.setFolderSegments}
            onSelect={(track) => selectOnly(track.id)}
            onPlay={playTrack}
          />
        ) : null}
      </div>
    </div>
  );
}
