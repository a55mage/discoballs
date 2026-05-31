export type LyricLine = {
  timeSec?: number;
  text: string;
};

type LrclibPayload = {
  syncedLyrics?: string;
  plainLyrics?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
};

export function parseSyncedLyrics(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const rows = lrc.split(/\r?\n/);
  for (const row of rows) {
    const text = row.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) {
      continue;
    }
    const timeTags = [...row.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!timeTags.length) {
      continue;
    }
    for (const tag of timeTags) {
      const min = Number(tag[1] || 0);
      const sec = Number(tag[2] || 0);
      const fracRaw = tag[3] || "0";
      const frac = fracRaw.length === 3 ? Number(fracRaw) / 1000 : Number(fracRaw) / 100;
      const timeSec = min * 60 + sec + frac;
      lines.push({ timeSec, text });
    }
  }
  return lines.sort((a, b) => (a.timeSec ?? 0) - (b.timeSec ?? 0));
}

export function parsePlainLyrics(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line }));
}

export function getActiveLyricIndex(lines: LyricLine[], currentTimeSec: number): number {
  if (!lines.length) {
    return -1;
  }
  const hasTimestamps = lines.some((line) => Number.isFinite(line.timeSec));
  if (!hasTimestamps) {
    return -1;
  }
  let activeIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const lineTime = lines[index].timeSec;
    if (!Number.isFinite(lineTime)) {
      continue;
    }
    if ((lineTime as number) <= currentTimeSec) {
      activeIndex = index;
    } else {
      break;
    }
  }
  return activeIndex;
}

export async function fetchLyrics(
  trackTitle: string,
  trackArtist: string,
  trackAlbum: string,
  signal?: AbortSignal
): Promise<{ lines: LyricLine[]; isSynced: boolean }> {
  const title = trackTitle.trim();
  const artist = trackArtist.trim();
  if (!title || !artist) {
    return { lines: [], isSynced: false };
  }
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  });
  if (trackAlbum.trim()) {
    params.set("album_name", trackAlbum.trim());
  }
  const directPayload = await fetchPayload(`https://lrclib.net/api/get?${params.toString()}`, signal);
  const directResult = parseLyricsPayload(directPayload);
  if (directResult.lines.length) {
    return directResult;
  }

  const searchPayload = await fetchPayload(`https://lrclib.net/api/search?${params.toString()}`, signal);
  if (Array.isArray(searchPayload)) {
    const normalizedTitle = normalizeText(title);
    const normalizedArtist = normalizeText(artist);
    const sortedCandidates = [...searchPayload].sort((a, b) => {
      const aScore = scoreCandidate(a, normalizedTitle, normalizedArtist);
      const bScore = scoreCandidate(b, normalizedTitle, normalizedArtist);
      return bScore - aScore;
    });
    for (const item of sortedCandidates) {
      const result = parseLyricsPayload(item);
      if (result.lines.length) {
        return result;
      }
    }
  }

  return { lines: [], isSynced: false };
}

function parseLyricsPayload(payload: unknown): { lines: LyricLine[]; isSynced: boolean } {
  if (!payload || typeof payload !== "object") {
    return { lines: [], isSynced: false };
  }
  const typed = payload as LrclibPayload;
  const syncedLyrics = typeof typed.syncedLyrics === "string" ? typed.syncedLyrics.trim() : "";
  if (syncedLyrics) {
    const parsed = parseSyncedLyrics(syncedLyrics);
    if (parsed.length) {
      return { lines: parsed, isSynced: true };
    }
  }
  const plainLyrics = typeof typed.plainLyrics === "string" ? typed.plainLyrics.trim() : "";
  if (!plainLyrics) {
    return { lines: [], isSynced: false };
  }
  return { lines: parsePlainLyrics(plainLyrics), isSynced: false };
}

async function fetchPayload(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreCandidate(payload: unknown, normalizedTitle: string, normalizedArtist: string): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  const typed = payload as LrclibPayload;
  const title = normalizeText(typeof typed.trackName === "string" ? typed.trackName : "");
  const artist = normalizeText(typeof typed.artistName === "string" ? typed.artistName : "");
  let score = 0;
  if (title && normalizedTitle && (title.includes(normalizedTitle) || normalizedTitle.includes(title))) {
    score += 2;
  }
  if (artist && normalizedArtist && (artist.includes(normalizedArtist) || normalizedArtist.includes(artist))) {
    score += 2;
  }
  if (typeof typed.syncedLyrics === "string" && typed.syncedLyrics.trim()) {
    score += 1;
  }
  return score;
}
