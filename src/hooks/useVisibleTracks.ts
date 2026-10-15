import { useMemo } from "react";
import { countHealth, findDuplicateIds, getTrackIssues, getVisibleTracks } from "../domain/libraryView";
import { useLibraryStore } from "../store/libraryStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { useLibraryViewStore } from "../store/libraryViewStore";

/** The library as the Tracks tab shows it, plus the health information that drives filters and badges. */
export function useVisibleTracks() {
  const tracks = useLibraryStore((state) => state.tracks);
  const { query, filter, scope, sortKey, sortDirection, ignoredDuplicates, duplicatesIgnoreFormats } = useLibraryViewStore();

  const favorites = useFavoritesStore((state) => state.favorites);
  const ratings = useFavoritesStore((state) => state.ratings);
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  const duplicateIds = useMemo(
    () => findDuplicateIds(tracks, new Set(ignoredDuplicates), { ignoreOtherFormats: duplicatesIgnoreFormats }),
    [tracks, ignoredDuplicates, duplicatesIgnoreFormats]
  );
  const health = useMemo(() => countHealth(tracks, duplicateIds, favoriteIds), [tracks, duplicateIds, favoriteIds]);
  const visibleTracks = useMemo(
    () => getVisibleTracks(tracks, { query, filter, scope, sortKey, sortDirection }, duplicateIds, { favoriteIds, ratings }),
    [tracks, query, filter, scope, sortKey, sortDirection, duplicateIds, favoriteIds, ratings]
  );
  /** Same filters, but not narrowed to an album/artist: the source of the Albums and Artists tabs. */
  const unscopedTracks = useMemo(
    () => getVisibleTracks(tracks, { query, filter, scope: null, sortKey: "added", sortDirection: "asc" }, duplicateIds, { favoriteIds, ratings }),
    [tracks, query, filter, duplicateIds, favoriteIds, ratings]
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
