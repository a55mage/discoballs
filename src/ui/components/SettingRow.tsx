import { type ReactNode } from "react";
import { cx } from "../cx";

export type SettingRowProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Marks a freshly added setting. */
  badge?: ReactNode;
  className?: string;
  /** The control (switch, select, buttons…), aligned to the end. */
  children?: ReactNode;
};

/** One line of a settings page: what it is, what it does, and its control. */
export function SettingRow({ title, description, badge, className, children }: SettingRowProps) {
  return (
    <div className={cx("db-setting", className)}>
      <div className="db-setting__text">
        <div className="db-setting__title">
          {title}
          {badge}
        </div>
        {description ? <div className="db-setting__desc">{description}</div> : null}
      </div>
      {children ? <div className="db-setting__control">{children}</div> : null}
    </div>
  );
}
