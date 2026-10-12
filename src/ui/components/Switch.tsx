import { type ButtonHTMLAttributes } from "react";
import { cx } from "../cx";

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role" | "aria-checked" | "aria-label"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name of the setting. */
  label: string;
};

export function Switch({ checked, onChange, label, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx("db-switch", className)}
      onClick={() => onChange(!checked)}
      {...rest}
    />
  );
}
