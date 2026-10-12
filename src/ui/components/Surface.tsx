import { type HTMLAttributes } from "react";
import { cx } from "../cx";

export type PaneProps = HTMLAttributes<HTMLDivElement> & {
  /** Frosted glass background. */
  glass?: boolean;
  /** Hairline on one side, used to join flush panes without gaps. */
  divider?: "left" | "right";
  scroll?: boolean;
};

/** A flush layout area: no outer margin or radius, so neighbouring panes share one continuous surface. */
export function Pane({ glass, divider, scroll, className, ...rest }: PaneProps) {
  return (
    <div
      className={cx(
        "db-pane",
        glass && "db-glass",
        divider === "left" && "db-pane--divider-left",
        divider === "right" && "db-pane--divider-right",
        scroll && "db-scroll",
        className
      )}
      {...rest}
    />
  );
}
