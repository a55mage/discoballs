import { adapter } from "../api";
import { useLibraryStore } from "../store/libraryStore";
import { useNavidromeStore } from "../store/navidromeStore";
import { usePlayerStore } from "../store/playerStore";
import { useSettingsStore } from "../store/settingsStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import type { SearchQuery, Track } from "../types";
import { formatError } from "../utils/common";
import { cancelOnlineSearch, runOnlineSearch } from "./onlineSearch";

/** Makes a track the current selection and prepares the tag editor for it. */
export function selectTrack(track: Track): void {
  const library = useLibraryStore.getState();
  const editor = useTagEditorStore.getState();
  const isNewTrack = track.id !== library.selectedTrackId;
  if (isNewTrack) {
    editor.setTrackDraft({ ...track });
  }
  library.setSelectedTrackId(track.id);
  editor.setSearchTitle(track.title);
  editor.setSearchArtist(track.artist);
  editor.setSearchAlbum(track.album);
  if (isNewTrack) {
    cancelOnlineSearch("Online search canceled: track changed.");
    editor.setOnlineResults([]);
    editor.setSelectedResultId("");
    editor.setSearchStatus("Ready");
  }
}

/** Replaces the whole library (scan, auto-open, Navidrome) and resets selection, playback and search. */
export function applyLoadedLibrary(folderPath: string, tracks: Track[], preferredSelectedTrackId = ""): void {
  const library = useLibraryStore.getState();
  const editor = useTagEditorStore.getState();
  if (!folderPath.startsWith("Navidrome/")) {
    // A local library replaces the server's: the header no longer shows it as connected.
    const navidrome = useNavidromeStore.getState();
    navidrome.setConnectedNavidromeBookmarkId("");
    navidrome.setConnectedNavidromeServer(null);
  }
  library.setFolderPath(folderPath);
  library.setTracks(tracks);
  const selectedId = tracks.some((track) => track.id === preferredSelectedTrackId)
    ? preferredSelectedTrackId
    : tracks[0]?.id ?? "";
  library.setSelectedTrackId(selectedId);
  usePlayerStore.getState().resetSession();
  const selected = tracks.find((track) => track.id === selectedId) ?? tracks[0];
  if (selected) {
    editor.setSearchTitle(selected.title);
    editor.setSearchArtist(selected.artist);
    editor.setSearchAlbum(selected.album);
  }
  editor.setOnlineResults([]);
  editor.setSelectedResultId("");
}

export async function scanLibraryWithPicker(): Promise<void> {
  const library = useLibraryStore.getState();
  const editor = useTagEditorStore.getState();
  cancelOnlineSearch();
  library.setIsLoadingScan(true);
  try {
    const result = await adapter.selectFolderAndScan();
    if (!result.folderPath) {
      return;
    }
    applyLoadedLibrary(result.folderPath, result.tracks);
    const settings = useSettingsStore.getState();
    if (!settings.defaultFolderPath) {
      settings.setDefaultFolderPath(result.folderPath);
    }
    editor.setSearchStatus("Ready");
  } catch (error) {
    editor.setSearchStatus(`Scan error: ${formatError(error)}`);
  } finally {
    library.setIsLoadingScan(false);
  }
}

export function searchOnlineForTrack(track: Track): void {
  selectTrack(track);
  const query: SearchQuery = { title: track.title, artist: track.artist, album: track.album };
  void runOnlineSearch(query);
}

export async function openTrackInFileManager(path: string): Promise<void> {
  if (!path) {
    return;
  }
  try {
    await adapter.openTrackInFileManager(path);
  } catch (error) {
    useTagEditorStore.getState().setSearchStatus(`Open folder error: ${formatError(error)}`);
  }
}

export async function openLibraryFolder(): Promise<void> {
  const { folderPath } = useLibraryStore.getState();
  if (!folderPath) {
    return;
  }
  if (folderPath.startsWith("Navidrome/")) {
    useTagEditorStore.getState().setSearchStatus("Navidrome libraries are remote, no local folder to open.");
    return;
  }
  await openTrackInFileManager(folderPath);
}

export async function chooseDefaultFolder(): Promise<void> {
  try {
    const picked = await adapter.pickFolder();
    if (!picked) {
      return;
    }
    useSettingsStore.getState().setDefaultFolderPath(picked);
  } catch (error) {
    useTagEditorStore.getState().setSearchStatus(`Pick folder error: ${formatError(error)}`);
  }
}
