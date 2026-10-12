import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cx } from "../cx";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Accessible name; icon-only buttons must have one. */
  label: string;
  size?: "sm" | "md" | "lg";
  /** Highlights the button (for toggles such as shuffle or repeat). */
  active?: boolean;
  /** Filled accent circle, used for the main play/pause control. */
  solid?: boolean;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", active, solid, className, children, type = "button", ...rest },
  ref
) {
  const pressed = rest["aria-pressed"] ?? (active === undefined ? undefined : active);
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      aria-pressed={pressed}
      className={cx(
        "db-icon-btn",
        size !== "md" && `db-icon-btn--${size}`,
        active && "db-icon-btn--active",
        solid && "db-icon-btn--solid",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
