// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../shell/AppShell";
import { Backdrop } from "../shell/Backdrop";
import { CommandPalette } from "../shell/CommandPalette";
import { useLibraryStore } from "../store/libraryStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import type { Track } from "../types";

const track = (id: string, title: string, artist = "Artist"): Track => ({
  id,
  path: `/m/${id}.mp3`,
  title,
  artist,
  album: "Album",
  tracknumber: "1",
  year: "2020",
  genre: "Rock",
  hasCover: false,
});

beforeEach(() => {
  useUiStore.setState({ activeScreen: "library", isPaletteOpen: false, isImmersive: false, toast: null });
  useSettingsStore.setState({ dynamicBackground: true, backgroundIntensity: 70, colorMode: "light" });
  useLibraryStore.setState({ tracks: [track("1", "Solid Gold", "Battle Tapes"), track("2", "Harbor Lights", "Marlow Vane")], selectedTrackId: "" });
});

afterEach(cleanup);

describe("Backdrop", () => {
  it("shows the cover and scales its strength with the intensity setting", () => {
    useSettingsStore.setState({ backgroundIntensity: 100 });
    const { container } = render(<Backdrop coverUrl="cover.jpg" />);
    const root = container.querySelector(".shell__backdrop") as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("cover.jpg");
    expect(root.style.getPropertyValue("--shell-backdrop-strength")).toBe("1");
  });

  it("falls back to an accent gradient without a cover", () => {
    const { container } = render(<Backdrop />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".shell__backdrop-fallback")).not.toBeNull();
  });

  it("renders nothing when the dynamic background is off", () => {
    useSettingsStore.setState({ dynamicBackground: false });
    const { container } = render(<Backdrop coverUrl="cover.jpg" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("CommandPalette", () => {
  const open = () => act(() => useUiStore.getState().setPaletteOpen(true));

  it("is hidden until opened", () => {
    render(<CommandPalette onTogglePlayPause={() => undefined} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    open();
    expect(screen.getByRole("dialog", { name: "Search and commands" })).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("lists screens and commands, and navigates on Enter", () => {
    render(<CommandPalette onTogglePlayPause={() => undefined} />);
    open();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "playlists" } });
    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain("Playlists");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useUiStore.getState().activeScreen).toBe("dashboard");
    expect(useUiStore.getState().isPaletteOpen).toBe(false);
  });

  it("finds tracks and selects them", () => {
    render(<CommandPalette onTogglePlayPause={() => undefined} />);
    open();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "marlow" } });
    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain("Harbor Lights");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useLibraryStore.getState().selectedTrackId).toBe("2");
    expect(useUiStore.getState().activeScreen).toBe("library");
  });

  it("moves the highlight with the arrow keys and exposes it to assistive tech", () => {
    render(<CommandPalette onTogglePlayPause={() => undefined} />);
    open();
    const input = screen.getByRole("combobox");
    const first = screen.getAllByRole("option")[0];
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(first.id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const second = screen.getAllByRole("option")[1];
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(second.id);
  });

  it("runs the play/pause command and closes on Escape", () => {
    const onToggle = vi.fn();
    render(<CommandPalette onTogglePlayPause={onToggle} />);
    open();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "play" } });
    const play = screen.getAllByRole("option").find((option) => option.querySelector(".shell__palette-label")?.textContent === "Play");
    fireEvent.click(play as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);

    open();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toggles the dynamic background from the palette", () => {
    render(<CommandPalette onTogglePlayPause={() => undefined} />);
    open();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "dynamic" } });
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(useSettingsStore.getState().dynamicBackground).toBe(false);
  });
});

describe("AppShell", () => {
  const renderShell = () =>
    render(
      <AppShell onBrandClick={() => undefined} onTogglePlayPause={() => undefined}>
        <p>Screen content</p>
      </AppShell>
    );

  it("frames the screen with navigation, header and player", () => {
    renderShell();
    const nav = screen.getByRole("navigation");
    expect(within(nav).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Library",
      "Tag Editor",
      "Playlists",
      "Now Playing",
    ]);
    expect(screen.getByRole("heading", { name: "Library" })).toBeTruthy();
    expect(screen.getByRole("contentinfo", { name: "Player" })).toBeTruthy();
    expect(screen.getByText("Screen content")).toBeTruthy();
  });

  it("marks the active screen and switches on click", async () => {
    renderShell();
    const tagEditor = screen.getByRole("button", { name: "Tag Editor" });
    await userEvent.click(tagEditor);
    expect(useUiStore.getState().activeScreen).toBe("tagging");
    expect(tagEditor.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "Tag Editor" })).toBeTruthy();
  });

  it("opens the palette with Ctrl+K", () => {
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(useUiStore.getState().isPaletteOpen).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("ignores full-window mode outside Now Playing", () => {
    renderShell();
    act(() => useUiStore.getState().setImmersive(true));
    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  it("keeps only the content, and the audio element, in immersive mode", () => {
    const { container } = renderShell();
    act(() => useUiStore.getState().setActiveScreen("player"));
    act(() => useUiStore.getState().setImmersive(true));
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.getByText("Screen content")).toBeTruthy();
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("does not render an empty src attribute on the audio element", () => {
    const { container } = renderShell();
    expect(container.querySelector("audio")?.hasAttribute("src")).toBe(false);
  });
});
