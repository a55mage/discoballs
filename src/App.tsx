import { type ReactNode } from "react";
import { togglePlayPause } from "./actions/playback";
import { useAutoEqualizer } from "./hooks/useAutoEqualizer";
import { useLibrarySession } from "./hooks/useLibrarySession";
import { useMediaControls } from "./hooks/useMediaControls";
import { usePlaybackEngine } from "./hooks/usePlaybackEngine";
import { useTagDraftSync } from "./hooks/useTagDraftSync";
import { LibraryInspector } from "./screens/library/LibraryInspector";
import { BeatmapLab } from "./screens/beatmap/BeatmapLab";
import { LibraryScreen } from "./screens/library/LibraryScreen";
import { NowPlayingScreen } from "./screens/nowPlaying/NowPlayingScreen";
import { PlaylistsScreen } from "./screens/playlists/PlaylistsScreen";
import { SettingsScreen } from "./screens/settings/SettingsScreen";
import { TagEditorScreen } from "./screens/tagEditor/TagEditorScreen";
import { AppShell } from "./shell/AppShell";
import { useLibraryStore } from "./store/libraryStore";
import { getVisibleLibraryTracks } from "./store/selectors";
import { useSettingsStore } from "./store/settingsStore";
import { useUiStore } from "./store/uiStore";
import { useApplyTheme } from "./ui/useApplyTheme";

export function App() {
  useApplyTheme();
  usePlaybackEngine();
  useAutoEqualizer();
  useTagDraftSync();
  useLibrarySession();

  const activeScreen = useUiStore((state) => state.activeScreen);
  const hasTracks = useLibraryStore((state) => state.tracks.length > 0);
  const rotateAccent = useSettingsStore((state) => state.rotateAccent);

  // Playing from the library queues the list as it is filtered and sorted on screen.
  const togglePlay = () => void togglePlayPause(getVisibleLibraryTracks().map((track) => track.id));
  useMediaControls(togglePlay);

  const screens: Record<typeof activeScreen, ReactNode> = {
    library: <LibraryScreen onTogglePlayPause={togglePlay} />,
    tagging: <TagEditorScreen />,
    dashboard: <PlaylistsScreen />,
    player: <NowPlayingScreen onTogglePlayPause={togglePlay} />,
    settings: <SettingsScreen />,
    beatmap: <BeatmapLab onTogglePlayPause={togglePlay} />,
  };

  return (
    <AppShell
      inspector={activeScreen === "library" && hasTracks ? <LibraryInspector /> : undefined}
      onBrandClick={rotateAccent}
      onTogglePlayPause={togglePlay}
    >
      {screens[activeScreen]}
    </AppShell>
  );
}
