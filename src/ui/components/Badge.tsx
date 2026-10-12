import { type HTMLAttributes } from "react";
import { cx } from "../cx";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "accent" | "neutral" | "warn" | "ok";
};

export function Badge({ tone = "accent", className, ...rest }: BadgeProps) {
  return <span className={cx("db-badge", tone !== "accent" && `db-badge--${tone}`, className)} {...rest} />;
}
