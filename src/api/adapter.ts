import type { OnlineMatch, ScanResult, SearchQuery, TrackUpdate } from "../types";

export interface MusicAdapter {
  selectFolderAndScan(): Promise<ScanResult>;
  saveTrack(trackId: string, path: string, update: TrackUpdate, coverUrl?: string): Promise<void>;
  searchOnline(query: SearchQuery): Promise<OnlineMatch[]>;
}
