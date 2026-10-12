import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../store/settingsStore";

type Layer = { key: number; src: string };

/** Keeps the previous image around briefly so a new cover can fade in over it. */
function useCoverLayers(src: string | undefined): Layer[] {
  const [layers, setLayers] = useState<Layer[]>(() => (src ? [{ key: 0, src }] : []));
  const counter = useRef(0);

  useEffect(() => {
    if (!src) {
      setLayers([]);
      return;
    }
    setLayers((current) => {
      if (current[current.length - 1]?.src === src) {
        return current;
      }
      counter.current += 1;
      return [...current.slice(-1), { key: counter.current, src }];
    });
    const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), 800);
    return () => window.clearTimeout(timer);
  }, [src]);

  return layers;
}

type BackdropProps = {
  /** Cover of the track in use; without it an accent gradient is shown. */
  coverUrl?: string;
};

/** Blurred, saturated copy of the current cover that tints the whole window (Settings → Appearance). */
export function Backdrop({ coverUrl }: BackdropProps) {
  const enabled = useSettingsStore((state) => state.dynamicBackground);
  const intensity = useSettingsStore((state) => state.backgroundIntensity);
  const layers = useCoverLayers(enabled ? coverUrl : undefined);

  if (!enabled) {
    return null;
  }
  const strength = 0.1 + (0.9 * intensity) / 100;
  return (
    <div className="shell__backdrop" aria-hidden="true" style={{ ["--shell-backdrop-strength" as string]: strength }}>
      {layers.length === 0 ? <div className="shell__backdrop-fallback" /> : null}
      {layers.map((layer) => (
        <img key={layer.key} src={layer.src} alt="" className="shell__backdrop-img" draggable={false} />
      ))}
    </div>
  );
}
