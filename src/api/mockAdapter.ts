import type { MusicAdapter } from "./adapter";
import type { OnlineMatch, ScanResult, SearchQuery, Track, TrackUpdate } from "../types";

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

  async saveTrack(trackId: string, _path: string, update: TrackUpdate, coverUrl?: string): Promise<void> {
    await wait(200);
    tracks = tracks.map((track) => {
      if (track.id !== trackId) {
        return track;
      }
      return {
        ...track,
        ...update,
        coverUrl: coverUrl ?? track.coverUrl,
        hasCover: Boolean(coverUrl ?? track.coverUrl),
      };
    });
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
};
