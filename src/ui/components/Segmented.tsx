import { type KeyboardEvent, type ReactNode, useRef } from "react";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; ariaLabel?: string };

type SegmentedProps<T extends string> = {
  /** Describes the group for assistive tech. */
  label: string;
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
};

/** Single choice control (radio semantics with arrow-key navigation). */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.findIndex((option) => option.value === value);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className="db-seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            className="db-seg-btn"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type ToggleGroupProps<T extends string> = {
  label: string;
  options: Array<SegmentedOption<T>>;
  value: T[];
  onChange: (value: T[]) => void;
  /** Minimum number of selected options (default 1: the last one cannot be switched off). */
  min?: number;
};

/** Multi choice control: any combination of options can be on. */
export function ToggleGroup<T extends string>({ label, options, value, onChange, min = 1 }: ToggleGroupProps<T>) {
  function toggle(option: T) {
    const isOn = value.includes(option);
    if (isOn && value.length <= min) {
      return;
    }
    onChange(isOn ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <div className="db-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="db-seg-btn"
          aria-pressed={value.includes(option.value)}
          aria-label={option.ariaLabel}
          onClick={() => toggle(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
