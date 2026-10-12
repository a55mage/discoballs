import { useMemo } from "react";
import { undoBatch, undoEntry, undoWithToast } from "../actions/history";
import { formatAgo, groupHistory, summarizeChanges, type HistoryGroup } from "../domain/history";
import { useHistoryStore } from "../store/historyStore";
import { useUiStore } from "../store/uiStore";
import { Badge, Button, Dialog } from "../ui";

/** Every tag change made with DiscoBalls, newest first, with a way back. */
export function HistoryDialog() {
  const { isHistoryOpen, setHistoryOpen } = useUiStore();
  const entries = useHistoryStore((state) => state.entries);
  const clear = useHistoryStore((state) => state.clear);
  const groups = useMemo(() => groupHistory(entries), [entries]);

  return (
    <Dialog
      open={isHistoryOpen}
      onClose={() => setHistoryOpen(false)}
      title="Change history"
      width={680}
      footer={
        <>
          <span className="hist__note">Covers are not restored by undo. History is kept on this computer.</span>
          <Button disabled={entries.length === 0} onClick={clear}>Clear history</Button>
        </>
      }
    >
      {groups.length === 0 ? <p className="hist__empty">No changes yet. Tags you save will show up here.</p> : null}
      <ul className="hist" aria-label="Changes">
        {groups.map((group) => (
          <HistoryRow key={group.key} group={group} />
        ))}
      </ul>
    </Dialog>
  );
}

function HistoryRow({ group }: { group: HistoryGroup }) {
  const isBatch = group.entries.length > 1;
  const first = group.entries[0];
  const run = () => (isBatch && first.batchId ? undoWithToast(() => undoBatch(first.batchId as string)) : undoWithToast(() => undoEntry(first)));

  return (
    <li className="hist__row">
      <div className="hist__main">
        <div className="hist__title">
          <strong>{isBatch ? `${group.label} · ${group.entries.length} tracks` : first.trackTitle || group.label}</strong>
          <span>{formatAgo(group.at)}</span>
          {group.undone ? <Badge tone="neutral">Undone</Badge> : null}
        </div>
        {isBatch ? (
          <details className="hist__details">
            <summary>Show tracks</summary>
            <ul>
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.trackTitle}</strong> <span>{summarizeChanges(entry)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="hist__summary">{first.label}: {summarizeChanges(first) || "No tag changes"}</p>
        )}
      </div>
      <Button size="sm" disabled={group.undone} onClick={() => void run()}>Undo</Button>
    </li>
  );
}
