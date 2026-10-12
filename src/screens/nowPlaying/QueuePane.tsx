import { IconClose, IconTrash } from "../../components/icons";
import { clearPlayerQueue, loadMoreQueueTracks, playTrackFromQueue, removeTrackFromPlayerQueue } from "../../actions/playback";
import { usePlaybackQueueView } from "../../hooks/usePlaybackQueueView";
import { usePlayerStore } from "../../store/playerStore";
import type { Track } from "../../types";
import { Button, Cover, IconButton, cx } from "../../ui";

/** Playing queue: the previous track, the current one and what comes next. */
export function QueuePane() {
  const playbackTrackId = usePlayerStore((state) => state.playbackTrackId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const { upcomingTracks, historyTracks, hasMoreUpcomingTracks } = usePlaybackQueueView();

  const row = (track: Track, role: "history" | "current" | "next") => (
    <li key={`${role}-${track.id}`} className={cx("np-queue__row", role === "current" && "is-current", role === "history" && "is-history")}>
      <button type="button" className="np-queue__play" onClick={() => void playTrackFromQueue(track)} aria-label={`Play ${track.title || "track"}`}>
        <Cover size={40} radius={8} src={track.coverUrl} />
        <span className="np-queue__text">
          <span className="np-queue__title">{track.title || "Untitled"}</span>
          <span className="np-queue__artist">{role === "current" ? (isPlaying ? "Now playing · " : "Paused · ") : ""}{track.artist || "Unknown artist"}</span>
        </span>
      </button>
      {role !== "history" ? (
        <IconButton label={`Remove ${track.title || "track"} from the queue`} size="sm" onClick={() => removeTrackFromPlayerQueue(track.id)}>
          <IconClose />
        </IconButton>
      ) : null}
    </li>
  );

  const isEmpty = upcomingTracks.length === 0 && historyTracks.length === 0;

  return (
    <aside className="np-queue db-glass db-pane--divider-left" aria-label="Queue">
      <header className="np-queue__head">
        <h2>Up next</h2>
        <Button size="sm" icon={<IconTrash />} disabled={isEmpty} onClick={clearPlayerQueue}>Clear</Button>
      </header>
      <div className="np-queue__scroll">
        {isEmpty ? <p className="np-queue__empty">The queue is empty. Play a track from the library to fill it.</p> : null}
        <ul>
          {historyTracks.map((track) => row(track, "history"))}
          {upcomingTracks.map((track) => row(track, track.id === playbackTrackId ? "current" : "next"))}
        </ul>
        {hasMoreUpcomingTracks ? (
          <Button size="sm" block onClick={loadMoreQueueTracks}>Show more</Button>
        ) : null}
      </div>
    </aside>
  );
}
