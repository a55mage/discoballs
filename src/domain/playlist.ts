export type PlaylistEntry = { id: string; trackId: string };
export type Playlist = { id: string; name: string; entries: PlaylistEntry[] };

export function shuffleTrackIds(trackIds: string[]): string[] {
  const shuffled = [...trackIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = current;
  }
  return shuffled;
}

export function buildPlaylistQueueOrder(trackIds: string[], shuffleEnabled: boolean, startTrackId?: string): string[] {
  const normalizedTrackIds = trackIds.filter((trackId, index) => trackId && trackIds.indexOf(trackId) === index);
  if (!normalizedTrackIds.length) {
    return [];
  }
  const startId = startTrackId && normalizedTrackIds.includes(startTrackId) ? startTrackId : normalizedTrackIds[0];
  if (!startId) {
    return normalizedTrackIds;
  }
  const remainingTrackIds = normalizedTrackIds.filter((trackId) => trackId !== startId);
  if (shuffleEnabled) {
    return [startId, ...shuffleTrackIds(remainingTrackIds)];
  }
  const startIndex = normalizedTrackIds.indexOf(startId);
  return normalizedTrackIds.slice(startIndex);
}

export function buildLibraryQueueOrder(trackIds: string[], startTrackId: string): string[] {
  const startIndex = trackIds.findIndex((trackId) => trackId === startTrackId);
  if (startIndex < 0) {
    return [];
  }
  return trackIds.slice(startIndex);
}

export function areTrackIdListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((trackId, index) => trackId === right[index]);
}

export function normalizePlaylistName(value: string): string {
  return value.trim().toLowerCase();
}

export function buildUniquePlaylistName(playlists: Playlist[], baseName: string, excludeId?: string): string {
  const fallbackBase = baseName.trim() || "New Playlist";
  const usedNames = new Set(
    playlists
      .filter((playlist) => playlist.id !== excludeId)
      .map((playlist) => normalizePlaylistName(playlist.name))
  );
  if (!usedNames.has(normalizePlaylistName(fallbackBase))) {
    return fallbackBase;
  }
  let index = 2;
  while (usedNames.has(normalizePlaylistName(`${fallbackBase} (${index})`))) {
    index += 1;
  }
  return `${fallbackBase} (${index})`;
}
