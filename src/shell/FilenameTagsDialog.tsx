import { useEffect, useMemo, useState } from "react";
import { applyTrackEdits, describeBatchResult } from "../actions/batchEdit";
import { undoLast, undoWithToast } from "../actions/history";
import { fillDraft } from "../actions/tagEditor";
import { compilePattern, FILENAME_PATTERNS, planFilenameTags, type FilenameField } from "../domain/filenameTags";
import { TAG_FIELDS } from "../domain/history";
import { useLibraryStore } from "../store/libraryStore";
import { useUiStore } from "../store/uiStore";
import { Badge, Button, Dialog, Field, Select, Switch, TextInput } from "../ui";

const CUSTOM = "custom";
const PREVIEW_LIMIT = 50;
const FIELD_LABEL: Record<FilenameField, string> = Object.fromEntries(TAG_FIELDS.map(({ field, label }) => [field, label])) as Record<FilenameField, string>;

/**
 * Reads tags from file names ("01 - Artist - Title.mp3"). Shows what would be written for every track before
 * anything is touched.
 */
export function FilenameTagsDialog() {
  const { filenameTags, setFilenameTags, showToast } = useUiStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const [patternId, setPatternId] = useState(FILENAME_PATTERNS[0].id);
  const [custom, setCustom] = useState("{artist} - {title}");
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (filenameTags) {
      setBusy(false);
    }
  }, [filenameTags]);

  const selected = useMemo(
    () => (filenameTags ? filenameTags.ids.map((id) => tracks.find((track) => track.id === id)).filter((track) => track !== undefined) : []),
    [filenameTags, tracks]
  );
  const template = patternId === CUSTOM ? custom : FILENAME_PATTERNS.find((pattern) => pattern.id === patternId)?.template ?? "";
  const patternIsValid = compilePattern(template) !== null;
  const plan = useMemo(() => planFilenameTags(selected, template, { onlyEmpty }), [selected, template, onlyEmpty]);

  const willChange = plan.filter((item) => Object.keys(item.patch).length > 0);
  const noMatch = plan.filter((item) => item.parsed === null).length;
  const alreadyRight = plan.length - willChange.length - noMatch;
  const isDraft = filenameTags?.mode === "draft";
  const close = () => setFilenameTags(null);

  async function apply() {
    if (isDraft) {
      fillDraft(willChange[0]?.patch ?? {});
      close();
      return;
    }
    setBusy(true);
    const result = await applyTrackEdits(
      willChange.map((item) => ({ id: item.trackId, patch: item.patch })),
      undefined,
      "Tags from file names"
    );
    setBusy(false);
    close();
    const summary = describeBatchResult(result);
    showToast(summary.message, summary.tone, result.updated ? { label: "Undo", run: () => void undoWithToast(undoLast) } : undefined);
  }

  const trackName = (id: string) => selected.find((track) => track.id === id);

  return (
    <Dialog
      open={filenameTags !== null}
      onClose={close}
      title="Tags from file names"
      width={720}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={busy || !patternIsValid || willChange.length === 0} onClick={() => void apply()}>
            {isDraft ? "Fill the form" : busy ? "Saving…" : `Write ${willChange.length} ${willChange.length === 1 ? "track" : "tracks"}`}
          </Button>
        </>
      }
    >
      <div className="fn__options">
        <Field label="File name pattern">
          <Select value={patternId} onChange={(event) => setPatternId(event.target.value)}>
            {FILENAME_PATTERNS.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </Select>
        </Field>
        {patternId === CUSTOM ? (
          <Field label="Custom pattern" hint="Use {track} {artist} {album} {title} {year} {genre}, each at most once.">
            <TextInput value={custom} invalid={!patternIsValid} onChange={(event) => setCustom(event.target.value)} />
          </Field>
        ) : null}
        <label className="fn__switch">
          <span>
            <strong>Only fill empty tags</strong>
            <small>Keep what is already written</small>
          </span>
          <Switch label="Only fill empty tags" checked={onlyEmpty} onChange={setOnlyEmpty} />
        </label>
      </div>

      <p className="fn__summary" role="status">
        <Badge>{willChange.length} will change</Badge>
        {alreadyRight ? <Badge tone="neutral">{alreadyRight} already right</Badge> : null}
        {noMatch ? <Badge tone="warn">{noMatch} don’t match the pattern</Badge> : null}
      </p>

      <ul className="fn__preview" aria-label="Preview">
        {plan.slice(0, PREVIEW_LIMIT).map((item) => {
          const track = trackName(item.trackId);
          const fields = Object.keys(item.patch) as FilenameField[];
          return (
            <li key={item.trackId} className={item.parsed ? undefined : "is-nomatch"}>
              <span className="fn__file">{track?.path.replace(/\\/g, "/").split("/").pop()}</span>
              {item.parsed === null ? (
                <span className="fn__result">Doesn’t match the pattern</span>
              ) : fields.length ? (
                <span className="fn__result">{fields.map((field) => `${FIELD_LABEL[field]}: ${item.patch[field]}`).join(" · ")}</span>
              ) : (
                <span className="fn__result fn__result--muted">Nothing to change</span>
              )}
            </li>
          );
        })}
      </ul>
      {plan.length > PREVIEW_LIMIT ? <p className="fn__more">…and {plan.length - PREVIEW_LIMIT} more tracks.</p> : null}
    </Dialog>
  );
}
