import { type InputHTMLAttributes } from "react";
import { cx } from "../cx";

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> & {
  value: number;
  onValueChange: (value: number) => void;
  /** Accessible name. */
  label: string;
  vertical?: boolean;
};

export function Slider({ value, onValueChange, label, vertical, className, ...rest }: SliderProps) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      className={cx("db-slider", vertical && "db-slider--vertical", className)}
      onChange={(event) => onValueChange(Number(event.target.value))}
      {...rest}
    />
  );
}
