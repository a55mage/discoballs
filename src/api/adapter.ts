import type { OnlineMatch, RenameConfig, SaveTrackResult, ScanResult, SearchQuery, TrackUpdate } from "../types";

export interface MusicAdapter {
  selectFolderAndScan(): Promise<ScanResult>;
  saveTrack(
    trackId: string,
    path: string,
    update: TrackUpdate,
    coverUrl?: string,
    renameConfig?: RenameConfig
  ): Promise<SaveTrackResult>;
  renameTrack(path: string, update: TrackUpdate, renameConfig: RenameConfig): Promise<SaveTrackResult>;
  getAudioSource(path: string): Promise<string>;
  searchOnline(query: SearchQuery): Promise<OnlineMatch[]>;
}
