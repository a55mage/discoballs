export async function openExternalLink(url: string): Promise<void> {
  const invoke = (
    window as Window & {
      __TAURI_INTERNALS__?: { invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T> };
    }
  ).__TAURI_INTERNALS__?.invoke;

  if (invoke) {
    try {
      await invoke<void>("open_external_url", { url });
      return;
    } catch {
      // Fall through to the browser default opener.
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
