import type { MusicAdapter } from "./adapter";
import type {
  AlbumQuery,
  AlbumRelease,
  AlbumSummary,
  Beatmap,
  MediaControlEvent,
  NavidromeConnectionInput,
  NavidromeConnectionResult,
  NowPlayingInfo,
  OnlineMatch,
  RenameConfig,
  SaveTrackResult,
  ScanResult,
  SearchQuery,
  Track,
  TrackTechnicalInfo,
  TrackUpdate,
} from "../types";

/** Offline placeholder artwork: a gradient with a sun, as an SVG data URI. */
function svgCover(from: string, to: string, accent: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="500" height="500" fill="url(#g)"/><circle cx="350" cy="150" r="78" fill="${accent}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const COVERS = [
  svgCover("#1f3a5f", "#4f8fb8", "#f2c14e"),
  svgCover("#6b4a2b", "#d9a066", "#f3e3c3"),
  svgCover("#2b1450", "#e0359b", "#35e0d2"),
  svgCover("#27403b", "#8cb8a4", "#f0e6d2"),
  svgCover("#3d2a4a", "#c27ba0", "#ffd9a8"),
];

// [title, artist, album, year, genre, track, ext, cover index (-1: none)]
const SAMPLE_TRACKS: Array<[string, string, string, string, string, string, string, number]> = [
  ["Harbor Lights", "Marlow Vane", "Night Ferry", "2019", "Indie Rock", "1", "flac", 0],
  ["Salt and Static", "Marlow Vane", "Night Ferry", "2019", "Indie Rock", "2", "flac", 0],
  ["Night Ferry", "Marlow Vane", "Night Ferry", "2019", "Indie Rock", "3", "flac", 0],
  ["Low Tide Radio", "Marlow Vane", "Night Ferry", "2019", "Indie Rock", "4", "flac", 0],
  ["Cedar Road", "Hollow Pines", "Cedar Sessions", "2021", "Folk", "1", "mp3", 1],
  ["Ember Hands", "Hollow Pines", "Cedar Sessions", "2021", "Folk", "2", "mp3", 1],
  ["Slow Thaw", "Hollow Pines", "Cedar Sessions", "2021", "Folk", "3", "mp3", 1],
  ["Paper Lanterns", "Hollow Pines", "Cedar Sessions", "2021", "Folk", "4", "mp3", 1],
  ["Afterimage", "Velvet Circuit", "Neon Tides", "2017", "Electronic", "1", "mp3", 2],
  ["Neon Tides", "Velvet Circuit", "Neon Tides", "2017", "Electronic", "2", "mp3", 2],
  ["Glass Highway", "Velvet Circuit", "Neon Tides", "2017", "Electronic", "3", "mp3", 2],
  ["Quiet Rooms", "Nora Aldous", "Quiet Rooms", "2022", "", "1", "flac", 3],
  ["Morning Hours", "Nora Aldous", "Quiet Rooms", "2022", "", "2", "flac", 3],
  ["Blue Curtain", "Nora Aldous", "Quiet Rooms", "2022", "", "3", "flac", 3],
  ["Greenhouse", "The Glass Orchard", "Greenhouse", "", "Dream Pop", "1", "m4a", -1],
  ["Pale Orchard", "The Glass Orchard", "Greenhouse", "", "Dream Pop", "2", "m4a", -1],
  ["", "", "", "", "", "", "mp3", -1],
  ["Afterimage", "Velvet Circuit", "Neon Tides (copy)", "2017", "Electronic", "1", "mp3", 2],
];

let tracks: Track[] = SAMPLE_TRACKS.map(([title, artist, album, year, genre, tracknumber, ext, cover], index) => {
  const folder = album ? album.replace(" (copy)", "") : "_unsorted";
  const fileName = title ? `${tracknumber.padStart(2, "0")} ${title}.${ext}` : `track_07_final.${ext}`;
  return {
    id: String(index + 1),
    path: `/Music/${artist || "_unsorted"}/${folder}/${fileName}`,
    title,
    artist,
    album,
    tracknumber,
    year,
    genre,
    hasCover: cover >= 0,
    coverUrl: cover >= 0 ? COVERS[cover] : undefined,
    // One sample track a day, the most recent ones last, so "Date added" has something to sort.
    addedAt: Date.UTC(2026, 0, 1) + ((index * 7) % SAMPLE_TRACKS.length) * 86_400_000,
  };
});

