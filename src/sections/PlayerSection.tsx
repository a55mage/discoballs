import type { RefObject } from "react";
import { Card } from "../components/Card";
import { MusicVisualizerSection } from "./MusicVisualizerSection";
import type { Track } from "../types";

type PlayerSectionProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isActive: boolean;
  hasAudio: boolean;
  isPlaying: boolean;
  coverUrl?: string;
  currentTime: number;
  duration: number;
  title: string;
  artist: string;
  accentColor: string;
  isDarkMode: boolean;
  queueTracks: Track[];
  playbackTrackId: string;
  onQueueTrackClick: (track: Track) => void;
};

export function PlayerSection({
  audioRef,
  isActive,
  hasAudio,
  isPlaying,
  coverUrl,
  currentTime,
  duration,
  title,
  artist,
  accentColor,
  isDarkMode,
  queueTracks,
  playbackTrackId,
  onQueueTrackClick,
}: PlayerSectionProps) {
  return (
    <main className="player-layout">
      <div className="player-main">
        <MusicVisualizerSection
          audioRef={audioRef}
          isActive={isActive}
          hasAudio={hasAudio}
          isPlaying={isPlaying}
          coverUrl={coverUrl}
          currentTime={currentTime}
          duration={duration}
          title={title}
          artist={artist}
          accentColor={accentColor}
          isDarkMode={isDarkMode}
        />
      </div>
      <div className="player-queue">
        <Card title="Playback Queue">
          <ul className="queue-list">
            {queueTracks.map((track) => (
              <li key={track.id}>
                <button
                  className={track.id === playbackTrackId ? "queue-item active" : "queue-item"}
                  onClick={() => onQueueTrackClick(track)}
                >
                  <strong>{track.title || "Untitled"}</strong>
                  <small>{track.artist || "Unknown artist"}</small>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
