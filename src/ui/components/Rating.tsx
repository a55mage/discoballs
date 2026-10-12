import { IconStar } from "../../components/icons";
import { cx } from "../cx";

export type RatingProps = {
  /** 0 (no rating) to 5. */
  value: number;
  /** Called with the star clicked; the parent clears the rating when the same star is clicked again. */
  onChange?: (value: number) => void;
  /** Describes whose rating this is, for assistive tech ("Rating of Harbor Lights"). */
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

/** Five stars. Read-only without `onChange`. */
export function Rating({ value, onChange, label = "Rating", size = "md", className }: RatingProps) {
  if (!onChange) {
    return (
      <span className={cx("db-rating", `db-rating--${size}`, className)} role="img" aria-label={`${label}: ${value} of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <IconStar key={star} className={cx("db-rating__star", star <= value && "is-on")} aria-hidden="true" />
        ))}
      </span>
    );
  }
  return (
    <span className={cx("db-rating", `db-rating--${size}`, className)} role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={cx("db-rating__btn", star <= value && "is-on")}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          aria-pressed={star === value}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onChange(star);
          }}
        >
          <IconStar className="db-rating__star" aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}
