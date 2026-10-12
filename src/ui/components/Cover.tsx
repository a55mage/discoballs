import { type CSSProperties } from "react";
import { IconMusicNote } from "../../components/icons";
import { cx } from "../cx";

export type CoverProps = {
  src?: string;
  /** Edge length in px, or any CSS length. Omit to size it from the parent. */
  size?: number | string;
  radius?: number | string;
  className?: string;
  /** Text alternative; leave empty when the title is shown next to the cover. */
  alt?: string;
};

/** Square album art with a neutral placeholder when there is no image. */
export function Cover({ src, size, radius = 10, className, alt = "" }: CoverProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    aspectRatio: size === undefined ? "1 / 1" : undefined,
    borderRadius: radius,
  };
  return (
    <span className={cx("db-cover", !src && "db-cover--empty", className)} style={style}>
      {src ? <img src={src} alt={alt} loading="lazy" draggable={false} /> : <IconMusicNote className="db-cover__icon" aria-hidden="true" />}
    </span>
  );
}
