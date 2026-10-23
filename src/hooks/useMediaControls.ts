import { useEffect, useRef } from "react";
import { adapter } from "../api";
import { audioRef } from "../audio/audioRef";
import { runMediaControl } from "../actions/mediaControls";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import type { MediaControlAction } from "../types";

/**
 * Media keys and system controls, on every platform:
 * - the webview's Media Session API (Windows WebView2, Linux, browsers; also the track in the system's media flyout);
 * - native macOS controls (`media_controls.rs`), since WebKit does not take over the keys for audio routed through
 *   the Web Audio graph. The current track is mirrored to both.
 */
export function useMediaControls(togglePlayPause: () => void): void {
  const toggleRef = useRef(togglePlayPause);
  toggleRef.current = togglePlayPause;

  const playbackTrackId = usePlayerStore((state) => state.playbackTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const duration = usePlayerStore((state) => state.duration);
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === playbackTrackId));

  // Commands: native events and Media Session handlers lead to the same actions.
  useEffect(() => {
    const run = (action: MediaControlAction, position?: number) => runMediaControl({ action, position }, () => toggleRef.current());
    const stopNative = adapter.onMediaControl((event) => runMediaControl(event, () => toggleRef.current()));

    const session = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => run("play")],
      ["pause", () => run("pause")],
      ["stop", () => run("pause")],
      ["previoustrack", () => run("previous")],
      ["nexttrack", () => run("next")],
      ["seekto", (details) => run("seek", details.seekTime)],
      ["seekbackward", (details) => run("seek", (audioRef.current?.currentTime ?? 0) - (details.seekOffset ?? 10))],
      ["seekforward", (details) => run("seek", (audioRef.current?.currentTime ?? 0) + (details.seekOffset ?? 10))],
    ];
    for (const [action, handler] of handlers) {
      try {
        session?.setActionHandler(action, handler);
      } catch {
        // Not every webview knows every action.
      }
    }
    return () => {
      stopNative();
      for (const [action] of handlers) {
        try {
          session?.setActionHandler(action, null);
        } catch {
          // Ignore.
        }
      }
    };
  }, []);

  // What the system shows: title, artist, album, cover, playing or paused, and the position.
  useEffect(() => {
    const session = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    const audio = audioRef.current;
    const publish = () => {
      const position = audio?.currentTime ?? 0;
      if (session) {
        try {
          session.metadata =
            track && typeof MediaMetadata !== "undefined"
              ? new MediaMetadata({
                  title: track.title || "Untitled",
                  artist: track.artist,
                  album: track.album,
                  artwork: track.coverUrl ? [{ src: track.coverUrl }] : [],
                })
              : null;
          session.playbackState = !track ? "none" : isPlaying ? "playing" : "paused";
          if (track && duration > 0) {
            session.setPositionState?.({ duration, position: Math.min(position, duration), playbackRate: 1 });
          }
        } catch {
          // A webview without parts of the API: the keys still work through the handlers.
        }
      }
      void adapter
        .updateNowPlaying(
          track
            ? { title: track.title || "Untitled", artist: track.artist, album: track.album, duration: duration || 0, position, playing: isPlaying }
            : null
        )
        .catch(() => undefined);
    };
    publish();
    // A seek moves the position the system extrapolates from.
    audio?.addEventListener("seeked", publish);
    return () => audio?.removeEventListener("seeked", publish);
  }, [track, isPlaying, duration]);
}
