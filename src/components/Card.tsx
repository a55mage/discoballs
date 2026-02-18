import type { PropsWithChildren, ReactNode } from "react";

type CardProps = PropsWithChildren<{
  title: string;
  className?: string;
  headerAfterTitle?: ReactNode;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
}>;

export function Card({ title, className, headerAfterTitle, headerCenter, headerRight, children }: CardProps) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      <div className="card-header">
        <div className="card-header-left">
          <h2 className="card-title">{title}</h2>
          {headerAfterTitle}
        </div>
        <div className="card-header-center">{headerCenter}</div>
        <div className="card-header-right">{headerRight}</div>
      </div>
      {children}
    </section>
  );
}
