import { IconPlaylist } from "../../components/icons";
import { cx } from "../cx";

export type CoverMosaicProps = {
  /** Cover urls; the first four distinct ones are used. */
  covers: Array<string | undefined>;
  size?: number | string;
  radius?: number | string;
  className?: string;
};

/** Playlist artwork: one cover, or a 2×2 grid when the playlist has several. */
export function CoverMosaic({ covers, size, radius = 12, className }: CoverMosaicProps) {
  const unique = [...new Set(covers.filter((cover): cover is string => Boolean(cover)))].slice(0, 4);
  const tiles = unique.length >= 4 ? unique : unique.length >= 1 ? unique.slice(0, 1) : [];
  return (
    <span
      className={cx("db-mosaic", tiles.length === 4 && "db-mosaic--grid", tiles.length === 0 && "db-mosaic--empty", className)}
      style={{ width: size, height: size, aspectRatio: size === undefined ? "1 / 1" : undefined, borderRadius: radius }}
    >
      {tiles.length === 0 ? <IconPlaylist className="db-mosaic__icon" aria-hidden="true" /> : null}
      {tiles.map((cover) => (
        <img key={cover} src={cover} alt="" draggable={false} loading="lazy" />
      ))}
    </span>
  );
}
