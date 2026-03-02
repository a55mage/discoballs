import type { OnlineMatch, RenameConfig, SaveTrackResult, ScanResult, SearchQuery, TrackTechnicalInfo, TrackUpdate } from "../types";

export interface MusicAdapter {
  selectFolderAndScan(): Promise<ScanResult>;
  saveTrack(
    trackId: string,
    path: string,
    update: TrackUpdate,
    coverUrl?: string,
    renameConfig?: RenameConfig,
    removeCover?: boolean
  ): Promise<SaveTrackResult>;
  renameTrack(path: string, update: TrackUpdate, renameConfig: RenameConfig): Promise<SaveTrackResult>;
  getAudioSource(path: string): Promise<string>;
  getTrackTechnicalInfo(path: string): Promise<TrackTechnicalInfo | null>;
  searchOnline(query: SearchQuery): Promise<OnlineMatch[]>;
  openTrackInFileManager(path: string): Promise<void>;
}
