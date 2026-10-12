import type { Track } from "../types";

export type FilenameField = "tracknumber" | "artist" | "album" | "title" | "year" | "genre";

export type FilenamePattern = {
  id: string;
  /** Tokens in curly braces: {track} {artist} {album} {title} {year} {genre}. Everything else is literal. */
  template: string;
  label: string;
};

export const FILENAME_PATTERNS: FilenamePattern[] = [
  { id: "track-artist-title", template: "{track} - {artist} - {title}", label: "01 - Artist - Title" },
  { id: "track-title", template: "{track} - {title}", label: "01 - Title" },
  { id: "track-title-space", template: "{track} {title}", label: "01 Title" },
  { id: "artist-title", template: "{artist} - {title}", label: "Artist - Title" },
  { id: "artist-album-track-title", template: "{artist} - {album} - {track} - {title}", label: "Artist - Album - 01 - Title" },
  { id: "title", template: "{title}", label: "Title only" },
];

const TOKEN_FIELDS: Record<string, FilenameField> = {
  track: "tracknumber",
  artist: "artist",
  album: "album",
  title: "title",
  year: "year",
  genre: "genre",
};

const TOKEN_REGEX: Record<FilenameField, string> = {
  tracknumber: "(\\d{1,3})",
  year: "(\\d{4})",
  artist: "(.+?)",
  album: "(.+?)",
  title: "(.+?)",
  genre: "(.+?)",
};

export type CompiledPattern = { regex: RegExp; fields: FilenameField[] } | null;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turns a template into a matcher, or null when it has no known token or repeats one. */
export function compilePattern(template: string): CompiledPattern {
  const fields: FilenameField[] = [];
  let source = "";
  let lastIndex = 0;
  const tokens = /\{(\w+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(template))) {
    const field = TOKEN_FIELDS[match[1].toLowerCase()];
    if (!field || fields.includes(field)) {
      return null;
    }
    source += escapeRegex(template.slice(lastIndex, match.index)).replace(/\\? /g, "\\s+");
    source += TOKEN_REGEX[field];
    fields.push(field);
    lastIndex = match.index + match[0].length;
  }
  source += escapeRegex(template.slice(lastIndex)).replace(/\\? /g, "\\s+");
  if (!fields.length) {
    return null;
  }
  return { regex: new RegExp(`^${source}$`, "i"), fields };
}

export function fileStem(path: string): string {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function clean(value: string): string {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export type ParsedFilename = Partial<Record<FilenameField, string>>;

/** The tags a file name carries under a pattern, or null when the name does not fit the pattern. */
export function parseFileName(path: string, compiled: CompiledPattern): ParsedFilename | null {
  if (!compiled) {
    return null;
  }
  const match = compiled.regex.exec(clean(fileStem(path)));
  if (!match) {
    return null;
  }
  const parsed: ParsedFilename = {};
  compiled.fields.forEach((field, index) => {
    const value = clean(match[index + 1] ?? "");
    if (value) {
      parsed[field] = field === "tracknumber" ? String(Number(value)) : value;
    }
  });
  return parsed;
}

export type FilenameTagChange = {
  trackId: string;
  parsed: ParsedFilename | null;
  /** What would actually be written (respecting "only fill empty fields"). */
  patch: Partial<Pick<Track, FilenameField>>;
};

/** Plans the tag changes for tracks without touching anything. */
export function planFilenameTags(tracks: Track[], template: string, options: { onlyEmpty: boolean }): FilenameTagChange[] {
  const compiled = compilePattern(template);
  return tracks.map((track) => {
    const parsed = parseFileName(track.path, compiled);
    const patch: FilenameTagChange["patch"] = {};
    if (parsed) {
      for (const field of Object.keys(parsed) as FilenameField[]) {
        const value = parsed[field] as string;
        if (value !== track[field] && (!options.onlyEmpty || !track[field].trim())) {
          patch[field] = value;
        }
      }
    }
    return { trackId: track.id, parsed, patch };
  });
}
