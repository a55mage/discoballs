import { type ChangeEvent, type ComponentType, type RefObject, type SVGProps } from "react";
import { Card } from "../components/Card";
import type { Track } from "../types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type TrackDetailsSectionProps = {
  selectedFileName: string;
  selectedFilePath: string;
  hasUnsavedChanges: boolean;
  technicalBadge: string;
  technicalSummary: string;
  coverInputRef: RefObject<HTMLInputElement | null>;
  onCoverFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  editableTrack: Track | null;
  onSelectCoverClick: () => void;
  onRemoveCover: () => void;
  onTrackFieldChange: (field: keyof Track, value: string) => void;
  onSaveTrack: () => void;
  onSaveAndRenameTrack: () => void;
  renamePreview: string;
  onRenameOnlyTrack: () => void;
  onOpenTrackPathClick: () => void;
  onOpenRenameSettings: () => void;
  IconPlus: IconComponent;
  IconTrash: IconComponent;
  IconSave: IconComponent;
  IconSaveRename: IconComponent;
  IconRename: IconComponent;
  IconSettings: IconComponent;
};

export function TrackDetailsSection({
  selectedFileName,
  selectedFilePath,
  hasUnsavedChanges,
  technicalBadge,
  technicalSummary,
  coverInputRef,
  onCoverFileChange,
  editableTrack,
  onSelectCoverClick,
  onRemoveCover,
  onTrackFieldChange,
  onSaveTrack,
  onSaveAndRenameTrack,
  renamePreview,
  onRenameOnlyTrack,
  onOpenTrackPathClick,
  onOpenRenameSettings,
  IconPlus,
  IconTrash,
  IconSave,
  IconSaveRename,
  IconRename,
  IconSettings,
}: TrackDetailsSectionProps) {
  return (
    <Card
      title="Track details"
      className="details-card"
      headerAfterTitle={
        <button
          type="button"
          className="library-path library-path-link"
          onClick={onOpenTrackPathClick}
          disabled={!selectedFilePath}
          title={selectedFilePath || selectedFileName}
          aria-label="Open containing folder"
        >
          {selectedFilePath || selectedFileName}
        </button>
      }
      headerRight={
        <span className={hasUnsavedChanges ? "dirty-indicator" : "dirty-indicator is-hidden"}>
          Unsaved changes
        </span>
      }
    >
      <div className="detail-layout">
        <div className="detail-cover-wrap">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={onCoverFileChange}
            style={{ display: "none" }}
          />
          <div className="detail-cover-shell">
            {editableTrack?.coverUrl ? (
              <img src={editableTrack.coverUrl} alt="Track cover" className="cover detail-cover" />
            ) : (
              <div className="cover-placeholder detail-cover">No cover</div>
            )}
            <div className="cover-actions">
              <button
                className="ghost-button"
                onClick={onSelectCoverClick}
                disabled={!editableTrack}
                title="Carica cover"
                aria-label="Carica cover"
              >
                <span className="btn-content"><IconPlus className="btn-icon" /></span>
              </button>
              <button
                className="ghost-button"
                onClick={onRemoveCover}
                disabled={!editableTrack || !editableTrack.hasCover}
                title="Rimuovi cover"
                aria-label="Rimuovi cover"
              >
                <span className="btn-content"><IconTrash className="btn-icon" /></span>
              </button>
            </div>
          </div>
        </div>

        <div className="detail-form">
          {editableTrack && (
            <div className="detail-technical-row">
              <span className="track-format-badge">{technicalBadge}</span>
              <span className="detail-technical-text">{technicalSummary}</span>
            </div>
          )}
          <label className="floating-field">
            <input
              className="input"
              placeholder=" "
              value={editableTrack?.title ?? ""}
              onChange={(event) => onTrackFieldChange("title", event.target.value)}
            />
            <span className="floating-label">Title</span>
          </label>
          <div className="detail-row-two">
            <label className="floating-field">
              <input
                className="input"
                placeholder=" "
                value={editableTrack?.artist ?? ""}
                onChange={(event) => onTrackFieldChange("artist", event.target.value)}
              />
              <span className="floating-label">Artist</span>
            </label>
            <label className="floating-field">
              <input
                className="input"
                placeholder=" "
                value={editableTrack?.album ?? ""}
                onChange={(event) => onTrackFieldChange("album", event.target.value)}
              />
              <span className="floating-label">Album</span>
            </label>
          </div>
          <div className="short-fields">
            <label className="floating-field">
              <input
                className="input input-short"
                placeholder=" "
                value={editableTrack?.tracknumber ?? ""}
                onChange={(event) => onTrackFieldChange("tracknumber", event.target.value)}
              />
              <span className="floating-label">Track #</span>
            </label>
            <label className="floating-field">
              <input
                className="input input-short"
                placeholder=" "
                value={editableTrack?.year ?? ""}
                onChange={(event) => onTrackFieldChange("year", event.target.value)}
              />
              <span className="floating-label">Year</span>
            </label>
            <label className="floating-field">
              <input
                className="input input-short"
                placeholder=" "
                value={editableTrack?.genre ?? ""}
                onChange={(event) => onTrackFieldChange("genre", event.target.value)}
              />
              <span className="floating-label">Genre</span>
            </label>
            <div className="inline-action-slot">
              <button onClick={onSaveTrack} disabled={!editableTrack} title="Save tags" aria-label="Save tags">
                <span className="btn-content"><IconSave className="btn-icon" /></span>
              </button>
              <button onClick={onSaveAndRenameTrack} disabled={!editableTrack} title="Save tags + rename file" aria-label="Save tags + rename file">
                <span className="btn-content"><IconSaveRename className="btn-icon" /></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rename-preview-row">
        <label className="rename-preview-field">
          Renamed filename preview
          <input className="input" readOnly value={renamePreview} />
        </label>
        <div className="rename-preview-actions">
          <button onClick={onRenameOnlyTrack} disabled={!editableTrack} title="Rename file" aria-label="Rename file">
            <span className="btn-content"><IconRename className="btn-icon" /></span>
          </button>
          <button className="ghost-button" onClick={onOpenRenameSettings} disabled={!editableTrack} title="Rename settings" aria-label="Rename settings">
            <span className="btn-content"><IconSettings className="btn-icon" /></span>
          </button>
        </div>
      </div>
    </Card>
  );
}
