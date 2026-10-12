import { IconCheck, IconClose, IconInfo } from "../components/icons";
import { useUiStore } from "../store/uiStore";
import { IconButton, cx } from "../ui";

/** Short confirmation or error message at the bottom of the window. */
export function Toast() {
  const toast = useUiStore((state) => state.toast);
  const dismiss = useUiStore((state) => state.dismissToast);

  return (
    <div className="shell__toast-region" role="status" aria-live={toast?.tone === "error" ? "assertive" : "polite"}>
      {toast ? (
        <div key={toast.id} className={cx("shell__toast", `shell__toast--${toast.tone}`)}>
          {toast.tone === "success" ? <IconCheck aria-hidden="true" /> : <IconInfo aria-hidden="true" />}
          <span>{toast.message}</span>
          <IconButton label="Dismiss" size="sm" onClick={dismiss}><IconClose /></IconButton>
        </div>
      ) : null}
    </div>
  );
}
