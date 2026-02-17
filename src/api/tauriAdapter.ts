import type { MusicAdapter } from "./adapter";
import type { OnlineMatch, ScanResult, SearchQuery, Track, TrackUpdate } from "../types";

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriInternals = {
  invoke: TauriInvoke;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getInvoke(): TauriInvoke {
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (!internals?.invoke) {
    throw new Error("Tauri runtime non disponibile");
  }
  return internals.invoke;
}

type TauriTrack = {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  tracknumber: string;
  year: string;
  genre: string;
  has_cover: boolean;
  cover_data_url?: string | null;
};

type TauriScanResult = {
  folder_path: string;
  tracks: TauriTrack[];
};

type TauriOnlineMatch = {
  id: string;
  title: string;
  artist: string;
  album: string;
  date: string;
  source?: string;
  tracknumber?: string;
  cover_data_url?: string | null;
  release_id?: string;
};

function mapTrack(t: TauriTrack): Track {
  return {
    id: t.id,
    path: t.path,
    title: t.title,
    artist: t.artist,
    album: t.album,
    tracknumber: t.tracknumber,
    year: t.year,
    genre: t.genre,
    hasCover: t.has_cover,
    coverUrl: t.cover_data_url ?? undefined,
  };
}

function mapOnlineMatch(m: TauriOnlineMatch): OnlineMatch {
  return {
    id: m.id,
    title: m.title,
    artist: m.artist,
    album: m.album,
    date: m.date,
    source: m.source,
    tracknumber: m.tracknumber,
    coverUrl: m.cover_data_url ?? undefined,
    releaseId: m.release_id,
  };
}

export const tauriAdapter: MusicAdapter = {
  async selectFolderAndScan(): Promise<ScanResult> {
    const invoke = getInvoke();
    const selectedPath = await invoke<string | null>("pick_music_folder");
    if (!selectedPath) {
      return { folderPath: "", tracks: [] };
    }

    const result = await invoke<TauriScanResult>("scan_folder", { path: selectedPath });
    return {
      folderPath: result.folder_path,
      tracks: result.tracks.map(mapTrack),
    };
  },

  async saveTrack(_trackId: string, path: string, update: TrackUpdate, coverUrl?: string): Promise<void> {
    const invoke = getInvoke();
    await invoke("save_track", {
      input: {
        path,
        title: update.title,
        artist: update.artist,
        album: update.album,
        tracknumber: update.tracknumber,
        year: update.year,
        genre: update.genre,
        cover_data_url: coverUrl ?? null,
      },
    });
  },

  async searchOnline(query: SearchQuery): Promise<OnlineMatch[]> {
    const invoke = getInvoke();
    const result = await invoke<TauriOnlineMatch[]>("search_online", { query });
    return result.map(mapOnlineMatch);
  },
};

export function createAdapter(fallback: MusicAdapter): MusicAdapter {
  if (isTauriRuntime()) {
    return tauriAdapter;
  }
  return fallback;
}
