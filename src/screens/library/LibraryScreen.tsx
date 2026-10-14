import { type MouseEvent, type ReactNode, useMemo } from "react";
import { IconClose, IconFolder, IconGlobe, IconGrid, IconListCompact, IconRows, IconSearch, IconArrowUp, IconArrowDown } from "../../components/icons";
import { scanLibraryWithPicker } from "../../actions/library";
import { moveSelection, selectOnly, selectRangeTo, toggleSelectAll, toggleSelected } from "../../actions/librarySelection";
import { playFromLibraryCover } from "../../actions/playback";
import { summarizeAlbums, summarizeArtists, type LibraryAlbumSummary, type LibraryArtistSummary } from "../../domain/library";
import type { HealthFilter, LibraryTab, SortKey } from "../../domain/libraryView";
import { useVisibleTracks } from "../../hooks/useVisibleTracks";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useLibraryViewStore } from "../../store/libraryViewStore";
import { useNavidromeStore } from "../../store/navidromeStore";
import { usePlayerStore } from "../../store/playerStore";
import { useSettingsStore, type ListDensity } from "../../store/settingsStore";
import type { Track } from "../../types";
import { Button, Chip, IconButton, Segmented, Select, TextInput } from "../../ui";
import { AlbumGrid, ArtistList, FolderBrowser } from "./CollectionViews";
import { TrackGrid } from "./TrackGrid";
import { TrackTable } from "./TrackTable";
import "./library.css";

const TAB_OPTIONS: Array<{ value: LibraryTab; label: string }> = [
  { value: "tracks", label: "Tracks" },
  { value: "albums", label: "Albums" },
  { value: "artists", label: "Artists" },
  { value: "folders", label: "Folders" },
];

const FILTER_LABELS: Record<HealthFilter, string> = {
  all: "All",
  cover: "Missing cover",
  tags: "Missing tags",
  duplicates: "Duplicates",
  favorites: "Favorites",
};

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "added", label: "Date added" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "year", label: "Year" },
  { value: "genre", label: "Genre" },
  { value: "format", label: "Format" },
  { value: "rating", label: "Rating" },
];

const STYLE_OPTIONS: Array<{ value: ListDensity; label: ReactNode; ariaLabel: string }> = [
  { value: "comfortable", label: <IconRows aria-hidden="true" />, ariaLabel: "Comfortable rows" },
  { value: "compact", label: <IconListCompact aria-hidden="true" />, ariaLabel: "Compact rows" },
  { value: "grid", label: <IconGrid aria-hidden="true" />, ariaLabel: "Grid of covers" },
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
  const { tracks, visibleTracks, unscopedTracks, duplicateIds } = useVisibleTracks();
  const { favorites, ratings, toggleFavorite, setRating } = useFavoritesStore();
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

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

  const scopeLabel = view.scope ? (view.scope.kind === "album" ? `${view.scope.album} · ${view.scope.artist}` : view.scope.artist) : "";
  const filterLabel = view.filter === "all" ? "" : FILTER_LABELS[view.filter];

  return (
    <div className="lib-screen">
      <div className="lib-toolbar">
        <Segmented label="Library view" value={view.tab} options={TAB_OPTIONS} onChange={view.setTab} />
        <label className="lib-search">
          <IconSearch aria-hidden="true" />
          <TextInput placeholder="Filter this list…" aria-label="Filter library" value={view.query} onChange={(event) => view.setQuery(event.target.value)} />
        </label>
        {view.scope || filterLabel ? (
          <div className="lib-chips" role="group" aria-label="Active filters">
            {filterLabel ? (
              <Chip on onClick={() => view.setFilter("all")} aria-label={`Remove filter ${filterLabel}`}>
                {filterLabel}
                <IconClose aria-hidden="true" width={12} height={12} />
              </Chip>
            ) : null}
            {view.scope ? (
              <Chip on onClick={() => view.setScope(null)} aria-label={`Remove filter ${scopeLabel}`}>
                {scopeLabel}
                <IconClose aria-hidden="true" width={12} height={12} />
              </Chip>
            ) : null}
          </div>
        ) : null}
        {view.tab === "tracks" ? (
          <div className="lib-toolbar__end">
            {listDensity === "grid" ? (
              <>
                <Select className="lib-sortselect" aria-label="Sort by" value={view.sortKey} onChange={(event) => view.clickSort(event.target.value as SortKey)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <IconButton
                  label={view.sortDirection === "asc" ? "Ascending: switch to descending" : "Descending: switch to ascending"}
                  onClick={() => view.clickSort(view.sortKey)}
                >
                  {view.sortDirection === "asc" ? <IconArrowUp /> : <IconArrowDown />}
                </IconButton>
              </>
            ) : null}
            <Segmented label="Track list style" value={listDensity} onChange={setListDensity} options={STYLE_OPTIONS} />
          </div>
        ) : null}
      </div>

      <div className="lib-body">
        {view.tab === "tracks" && listDensity === "grid" ? (
          <TrackGrid
            tracks={visibleTracks}
            duplicateIds={duplicateIds}
            selectedIds={view.selectedIds}
            cursorId={view.anchorId}
            playingTrackId={playbackTrackId}
            isPlaying={isPlaying}
            favoriteIds={favoriteIds}
            onRowClick={onRowClick}
            onToggleSelected={(track) => toggleSelected(track.id)}
            onPlay={playTrack}
            onToggleFavorite={(track) => toggleFavorite(track.id)}
            onKeyNavigate={moveSelection}
            onSelectAll={toggleSelectAll}
          />
        ) : null}
        {view.tab === "tracks" && listDensity !== "grid" ? (
          <TrackTable
            tracks={visibleTracks}
            duplicateIds={duplicateIds}
            density={listDensity === "compact" ? "compact" : "comfortable"}
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
            favoriteIds={favoriteIds}
            ratings={ratings}
            onToggleFavorite={(track) => toggleFavorite(track.id)}
            onRate={(track, rating) => setRating(track.id, rating)}
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
