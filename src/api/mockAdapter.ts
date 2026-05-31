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

let tracks: Track[] = [
  {
    id: "1",
    path: "/Music/Daft Punk/Random Access Memories/01 Give Life Back to Music.flac",
    title: "Give Life Back to Music",
    artist: "Daft Punk",
    album: "Random Access Memories",
    tracknumber: "1",
    year: "2013",
    genre: "Electronic",
    hasCover: true,
    coverUrl: "https://picsum.photos/seed/ram/500/500",
  },
  {
    id: "2",
    path: "/Music/Radiohead/In Rainbows/01 15 Step.mp3",
    title: "15 Step",
    artist: "Radiohead",
    album: "In Rainbows",
    tracknumber: "1",
    year: "2007",
    genre: "Alternative",
    hasCover: false,
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAdapter: MusicAdapter = {
  async selectFolderAndScan(): Promise<ScanResult> {
    await wait(300);
    return {
      folderPath: "/Music",
      tracks,
    };
  },

  async scanFolder(path: string): Promise<ScanResult> {
    await wait(220);
    return {
      folderPath: path || "/Music",
      tracks,
    };
  },

  async pickFolder(): Promise<string | null> {
    await wait(100);
    return "/Music";
  },

  async saveTrack(
    trackId: string,
    path: string,
    update: TrackUpdate,
    coverUrl?: string,
    renameConfig?: RenameConfig,
    removeCover?: boolean
  ): Promise<SaveTrackResult> {
    await wait(200);
    let nextPath = path;
    tracks = tracks.map((track) => {
      if (track.id !== trackId) {
        return track;
      }
      if (renameConfig && renameConfig.fields.length) {
        const extension = track.path.includes(".") ? `.${track.path.split(".").pop()}` : "";
        const parts = renameConfig.fields
          .map((field) => String(update[field as keyof TrackUpdate] || "").trim())
          .filter(Boolean);
        const name = parts.join(renameConfig.separator || " - ") || "Track";
        const baseDir = track.path.slice(0, track.path.lastIndexOf("/") + 1);
        nextPath = `${baseDir}${name}${extension}`;
      }
      return {
        ...track,
        ...update,
        id: nextPath,
        path: nextPath,
        coverUrl: removeCover ? undefined : (coverUrl ?? track.coverUrl),
        hasCover: removeCover ? false : Boolean(coverUrl ?? track.coverUrl),
      };
    });
    return { path: nextPath };
  },

  async renameTrack(path: string, update: TrackUpdate, renameConfig: RenameConfig): Promise<SaveTrackResult> {
    await wait(180);
    let nextPath = path;
    tracks = tracks.map((track) => {
      if (track.path !== path) {
        return track;
      }

      const extension = track.path.includes(".") ? `.${track.path.split(".").pop()}` : "";
      const parts = renameConfig.fields
        .map((field) => String(update[field as keyof TrackUpdate] || "").trim())
        .filter(Boolean);
      const name = parts.join(renameConfig.separator || " - ") || "Track";
      const baseDir = track.path.slice(0, track.path.lastIndexOf("/") + 1);
      nextPath = `${baseDir}${name}${extension}`;
      return {
        ...track,
        id: nextPath,
        path: nextPath,
      };
    });
    return { path: nextPath };
  },

  async getAudioSource(_track: Track): Promise<string> {
    return "";
  },

  async getTrackCoverSource(track: Track): Promise<string | null> {
    await wait(60);
    return track.coverUrl ?? null;
  },

  async getTrackTechnicalInfo(path: string): Promise<TrackTechnicalInfo | null> {
    const extension = path.split(".").pop()?.toUpperCase() || "N/A";
    if (extension === "N/A") {
      return null;
    }
    return {
      format: extension,
      bitrateKbps: extension === "FLAC" ? 980 : 320,
      durationSeconds: 245,
      sampleRateHz: 44100,
      fileSizeBytes: extension === "FLAC" ? 34500000 : 9500000,
      channels: 2,
      bitDepth: extension === "FLAC" ? 24 : 16,
    };
  },

  async searchOnline(query: SearchQuery): Promise<OnlineMatch[]> {
    await wait(450);
    const q = `${query.artist} ${query.title} ${query.album}`.toLowerCase();
    if (!q.trim()) {
      return [];
    }

    return [
      {
        id: "mb-1",
        title: query.title || "Track Match A",
        artist: query.artist || "Unknown Artist",
        album: query.album || "Unknown Album",
        date: "2013-05-17",
        source: "MusicBrainz",
        tracknumber: "1",
        coverUrl: "https://picsum.photos/seed/match-a/500/500",
        releaseId: "release-a",
      },
      {
        id: "mb-2",
        title: query.title || "Track Match B",
        artist: query.artist || "Unknown Artist",
        album: (query.album || "Unknown Album") + " (Deluxe)",
        date: "2014-11-01",
        source: "MusicBrainz",
        tracknumber: "1",
        coverUrl: "https://picsum.photos/seed/match-b/500/500",
        releaseId: "release-b",
      },
      {
        id: "it-1",
        title: query.title || "Track Match C",
        artist: query.artist || "Unknown Artist",
        album: query.album || "Unknown Album",
        date: "2012-09-20",
        source: "iTunes",
        tracknumber: "2",
        coverUrl: "https://picsum.photos/seed/itunes-a/500/500",
      },
    ];
  },

  async connectNavidrome(input: NavidromeConnectionInput): Promise<NavidromeConnectionResult> {
    await wait(250);
    if (!input.baseUrl.trim() || !input.username.trim() || !input.password.trim()) {
      return {
        ok: false,
        message: "Server URL, username and password are required.",
      };
    }
    return {
      ok: true,
      serverVersion: "0.54.0 mock",
      apiVersion: "1.16.1",
      message: `Connected to ${input.name || input.baseUrl}`,
    };
  },

  async scanNavidromeLibrary(input: NavidromeConnectionInput): Promise<ScanResult> {
    await wait(350);
    const serverName = input.name || input.baseUrl || "Navidrome";
    return {
      folderPath: `Navidrome/${serverName}`,
      tracks: tracks.map((track, index) => ({
        ...track,
        id: `navidrome:${input.baseUrl}:${track.id}`,
        path: `Navidrome/${serverName}/${track.artist || "Unknown Artist"}/${track.album || "Unknown Album"}/${String(index + 1).padStart(2, "0")} - ${track.title || "Untitled"}.mp3`,
        source: {
          type: "navidrome",
          baseUrl: input.baseUrl,
          username: input.username,
          password: input.password,
          songId: track.id,
          coverArtId: track.hasCover ? `cover-${track.id}` : undefined,
          suffix: "mp3",
          contentType: "audio/mpeg",
        },
      })),
    };
  },

  async openTrackInFileManager(_path: string): Promise<void> {
    await wait(50);
  },
};
