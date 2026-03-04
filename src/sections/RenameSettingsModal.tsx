import { type ComponentType, type SVGProps } from "react";
import type { RenameField } from "../types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type RenameSettingsModalProps = {
  show: boolean;
  renameFields: RenameField[];
  renameFieldOptions: Array<{ key: RenameField; label: string }>;
  renameSeparator: string;
  onClose: () => void;
  onMoveRenameField: (field: RenameField, direction: -1 | 1) => void;
  onToggleRenameField: (field: RenameField) => void;
  onRenameSeparatorChange: (value: string) => void;
  renameFieldLabel: (field: RenameField) => string;
  IconClose: IconComponent;
  IconArrowUp: IconComponent;
  IconArrowDown: IconComponent;
  IconCheck: IconComponent;
};

export function RenameSettingsModal({
  show,
  renameFields,
  renameFieldOptions,
  renameSeparator,
  onClose,
  onMoveRenameField,
  onToggleRenameField,
  onRenameSeparatorChange,
  renameFieldLabel,
  IconClose,
  IconArrowUp,
  IconArrowDown,
  IconCheck,
}: RenameSettingsModalProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>File rename settings</h3>
          <button className="ghost-button" onClick={onClose} title="Close" aria-label="Close">
            <span className="btn-content"><IconClose className="btn-icon" /></span>
          </button>
        </div>
        <p className="muted compact">Choose fields, order, and separator for the final filename.</p>

        <div className="rename-fields">
          {renameFields.map((field) => (
            <div key={field} className="rename-field-row">
              <label className="rename-field-check">{renameFieldLabel(field)}</label>
              <div className="rename-field-controls">
                <button className="ghost-button" onClick={() => onMoveRenameField(field, -1)} title="Move up" aria-label="Move up">
                  <span className="btn-content"><IconArrowUp className="btn-icon" /></span>
                </button>
                <button className="ghost-button" onClick={() => onMoveRenameField(field, 1)} title="Move down" aria-label="Move down">
                  <span className="btn-content"><IconArrowDown className="btn-icon" /></span>
                </button>
                <button className="ghost-button" onClick={() => onToggleRenameField(field)} disabled={renameFields.length <= 1} title="Remove" aria-label="Remove">
                  <span className="btn-content"><IconClose className="btn-icon" /></span>
                </button>
              </div>
            </div>
          ))}
          {renameFieldOptions.filter((option) => !renameFields.includes(option.key)).map((option) => (
            <div key={option.key} className="rename-field-row">
              <label className="rename-field-check">{option.label}</label>
              <div className="rename-field-controls">
                <button className="ghost-button" onClick={() => onToggleRenameField(option.key)} title="Add" aria-label="Add">
                  <span className="btn-content"><IconCheck className="btn-icon" /></span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <label>
          Separator
          <input className="input input-short" value={renameSeparator} onChange={(event) => onRenameSeparatorChange(event.target.value)} />
        </label>
      </div>
    </div>
  );
}
