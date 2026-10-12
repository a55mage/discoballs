import type { OnlineMatch, SearchQuery } from "../types";
import { getOnlineMatchDateSortKey, scoreOnlineMatch } from "../utils/appHelpers";

/** Results sorted by release date (oldest first). */
export function sortOnlineResultsByDate(results: OnlineMatch[]): OnlineMatch[] {
  return [...results].sort((a, b) => {
    const aDate = getOnlineMatchDateSortKey(a.date);
    const bDate = getOnlineMatchDateSortKey(b.date);
    if (aDate === bDate) {
      return 0;
    }
    return aDate < bDate ? -1 : 1;
  });
}

/** Highest scoring result; ties are won by the earliest release date. */
export function findBestMatchId(results: OnlineMatch[], query: SearchQuery): string {
  let bestMatch: OnlineMatch | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const result of results) {
    const score = scoreOnlineMatch(result, query);
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
    if (getOnlineMatchDateSortKey(result.date) < getOnlineMatchDateSortKey(bestMatch.date)) {
      bestMatch = result;
    }
  }
  return bestMatch?.id ?? "";
}

/** Date-sorted results with the best match moved to the top. */
export function orderOnlineResults(results: OnlineMatch[], query: SearchQuery): { sorted: OnlineMatch[]; bestMatchId: string } {
  const dateSorted = sortOnlineResultsByDate(results);
  const bestMatchId = findBestMatchId(results, query);
  if (!bestMatchId) {
    return { sorted: dateSorted, bestMatchId };
  }
  const bestIndex = dateSorted.findIndex((result) => result.id === bestMatchId);
  if (bestIndex <= 0) {
    return { sorted: dateSorted, bestMatchId };
  }
  return {
    sorted: [dateSorted[bestIndex], ...dateSorted.slice(0, bestIndex), ...dateSorted.slice(bestIndex + 1)],
    bestMatchId,
  };
}