const MOCK_RELEASES: AlbumRelease[] = [
  {
    id: "mock-night-ferry",
    title: "Night Ferry",
    artist: "Marlow Vane",
    date: "2019-03-08",
    coverUrl: COVERS[0],
    tracks: [
      { title: "Harbor Lights", artist: "Marlow Vane", number: "1", disc: 1 },
      { title: "Salt & Static", artist: "Marlow Vane", number: "2", disc: 1 },
      { title: "Night Ferry", artist: "Marlow Vane", number: "3", disc: 1 },
      { title: "Low Tide Radio", artist: "Marlow Vane", number: "4", disc: 1 },
      { title: "Lantern Season", artist: "Marlow Vane", number: "5", disc: 1 },
    ],
  },
  {
    id: "mock-night-ferry-deluxe",
    title: "Night Ferry (Deluxe Edition)",
    artist: "Marlow Vane",
    date: "2020-03-06",
    coverUrl: COVERS[2],
    tracks: [
      { title: "Harbor Lights", artist: "Marlow Vane", number: "1", disc: 1 },
      { title: "Salt & Static", artist: "Marlow Vane", number: "2", disc: 1 },
      { title: "Night Ferry", artist: "Marlow Vane", number: "3", disc: 1 },
      { title: "Low Tide Radio", artist: "Marlow Vane", number: "4", disc: 1 },
      { title: "Lantern Season", artist: "Marlow Vane", number: "5", disc: 1 },
      { title: "Harbor Lights (Demo)", artist: "Marlow Vane", number: "1", disc: 2 },
    ],
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let mockToneUrl = "";

/** A short quiet sine tone so playback can be exercised in a plain browser without real audio files. */
function getMockToneUrl(): string {
  if (mockToneUrl) {
    return mockToneUrl;
  }
  const sampleRate = 8000;
  const seconds = 30;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 0.08;
    view.setInt16(44 + index * 2, sample * 32767, true);
  }
  mockToneUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return mockToneUrl;
}

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

  async searchAlbums(query: AlbumQuery): Promise<AlbumSummary[]> {
    await wait(350);
    const needle = `${query.artist} ${query.album}`.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const known = MOCK_RELEASES.filter((release) => needle.split(/\s+/).some((word) => word.length > 2 && `${release.artist} ${release.title}`.toLowerCase().includes(word)));
    return known.map(({ tracks, coverUrl: _cover, ...summary }) => ({ ...summary, trackCount: tracks.length, country: "XW", label: "Sample Records" }));
  },

  async getAlbumRelease(releaseId: string): Promise<AlbumRelease> {
    await wait(300);
    const release = MOCK_RELEASES.find((item) => item.id === releaseId);
    if (!release) {
      throw new Error("Release not found");
    }
    return release;
  },

  async renameFile(path: string, fileName: string): Promise<SaveTrackResult> {
    await wait(120);
    const baseDir = path.slice(0, path.lastIndexOf("/") + 1);
    const nextPath = `${baseDir}${fileName}`;
    tracks = tracks.map((track) => (track.path === path ? { ...track, id: nextPath, path: nextPath } : track));
    return { path: nextPath };
  },

  async getAudioSource(_track: Track): Promise<string> {
    return getMockToneUrl();
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
      // FLAC files of the sample library carry a ReplayGain tag, MP3 ones do not.
      replayGainTrackDb: extension === "FLAC" ? -6.5 : undefined,
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
        coverUrl: COVERS[0],
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
        coverUrl: COVERS[1],
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
        coverUrl: COVERS[2],
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

  // No native media controls in a plain browser: the Media Session API covers it there.
  onMediaControl(_handler: (event: MediaControlEvent) => void): () => void {
    return () => undefined;
  },

  async updateNowPlaying(_info: NowPlayingInfo | null): Promise<void> {},

  async analyzeBeatmap(track: Track, force = false): Promise<Beatmap> {
    await wait(force ? 900 : 500);
    return mockBeatmap(Number(track.id) || 1);
  },
};

/**
 * A believable beatmap for the 30 s mock tone: 120 BPM with kick / snare / hat onsets, a quiet intro,
 * a loud middle and a break, varied a little per track.
 */
function mockBeatmap(seed: number): Beatmap {
  const duration = 30;
  const bpm = 116 + (seed % 5) * 2;
  const beat = 60 / bpm;
  const beats: number[] = [];
  for (let time = 0.4; time < duration - 0.2; time += beat) beats.push(Number(time.toFixed(3)));
  const level = (time: number) => (time < 8 ? 0.3 : time < 22 ? 0.85 : 0.45) + 0.08 * Math.sin(time * 1.7 + seed);
  const onsets: Beatmap["onsets"] = [];
  beats.forEach((time, index) => {
    if (index % 2 === 0) onsets.push({ time, strength: 0.9, band: 0 });
    if (index % 2 === 1 && time > 8) onsets.push({ time, strength: 0.75, band: 1 });
    if (time > 4) onsets.push({ time: Number((time + beat / 2).toFixed(3)), strength: 0.4 + ((index * seed) % 4) / 10, band: 2 });
  });
  const intensityRate = 20;
  const waveformRate = 100;
  return {
    version: 1,
    duration,
    bpm,
    tempoConfidence: 0.62,
    beats,
    onsets,
    intensityRate,
    intensity: Array.from({ length: duration * intensityRate }, (_, i) => Math.min(1, level(i / intensityRate))),
    waveformRate,
    waveform: Array.from({ length: duration * waveformRate }, (_, i) => {
      const time = i / waveformRate;
      const sinceBeat = (time - 0.4) % beat;
      return Math.min(1, level(time) * (0.35 + 0.65 * Math.exp(-sinceBeat * 9)));
    }),
    sections: [
      { start: 0, end: 8, intensity: 0.3 },
      { start: 8, end: 22, intensity: 0.85 },
      { start: 22, end: duration, intensity: 0.45 },
    ],
    decodeMs: 0,
    analysisMs: 0,
    cached: false,
  };
}
