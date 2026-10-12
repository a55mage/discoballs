import { useEffect, useState } from "react";
import type { Track } from "../types";
import { fetchLyrics, type LyricLine } from "../utils/lyrics";

export type LyricsState = { lines: LyricLine[]; isSynced: boolean; status: string };

/** Loads lyrics for a track (by id) and exposes them with a human readable status. */
export function useLyrics(track: Track | null): LyricsState {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [status, setStatus] = useState("Select a track to load lyrics.");

  useEffect(() => {
    if (!track) {
      setLines([]);
      setIsSynced(false);
      setStatus("Select a track to load lyrics.");
      return;
    }
    const title = track.title.trim();
    const artist = track.artist.trim();
    if (!title || !artist) {
      setLines([]);
      setIsSynced(false);
      setStatus("Missing title or artist metadata.");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setIsSynced(false);
    setStatus("Loading lyrics...");
    (async () => {
      try {
        const result = await fetchLyrics(title, artist, track.album, controller.signal);
        if (cancelled) {
          return;
        }
        setLines(result.lines);
        setIsSynced(result.isSynced);
        setStatus(result.lines.length ? "" : "No lyrics found.");
      } catch {
        if (cancelled) {
          return;
        }
        setLines([]);
        setIsSynced(false);
        setStatus("Lyrics unavailable for this track.");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [track?.id]);

  return { lines, isSynced, status };
}
