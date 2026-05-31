import { type ComponentType, type CSSProperties, type KeyboardEvent, type RefObject, type SVGProps, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { EQUALIZER_FREQUENCIES } from "../utils/audioGraph";
import { getOrCreateMediaAudioGraph } from "../utils/audioGraph";
import { NO_GENRE_EQ_KEY } from "../utils/appHelpers";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type SettingsSectionProps = {
  autoOpenDefaultFolder: boolean;
  onAutoOpenDefaultFolderChange: (value: boolean) => void;
  startupScreen: "tagging" | "library" | "dashboard" | "player";
  onStartupScreenChange: (value: "tagging" | "library" | "dashboard" | "player") => void;
  defaultFolderPath: string;
  onChooseDefaultFolder: () => void;
  folderPath: string;
  onUseCurrentLibraryFolder: () => void;
  audioAutoEq: boolean;
  onAudioAutoEqChange: (value: boolean) => void;
  audioNormalizeVolume: boolean;
  onAudioNormalizeVolumeChange: (value: boolean) => void;
  audioSmartCrossfade: boolean;
  onAudioSmartCrossfadeChange: (value: boolean) => void;
  libraryGenres: Array<{ key: string; label: string }>;
  genreEqPresetMap: Record<string, string>;
  onGenreEqPresetChange: (genreKey: string, presetId: string) => void;
  colorMode: "light" | "dark";
  onColorModeChange: (value: "light" | "dark") => void;
  accentThemes: Array<{ accent: string }>;
  activeAccentIndex: number;
  onActiveAccentIndexChange: (index: number) => void;
  onAccentColorChange: (index: number, color: string) => void;
  onAddAccentTheme: () => void;
  onRemoveAccentTheme: (index: number) => void;
  onResetAccentThemes: () => void;
  accentRotateOnLaunch: boolean;
  onAccentRotateOnLaunchChange: (value: boolean) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
  accentColor: string;
  equalizerPresets: Array<{ id: string; name: string }>;
  startupEqualizerPresetId: string;
  onStartupEqualizerPresetIdChange: (value: string) => void;
  equalizerPresetId: string;
  onEqualizerPresetIdChange: (value: string) => void;
  onEqualizerPresetChange: (presetId: string) => void;
  equalizerPresetName: string;
  onEqualizerPresetNameChange: (value: string) => void;
  isEqualizerPresetRenaming: boolean;
  onEqualizerPresetNameInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  equalizerBandGains: number[];
  onEqualizerBandGainChange: (index: number, value: number) => void;
  equalizerPreampDb: number;
  onEqualizerPreampDbChange: (value: number) => void;
  equalizerWetMixPercent: number;
  onEqualizerWetMixPercentChange: (value: number) => void;
  canRenameDeleteEqualizerPreset: boolean;
  onCreateEqualizerPreset: () => void;
  onRenameEqualizerPreset: () => void;
  onDeleteEqualizerPreset: () => void;
  onSaveEqualizerPreset: () => void;
  onResetEqualizer: () => void;
  IconPlus: IconComponent;
  IconRename: IconComponent;
  IconTrash: IconComponent;
  IconSave: IconComponent;
  IconFolder: IconComponent;
  IconExternalLink: IconComponent;
};

export function SettingsSection({
  autoOpenDefaultFolder,
  onAutoOpenDefaultFolderChange,
  startupScreen,
  onStartupScreenChange,
  defaultFolderPath,
  onChooseDefaultFolder,
  folderPath,
  onUseCurrentLibraryFolder,
  audioAutoEq,
  onAudioAutoEqChange,
  audioNormalizeVolume,
  onAudioNormalizeVolumeChange,
  audioSmartCrossfade,
  onAudioSmartCrossfadeChange,
  libraryGenres,
  genreEqPresetMap,
  onGenreEqPresetChange,
  colorMode,
  onColorModeChange,
  accentThemes,
  activeAccentIndex,
  onActiveAccentIndexChange,
  onAccentColorChange,
  onAddAccentTheme,
  onRemoveAccentTheme,
  onResetAccentThemes,
  accentRotateOnLaunch,
  onAccentRotateOnLaunchChange,
  audioRef,
  accentColor,
  equalizerPresets,
  startupEqualizerPresetId,
  onStartupEqualizerPresetIdChange,
  equalizerPresetId,
  onEqualizerPresetIdChange,
  onEqualizerPresetChange,
  equalizerPresetName,
  onEqualizerPresetNameChange,
  isEqualizerPresetRenaming,
  onEqualizerPresetNameInputKeyDown,
  equalizerBandGains,
  onEqualizerBandGainChange,
  equalizerPreampDb,
  onEqualizerPreampDbChange,
  equalizerWetMixPercent,
  onEqualizerWetMixPercentChange,
  canRenameDeleteEqualizerPreset,
  onCreateEqualizerPreset,
  onRenameEqualizerPreset,
  onDeleteEqualizerPreset,
  onSaveEqualizerPreset,
  onResetEqualizer,
  IconPlus,
  IconRename,
  IconTrash,
  IconSave,
  IconFolder,
  IconExternalLink,
}: SettingsSectionProps) {
  const curveBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const curveBgContainerRef = useRef<HTMLDivElement | null>(null);
  const [isGenreEqAccordionOpen, setIsGenreEqAccordionOpen] = useState(false);

  const eqCurvePath = useMemo(() => {
    const points = equalizerBandGains.map((value, index) => ({
      x: (index / Math.max(1, equalizerBandGains.length - 1)) * 100,
      y: 50 - (value / 12) * 42,
    }));
    if (!points.length) {
      return "";
    }
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const prev = points[Math.max(0, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const after = points[Math.min(points.length - 1, index + 2)];
      const cp1x = current.x + (next.x - prev.x) / 6;
      const cp1y = current.y + (next.y - prev.y) / 6;
      const cp2x = next.x - (after.x - current.x) / 6;
      const cp2y = next.y - (after.y - current.y) / 6;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return path;
  }, [equalizerBandGains]);

  const eqAverageGain = useMemo(() => {
    if (!equalizerBandGains.length) {
      return 0;
    }
    const total = equalizerBandGains.reduce((sum, value) => sum + value, 0);
    return total / equalizerBandGains.length;
  }, [equalizerBandGains]);

  useEffect(() => {
    const canvas = curveBgCanvasRef.current;
    const container = curveBgContainerRef.current;
    if (!canvas || !container) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = Math.max(260, Math.floor(container.clientWidth));
      const height = Math.max(140, Math.floor(container.clientHeight));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof window.ResizeObserver === "function") {
      resizeObserver = new window.ResizeObserver(resize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", resize);
    }

    let frameId: number | null = null;
    const draw = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.clearRect(0, 0, width, height);

      const audio = audioRef.current;
      const graph = audio ? getOrCreateMediaAudioGraph(audio) : null;
      if (!graph) {
        frameId = requestAnimationFrame(draw);
        return;
      }
      graph.analyser.getByteFrequencyData(graph.frequencyData);
      drawXpBars(ctx, width, height, graph.frequencyData, accentColor, 0.2);
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resize);
      }
    };
  }, [audioRef, accentColor]);

  return (
    <main className="settings-layout">
      <div className="settings-main-column">
        <Card title="Settings" className="settings-main-card">
          <div className="settings-main-content">
            <section className="settings-block">
              <h3 className="settings-block-title">General</h3>
              <div className="settings-grid">
                <label className="settings-toggle">
                  <input type="checkbox" checked={autoOpenDefaultFolder} onChange={(event) => onAutoOpenDefaultFolderChange(event.target.checked)} />
                  <span>Auto-open default folder on launch</span>
                </label>
                <label className="settings-field">
                  <span>Startup screen</span>
                  <select
                    className="input playlist-control settings-genre-eq-select"
                    value={startupScreen}
                    onChange={(event) => onStartupScreenChange(event.target.value as "tagging" | "library" | "dashboard" | "player")}
                    aria-label="Startup screen"
                  >
                    <option value="tagging">Music tagging</option>
                    <option value="library">Library</option>
                    <option value="dashboard">Playlist editor</option>
                    <option value="player">Player</option>
                  </select>
                </label>
                <div className="settings-readonly-path" title={defaultFolderPath || "No default folder selected"}>
                  {defaultFolderPath || "No default folder selected"}
                </div>
                <div className="settings-inline-actions">
                  <button className="ghost-button" onClick={onChooseDefaultFolder}>
                    <span className="btn-content"><IconFolder className="btn-icon" />Choose folder</span>
                  </button>
                  <button className="ghost-button" onClick={onUseCurrentLibraryFolder} disabled={!folderPath}>
                    <span className="btn-content"><IconExternalLink className="btn-icon" />Use current</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-block">
              <h3 className="settings-block-title">Audio Settings</h3>
              <div className="settings-grid">
                <label className="settings-toggle">
                  <input type="checkbox" checked={audioAutoEq} onChange={(event) => onAudioAutoEqChange(event.target.checked)} />
                  <span>Auto EQ by track genre</span>
                </label>
                <label className="settings-field">
                  <span>Startup EQ preset</span>
                  <select
                    className="input playlist-control settings-genre-eq-select"
                    value={startupEqualizerPresetId}
                    onChange={(event) => onStartupEqualizerPresetIdChange(event.target.value)}
                    aria-label="Startup equalizer preset"
                  >
                    <option value="">Use last active preset</option>
                    {equalizerPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" checked={audioNormalizeVolume} onChange={(event) => onAudioNormalizeVolumeChange(event.target.checked)} />
                  <span>Normalize playback volume (planned)</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" checked={audioSmartCrossfade} onChange={(event) => onAudioSmartCrossfadeChange(event.target.checked)} />
                  <span>Smart crossfade between tracks (planned)</span>
                </label>
              </div>
              <div className="settings-genre-eq-map">
                <button
                  type="button"
                  className="ghost-button settings-accordion-toggle"
                  onClick={() => setIsGenreEqAccordionOpen((prev) => !prev)}
                  aria-expanded={isGenreEqAccordionOpen}
                  title={isGenreEqAccordionOpen ? "Collapse Auto EQ genre mapping" : "Expand Auto EQ genre mapping"}
                >
                  <span className="settings-subtitle">Auto EQ genre mapping</span>
                  <span aria-hidden="true">{isGenreEqAccordionOpen ? "▾" : "▸"}</span>
                </button>
                {isGenreEqAccordionOpen && (
                  <>
                    <div className="settings-genre-eq-list">
                      <label className="settings-genre-eq-row">
                        <span>Default (no genre)</span>
                        <select
                          className="input playlist-control settings-genre-eq-select"
                          value={genreEqPresetMap[NO_GENRE_EQ_KEY] ?? ""}
                          onChange={(event) => onGenreEqPresetChange(NO_GENRE_EQ_KEY, event.target.value)}
                          aria-label="Preset mapping for tracks without genre"
                        >
                          <option value="">No preset</option>
                          {equalizerPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.name}</option>
                          ))}
                        </select>
                      </label>
                      {libraryGenres.map((genre) => (
                        <label key={genre.key} className="settings-genre-eq-row">
                          <span>{genre.label}</span>
                          <select
                            className="input playlist-control settings-genre-eq-select"
                            value={genreEqPresetMap[genre.key] ?? ""}
                            onChange={(event) => onGenreEqPresetChange(genre.key, event.target.value)}
                            aria-label={`Preset mapping for ${genre.label}`}
                          >
                            <option value="">No preset</option>
                            {equalizerPresets.map((preset) => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    {!libraryGenres.length && <p className="muted">No genres found in library yet.</p>}
                  </>
                )}
              </div>
            </section>

            <section className="settings-block">
              <h3 className="settings-block-title">Appearance</h3>
              <div className="settings-grid">
                <label className="settings-toggle">
                  <input type="checkbox" checked={colorMode === "dark"} onChange={(event) => onColorModeChange(event.target.checked ? "dark" : "light")} />
                  <span>Enable dark mode</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" checked={accentRotateOnLaunch} onChange={(event) => onAccentRotateOnLaunchChange(event.target.checked)} />
                  <span>Rotate accent palette on launch</span>
                </label>
                <div className="settings-inline-actions">
                  <button className="ghost-button" onClick={onAddAccentTheme}>
                    <span className="btn-content"><IconPlus className="btn-icon" />Add accent</span>
                  </button>
                  <button className="ghost-button" onClick={onResetAccentThemes}>
                    <span className="btn-content"><IconExternalLink className="btn-icon" />Reset defaults</span>
                  </button>
                </div>
                <div className="accent-theme-list">
                  {accentThemes.map((theme, index) => (
                    <div
                      key={`${theme.accent}-${index}`}
                      className={activeAccentIndex === index ? "accent-theme-item is-active" : "accent-theme-item"}
                    >
                      <div className="accent-item-head">
                        <button
                          className="ghost-button accent-select-btn"
                          type="button"
                          onClick={() => onActiveAccentIndexChange(index)}
                          title="Set as default accent"
                          aria-label="Set as default accent"
                        >
                          <span className="accent-swatch" style={{ background: theme.accent }} />
                          <span>Accent {index + 1}</span>
                        </button>
                        <button
                          className="ghost-button mini-icon"
                          type="button"
                          onClick={() => onRemoveAccentTheme(index)}
                          disabled={accentThemes.length <= 1}
                          title="Remove accent"
                          aria-label="Remove accent"
                        >
                          <IconTrash className="btn-icon" />
                        </button>
                      </div>
                      <input
                        type="color"
                        className="accent-color-input"
                        value={theme.accent}
                        onChange={(event) => onAccentColorChange(index, event.target.value)}
                        aria-label={`Accent ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </Card>
      </div>

      <div className="settings-eq-column">
        <Card
          title="Equalizer Studio"
          className="settings-eq-card"
          headerRight={(
            <div className="playlist-toolbar settings-eq-toolbar">
              {isEqualizerPresetRenaming ? (
                <input
                  className="input playlist-control settings-eq-input"
                  value={equalizerPresetName}
                  onChange={(event) => onEqualizerPresetNameChange(event.target.value)}
                  onKeyDown={onEqualizerPresetNameInputKeyDown}
                  placeholder="Preset name"
                  aria-label="Preset name"
                  autoFocus
                />
              ) : (
                <select
                  className="input playlist-control settings-eq-input"
                  value={equalizerPresetId}
                  onChange={(event) => {
                    const nextPresetId = event.target.value;
                    if (!nextPresetId) {
                      onEqualizerPresetIdChange("");
                      return;
                    }
                    onEqualizerPresetChange(nextPresetId);
                  }}
                  disabled={!equalizerPresets.length}
                  aria-label="Select equalizer preset"
                  title="Select equalizer preset"
                >
                  {!equalizerPresets.length && <option value="">No presets available</option>}
                  <option value="">Custom</option>
                  {equalizerPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              )}
              <button className="ghost-button" onClick={onCreateEqualizerPreset} title="Create preset" aria-label="Create preset">
                <span className="btn-content"><IconPlus className="btn-icon" /></span>
              </button>
              <button
                className="ghost-button"
                onClick={onRenameEqualizerPreset}
                disabled={!canRenameDeleteEqualizerPreset}
                title={isEqualizerPresetRenaming ? "Confirm rename preset" : "Rename preset"}
                aria-label={isEqualizerPresetRenaming ? "Confirm rename preset" : "Rename preset"}
              >
                <span className="btn-content"><IconRename className="btn-icon" /></span>
              </button>
              <button
                className="ghost-button"
                onClick={onDeleteEqualizerPreset}
                disabled={!canRenameDeleteEqualizerPreset}
                title="Delete preset"
                aria-label="Delete preset"
              >
                <span className="btn-content"><IconTrash className="btn-icon" /></span>
              </button>
              <button className="ghost-button" onClick={onSaveEqualizerPreset} title="Save preset" aria-label="Save preset">
                <span className="btn-content"><IconSave className="btn-icon" /></span>
              </button>
            </div>
          )}
        >
          <div className="settings-eq-layout">
            <div className="settings-eq-curve-panel">
              <div className="settings-eq-curve-head">
                <strong>Tone Curve</strong>
                <small>Avg gain {eqAverageGain >= 0 ? "+" : ""}{eqAverageGain.toFixed(1)} dB</small>
              </div>
              <div className="settings-eq-curve-stage" ref={curveBgContainerRef}>
                <canvas ref={curveBgCanvasRef} className="settings-eq-curve-bg-canvas" aria-hidden="true" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="settings-eq-curve" role="img" aria-label="Equalizer curve preview">
                  <line x1="0" y1="50" x2="100" y2="50" className="settings-eq-curve-midline" />
                  <path d={eqCurvePath} className="settings-eq-curve-line" />
                </svg>
              </div>
            </div>

            <div className="settings-eq-faders">
              {EQUALIZER_FREQUENCIES.map((band, index) => {
                const value = equalizerBandGains[index] ?? 0;
                const fill = `${Math.max(0, Math.min(100, ((value + 12) / 24) * 100))}%`;
                return (
                  <label key={band} className="settings-eq-fader">
                    <span className="settings-eq-fader-label">{band >= 1000 ? `${band / 1000}k` : band}Hz</span>
                    <input
                      className="settings-eq-slider"
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={value}
                      style={{ "--eq-fill": fill } as CSSProperties}
                      onChange={(event) => {
                        onEqualizerBandGainChange(index, Number(event.target.value));
                        onEqualizerPresetIdChange("");
                      }}
                      onDoubleClick={() => {
                        onEqualizerBandGainChange(index, 0);
                        onEqualizerPresetIdChange("");
                      }}
                    />
                    <span className="settings-eq-fader-value">{value >= 0 ? "+" : ""}{value.toFixed(1)}</span>
                  </label>
                );
              })}
            </div>

            <div className="settings-eq-footer">
              <label className="settings-eq-field">
                Preamp
                <div className="settings-eq-inline-range">
                  <input
                    className="settings-eq-slider-inline"
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={equalizerPreampDb}
                    onChange={(event) => {
                      onEqualizerPreampDbChange(Number(event.target.value));
                      onEqualizerPresetIdChange("");
                    }}
                  />
                  <span>{equalizerPreampDb >= 0 ? "+" : ""}{equalizerPreampDb.toFixed(1)} dB</span>
                </div>
              </label>
              <label className="settings-eq-field">
                Wet mix
                <div className="settings-eq-inline-range">
                  <input
                    className="settings-eq-slider-inline"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={equalizerWetMixPercent}
                    onChange={(event) => {
                      onEqualizerWetMixPercentChange(Number(event.target.value));
                      onEqualizerPresetIdChange("");
                    }}
                  />
                  <span>{equalizerWetMixPercent}%</span>
                </div>
              </label>
            </div>

            <div className="settings-eq-actions">
              <button className="ghost-button" type="button" onClick={onResetEqualizer}>Reset to Flat</button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

function drawXpBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freq: Uint8Array<ArrayBuffer>,
  accentColor: string,
  alpha = 1
) {
  const bins = Math.min(64, freq.length);
  const barGap = 2;
  const barWidth = Math.max(1, (width - (bins - 1) * barGap) / bins);

  const safeAlpha = Math.max(0, Math.min(1, alpha));
  ctx.save();
  ctx.globalAlpha = safeAlpha;
  for (let index = 0; index < bins; index += 1) {
    const energy = freq[index] / 255;
    const amp = Math.max(0.02, energy);
    const barHeight = amp * (height * 0.92);
    const x = index * (barWidth + barGap);
    const y = height - barHeight;

    const gradient = ctx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(1, "rgba(40, 250, 255, 0.18)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
  ctx.restore();
}
