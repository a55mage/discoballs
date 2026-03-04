export const EQUALIZER_FREQUENCIES = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export type EqualizerPreset = {
  id: string;
  name: string;
  bandGains: number[];
  preampDb: number;
  wetMixPercent: number;
};

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { id: "flat", name: "Flat", bandGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preampDb: 0, wetMixPercent: 100 },
  { id: "warm", name: "Warm", bandGains: [2, 2, 1, 1, 0, -1, -1, -1, 0, 1], preampDb: 0, wetMixPercent: 100 },
  { id: "vocal", name: "Vocal Boost", bandGains: [-2, -1, 0, 1, 2, 3, 3, 2, 1, 0], preampDb: 0, wetMixPercent: 100 },
  { id: "club", name: "Club", bandGains: [3, 2, 1, 0, -1, -1, 0, 1, 2, 3], preampDb: 0, wetMixPercent: 100 },
  { id: "air", name: "Airy", bandGains: [-1, -1, -1, 0, 1, 2, 3, 3, 4, 4], preampDb: 0, wetMixPercent: 100 },
];

export const DEFAULT_EQUALIZER_PRESET = EQUALIZER_PRESETS[0];

export type MediaAudioGraph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  preamp: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  outputGain: GainNode;
  filters: BiquadFilterNode[];
  analyser: AnalyserNode;
  frequencyData: Uint8Array;
  timeData: Uint8Array;
};

type EqualizerRuntimeSettings = {
  bandGains: number[];
  preampDb: number;
  wetMixPercent: number;
};

const GRAPH_BY_AUDIO = new WeakMap<HTMLAudioElement, MediaAudioGraph>();

function getContextCtor(): typeof AudioContext | undefined {
  return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getOrCreateMediaAudioGraph(audio: HTMLAudioElement): MediaAudioGraph | null {
  const existing = GRAPH_BY_AUDIO.get(audio);
  if (existing) {
    return existing;
  }

  const ContextCtor = getContextCtor();
  if (!ContextCtor) {
    return null;
  }

  const context = new ContextCtor();
  const source = context.createMediaElementSource(audio);
  const preamp = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const outputGain = context.createGain();
  const analyser = context.createAnalyser();

  const filters = EQUALIZER_FREQUENCIES.map((frequency) => {
    const filter = context.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = 1.05;
    filter.gain.value = 0;
    return filter;
  });

  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.82;
  preamp.gain.value = 1;
  dryGain.gain.value = 0;
  wetGain.gain.value = 1;
  outputGain.gain.value = 1;

  source.connect(dryGain);
  dryGain.connect(outputGain);

  source.connect(preamp);
  if (filters.length) {
    preamp.connect(filters[0]);
    for (let index = 0; index < filters.length - 1; index += 1) {
      filters[index].connect(filters[index + 1]);
    }
    filters[filters.length - 1].connect(wetGain);
  } else {
    preamp.connect(wetGain);
  }
  wetGain.connect(outputGain);

  outputGain.connect(analyser);
  analyser.connect(context.destination);

  const graph: MediaAudioGraph = {
    context,
    source,
    preamp,
    dryGain,
    wetGain,
    outputGain,
    filters,
    analyser,
    frequencyData: new Uint8Array(analyser.frequencyBinCount),
    timeData: new Uint8Array(analyser.fftSize),
  };
  GRAPH_BY_AUDIO.set(audio, graph);
  return graph;
}

export function applyEqualizerSettings(graph: MediaAudioGraph, settings: EqualizerRuntimeSettings) {
  const now = graph.context.currentTime;
  const clampedWetMix = clamp(settings.wetMixPercent, 0, 100) / 100;
  const clampedPreamp = clamp(settings.preampDb, -18, 18);

  graph.dryGain.gain.cancelScheduledValues(now);
  graph.wetGain.gain.cancelScheduledValues(now);
  graph.preamp.gain.cancelScheduledValues(now);
  graph.dryGain.gain.setTargetAtTime(1 - clampedWetMix, now, 0.015);
  graph.wetGain.gain.setTargetAtTime(clampedWetMix, now, 0.015);
  graph.preamp.gain.setTargetAtTime(dbToGain(clampedPreamp), now, 0.02);

  for (let index = 0; index < graph.filters.length; index += 1) {
    const filter = graph.filters[index];
    const gain = clamp(settings.bandGains[index] ?? 0, -18, 18);
    filter.gain.cancelScheduledValues(now);
    filter.gain.setTargetAtTime(gain, now, 0.02);
  }
}
