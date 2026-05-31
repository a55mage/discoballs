import type { MusicAdapter } from "./adapter";
import type {
  NavidromeConnectionInput,
  NavidromeConnectionResult,
  OnlineMatch,
  RenameConfig,
  SaveTrackResult,
  ScanResult,
  SearchQuery,
  Track,
  TrackTechnicalInfo,
  TrackUpdate,
} from "../types";

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriInternals = {
  invoke: TauriInvoke;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function runtimeModeLabel(): "tauri" | "mock" {
  return isTauriRuntime() ? "tauri" : "mock";
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
  navidrome_source?: TauriNavidromeTrackSource | null;
};

type TauriNavidromeTrackSource = {
  base_url: string;
  username: string;
  password: string;
  song_id: string;
  cover_art_id?: string | null;
  suffix?: string | null;
  content_type?: string | null;
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

type TauriTrackTechnicalInfo = {
  format: string;
  bitrate_kbps?: number | null;
  duration_seconds?: number | null;
  sample_rate_hz?: number | null;
  file_size_bytes?: number | null;
  channels?: number | null;
  bit_depth?: number | null;
};

type TauriNavidromeConnectionResult = {
  ok: boolean;
  server_version?: string | null;
  api_version?: string | null;
  message?: string | null;
};

function hexEncode(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildNavidromeRestUrl(
  source: TauriNavidromeTrackSource | NonNullable<Track["source"]>,
  endpoint: "stream" | "getCoverArt",
  params: Record<string, string>
): string {
  const baseUrl = "base_url" in source ? source.base_url : source.baseUrl;
  const username = source.username;
  const password = source.password;
  const searchParams = new URLSearchParams({
    ...params,
    u: username,
    p: `enc:${hexEncode(password)}`,
    v: "1.16.1",
    c: "DiscoBalls",
  });
  return `${baseUrl.replace(/\/+$/, "")}/rest/${endpoint}.view?${searchParams.toString()}`;
}

function mapTrack(t: TauriTrack): Track {
  const navidromeSource = t.navidrome_source ? {
    type: "navidrome" as const,
    baseUrl: t.navidrome_source.base_url,
    username: t.navidrome_source.username,
    password: t.navidrome_source.password,
    songId: t.navidrome_source.song_id,
    coverArtId: t.navidrome_source.cover_art_id ?? undefined,
    suffix: t.navidrome_source.suffix ?? undefined,
    contentType: t.navidrome_source.content_type ?? undefined,
  } : undefined;
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
    coverUrl: t.cover_data_url ?? (t.navidrome_source?.cover_art_id
      ? buildNavidromeRestUrl(t.navidrome_source, "getCoverArt", { id: t.navidrome_source.cover_art_id, size: "300" })
      : undefined),
    source: navidromeSource,
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

function mapTrackTechnicalInfo(info: TauriTrackTechnicalInfo): TrackTechnicalInfo {
  return {
    format: info.format,
    bitrateKbps: info.bitrate_kbps ?? undefined,
    durationSeconds: info.duration_seconds ?? undefined,
    sampleRateHz: info.sample_rate_hz ?? undefined,
    fileSizeBytes: info.file_size_bytes ?? undefined,
    channels: info.channels ?? undefined,
    bitDepth: info.bit_depth ?? undefined,
  };
}

function mapNavidromeConnectionResult(result: TauriNavidromeConnectionResult): NavidromeConnectionResult {
  return {
    ok: result.ok,
    serverVersion: result.server_version ?? undefined,
    apiVersion: result.api_version ?? undefined,
    message: result.message ?? undefined,
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

  async scanFolder(path: string): Promise<ScanResult> {
    const invoke = getInvoke();
    const result = await invoke<TauriScanResult>("scan_folder", { path });
    return {
      folderPath: result.folder_path,
      tracks: result.tracks.map(mapTrack),
    };
  },

  async pickFolder(): Promise<string | null> {
    const invoke = getInvoke();
    return await invoke<string | null>("pick_music_folder");
  },

  async saveTrack(
    _trackId: string,
    path: string,
    update: TrackUpdate,
    coverUrl?: string,
    renameConfig?: RenameConfig,
    removeCover?: boolean
  ): Promise<SaveTrackResult> {
    const invoke = getInvoke();
    return await invoke<SaveTrackResult>("save_track", {
      input: {
        path,
        title: update.title,
        artist: update.artist,
        album: update.album,
        tracknumber: update.tracknumber,
        year: update.year,
        genre: update.genre,
        cover_data_url: coverUrl ?? null,
        remove_cover: Boolean(removeCover),
        rename_fields: renameConfig?.fields ?? null,
        rename_separator: renameConfig?.separator ?? null,
      },
    });
  },

  async searchOnline(query: SearchQuery): Promise<OnlineMatch[]> {
    const invoke = getInvoke();
    const result = await invoke<TauriOnlineMatch[]>("search_online", { query });
    return result.map(mapOnlineMatch);
  },

  async connectNavidrome(input: NavidromeConnectionInput): Promise<NavidromeConnectionResult> {
    const invoke = getInvoke();
    const result = await invoke<TauriNavidromeConnectionResult>("navidrome_ping", {
      input: {
        base_url: input.baseUrl,
        username: input.username,
        password: input.password,
      },
    });
    return mapNavidromeConnectionResult(result);
  },

  async scanNavidromeLibrary(input: NavidromeConnectionInput): Promise<ScanResult> {
    const invoke = getInvoke();
    const result = await invoke<TauriScanResult>("navidrome_scan_library", {
      input: {
        base_url: input.baseUrl,
        username: input.username,
        password: input.password,
      },
    });
    return {
      folderPath: result.folder_path,
      tracks: result.tracks.map(mapTrack),
    };
  },

  async renameTrack(path: string, update: TrackUpdate, renameConfig: RenameConfig): Promise<SaveTrackResult> {
    const invoke = getInvoke();
    return await invoke<SaveTrackResult>("rename_track", {
      input: {
        path,
        title: update.title,
        artist: update.artist,
        album: update.album,
        tracknumber: update.tracknumber,
        year: update.year,
        genre: update.genre,
        rename_fields: renameConfig.fields,
        rename_separator: renameConfig.separator,
      },
    });
  },

  async getAudioSource(track: Track): Promise<string> {
    const invoke = getInvoke();
    if (track.source?.type === "navidrome") {
      return await invoke<string>("navidrome_get_audio_data_url", {
        source: {
          base_url: track.source.baseUrl,
          username: track.source.username,
          password: track.source.password,
          song_id: track.source.songId,
          cover_art_id: track.source.coverArtId ?? null,
          suffix: track.source.suffix ?? null,
          content_type: track.source.contentType ?? null,
        },
      });
    }
    return await invoke<string>("get_audio_data_url", { path: track.path });
  },

  async getTrackTechnicalInfo(path: string): Promise<TrackTechnicalInfo | null> {
    const invoke = getInvoke();
    const result = await invoke<TauriTrackTechnicalInfo | null>("get_track_technical_info", { path });
    return result ? mapTrackTechnicalInfo(result) : null;
  },

  async getTrackCoverSource(track: Track): Promise<string | null> {
    if (!track.source || track.source.type !== "navidrome" || !track.source.coverArtId) {
      return track.coverUrl ?? null;
    }
    return buildNavidromeRestUrl(track.source, "getCoverArt", { id: track.source.coverArtId, size: "300" });
  },

  async openTrackInFileManager(path: string): Promise<void> {
    const invoke = getInvoke();
    await invoke<void>("open_track_in_file_manager", { path });
  },
};

export function createAdapter(fallback: MusicAdapter): MusicAdapter {
  if (isTauriRuntime()) {
    return tauriAdapter;
  }
  return fallback;
}
