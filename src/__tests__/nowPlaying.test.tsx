// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const fetchLyrics = vi.fn(async () => ({ lines: [] as Array<{ timeSec?: number; text: string }>, isSynced: false }));
vi.mock("../utils/lyrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/lyrics")>()),
  fetchLyrics: () => fetchLyrics(),
}));
vi.mock("../api", () => ({
  adapter: { getAudioSource: async () => "", getTrackTechnicalInfo: async () => null, getTrackCoverSource: async () => null },
}));
vi.mock("../screens/nowPlaying/Visualizer", () => ({ Visualizer: ({ preset }: { preset: string }) => <div data-testid="visualizer">{preset}</div> }));

import { LyricsView } from "../screens/nowPlaying/LyricsView";
import { NowPlayingScreen } from "../screens/nowPlaying/NowPlayingScreen";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";

const track = (id: string, title: string): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title,
  artist: "Artist",
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: true,
  coverUrl: "c.jpg",
});

beforeEach(() => {
  fetchLyrics.mockClear();
  useLibraryStore.setState({ tracks: [track("1", "First"), track("2", "Second"), track("3", "Third")], selectedTrackId: "1" });
  usePlayerStore.setState({
    playbackTrackId: "1",
    playbackQueueTrackIds: ["1", "2", "3"],
    playbackHistoryTrackIds: [],
    playerQueueVisibleCount: 50,
    isPlaying: false,
    currentTime: 0,
    duration: 100,
  });
  useSettingsStore.setState({ nowPlayingShow: ["cover", "lyrics"], nowPlayingQueue: true, playerVisualizerPresetId: "scope" });
  useUiStore.setState({ isImmersive: false, activeScreen: "player" });
});

afterEach(cleanup);

describe("NowPlayingScreen", () => {
  it("explains itself when nothing is selected", () => {
    useLibraryStore.setState({ tracks: [], selectedTrackId: "" });
    usePlayerStore.setState({ playbackTrackId: "" });
    render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Nothing playing yet" })).toBeTruthy();
  });

  it("shows the parts chosen in the settings", () => {
    const { container } = render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    expect(container.querySelector(".np__cover")).not.toBeNull();
    expect(container.querySelector(".np__lyrics")).not.toBeNull();
    expect(container.querySelector(".np__viz")).toBeNull();
    expect(container.querySelector(".np--parts-2")).not.toBeNull();
  });

  it("lets cover, lyrics and visualizer be combined, but never all hidden", () => {
    const { container } = render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    const group = screen.getByRole("group", { name: "Show in Now Playing" });
    fireEvent.click(within(group).getByRole("button", { name: "Visualizer" }));
    expect(container.querySelector(".np__viz")).not.toBeNull();
    expect(useSettingsStore.getState().nowPlayingShow).toEqual(["cover", "lyrics", "viz"]);
    expect(container.querySelector(".np--parts-3")).not.toBeNull();

    fireEvent.click(within(group).getByRole("button", { name: "Cover" }));
    fireEvent.click(within(group).getByRole("button", { name: "Lyrics" }));
    expect(useSettingsStore.getState().nowPlayingShow).toEqual(["viz"]);
    fireEvent.click(within(group).getByRole("button", { name: "Visualizer" }));
    expect(useSettingsStore.getState().nowPlayingShow).toEqual(["viz"]);
  });

  it("only offers the visualizer types while the visualizer is shown", () => {
    useSettingsStore.setState({ nowPlayingShow: ["viz"] });
    render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    expect(screen.getByTestId("visualizer").textContent).toBe("scope");
    fireEvent.change(screen.getByRole("combobox", { name: "Visualizer type" }), { target: { value: "tunnel" } });
    expect(screen.getByTestId("visualizer").textContent).toBe("tunnel");
  });

  it("shows and hides the queue", () => {
    render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    expect(screen.getByRole("complementary", { name: "Queue" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide queue" }));
    expect(screen.queryByRole("complementary", { name: "Queue" })).toBeNull();
    expect(useSettingsStore.getState().nowPlayingQueue).toBe(false);
  });

  it("marks the current track in the queue and removes tracks from it", () => {
    render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    const queue = screen.getByRole("complementary", { name: "Queue" });
    const items = within(queue).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].className).toContain("is-current");
    fireEvent.click(within(queue).getByRole("button", { name: "Remove Third from the queue" }));
    expect(usePlayerStore.getState().playbackQueueTrackIds).toEqual(["1", "2"]);
  });

  it("goes full window, hides the queue, shows the controls and leaves with the button or Escape", () => {
    render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Full window" }));
    expect(useUiStore.getState().isImmersive).toBe(true);
    expect(screen.queryByRole("complementary", { name: "Queue" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(useUiStore.getState().isImmersive).toBe(false);
  });

  it("asks for lyrics of the track in use", () => {
    render(<NowPlayingScreen onTogglePlayPause={() => undefined} />);
    expect(fetchLyrics).toHaveBeenCalledTimes(1);
  });
});

describe("LyricsView", () => {
  const lines = [
    { timeSec: 0, text: "One" },
    { timeSec: 10, text: "Two" },
    { timeSec: 20, text: "Three" },
  ];

  it("shows the status when there are no lyrics", () => {
    render(<LyricsView lines={[]} activeIndex={-1} synced={false} status="No lyrics found." onSeek={() => undefined} />);
    expect(screen.getByText("No lyrics found.")).toBeTruthy();
  });

  it("marks the line being sung and seeks when a line is clicked", () => {
    const onSeek = vi.fn();
    render(<LyricsView lines={lines} activeIndex={1} synced status="" onSeek={onSeek} />);
    const active = screen.getByText("Two").closest("li") as HTMLElement;
    expect(active.getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("One").closest("li")?.className).toContain("is-near");
    fireEvent.click(screen.getByRole("button", { name: "Three" }));
    expect(onSeek).toHaveBeenCalledWith(20);
  });

  it("shows plain lyrics as text, without seeking", () => {
    render(<LyricsView lines={[{ text: "Just words" }]} activeIndex={-1} synced={false} status="" onSeek={() => undefined} />);
    expect(screen.getByText("Just words")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Just words" })).toBeNull();
  });
});
