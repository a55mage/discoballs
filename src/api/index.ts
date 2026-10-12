import { createAdapter } from "./tauriAdapter";
import { mockAdapter } from "./mockAdapter";

/** The backend used by the app: the Tauri bridge when available, the mock adapter in a plain browser. */
export const adapter = createAdapter(mockAdapter);
