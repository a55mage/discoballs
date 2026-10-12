import { type ReactNode, type RefObject } from "react";
import { audioRef } from "../audio/audioRef";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { useUiStore } from "../store/uiStore";
import { cx } from "../ui";
import { Backdrop } from "./Backdrop";
import { CommandPalette } from "./CommandPalette";
import { Header } from "./Header";
import { NavidromeDialog } from "./NavidromeDialog";
import { Toast } from "./Toast";
import { PlayerBar } from "./PlayerBar";
import { Sidebar } from "./Sidebar";
import { usesOverlayTitleBar } from "./platform";
import { useShellShortcuts } from "./useShellShortcuts";
import "./shell.css";

type AppShellProps = {
  /** The active screen. */
  children: ReactNode;
  /** Optional right-hand panel inside the content window (e.g. the track inspector). */
  inspector?: ReactNode;
  onBrandClick: () => void;
  onTogglePlayPause: () => void;
};

/**
 * The window frame. Sidebar, header and player bar are one continuous frosted "C" around the content
 * window, over a backdrop tinted by the current cover. In immersive mode only the content remains.
 */
export function AppShell({ children, inspector, onBrandClick, onTogglePlayPause }: AppShellProps) {
  useShellShortcuts();
  // Full-window mode only applies to Now Playing; any other screen shows the whole frame again.
  const isImmersive = useUiStore((state) => state.isImmersive && state.activeScreen === "player");
  const playbackTrackId = usePlayerStore((state) => state.playbackTrackId);
  const audioSrc = usePlayerStore((state) => state.audioSrc);
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const infoTrack = tracks.find((track) => track.id === playbackTrackId) ?? tracks.find((track) => track.id === selectedTrackId);

  return (
    <div className={cx("shell", isImmersive && "shell--immersive", usesOverlayTitleBar() && "shell--overlay-titlebar")}>
      <Backdrop coverUrl={infoTrack?.coverUrl} />
      <div className="shell__veil" aria-hidden="true" />
      {!isImmersive ? <div className="db-glass shell__frame" aria-hidden="true" /> : null}

      {!isImmersive ? <Sidebar onBrandClick={onBrandClick} /> : null}
      {!isImmersive ? <Header /> : null}

      <main className="shell__content">
        <div className="shell__screen">
          <div className="shell__screen-body">{children}</div>
        </div>
        {inspector}
      </main>

      {!isImmersive ? <PlayerBar onTogglePlayPause={onTogglePlayPause} /> : null}
      <CommandPalette onTogglePlayPause={onTogglePlayPause} />
      <NavidromeDialog />
      <Toast />
      {/* Always mounted so playback survives immersive mode and screen changes. */}
      <audio ref={audioRef as RefObject<HTMLAudioElement>} src={audioSrc || undefined} preload="metadata" />
    </div>
  );
}
