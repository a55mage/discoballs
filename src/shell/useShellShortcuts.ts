import { useEffect } from "react";
import { useUiStore } from "../store/uiStore";

/** Global keyboard shortcuts of the shell: ⌘K / Ctrl+K toggles the command palette. */
export function useShellShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const ui = useUiStore.getState();
        ui.setPaletteOpen(!ui.isPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
