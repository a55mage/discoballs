import { beforeEach, describe, expect, it, vi } from "vitest";

const playNextTrack = vi.fn(async () => undefined);
const playPreviousTrack = vi.fn(async () => undefined);
const seekTo = vi.fn();
vi.mock("../actions/playback", () => ({
  playNextTrack: () => playNextTrack(),
  playPreviousTrack: () => playPreviousTrack(),
  seekTo: (value: number) => seekTo(value),
}));

import { resetMediaControlRepeat, runMediaControl } from "../actions/mediaControls";
import { audioRef } from "../audio/audioRef";
import { usePlayerStore } from "../store/playerStore";

describe("runMediaControl", () => {
  const toggle = vi.fn();
  beforeEach(() => {
    toggle.mockClear();
    playNextTrack.mockClear();
    playPreviousTrack.mockClear();
    seekTo.mockClear();
    resetMediaControlRepeat();
    usePlayerStore.setState({ isPlaying: false });
  });

  it("plays and pauses only when needed, toggles always", () => {
    runMediaControl({ action: "pause" }, toggle, 0);
    expect(toggle).not.toHaveBeenCalled();
    runMediaControl({ action: "play" }, toggle, 1000);
    expect(toggle).toHaveBeenCalledTimes(1);
    usePlayerStore.setState({ isPlaying: true });
    runMediaControl({ action: "play" }, toggle, 2000);
    expect(toggle).toHaveBeenCalledTimes(1);
    runMediaControl({ action: "toggle" }, toggle, 3000);
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("goes to the next and previous track and seeks", () => {
    runMediaControl({ action: "next" }, toggle, 0);
    runMediaControl({ action: "previous" }, toggle, 1000);
    expect(playNextTrack).toHaveBeenCalledTimes(1);
    expect(playPreviousTrack).toHaveBeenCalledTimes(1);
    audioRef.current = {} as HTMLAudioElement;
    runMediaControl({ action: "seek", position: 42 }, toggle, 2000);
    runMediaControl({ action: "seek", position: -3 }, toggle, 2010);
    expect(seekTo.mock.calls).toEqual([[42], [0]]);
    audioRef.current = null;
  });

  it("ignores the same key arriving twice (webview and native)", () => {
    runMediaControl({ action: "toggle" }, toggle, 5000);
    runMediaControl({ action: "toggle" }, toggle, 5100);
    expect(toggle).toHaveBeenCalledTimes(1);
    runMediaControl({ action: "toggle" }, toggle, 5600);
    expect(toggle).toHaveBeenCalledTimes(2);
    runMediaControl({ action: "next" }, toggle, 5650);
    expect(playNextTrack).toHaveBeenCalledTimes(1);
  });
});
