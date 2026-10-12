import { useEffect, useState } from "react";
import { adapter } from "../api";
import type { Track, TrackTechnicalInfo } from "../types";

/** Reads format, bitrate, duration... of a local track; remote (Navidrome) tracks have none. */
export function useTrackTechnicalInfo(track: Track | null): TrackTechnicalInfo | null {
  const [info, setInfo] = useState<TrackTechnicalInfo | null>(null);
  const path = track?.path;
  const isRemote = track?.source?.type === "navidrome";

  useEffect(() => {
    let cancelled = false;
    if (!path || isRemote) {
      setInfo(null);
      return;
    }

    (async () => {
      try {
        const result = await adapter.getTrackTechnicalInfo(path);
        if (!cancelled) {
          setInfo(result);
        }
      } catch {
        if (!cancelled) {
          setInfo(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return info;
}
