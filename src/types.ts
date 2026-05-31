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
};

export type TrackTechnicalInfo = {
  format: string;
  bitrateKbps?: number;
  durationSeconds?: number;
  sampleRateHz?: number;
  fileSizeBytes?: number;
  channels?: number;
  bitDepth?: number;
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
