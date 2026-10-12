import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cx } from "../cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Leading icon (an <svg> sized by the button). */
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", block, icon, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("db-btn", `db-btn--${variant}`, size !== "md" && `db-btn--${size}`, block && "db-btn--block", className)}
      {...rest}
    >
      {icon ? <span className="db-btn__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
});
