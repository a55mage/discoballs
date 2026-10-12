import { type KeyboardEvent, useMemo } from "react";
import { saveTrackTags } from "../../actions/tagEditor";
import { getDraftChanges } from "../../domain/matches";
import { useLibraryStore } from "../../store/libraryStore";
import { useTagEditorStore } from "../../store/tagEditorStore";
import { EditorPane } from "./EditorPane";
import { FileList } from "./FileList";
import { MatchesPane } from "./MatchesPane";
import "./tagEditor.css";

export function TagEditorScreen() {
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const draft = useTagEditorStore((state) => state.trackDraft);
  const saved = useMemo(() => tracks.find((track) => track.id === selectedTrackId) ?? null, [tracks, selectedTrackId]);
  const changes = useMemo(() => getDraftChanges(saved, draft), [saved, draft]);

  // Ctrl/Cmd+S saves the tags of the track being edited.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (changes.length && draft?.source?.type !== "navidrome") {
        void saveTrackTags();
      }
    }
  }

  return (
    <div className="tag-screen" onKeyDown={onKeyDown}>
      <FileList dirty={changes.length > 0} />
      <div className="tag-main">
        {saved && draft ? (
          <EditorPane saved={saved} draft={draft} changes={changes} />
        ) : (
          <div className="tag-empty">
            <h2 className="db-text-display">{tracks.length ? "Pick a track to edit" : "No music yet"}</h2>
            <p>{tracks.length ? "Choose a file on the left to edit its tags, artwork and name." : "Open a music folder from the header to start tagging."}</p>
          </div>
        )}
      </div>
      <MatchesPane draft={draft} readOnly={draft?.source?.type === "navidrome"} />
    </div>
  );
}
