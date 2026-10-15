import { type KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { IconPlus, IconRename, IconSave, IconTrash } from "../../components/icons";
import { audioRef } from "../../audio/audioRef";
import { BUILTIN_EQ_PRESET_IDS } from "../../domain/equalizer";
import { averageGain, buildEqCurvePath, formatBandFrequency, formatGain } from "../../domain/equalizerCurve";
import { useEqualizerStore } from "../../store/equalizerStore";
import { useSettingsStore } from "../../store/settingsStore";
import { EQUALIZER_FREQUENCIES, getOrCreateMediaAudioGraph } from "../../utils/audioGraph";
import { VizState, drawSpectrum } from "../nowPlaying/vizEffects";
import { Button, Field, IconButton, Select, Slider, TextInput } from "../../ui";

/** Live spectrum behind the tone curve, so the effect of a change is visible while music plays. */
function Spectrum() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const accent = useSettingsStore((state) => state.accentThemes[state.accentIndex]?.accent ?? "#ee703e");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    let frame = 0;
    const state = new VizState();
    const draw = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const audio = audioRef.current;
      const graph = audio ? getOrCreateMediaAudioGraph(audio) : null;
      if (graph) {
        graph.analyser.getByteFrequencyData(graph.frequencyData);
        graph.analyser.getByteTimeDomainData(graph.timeData);
        drawSpectrum(ctx, width, height, { freq: graph.frequencyData, time: graph.timeData, isPlaying: true, accent, isDark: false, t: performance.now() * 0.001 }, state);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [accent]);

  return <canvas ref={canvasRef} className="eq__spectrum" aria-hidden="true" />;
}

export function EqualizerStudio() {
  const eq = useEqualizerStore();
  const { equalizerPresets, equalizerPresetId, equalizerPresetName, equalizerBandGains, isEqualizerPresetRenaming } = eq;
  const isCustom = Boolean(equalizerPresetId) && !BUILTIN_EQ_PRESET_IDS.has(equalizerPresetId);
  const curve = useMemo(() => buildEqCurvePath(equalizerBandGains), [equalizerBandGains]);
  const average = averageGain(equalizerBandGains);

  function onNameKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      eq.renameButtonClick();
    }
  }

  return (
    <section className="eq" aria-label="Equalizer">
      <header className="eq__head">
        <div className="eq__preset">
          {isEqualizerPresetRenaming ? (
            <Field label="Preset name">
              <TextInput value={equalizerPresetName} autoFocus onChange={(event) => eq.setEqualizerPresetName(event.target.value)} onKeyDown={onNameKey} />
            </Field>
          ) : (
            <Field label="Preset">
              <Select value={equalizerPresetId} onChange={(event) => eq.changePreset(event.target.value)}>
                <option value="">Custom</option>
                {equalizerPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div className="eq__actions">
          <IconButton label="New preset from the current settings" onClick={eq.createPreset}><IconPlus /></IconButton>
          <IconButton label={isEqualizerPresetRenaming ? "Confirm name" : "Rename preset"} disabled={!isCustom} onClick={eq.renameButtonClick}><IconRename /></IconButton>
          <IconButton label="Delete preset" disabled={!isCustom} onClick={eq.deletePreset}><IconTrash /></IconButton>
          <IconButton label={isCustom ? "Save preset" : "Save as a new preset"} onClick={eq.savePreset}><IconSave /></IconButton>
          <Button size="sm" onClick={eq.reset}>Reset to flat</Button>
        </div>
      </header>

      <div className="eq__curve">
        <div className="eq__curve-head">
          <strong>Tone curve</strong>
          <span>Average {formatGain(average)}</span>
        </div>
        <div className="eq__curve-plot">
          <Spectrum />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Tone curve, average ${formatGain(average)}`}>
            <line x1="0" y1="50" x2="100" y2="50" className="eq__zero" />
            <path d={curve} className="eq__line" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>

      <div className="eq__bands" role="group" aria-label="Frequency bands">
        {EQUALIZER_FREQUENCIES.map((frequency, index) => (
          <div key={frequency} className="eq__band">
            <span className="eq__band-label">{formatBandFrequency(frequency)}</span>
            <Slider
              vertical
              label={`${formatBandFrequency(frequency)} gain`}
              min={-12}
              max={12}
              step={0.5}
              value={equalizerBandGains[index] ?? 0}
              onValueChange={(value) => eq.setEqualizerBandGain(index, value)}
              aria-valuetext={formatGain(equalizerBandGains[index] ?? 0)}
            />
            <span className="eq__band-value">{formatGain(equalizerBandGains[index] ?? 0).replace(" dB", "")}</span>
          </div>
        ))}
      </div>

      <div className="eq__master">
        <Field label={`Preamp ${formatGain(eq.equalizerPreampDb)}`}>
          <Slider label="Preamp" min={-12} max={12} step={0.5} value={eq.equalizerPreampDb} onValueChange={eq.setEqualizerPreampDb} />
        </Field>
        <Field label={`Wet mix ${eq.equalizerWetMixPercent}%`}>
          <Slider label="Wet mix" min={0} max={100} step={1} value={eq.equalizerWetMixPercent} onValueChange={eq.setEqualizerWetMixPercent} />
        </Field>
      </div>
    </section>
  );
}
