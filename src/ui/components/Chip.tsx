import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "../cx";

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Selected state; exposed to assistive tech as aria-pressed. */
  on?: boolean;
  count?: number;
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { on = false, count, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} aria-pressed={on} className={cx("db-chip", on && "db-chip--on", className)} {...rest}>
      {children}
      {count !== undefined ? <span className="db-chip__count">{count}</span> : null}
    </button>
  );
});
