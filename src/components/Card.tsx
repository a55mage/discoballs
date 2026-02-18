import type { PropsWithChildren, ReactNode } from "react";

type CardProps = PropsWithChildren<{
  title: string;
  className?: string;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
}>;

export function Card({ title, className, headerCenter, headerRight, children }: CardProps) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <div className="card-header-center">{headerCenter}</div>
        <div className="card-header-right">{headerRight}</div>
      </div>
      {children}
    </section>
  );
}
