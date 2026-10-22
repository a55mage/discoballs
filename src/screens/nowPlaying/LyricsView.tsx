import { useEffect, useRef } from "react";
import type { LyricLine } from "../../utils/lyrics";
import { cx } from "../../ui";

type LyricsViewProps = {
  lines: LyricLine[];
  /** Index of the line being sung (-1 before the first one, or when the lyrics are not synced). */
  activeIndex: number;
  synced: boolean;
  /** Shown when there are no lines: loading, not found, missing metadata… */
  status: string;
  large?: boolean;
  onSeek: (timeSec: number) => void;
};

/** Karaoke-style lyrics: the current line is centered and emphasized; click a line to jump to it. */
export function LyricsView({ lines, activeIndex, synced, status, large, onSeek }: LyricsViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shownLinesRef = useRef<LyricLine[] | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>("[aria-current='true']");
    if (!container || !active) {
      return;
    }
    // offsetTop ignores the scale of the current line, so the target does not move while it grows.
    const top = active.offsetTop - container.clientHeight / 2 + active.offsetHeight / 2;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // New lyrics (another track) jump into place; within a song the next line glides up.
    const isNewText = shownLinesRef.current !== lines;
    shownLinesRef.current = lines;
    container.scrollTo?.({ top: Math.max(0, top), behavior: reduceMotion || isNewText ? "auto" : "smooth" });
  }, [activeIndex, lines]);

  if (!lines.length) {
    return (
      <div className="np-lyrics np-lyrics--empty">
        <p>{status || "No lyrics"}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cx("np-lyrics", synced && "np-lyrics--synced", large && "np-lyrics--large")} aria-label="Lyrics">
      <ol>
        {lines.map((line, index) => {
          const isActive = synced && index === activeIndex;
          const distance = synced && activeIndex >= 0 ? Math.abs(index - activeIndex) : 0;
          return (
            <li key={index} className={cx(isActive && "is-active", distance === 1 && "is-near", distance > 1 && "is-far")} aria-current={isActive ? "true" : undefined}>
              {synced && line.timeSec !== undefined ? (
                <button type="button" onClick={() => onSeek(line.timeSec as number)}>{line.text}</button>
              ) : (
                <span>{line.text}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
