import type { ComponentType, SVGProps } from "react";
import { IconDisc, IconLibrary, IconPlaylist, IconSettings, IconTag, IconVisualizerBars } from "../components/icons";
import type { AppScreen } from "../types";

export type ScreenMeta = {
  id: AppScreen;
  label: string;
  title: string;
  subtitle: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/** Sidebar order. `dashboard` is the playlist editor, `tagging` the tag editor. */
export const SCREENS: ScreenMeta[] = [
  { id: "library", label: "Library", title: "Library", subtitle: "Browse and manage your music", Icon: IconLibrary },
  { id: "tagging", label: "Tag Editor", title: "Tag Editor", subtitle: "Edit metadata, match online, rename files", Icon: IconTag },
  { id: "dashboard", label: "Playlists", title: "Playlists", subtitle: "Build and reorder playlists", Icon: IconPlaylist },
  { id: "player", label: "Now Playing", title: "Now Playing", subtitle: "Lyrics, visualizer and queue", Icon: IconDisc },
  { id: "settings", label: "Settings", title: "Settings", subtitle: "Audio, appearance and library", Icon: IconSettings },
];

/**
 * Hidden: the rhythm analysis debug view (the game it was made for is shelved). Not in the sidebar; the command
 * palette offers it only when the search mentions "beatmap".
 */
export const BEATMAP_LAB: ScreenMeta = {
  id: "beatmap",
  label: "Beatmap lab",
  title: "Beatmap lab",
  subtitle: "Rhythm analysis of a track",
  Icon: IconVisualizerBars,
};

export function getScreenMeta(screen: AppScreen): ScreenMeta {
  return SCREENS.find((item) => item.id === screen) ?? SCREENS[0];
}
