function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readString(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readJson(key: string): unknown {
  const raw = readString(key);
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeString(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    // Ignore quota/security failures: persistence is best-effort.
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeString(key, JSON.stringify(value));
  } catch {
    // Ignore serialization failures.
  }
}

export function removeKey(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // Ignore.
  }
}
