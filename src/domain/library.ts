import type { Track } from "../types";
import { normalizeGenreKey } from "../utils/appHelpers";

export type LibraryArtistSummary = {
  id: string;
  name: string;
  trackCount: number;
  albumCount: number;
  coverUrl?: string;
};

export type LibraryAlbumSummary = {
  id: string;
  title: string;
  artist: string;
  year: string;
  trackCount: number;
  coverUrl?: string;
};

export type LibraryGenre = { key: string; label: string };

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

export function summarizeGenres(tracks: Track[]): LibraryGenre[] {
  const genreMap = new Map<string, string>();
  for (const track of tracks) {
    const rawGenre = String(track.genre || "").trim();
    if (!rawGenre) {
      continue;
    }
    const genreKey = normalizeGenreKey(rawGenre);
    if (!genreKey || genreMap.has(genreKey)) {
      continue;
    }
    genreMap.set(genreKey, rawGenre);
  }
  return [...genreMap.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => byName(a.label, b.label));
}

export function summarizeArtists(tracks: Track[]): LibraryArtistSummary[] {
  const artists = new Map<string, { name: string; trackCount: number; albums: Set<string>; coverUrl?: string }>();
  for (const track of tracks) {
    const name = track.artist.trim() || "Unknown artist";
    const key = name.toLowerCase();
    const artist = artists.get(key) ?? { name, trackCount: 0, albums: new Set<string>(), coverUrl: undefined };
    artist.trackCount += 1;
    artist.albums.add((track.album.trim() || "Unknown album").toLowerCase());
    if (!artist.coverUrl && track.coverUrl) {
      artist.coverUrl = track.coverUrl;
    }
    artists.set(key, artist);
  }
  return [...artists.entries()]
    .map(([id, artist]) => ({
      id,
      name: artist.name,
      trackCount: artist.trackCount,
      albumCount: artist.albums.size,
      coverUrl: artist.coverUrl,
    }))
    .sort((a, b) => byName(a.name, b.name));
}

export function summarizeAlbums(tracks: Track[]): LibraryAlbumSummary[] {
  const albums = new Map<string, { title: string; artist: string; year: string; trackCount: number; coverUrl?: string }>();
  for (const track of tracks) {
    const title = track.album.trim() || "Unknown album";
    const artist = track.artist.trim() || "Unknown artist";
    const key = `${artist.toLowerCase()}|${title.toLowerCase()}`;
    const album = albums.get(key) ?? { title, artist, year: track.year, trackCount: 0, coverUrl: undefined };
    album.trackCount += 1;
    if (!album.year && track.year) {
      album.year = track.year;
    }
    if (!album.coverUrl && track.coverUrl) {
      album.coverUrl = track.coverUrl;
    }
    albums.set(key, album);
  }
  return [...albums.entries()]
    .map(([id, album]) => ({
      id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      trackCount: album.trackCount,
      coverUrl: album.coverUrl,
    }))
    .sort((a, b) => byName(a.artist, b.artist) || byName(a.title, b.title));
}
