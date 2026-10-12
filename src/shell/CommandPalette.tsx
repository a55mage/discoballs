import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { scanLibraryWithPicker, selectTrack } from "../actions/library";
import { undoLast, undoWithToast } from "../actions/history";
import { playNextTrack, playPreviousTrack } from "../actions/playback";
import { useFavoritesStore } from "../store/favoritesStore";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { Badge, cx } from "../ui";
import { SCREENS } from "./screens";

type PaletteItem = {
  id: string;
  kind: "Go to" | "Command" | "Track";
  label: string;
  hint?: string;
  run: () => void;
};

const MAX_TRACK_RESULTS = 8;

type CommandPaletteProps = {
  onTogglePlayPause: () => void;
};

/** ⌘K / Ctrl+K: jump to screens, run commands and find tracks. */
export function CommandPalette({ onTogglePlayPause }: CommandPaletteProps) {
  const { isPaletteOpen, setPaletteOpen, setActiveScreen } = useUiStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const settings = useSettingsStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (isPaletteOpen) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    } else {
      returnFocusRef.current?.focus?.();
    }
  }, [isPaletteOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const close = () => setPaletteOpen(false);
    const command = (id: string, label: string, run: () => void, kind: PaletteItem["kind"] = "Command"): PaletteItem => ({
      id,
      kind,
      label,
      run: () => {
        close();
        run();
      },
    });
    const commands: PaletteItem[] = [
      ...SCREENS.map((screen) => command(`go-${screen.id}`, screen.label, () => setActiveScreen(screen.id), "Go to")),
      command("play", isPlaying ? "Pause" : "Play", onTogglePlayPause),
      command("next", "Next track", () => void playNextTrack()),
      command("prev", "Previous track", () => void playPreviousTrack()),
      command("favorite", "Add or remove the current track from favorites", () => {
        const { playbackTrackId } = usePlayerStore.getState();
        const { selectedTrackId } = useLibraryStore.getState();
        const id = playbackTrackId || selectedTrackId;
        if (id) {
          useFavoritesStore.getState().toggleFavorite(id);
        }
      }),
      command("undo", "Undo last tag change", () => void undoWithToast(undoLast)),
      command("duplicates", "Review duplicates", () => useUiStore.getState().setDuplicatesOpen(true)),
      command("history", "Show change history", () => useUiStore.getState().setHistoryOpen(true)),
      command("fullwindow", "Full window Now Playing", () => {
        setActiveScreen("player");
        useUiStore.getState().setImmersive(true);
      }),
      command("theme", settings.colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode", () =>
        settings.setColorMode(settings.colorMode === "dark" ? "light" : "dark")
      ),
      command("dynbg", settings.dynamicBackground ? "Turn off dynamic background" : "Turn on dynamic background", () =>
        settings.setDynamicBackground(!settings.dynamicBackground)
      ),
      command("autoeq", settings.audioAutoEq ? "Turn off Auto EQ" : "Turn on Auto EQ", () => settings.setAudioAutoEq(!settings.audioAutoEq)),
      command("open", "Open music folder…", () => void scanLibraryWithPicker()),
    ];
    const needle = query.trim().toLowerCase();
    const matchingCommands = needle ? commands.filter((item) => item.label.toLowerCase().includes(needle)) : commands;
    if (!needle) {
      return matchingCommands;
    }
    const matchingTracks: PaletteItem[] = tracks
      .filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(needle))
      .slice(0, MAX_TRACK_RESULTS)
      .map((track) => ({
        id: `track-${track.id}`,
        kind: "Track" as const,
        label: track.title || track.path.split(/[\\/]/).pop() || "Untitled",
        hint: [track.artist, track.album].filter(Boolean).join(" · "),
        run: () => {
          close();
          selectTrack(track);
          setActiveScreen("library");
        },
      }));
    return [...matchingTracks, ...matchingCommands];
  }, [query, tracks, isPlaying, settings, onTogglePlayPause, setActiveScreen, setPaletteOpen]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(items.length - 1, 0)));
  }, [items.length]);

  if (!isPaletteOpen) {
    return null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setPaletteOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (items.length ? (index + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[activeIndex]?.run();
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <div className="shell__palette-layer" onKeyDown={onKeyDown}>
      <div className="shell__palette-scrim" onClick={() => setPaletteOpen(false)} aria-hidden="true" />
      <div className="shell__palette" role="dialog" aria-modal="true" aria-label="Search and commands">
        <div className="shell__palette-input">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items.length ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            placeholder="Type a track, album or command…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="shell__palette-list">
          {items.map((item, index) => (
            <li
              key={item.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={cx("shell__palette-item", index === activeIndex && "is-active")}
              onMouseMove={() => setActiveIndex(index)}
              onClick={item.run}
            >
              <Badge tone="neutral">{item.kind}</Badge>
              <span className="shell__palette-label">{item.label}</span>
              {item.hint ? <span className="shell__palette-hint">{item.hint}</span> : null}
            </li>
          ))}
          {items.length === 0 ? <li className="shell__empty" role="presentation">No matches</li> : null}
        </ul>
      </div>
    </div>
  );
}
