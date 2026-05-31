import { type ComponentType, type SVGProps, useState } from "react";
import { Card } from "../components/Card";
import type { Track } from "../types";
import { LibrarySection, type LibrarySectionProps } from "./LibrarySection";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type LibraryArtistSummary = {
  id: string;
  name: string;
  trackCount: number;
  albumCount: number;
  coverUrl?: string;
};

export type LibraryAlbumSummary = {
  id: string;
  title: string;
  artist: string;
  year: string;
  trackCount: number;
  coverUrl?: string;
};

type LibraryBrowserSectionProps = {
  libraryProps: LibrarySectionProps;
  artists: LibraryArtistSummary[];
  albums: LibraryAlbumSummary[];
  tracks: Track[];
  onArtistClick: (artist: LibraryArtistSummary) => void;
  onAlbumClick: (album: LibraryAlbumSummary) => void;
  IconArtist: IconComponent;
  IconAlbum: IconComponent;
  IconMusicNote: IconComponent;
};

export function LibraryBrowserSection({
  libraryProps,
  artists,
  albums,
  tracks,
  onArtistClick,
  onAlbumClick,
  IconArtist,
  IconAlbum,
  IconMusicNote,
}: LibraryBrowserSectionProps) {
  const [activeView, setActiveView] = useState<"artists" | "albums">("artists");

  return (
    <main className="library-browser-screen">
      <div className="library-browser-library">
        <LibrarySection {...libraryProps} />
      </div>
      <div className="library-browser-panel">
        <Card
          title="Library"
          className="library-browser-card"
          headerAfterTitle={(
            <div className="library-browser-summary">
              <span>{tracks.length} tracks</span>
              <span>{artists.length} artists</span>
              <span>{albums.length} albums</span>
            </div>
          )}
          headerRight={(
            <div className="library-browser-tabs" role="tablist" aria-label="Library browser views">
              <button
                type="button"
                className={activeView === "artists" ? "view-mode-button active" : "view-mode-button"}
                onClick={() => setActiveView("artists")}
                title="Artists"
                aria-label="Artists"
              >
                <span className="btn-content"><IconArtist className="btn-icon" /></span>
              </button>
              <button
                type="button"
                className={activeView === "albums" ? "view-mode-button active" : "view-mode-button"}
                onClick={() => setActiveView("albums")}
                title="Albums"
                aria-label="Albums"
              >
                <span className="btn-content"><IconAlbum className="btn-icon" /></span>
              </button>
            </div>
          )}
        >
          {activeView === "artists" ? (
            <LibrarySummaryList
              kind="artist"
              items={artists}
              emptyText="No artists in library."
              IconFallback={IconArtist}
              onItemClick={onArtistClick}
            />
          ) : (
            <LibrarySummaryList
              kind="album"
              items={albums}
              emptyText="No albums in library."
              IconFallback={IconMusicNote}
              onItemClick={onAlbumClick}
            />
          )}
        </Card>
      </div>
    </main>
  );
}

type SummaryItem = LibraryArtistSummary | LibraryAlbumSummary;

type LibrarySummaryListProps<T extends SummaryItem> = {
  kind: "artist" | "album";
  items: T[];
  emptyText: string;
  IconFallback: IconComponent;
  onItemClick: (item: T) => void;
};

function LibrarySummaryList<T extends SummaryItem>({
  kind,
  items,
  emptyText,
  IconFallback,
  onItemClick,
}: LibrarySummaryListProps<T>) {
  if (!items.length) {
    return <p className="library-browser-empty">{emptyText}</p>;
  }

  return (
    <ul className="library-summary-grid">
      {items.map((item) => {
        const isAlbum = kind === "album";
        const title = isAlbum ? (item as LibraryAlbumSummary).title : (item as LibraryArtistSummary).name;
        const subtitle = isAlbum
          ? (item as LibraryAlbumSummary).artist
          : `${(item as LibraryArtistSummary).albumCount} albums`;
        const meta = isAlbum
          ? `${(item as LibraryAlbumSummary).trackCount} tracks${(item as LibraryAlbumSummary).year ? ` · ${(item as LibraryAlbumSummary).year}` : ""}`
          : `${(item as LibraryArtistSummary).trackCount} tracks`;

        return (
          <li key={item.id}>
            <button type="button" className="library-summary-card" onClick={() => onItemClick(item)}>
              {item.coverUrl ? (
                <img src={item.coverUrl} alt="" className="library-summary-cover" />
              ) : (
                <span className="library-summary-cover placeholder" aria-hidden="true">
                  <IconFallback className="library-summary-fallback-icon" />
                </span>
              )}
              <span className="library-summary-text">
                <strong title={title}>{title}</strong>
                <small title={subtitle}>{subtitle}</small>
                <small className="muted">{meta}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
