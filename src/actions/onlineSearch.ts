import { adapter } from "../api";
import { useTagEditorStore } from "../store/tagEditorStore";
import type { SearchQuery } from "../types";
import { formatError } from "../utils/common";

type SearchRequest = { id: number; canceled: boolean };

let activeRequest: SearchRequest | null = null;
let requestCounter = 0;

export function cancelOnlineSearch(reason = "Online search canceled."): void {
  if (!activeRequest) {
    return;
  }
  activeRequest.canceled = true;
  activeRequest = null;
  const editor = useTagEditorStore.getState();
  editor.setIsLoadingSearch(false);
  editor.setSearchStatus(reason);
}

export async function runOnlineSearch(query: SearchQuery): Promise<void> {
  const editor = useTagEditorStore.getState();
  const request: SearchRequest = { id: requestCounter + 1, canceled: false };
  requestCounter = request.id;
  activeRequest = request;

  editor.setIsLoadingSearch(true);
  editor.setSearchStatus("Online search in progress...");
  try {
    const result = await adapter.searchOnline(query);
    if (request.canceled || activeRequest?.id !== request.id) {
      return;
    }
    editor.setOnlineResults(result);
    editor.setSelectedResultId("");
    editor.setSearchStatus(`Search: "${query.artist} ${query.title} ${query.album}". Online results: ${result.length}`);
  } catch (error) {
    if (request.canceled || activeRequest?.id !== request.id) {
      return;
    }
    editor.setSearchStatus(`Online search error: ${formatError(error)}`);
  } finally {
    if (activeRequest?.id === request.id) {
      activeRequest = null;
      editor.setIsLoadingSearch(false);
    }
  }
}

/** Searches with the current query fields of the tag editor. */
export async function searchOnlineForCurrentQuery(): Promise<void> {
  const { searchTitle, searchArtist, searchAlbum } = useTagEditorStore.getState();
  await runOnlineSearch({ title: searchTitle, artist: searchArtist, album: searchAlbum });
}

export function toggleOnlineSearch(): void {
  if (useTagEditorStore.getState().isLoadingSearch) {
    cancelOnlineSearch();
    return;
  }
  void searchOnlineForCurrentQuery();
}
