import { audioRef } from "../audio/audioRef";
import { usePlayerStore } from "../store/playerStore";
import type { MediaControlEvent } from "../types";
import { playNextTrack, playPreviousTrack, seekTo } from "./playback";

/**
 * The same key press can arrive twice: once through the webview's Media Session and once through the native
 * macOS controls. A repeat of the same command this soon is dropped.
 */
const REPEAT_WINDOW_MS = 300;
let last = { action: "", at: -Infinity };

/** Runs a command from the system's media controls (keys, headphones, Control Center, Now Playing). */
export function runMediaControl(event: MediaControlEvent, togglePlayPause: () => void, now = performance.now()): void {
  if (event.action !== "seek" && event.action === last.action && now - last.at < REPEAT_WINDOW_MS) {
    return;
  }
  last = { action: event.action, at: now };
  const { isPlaying } = usePlayerStore.getState();
  switch (event.action) {
    case "play":
      if (!isPlaying) togglePlayPause();
      break;
    case "pause":
      if (isPlaying) togglePlayPause();
      break;
    case "toggle":
      togglePlayPause();
      break;
    case "next":
      void playNextTrack();
      break;
    case "previous":
      void playPreviousTrack();
      break;
    case "seek":
      if (typeof event.position === "number" && Number.isFinite(event.position) && audioRef.current) {
        seekTo(Math.max(0, event.position));
      }
      break;
  }
}

/** Forgets the last command (tests). */
export function resetMediaControlRepeat(): void {
  last = { action: "", at: -Infinity };
}
