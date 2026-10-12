import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef } from "react";
import { cx } from "../cx";

type FieldProps = {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control. The control is nested in the <label>, so no ids are needed. */
export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={cx("db-field", className)}>
      <span className="db-field__label">{label}</span>
      {children}
      {hint ? <span className="db-field__hint">{hint}</span> : null}
    </label>
  );
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Marks a value that differs from the saved one. */
  changed?: boolean;
  invalid?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { changed, invalid, className, type = "text", ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cx("db-input", changed && "db-input--changed", invalid && "db-input--invalid", className)}
      {...rest}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx("db-input", className)} {...rest}>
      {children}
    </select>
  );
});
