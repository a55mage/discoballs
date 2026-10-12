import { type ChangeEvent, useRef } from "react";
import { IconCover, IconSave, IconSaveRename, IconSettings, IconTrash } from "../../components/icons";
import { changeDraftField, loadDraftCoverFromFile, removeDraftCover, renameTrackFileOnly, revertDraft, saveTrackTags, saveTrackTagsAndRename } from "../../actions/tagEditor";
import { openTrackInFileManager } from "../../actions/library";
import type { DraftChange } from "../../domain/matches";
import { RENAME_FIELD_OPTIONS } from "../../domain/rename";
import { useTrackTechnicalInfo } from "../../hooks/useTrackTechnicalInfo";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import type { Track } from "../../types";
import { buildRenamePreview, formatTrackTechnicalBadge, formatTrackTechnicalSummary } from "../../utils/appHelpers";
import { getFileName } from "../../utils/common";
import { Badge, Button, Cover, Field, IconButton, TextInput } from "../../ui";

type FieldDef = { key: "title" | "artist" | "album" | "tracknumber" | "year" | "genre"; label: string; span: number };

const FIELDS: FieldDef[] = [
  { key: "title", label: "Title", span: 6 },
  { key: "artist", label: "Artist", span: 3 },
  { key: "album", label: "Album", span: 3 },
  { key: "tracknumber", label: "Track #", span: 2 },
  { key: "year", label: "Year", span: 2 },
  { key: "genre", label: "Genre", span: 2 },
];

type EditorPaneProps = {
  saved: Track;
  draft: Track;
  changes: DraftChange[];
};

export function EditorPane({ saved, draft, changes }: EditorPaneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { renameFields, renameSeparator } = useSettingsStore();
  const { setActiveScreen, setSettingsTab, setHistoryOpen, setFilenameTags } = useUiStore();
  const info = useTrackTechnicalInfo(draft);
  const changed = new Set(changes.map((change) => change.field));
  const isRemote = draft.source?.type === "navidrome";
  const hasChanges = changes.length > 0;

  const currentName = getFileName(saved.path);
  const nextName = buildRenamePreview(draft, renameFields, renameSeparator);
  const willRename = nextName !== currentName;

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      loadDraftCoverFromFile(file);
    }
  }

  return (
    <div className="tag-editor">
      <div className="tag-editor__scroll">
        <div className="tag-editor__top">
          <div className="tag-cover">
            <Cover src={draft.coverUrl} size={240} radius={12} alt={`Cover of ${draft.album || draft.title}`} />
            <div className="tag-cover__actions">
              <Button size="sm" block icon={<IconCover />} disabled={isRemote} onClick={() => fileInputRef.current?.click()}>
                Replace
              </Button>
              <IconButton label="Remove cover" disabled={isRemote || (!draft.coverUrl && !draft.hasCover)} onClick={removeDraftCover}>
                <IconTrash />
              </IconButton>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
            {changed.has("cover") ? <Badge className="tag-cover__badge">Cover changed</Badge> : null}
          </div>

          <div className="tag-fields-wrap">
            <div className="tag-tech">
              <Badge>{formatTrackTechnicalBadge(info, draft.path)}</Badge>
              <span>{formatTrackTechnicalSummary(info)}</span>
            </div>
            <button type="button" className="tag-path" title="Show in file manager" onClick={() => void openTrackInFileManager(draft.path)}>
              {draft.path}
            </button>
            <div className="tag-fields">
              {FIELDS.map((field) => (
                <div key={field.key} style={{ gridColumn: `span ${field.span}` }}>
                  <Field label={field.label}>
                    <TextInput
                      value={draft[field.key]}
                      changed={changed.has(field.key)}
                      disabled={isRemote}
                      placeholder="Unknown"
                      onChange={(event) => changeDraftField(field.key, event.target.value)}
                    />
                  </Field>
                </div>
              ))}
            </div>
            <Button size="sm" className="tag-fromname" disabled={isRemote} onClick={() => setFilenameTags({ ids: [saved.id], mode: "draft" })}>
              Fill from file name…
            </Button>
            {isRemote ? <p className="tag-note">Tracks of a Navidrome server are read-only.</p> : null}
          </div>
        </div>

        <section className="tag-rename" aria-label="File name">
          <header>
            <h3>File name</h3>
            <Button size="sm" icon={<IconSettings />} onClick={() => {
              setSettingsTab("renaming");
              setActiveScreen("settings");
            }}>Pattern</Button>
          </header>
          <div className="tag-rename__chips" aria-label="Pattern fields">
            {renameFields.map((field, index) => (
              <Badge key={field + index}>{RENAME_FIELD_OPTIONS.find((option) => option.key === field)?.label ?? field}</Badge>
            ))}
            <span className="tag-rename__sep">separator “{renameSeparator}”</span>
          </div>
          <div className="tag-rename__names">
            <span className="tag-rename__current" title={currentName}>{currentName}</span>
            <span aria-hidden="true">→</span>
            <strong className={willRename ? "is-new" : undefined} title={nextName}>{nextName}</strong>
          </div>
          <Button size="sm" disabled={isRemote || !willRename} onClick={() => void renameTrackFileOnly()}>Rename file only</Button>
        </section>
      </div>

      <footer className="tag-editor__bar">
        <span className="tag-editor__status" role="status">
          {hasChanges ? `${changes.length} unsaved ${changes.length === 1 ? "change" : "changes"}: ${changes.map((change) => change.label).join(", ")}` : "No unsaved changes"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>History</Button>
        <Button disabled={!hasChanges} onClick={revertDraft}>Revert</Button>
        <Button icon={<IconSave />} disabled={isRemote || !hasChanges} onClick={() => void saveTrackTags()}>Save tags</Button>
        <Button variant="primary" icon={<IconSaveRename />} disabled={isRemote || (!hasChanges && !willRename)} onClick={() => void saveTrackTagsAndRename()}>
          Save &amp; rename
        </Button>
      </footer>
    </div>
  );
}
