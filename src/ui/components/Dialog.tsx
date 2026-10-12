import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { IconClose } from "../../components/icons";
import { cx } from "../cx";
import { IconButton } from "./IconButton";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Max width in px. */
  width?: number;
  className?: string;
  children: ReactNode;
  /** Buttons aligned to the end, below the content. */
  footer?: ReactNode;
};

/**
 * Modal dialog: closes with Escape or a click on the scrim, keeps Tab inside, focuses its first control
 * and gives focus back to what had it before.
 */
export function Dialog({ open, onClose, title, width = 560, className, children, footer }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-dialog-close])");
    (first ?? panelRef.current)?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, [open]);

  if (!open) {
    return null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) {
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="db-dialog-layer" onKeyDown={onKeyDown}>
      <div className="db-dialog-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className={cx("db-dialog", className)} style={{ width: `min(${width}px, 100%)` }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="db-dialog__head">
          <h2 id={titleId} className="db-text-display">{title}</h2>
          <IconButton label="Close" data-dialog-close="" onClick={onClose}><IconClose /></IconButton>
        </header>
        <div className="db-dialog__body">{children}</div>
        {footer ? <footer className="db-dialog__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
