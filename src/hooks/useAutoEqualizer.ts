import { useEffect } from "react";
import { useEqualizerStore } from "../store/equalizerStore";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { useSettingsStore } from "../store/settingsStore";
import { inferGenrePresetId, normalizeGenreKey, NO_GENRE_EQ_KEY } from "../utils/appHelpers";
import { summarizeGenres } from "../domain/library";

/** Applies the equalizer preset mapped to the genre of the current track while Auto EQ is on. */
export function useAutoEqualizer(): void {
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedTrackId = useLibraryStore((state) => state.selectedTrackId);
  const playbackTrackId = usePlayerStore((state) => state.playbackTrackId);
  const audioAutoEq = useSettingsStore((state) => state.audioAutoEq);
  const equalizer = useEqualizerStore();
  const { equalizerPresets, genreEqPresetMap, syncGenreEqMap, applyPreset } = equalizer;

  // Keep the genre → preset map filled for every genre present in the library.
  useEffect(() => {
    syncGenreEqMap(summarizeGenres(tracks));
  }, [equalizerPresets, tracks]);

  const playbackTrack = tracks.find((track) => track.id === playbackTrackId) ?? null;
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;

  useEffect(() => {
    if (!audioAutoEq) {
      return;
    }
    const currentTrack = playbackTrack ?? selectedTrack;
    if (!currentTrack) {
      return;
    }
    const currentGenre = String(currentTrack.genre || "");
    const mapKey = normalizeGenreKey(currentGenre) || NO_GENRE_EQ_KEY;
    const presetId = genreEqPresetMap[mapKey] || inferGenrePresetId(currentGenre);
    const preset = presetId ? equalizerPresets.find((item) => item.id === presetId) : undefined;
    if (!preset) {
      return;
    }
    const hasSameBandGains =
      equalizer.equalizerBandGains.length === preset.bandGains.length &&
      equalizer.equalizerBandGains.every((value, index) => value === preset.bandGains[index]);
    if (
      equalizer.equalizerPresetId === preset.id &&
      equalizer.equalizerPresetName === preset.name &&
      hasSameBandGains &&
      equalizer.equalizerPreampDb === preset.preampDb &&
      equalizer.equalizerWetMixPercent === preset.wetMixPercent
    ) {
      return;
    }
    applyPreset(preset.id, preset.name, preset.bandGains, preset.preampDb, preset.wetMixPercent);
  }, [
    audioAutoEq,
    playbackTrack,
    selectedTrack,
    genreEqPresetMap,
    equalizerPresets,
    equalizer.equalizerPresetId,
    equalizer.equalizerPresetName,
    equalizer.equalizerBandGains,
    equalizer.equalizerPreampDb,
    equalizer.equalizerWetMixPercent,
  ]);
}
