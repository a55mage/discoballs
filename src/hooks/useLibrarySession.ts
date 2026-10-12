import { useEffect, useRef } from "react";
import { applyLoadedLibrary } from "../actions/library";
import { connectNavidromeBookmark } from "../actions/navidrome";
import { cancelOnlineSearch } from "../actions/onlineSearch";
import { adapter } from "../api";
import { useVisibleTracks } from "./useVisibleTracks";
import { useLibraryStore } from "../store/libraryStore";
import { clearPendingStartupConnection, isStartupConnectionPending, useNavidromeStore } from "../store/navidromeStore";
import { usePlayerStore } from "../store/playerStore";
import { getPlaybackTrack, getSelectedTrack } from "../store/selectors";
import { useSettingsStore } from "../store/settingsStore";
import { useTagEditorStore } from "../store/tagEditorStore";
import type { Track } from "../types";
import { formatError } from "../utils/common";

const SNAPSHOT_KEY = "musicmanager-library-snapshot";

function getRemoteCoverCacheKey(track: Track): string {
  if (track.source?.type === "navidrome" && track.source.coverArtId) {
    return `${track.source.baseUrl}:${track.source.coverArtId}`;
  }
  return track.id;
}

/**
 * Library lifecycle: restores the last library at launch, keeps its snapshot, auto-opens the default
 * folder, reconnects the startup Navidrome server and lazily downloads remote covers.
 */
export function useLibrarySession(): void {
  const { visibleTracks } = useVisibleTracks();
  const { tracks, folderPath, selectedTrackId } = useLibraryStore();
  const playbackTrackId = usePlayerStore((state) => state.playbackTrackId);
  const { autoOpenDefaultFolder, defaultFolderPath } = useSettingsStore();
  const navidromeBookmarks = useNavidromeStore((state) => state.navidromeBookmarks);

  const hasAutoOpenedDefaultFolderRef = useRef(false);
  const didAutoConnectNavidromeRef = useRef(false);
  const didRestoreLibrarySnapshotRef = useRef(false);
  const coverRequestIdsRef = useRef<Set<string>>(new Set());
  const coverCacheRef = useRef<Map<string, string | null>>(new Map());

  // Restore the last library instantly (the default folder is re-scanned afterwards).
  useEffect(() => {
    const savedSnapshot = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!useSettingsStore.getState().autoOpenDefaultFolder || !savedSnapshot) {
      return;
    }
    try {
      const snapshot = JSON.parse(savedSnapshot) as { folderPath?: unknown; tracks?: unknown };
      if (typeof snapshot.folderPath === "string" && Array.isArray(snapshot.tracks)) {
        const restoredTracks = snapshot.tracks as Track[];
        didRestoreLibrarySnapshotRef.current = true;
        const library = useLibraryStore.getState();
        library.setFolderPath(snapshot.folderPath);
        library.setTracks(restoredTracks);
        library.setSelectedTrackId(restoredTracks[0]?.id ?? "");
        usePlayerStore.getState().resetSession();
        useTagEditorStore.getState().setSearchStatus("Ready");
      }
    } catch {
      // Ignore invalid snapshot.
    }
  }, []);

  // Auto-open the default folder.
  useEffect(() => {
    if (!autoOpenDefaultFolder || !defaultFolderPath || hasAutoOpenedDefaultFolderRef.current) {
      return;
    }
    hasAutoOpenedDefaultFolderRef.current = true;
    let canceled = false;
    const library = useLibraryStore.getState();
    const editor = useTagEditorStore.getState();
    const shouldHydrateFromSnapshot =
      didRestoreLibrarySnapshotRef.current && folderPath === defaultFolderPath && tracks.length > 0;
    cancelOnlineSearch();
    if (!shouldHydrateFromSnapshot) {
      library.setIsLoadingScan(true);
    }
    void (async () => {
      try {
        const result = await adapter.scanFolder(defaultFolderPath);
        if (canceled || !result.folderPath) {
          return;
        }
        if (shouldHydrateFromSnapshot) {
          const scannedById = new Map(result.tracks.map((track) => [track.id, track] as const));
          library.setTracks((prev) =>
            prev.map((track) => {
              const scanned = scannedById.get(track.id);
              return scanned ? { ...track, hasCover: scanned.hasCover, coverUrl: scanned.coverUrl } : track;
            })
          );
          library.setFolderPath(result.folderPath);
        } else {
          applyLoadedLibrary(result.folderPath, result.tracks, selectedTrackId);
        }
        editor.setSearchStatus("Ready");
      } catch (error) {
        if (!canceled) {
          editor.setSearchStatus(`Auto-open scan error: ${formatError(error)}`);
        }
      } finally {
        if (!canceled) {
          library.setIsLoadingScan(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [autoOpenDefaultFolder, defaultFolderPath, folderPath, selectedTrackId, tracks.length]);

  // Reconnect the Navidrome server flagged "connect on open".
  useEffect(() => {
    if (didAutoConnectNavidromeRef.current || !isStartupConnectionPending() || !navidromeBookmarks.length) {
      return;
    }
    didAutoConnectNavidromeRef.current = true;
    clearPendingStartupConnection();
    const startupBookmark = navidromeBookmarks.find((bookmark) => bookmark.connectOnOpen);
    if (!startupBookmark) {
      return;
    }
    useNavidromeStore.getState().setIsNavidromePanelOpen(true);
    connectNavidromeBookmark(startupBookmark);
  }, [navidromeBookmarks]);

  // Keep a lightweight snapshot of local libraries (no covers) to restore at the next launch.
  useEffect(() => {
    if (!folderPath || !tracks.length || folderPath.startsWith("Navidrome/")) {
      return;
    }
    try {
      const snapshotTracks = tracks.map(({ coverUrl: _coverUrl, ...track }) => track);
      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ folderPath, tracks: snapshotTracks }));
    } catch {
      // Ignore quota/serialization failures to keep the UI responsive.
    }
  }, [folderPath, tracks]);

  // Download covers of remote tracks that are on screen or in use.
  const playbackTrack = getPlaybackTrack();
  const selectedTrack = getSelectedTrack();
  useEffect(() => {
    const candidates = [playbackTrack, selectedTrack, ...visibleTracks.slice(0, 30)].filter((track): track is Track =>
      Boolean(track?.source?.type === "navidrome" && track.hasCover && !track.coverUrl)
    );
    const uniqueCandidates = new Map<string, Track>();
    for (const track of candidates) {
      uniqueCandidates.set(getRemoteCoverCacheKey(track), track);
    }
    const pending = [...uniqueCandidates.entries()].filter(
      ([cacheKey]) => !coverRequestIdsRef.current.has(cacheKey) && !coverCacheRef.current.has(cacheKey)
    );
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
          useLibraryStore
            .getState()
            .setTracks((prev) => prev.map((item) => (getRemoteCoverCacheKey(item) === cacheKey ? { ...item, coverUrl } : item)));
          useTagEditorStore
            .getState()
            .setTrackDraft((prev) => (prev && getRemoteCoverCacheKey(prev) === cacheKey ? { ...prev, coverUrl } : prev));
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
  }, [playbackTrack, selectedTrack, visibleTracks, playbackTrackId, selectedTrackId]);
}
