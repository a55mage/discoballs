import { IconFolder } from "../../components/icons";
import { buildFolderEntries, type FolderEntry } from "../../domain/libraryView";
import type { LibraryAlbumSummary, LibraryArtistSummary } from "../../domain/library";
import type { Track } from "../../types";
import { Badge, Cover, cx } from "../../ui";

type AlbumGridProps = {
  albums: LibraryAlbumSummary[];
  onOpen: (album: LibraryAlbumSummary) => void;
};

export function AlbumGrid({ albums, onOpen }: AlbumGridProps) {
  if (!albums.length) {
    return <p className="lib-empty-rows">No albums match these filters.</p>;
  }
  return (
    <ul className="lib-albums" aria-label="Albums">
      {albums.map((album) => (
        <li key={album.id}>
          <button type="button" className="lib-album" onClick={() => onOpen(album)}>
            <Cover src={album.coverUrl} radius={12} className="lib-album__cover" />
            <span className="lib-album__title">{album.title}</span>
            <span className="lib-album__meta">
              {album.artist}
              {album.year ? ` · ${album.year}` : ""}
            </span>
            <span className="lib-album__meta">{album.trackCount} {album.trackCount === 1 ? "track" : "tracks"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type ArtistListProps = {
  artists: LibraryArtistSummary[];
  onOpen: (artist: LibraryArtistSummary) => void;
};

export function ArtistList({ artists, onOpen }: ArtistListProps) {
  if (!artists.length) {
    return <p className="lib-empty-rows">No artists match these filters.</p>;
  }
  return (
    <ul className="lib-artists" aria-label="Artists">
      {artists.map((artist) => (
        <li key={artist.id}>
          <button type="button" className="lib-artist-row" onClick={() => onOpen(artist)}>
            <Cover size={52} radius={26} src={artist.coverUrl} />
            <span className="lib-artist-row__text">
              <strong>{artist.name}</strong>
              <span>
                {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"} · {artist.trackCount} {artist.trackCount === 1 ? "track" : "tracks"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type FolderBrowserProps = {
  tracks: Track[];
  rootPath: string;
  segments: string[];
  query: string;
  selectedIds: string[];
  onNavigate: (segments: string[]) => void;
  onSelect: (track: Track) => void;
  onPlay: (track: Track) => void;
};

export function FolderBrowser({ tracks, rootPath, segments, query, selectedIds, onNavigate, onSelect, onPlay }: FolderBrowserProps) {
  const entries = buildFolderEntries(tracks, rootPath, segments, query);
  const rootName = rootPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "Library";

  return (
    <div className="lib-folders">
      <nav className="lib-breadcrumb" aria-label="Folder path">
        <button type="button" onClick={() => onNavigate([])} aria-current={segments.length === 0 ? "location" : undefined}>{rootName}</button>
        {segments.map((segment, index) => (
          <span key={segment + index} className="lib-breadcrumb__part">
            <span aria-hidden="true">/</span>
            <button type="button" onClick={() => onNavigate(segments.slice(0, index + 1))} aria-current={index === segments.length - 1 ? "location" : undefined}>
              {segment}
            </button>
          </span>
        ))}
      </nav>
      {entries.length === 0 ? <p className="lib-empty-rows">This folder is empty.</p> : null}
      <ul className="lib-entries" aria-label="Folder content">
        {entries.map((entry: FolderEntry) =>
          entry.type === "folder" ? (
            <li key={`folder-${entry.pathSegments.join("/")}`}>
              <button type="button" className="lib-entry" onClick={() => onNavigate(entry.pathSegments)}>
                <IconFolder className="lib-entry__icon" aria-hidden="true" />
                <span className="lib-entry__name">{entry.name}</span>
                <Badge tone="neutral">{entry.trackCount} files</Badge>
              </button>
            </li>
          ) : (
            <li key={`track-${entry.track.id}`}>
              <button
                type="button"
                className={cx("lib-entry", selectedIds.includes(entry.track.id) && "is-selected")}
                onClick={() => onSelect(entry.track)}
                onDoubleClick={() => onPlay(entry.track)}
              >
                <Cover size={32} radius={6} src={entry.track.coverUrl} />
                <span className="lib-entry__name">{entry.name}</span>
                <span className="lib-entry__meta">{[entry.track.artist, entry.track.title].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
