// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const getTrackTechnicalInfo = vi.fn(async (_path: string) => ({ format: "FLAC", replayGainTrackDb: -6.5 }) as { format: string; replayGainTrackDb?: number } | null);
const gainSetTarget = vi.fn();
const graph = {
  context: { currentTime: 0, state: "running", resume: async () => undefined },
  normalizeGain: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: gainSetTarget } },
  outputGain: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
};
vi.mock("../api", () => ({
  adapter: { getTrackTechnicalInfo: (path: string) => getTrackTechnicalInfo(path), getAudioSource: async () => "blob:x" },
}));
vi.mock("../utils/audioGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/audioGraph")>()),
  getOrCreateMediaAudioGraph: () => graph,
  applyEqualizerSettings: () => undefined,
}));

import { audioRef } from "../audio/audioRef";
import { usePlaybackEngine } from "../hooks/usePlaybackEngine";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { useSettingsStore } from "../store/settingsStore";
import { applyNormalization, replayGainToLinear } from "../utils/audioGraph";

const track = (id: string, patch: Partial<Track> = {}): Track => ({
  id,
  path: `/m/${id}.flac`,
  title: id,
  artist: "A",
  album: "B",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: false,
  ...patch,
});

function Engine() {
  usePlaybackEngine();
  return null;
}

beforeEach(() => {
  getTrackTechnicalInfo.mockClear();
  gainSetTarget.mockClear();
  audioRef.current = document.createElement("audio");
  useLibraryStore.setState({ tracks: [track("1"), track("2", { source: { type: "navidrome", baseUrl: "u", username: "u", password: "p", songId: "s" } })], selectedTrackId: "" });
  usePlayerStore.setState({ playbackTrackId: "", replayGainDb: null });
  useSettingsStore.setState({ audioNormalizeVolume: false });
});

afterEach(() => {
  cleanup();
  audioRef.current = null;
});

describe("replayGainToLinear", () => {
  it("converts dB to a linear gain, caps boosts and ignores missing values", () => {
    expect(replayGainToLinear(0)).toBeCloseTo(1);
    expect(replayGainToLinear(-6)).toBeCloseTo(0.501, 2);
    expect(replayGainToLinear(12)).toBeCloseTo(replayGainToLinear(6));
    expect(replayGainToLinear(null)).toBe(1);
    expect(replayGainToLinear(undefined)).toBe(1);
    expect(replayGainToLinear(Number.NaN)).toBe(1);
  });

  it("applies the gain to the graph", () => {
    applyNormalization(graph as never, -6);
    expect(gainSetTarget.mock.calls[0][0]).toBeCloseTo(0.501, 2);
  });
});

describe("normalization while playing", () => {
  it("does nothing while the setting is off", async () => {
    render(<Engine />);
    await act(async () => usePlayerStore.setState({ playbackTrackId: "1" }));
    expect(getTrackTechnicalInfo).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().replayGainDb).toBeNull();
  });

  it("reads the ReplayGain of the playing track and applies it", async () => {
    useSettingsStore.setState({ audioNormalizeVolume: true });
    render(<Engine />);
    await act(async () => usePlayerStore.setState({ playbackTrackId: "1" }));
    await vi.waitFor(() => expect(usePlayerStore.getState().replayGainDb).toBe(-6.5));
    await vi.waitFor(() => expect(gainSetTarget.mock.calls.some((call) => Math.abs(call[0] - replayGainToLinear(-6.5)) < 1e-6)).toBe(true));
  });

  it("leaves tracks without a tag, and remote tracks, untouched", async () => {
    useSettingsStore.setState({ audioNormalizeVolume: true });
    getTrackTechnicalInfo.mockResolvedValueOnce({ format: "MP3" });
    render(<Engine />);
    await act(async () => usePlayerStore.setState({ playbackTrackId: "1" }));
    await vi.waitFor(() => expect(getTrackTechnicalInfo).toHaveBeenCalled());
    expect(usePlayerStore.getState().replayGainDb).toBeNull();

    getTrackTechnicalInfo.mockClear();
    await act(async () => usePlayerStore.setState({ playbackTrackId: "2", replayGainDb: -3 }));
    expect(getTrackTechnicalInfo).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(usePlayerStore.getState().replayGainDb).toBeNull());
  });

  it("goes back to unity gain when the setting is turned off", async () => {
    useSettingsStore.setState({ audioNormalizeVolume: true });
    render(<Engine />);
    await act(async () => usePlayerStore.setState({ playbackTrackId: "1" }));
    await vi.waitFor(() => expect(usePlayerStore.getState().replayGainDb).toBe(-6.5));
    gainSetTarget.mockClear();
    await act(async () => useSettingsStore.setState({ audioNormalizeVolume: false }));
    await vi.waitFor(() => expect(gainSetTarget.mock.calls[gainSetTarget.mock.calls.length - 1]?.[0]).toBeCloseTo(1));
  });
});
