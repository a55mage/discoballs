import { useMemo } from "react";
import { countHealth, findDuplicateIds, getTrackIssues, getVisibleTracks } from "../domain/libraryView";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryViewStore } from "../store/libraryViewStore";

/** The library as the Tracks tab shows it, plus the health information that drives filters and badges. */
export function useVisibleTracks() {
  const tracks = useLibraryStore((state) => state.tracks);
  const { query, filter, scope, sortKey, sortDirection, ignoredDuplicates } = useLibraryViewStore();

  const duplicateIds = useMemo(() => findDuplicateIds(tracks, new Set(ignoredDuplicates)), [tracks, ignoredDuplicates]);
  const health = useMemo(() => countHealth(tracks, duplicateIds), [tracks, duplicateIds]);
  const visibleTracks = useMemo(
    () => getVisibleTracks(tracks, { query, filter, scope, sortKey, sortDirection }, duplicateIds),
    [tracks, query, filter, scope, sortKey, sortDirection, duplicateIds]
  );
  /** Same filters, but not narrowed to an album/artist: the source of the Albums and Artists tabs. */
  const unscopedTracks = useMemo(
    () => getVisibleTracks(tracks, { query, filter, scope: null, sortKey: "added", sortDirection: "asc" }, duplicateIds),
    [tracks, query, filter, duplicateIds]
  );

  return {
    tracks,
    visibleTracks,
    unscopedTracks,
    duplicateIds,
    health,
    issuesOf: (trackId: string) => {
      const track = tracks.find((item) => item.id === trackId);
      return track ? getTrackIssues(track, duplicateIds) : [];
    },
  };
}
