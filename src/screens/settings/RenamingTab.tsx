import { IconClose, IconPlus } from "../../components/icons";
import { RENAME_FIELD_OPTIONS, renameFieldLabel } from "../../domain/rename";
import { useLibraryStore } from "../../store/libraryStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { Track } from "../../types";
import { buildRenamePreview } from "../../utils/appHelpers";
import { Chip, Field, IconButton, TextInput } from "../../ui";

const SAMPLE: Track = {
  id: "sample",
  path: "/Music/Solid Gold.mp3",
  title: "Solid Gold",
  artist: "Battle Tapes",
  album: "Polygon",
  tracknumber: "3",
  year: "2015",
  genre: "Electronic",
  hasCover: false,
};

const SEPARATORS = [" - ", " – ", " _ ", " "];

export function RenamingTab() {
  const s = useSettingsStore();
  const selected = useLibraryStore((state) => state.tracks.find((track) => track.id === state.selectedTrackId));
  const example = selected && selected.title ? selected : SAMPLE;
  const available = RENAME_FIELD_OPTIONS.filter((option) => !s.renameFields.includes(option.key));

  return (
    <>
      <h2 className="set__heading db-text-display">File renaming</h2>
      <p className="set__hint">Choose which tags build the file name and in what order. “Save &amp; rename” in the Tag Editor uses this pattern.</p>

      <h3 className="set__subheading">Pattern</h3>
      <ol className="set__pattern" aria-label="Fields in the file name">
        {s.renameFields.map((field, index) => (
          <li key={field} className="set__pattern-item">
            <span className="set__pattern-index">{index + 1}</span>
            <span className="set__pattern-name">{renameFieldLabel(field)}</span>
            <IconButton label={`Move ${renameFieldLabel(field)} earlier`} size="sm" disabled={index === 0} onClick={() => s.moveRenameField(field, -1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /></svg>
            </IconButton>
            <IconButton label={`Move ${renameFieldLabel(field)} later`} size="sm" disabled={index === s.renameFields.length - 1} onClick={() => s.moveRenameField(field, 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l6 6 6-6" /></svg>
            </IconButton>
            <IconButton label={`Remove ${renameFieldLabel(field)}`} size="sm" disabled={s.renameFields.length <= 1} onClick={() => s.toggleRenameField(field)}>
              <IconClose />
            </IconButton>
          </li>
        ))}
      </ol>
      {available.length ? (
        <div className="set__chips" role="group" aria-label="Fields you can add">
          {available.map((option) => (
            <Chip key={option.key} onClick={() => s.toggleRenameField(option.key)}>
              <IconPlus width={12} height={12} aria-hidden="true" />
              {option.label}
            </Chip>
          ))}
        </div>
      ) : null}

      <h3 className="set__subheading">Separator</h3>
      <div className="set__separator">
        <div className="set__separator-input">
          <Field label="Between fields">
            <TextInput value={s.renameSeparator} onChange={(event) => s.setRenameSeparator(event.target.value)} />
          </Field>
        </div>
        <div className="set__chips" role="group" aria-label="Separator presets">
          {SEPARATORS.map((separator) => (
            <Chip key={separator} on={s.renameSeparator === separator} onClick={() => s.setRenameSeparator(separator)}>
              {separator === " " ? "space" : `“${separator}”`}
            </Chip>
          ))}
        </div>
      </div>

      <div className="set__preview" aria-live="polite">
        <span className="set__preview-label">Preview{selected && selected.title ? " (selected track)" : " (example)"}</span>
        <strong>{buildRenamePreview(example, s.renameFields, s.renameSeparator)}</strong>
      </div>
    </>
  );
}
