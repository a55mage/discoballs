import { useMemo } from "react";
import { summarizeGenres } from "../../domain/library";
import { NO_GENRE_EQ_KEY } from "../../utils/appHelpers";
import { useEqualizerStore } from "../../store/equalizerStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useSettingsStore } from "../../store/settingsStore";
import { Badge, Field, SettingRow, Select, Switch } from "../../ui";
import { EqualizerStudio } from "./EqualizerStudio";

export function AudioTab() {
  const settings = useSettingsStore();
  const eq = useEqualizerStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const genres = useMemo(() => summarizeGenres(tracks), [tracks]);
  const mappingRows = [{ key: NO_GENRE_EQ_KEY, label: "Tracks without a genre" }, ...genres];

  return (
    <>
      <h2 className="set__heading db-text-display">Audio &amp; Equalizer</h2>
      <EqualizerStudio />

      <div className="set__group">
        <SettingRow title="Auto EQ by genre" description="Applies the preset mapped to the genre of the track that is playing.">
          <Switch label="Auto EQ by genre" checked={settings.audioAutoEq} onChange={settings.setAudioAutoEq} />
        </SettingRow>
        <SettingRow title="Startup preset" description="The equalizer preset used when the app starts.">
          <Select aria-label="Startup equalizer preset" value={eq.startupEqualizerPresetId} onChange={(event) => eq.setStartupEqualizerPresetId(event.target.value)}>
            <option value="">Use last active preset</option>
            {eq.equalizerPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow title="Normalize volume" description="Loudness matching between tracks." badge={<Badge tone="neutral">Coming soon</Badge>}>
          <Switch label="Normalize volume" checked={settings.audioNormalizeVolume} onChange={settings.setAudioNormalizeVolume} disabled />
        </SettingRow>
        <SettingRow title="Smart crossfade" description="Blend the end of a track into the next one." badge={<Badge tone="neutral">Coming soon</Badge>}>
          <Switch label="Smart crossfade" checked={settings.audioSmartCrossfade} onChange={settings.setAudioSmartCrossfade} disabled />
        </SettingRow>
      </div>

      <details className="set__details">
        <summary>Genre → preset mapping</summary>
        <p className="set__hint">Used by Auto EQ. Genres come from your library.</p>
        <div className="set__mapping">
          {mappingRows.map((row) => (
            <Field key={row.key} label={row.label}>
              <Select value={eq.genreEqPresetMap[row.key] ?? ""} onChange={(event) => eq.setGenreEqPreset(row.key, event.target.value)}>
                <option value="">No preset</option>
                {eq.equalizerPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
        {genres.length === 0 ? <p className="set__hint">No genres in the library yet.</p> : null}
      </details>
    </>
  );
}
