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

export interface MusicAdapter {
  selectFolderAndScan(): Promise<ScanResult>;
  scanFolder(path: string): Promise<ScanResult>;
  pickFolder(): Promise<string | null>;
  saveTrack(
    trackId: string,
    path: string,
    update: TrackUpdate,
    coverUrl?: string,
    renameConfig?: RenameConfig,
    removeCover?: boolean
  ): Promise<SaveTrackResult>;
  renameTrack(path: string, update: TrackUpdate, renameConfig: RenameConfig): Promise<SaveTrackResult>;
  getAudioSource(track: Track): Promise<string>;
  getTrackTechnicalInfo(path: string): Promise<TrackTechnicalInfo | null>;
  getTrackCoverSource(track: Track): Promise<string | null>;
  searchOnline(query: SearchQuery): Promise<OnlineMatch[]>;
  connectNavidrome(input: NavidromeConnectionInput): Promise<NavidromeConnectionResult>;
  scanNavidromeLibrary(input: NavidromeConnectionInput): Promise<ScanResult>;
  openTrackInFileManager(path: string): Promise<void>;
}
