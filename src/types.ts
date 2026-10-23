export type NavidromeTrackSource = {
  type: "navidrome";
  baseUrl: string;
  username: string;
  password: string;
  songId: string;
  coverArtId?: string;
  suffix?: string;
  contentType?: string;
};

export type Track = {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  tracknumber: string;
  year: string;
  genre: string;
  hasCover: boolean;
  coverUrl?: string;
  source?: NavidromeTrackSource;
  /** When the track entered the library (file creation time, or the server's date), ms since the epoch. */
  addedAt?: number;
};

export type TrackTechnicalInfo = {
  format: string;
  bitrateKbps?: number;
  durationSeconds?: number;
  sampleRateHz?: number;
  fileSizeBytes?: number;
  channels?: number;
  bitDepth?: number;
  /** ReplayGain gains stored in the file tags, in dB. */
  replayGainTrackDb?: number;
  replayGainAlbumDb?: number;
};

export type OnlineMatch = {
  id: string;
  title: string;
  artist: string;
  album: string;
  date: string;
  source?: string;
  tracknumber?: string;
  coverUrl?: string;
  releaseId?: string;
};

export type TrackUpdate = Pick<
  Track,
  "title" | "artist" | "album" | "tracknumber" | "year" | "genre"
>;

export type RenameField = "tracknumber" | "artist" | "album" | "title" | "year" | "genre";

export type RenameConfig = {
  fields: RenameField[];
  separator: string;
};

export type SearchQuery = {
  title: string;
  artist: string;
  album: string;
};

export type NavidromeConnectionInput = {
  name: string;
  baseUrl: string;
  username: string;
  password: string;
};

export type NavidromeConnectionResult = {
  ok: boolean;
  serverVersion?: string;
  apiVersion?: string;
  message?: string;
};

export type NavidromeBookmark = NavidromeConnectionInput & {
  id: string;
  connectOnOpen: boolean;
  lastConnectedAt?: string;
};

export type ScanResult = {
  folderPath: string;
  tracks: Track[];
};

export type SaveTrackResult = {
  path: string;
};

export type AppScreen = "tagging" | "library" | "dashboard" | "settings" | "player" | "beatmap";
export type StartupScreen = "tagging" | "library" | "dashboard" | "player";

export type AlbumQuery = { artist: string; album: string };

/** A release found online, before its tracks are loaded. */
export type AlbumSummary = {
  id: string;
  title: string;
  artist: string;
  date: string;
  country?: string;
  label?: string;
  disambiguation?: string;
  trackCount: number;
};

export type AlbumTrack = {
  title: string;
  artist: string;
  /** Position inside its disc ("1", "A1"…). */
  number: string;
  disc: number;
  lengthMs?: number;
};

export type AlbumRelease = {
  id: string;
  title: string;
  artist: string;
  date: string;
  tracks: AlbumTrack[];
  coverUrl?: string;
};

/** A command from the system's media controls (media keys, headphones, Control Center). */
export type MediaControlAction = "play" | "pause" | "toggle" | "next" | "previous" | "seek";
export type MediaControlEvent = { action: MediaControlAction; position?: number | null };

/** What the system's Now Playing shows. */
export type NowPlayingInfo = { title: string; artist: string; album: string; duration: number; position: number; playing: boolean };

/** A sudden change of the sound in one band: a candidate note or block for the rhythm game. */
export type BeatmapOnset = {
  time: number;
  /** 0…1, relative to the strongest onsets of the track. */
  strength: number;
  /** 0 low (kick, bass), 1 mid (snare, voice), 2 high (hats, cymbals). */
  band: 0 | 1 | 2;
};

export type BeatmapSection = { start: number; end: number; intensity: number };

/** What the analysis of a whole track finds (see src-tauri/src/beatmap.rs). Times are in seconds. */
export type Beatmap = {
  version: number;
  duration: number;
  bpm: number;
  /** 0…1: how clearly the pulse stands out. */
  tempoConfidence: number;
  beats: number[];
  onsets: BeatmapOnset[];
  /** Loudness over time, 0…1, `intensityRate` values per second. */
  intensityRate: number;
  intensity: number[];
  /** Peak level, 0…1, `waveformRate` values per second. */
  waveformRate: number;
  waveform: number[];
  sections: BeatmapSection[];
  decodeMs: number;
  analysisMs: number;
  cached: boolean;
};
