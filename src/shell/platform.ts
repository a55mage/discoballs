export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** On macOS the app draws under the title bar (Tauri `titleBarStyle: Overlay`) and leaves room for the traffic lights. */
export function usesOverlayTitleBar(): boolean {
  return isTauriRuntime() && isMacPlatform();
}

export const COMMAND_KEY_LABEL = isMacPlatform() ? "⌘K" : "Ctrl K";
