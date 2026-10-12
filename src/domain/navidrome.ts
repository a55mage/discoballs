import type { NavidromeBookmark } from "../types";

export function buildNavidromeBookmarkId(): string {
  return `navidrome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultNavidromeBookmarkName(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || baseUrl.trim();
  } catch {
    return baseUrl.trim() || "Navidrome server";
  }
}

export function normalizeNavidromeBookmark(item: unknown): NavidromeBookmark | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const candidate = item as Record<string, unknown>;
  const baseUrl = typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : "";
  const username = typeof candidate.username === "string" ? candidate.username.trim() : "";
  const password = typeof candidate.password === "string" ? candidate.password : "";
  if (!baseUrl || !username || !password) {
    return null;
  }
  const name = typeof candidate.name === "string" && candidate.name.trim()
    ? candidate.name.trim()
    : defaultNavidromeBookmarkName(baseUrl);
  const id = typeof candidate.id === "string" && candidate.id.trim()
    ? candidate.id
    : buildNavidromeBookmarkId();
  const lastConnectedAt = typeof candidate.lastConnectedAt === "string" ? candidate.lastConnectedAt : undefined;
  return {
    id,
    name,
    baseUrl,
    username,
    password,
    connectOnOpen: candidate.connectOnOpen === true,
    lastConnectedAt,
  };
}
