//! Beatmap analysis for the rhythm game: decodes a whole track and finds what a game track can be built from,
//! the way Audiosurf does before a ride.
//!
//! - intensity: loudness over time (slope and speed of the track);
//! - onsets: sudden changes of the sound in the low, mid and high bands (notes / blocks, with a lane);
//! - tempo and beats: the regular pulse of the onsets, tracked with dynamic programming (Ellis, 2007);
//! - sections: stable changes of energy (verse, chorus, break).
//!
//! These are events, not transcribed notes: nothing separates instruments or vocals.

use rustfft::{num_complex::Complex, FftPlanner};
use serde::{Deserialize, Serialize};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::{MediaSource, MediaSourceStream};
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Bumped when the analysis changes, so cached beatmaps are recomputed.
pub const ANALYZER_VERSION: u32 = 1;

/// Analysis rate: tracks are averaged down to about this rate first (plenty for rhythm, half the work).
const TARGET_RATE: u32 = 22_050;
const WINDOW: usize = 1024;
const HOP: usize = 256;
/// Band limits in Hz: low (kick, bass), mid (snare, voice, chords), high (hats, cymbals).
const BANDS: [(f32, f32); 3] = [(30.0, 200.0), (200.0, 2_500.0), (2_500.0, 9_000.0)];
const INTENSITY_RATE: f64 = 20.0;
const WAVEFORM_RATE: f64 = 100.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Onset {
    pub time: f64,
    /// 0…1, relative to the strongest onsets of the track.
    pub strength: f32,
    /// 0 low, 1 mid, 2 high.
    pub band: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub start: f64,
    pub end: f64,
    /// Mean intensity, 0…1.
    pub intensity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Beatmap {
    pub version: u32,
    pub duration: f64,
    pub bpm: f64,
    /// 0…1: how clearly the pulse stands out (low for rubato, ambient or beatless music).
    pub tempo_confidence: f64,
    pub beats: Vec<f64>,
    pub onsets: Vec<Onset>,
    pub intensity_rate: f64,
    pub intensity: Vec<f32>,
    pub waveform_rate: f64,
    pub waveform: Vec<f32>,
    pub sections: Vec<Section>,
    pub decode_ms: u64,
    pub analysis_ms: u64,
    /// Set when the beatmap comes from the cache rather than a fresh analysis.
    #[serde(default)]
    pub cached: bool,
}

/// Mono samples of a decoded track.
pub struct Pcm {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

/// Decodes any format Symphonia knows (MP3, AAC/M4A, ALAC, FLAC, Vorbis, WAV) to mono.
pub fn decode(source: Box<dyn MediaSource>, extension: Option<&str>) -> Result<Pcm, String> {
    let stream = MediaSourceStream::new(source, Default::default());
    let mut hint = Hint::new();
    if let Some(extension) = extension {
        hint.with_extension(extension);
    }
    let probed = symphonia::default::get_probe()
        .format(&hint, stream, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("Unsupported audio format: {e}"))?;
    let mut format = probed.format;
    let track = format.default_track().ok_or_else(|| "The file has no audio track".to_string())?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let sample_rate = codec_params.sample_rate.ok_or_else(|| "Unknown sample rate".to_string())?;
    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Unsupported audio codec: {e}"))?;

    let mut samples = Vec::new();
    let mut buffer: Option<SampleBuffer<f32>> = None;
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(error)) if error.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SymphoniaError::ResetRequired) => break,
            Err(error) => return Err(format!("Audio read error: {error}")),
        };
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            // A damaged frame: skip it, like players do.
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(error) => return Err(format!("Audio decode error: {error}")),
        };
        let spec = *decoded.spec();
        let channels = spec.channels.count().max(1);
        if buffer.as_ref().map_or(true, |current| current.capacity() < decoded.capacity()) {
            buffer = Some(SampleBuffer::new(decoded.capacity() as u64, spec));
        }
        let buffer = buffer.as_mut().expect("buffer was just created");
        buffer.copy_interleaved_ref(decoded);
        for frame in buffer.samples().chunks(channels) {
            samples.push(frame.iter().sum::<f32>() / channels as f32);
        }
    }
    if samples.is_empty() {
        return Err("The track decoded to silence".to_string());
    }
    Ok(Pcm { samples, sample_rate })
}

/// Averages blocks of samples to get close to `TARGET_RATE`.
fn downsample(pcm: &Pcm) -> (Vec<f32>, u32) {
    let factor = (pcm.sample_rate / TARGET_RATE).max(1) as usize;
    if factor == 1 {
        return (pcm.samples.clone(), pcm.sample_rate);
    }
    let samples = pcm
        .samples
        .chunks(factor)
        .map(|block| block.iter().sum::<f32>() / block.len() as f32)
        .collect();
    (samples, pcm.sample_rate / factor as u32)
}

fn percentile(values: &[f32], fraction: f32) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.total_cmp(b));
    let index = ((sorted.len() - 1) as f32 * fraction).round() as usize;
    sorted[index]
}

/// Centered moving average over `radius` frames on each side.
fn moving_average(values: &[f32], radius: usize) -> Vec<f32> {
    let mut prefix = vec![0.0f64; values.len() + 1];
    for (i, value) in values.iter().enumerate() {
        prefix[i + 1] = prefix[i] + *value as f64;
    }
    (0..values.len())
        .map(|i| {
            let from = i.saturating_sub(radius);
            let to = (i + radius + 1).min(values.len());
            ((prefix[to] - prefix[from]) / (to - from) as f64) as f32
        })
        .collect()
}

/// Spectral flux of each band and the RMS of each frame.
struct Frames {
    rate: f64,
    rms: Vec<f32>,
    flux: [Vec<f32>; 3],
}

fn analyse_frames(samples: &[f32], sample_rate: u32) -> Frames {
    let count = if samples.len() >= WINDOW { (samples.len() - WINDOW) / HOP + 1 } else { 1 };
    let window: Vec<f32> = (0..WINDOW)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / WINDOW as f32).cos())
        .collect();
    let fft = FftPlanner::<f32>::new().plan_fft_forward(WINDOW);
    let bin_hz = sample_rate as f32 / WINDOW as f32;
    let band_bins: Vec<(usize, usize)> = BANDS
        .iter()
        .map(|(low, high)| {
            let from = (low / bin_hz).ceil().max(1.0) as usize;
            let to = ((high / bin_hz).floor() as usize).min(WINDOW / 2).max(from + 1);
            (from, to)
        })
        .collect();

    let mut rms = Vec::with_capacity(count);
    let mut flux = [Vec::with_capacity(count), Vec::with_capacity(count), Vec::with_capacity(count)];
    let mut previous = vec![0.0f32; WINDOW / 2 + 1];
    let mut current = vec![0.0f32; WINDOW / 2 + 1];
    let mut spectrum = vec![Complex::new(0.0f32, 0.0); WINDOW];
    for frame in 0..count {
        let start = frame * HOP;
        let mut energy = 0.0f32;
        for i in 0..WINDOW {
            let sample = samples.get(start + i).copied().unwrap_or(0.0);
            energy += sample * sample;
            spectrum[i] = Complex::new(sample * window[i], 0.0);
        }
        rms.push((energy / WINDOW as f32).sqrt());
        fft.process(&mut spectrum);
        for (bin, value) in current.iter_mut().enumerate() {
            // Log compression: quiet details count, loud ones do not swamp everything.
            *value = (1.0 + 100.0 * spectrum[bin].norm()).ln();
        }
        for (band, (from, to)) in band_bins.iter().enumerate() {
            let rise: f32 = (*from..*to).map(|bin| (current[bin] - previous[bin]).max(0.0)).sum();
            flux[band].push(if frame == 0 { 0.0 } else { rise / (to - from) as f32 });
        }
        std::mem::swap(&mut previous, &mut current);
    }
    Frames { rate: sample_rate as f64 / HOP as f64, rms, flux }
}

/// Seconds of a frame: the centre of its window, where an attack shows up in the flux.
fn frame_time(frame: usize, frames: &Frames) -> f64 {
    (frame as f64 + (WINDOW / HOP) as f64 / 2.0) / frames.rate
}

/// Peaks of an onset envelope above an adaptive threshold.
fn pick_onsets(envelope: &[f32], frames: &Frames, band: u8, min_gap: f64) -> Vec<Onset> {
    let local_mean = moving_average(envelope, (0.15 * frames.rate) as usize);
    let scale = percentile(envelope, 0.99).max(1e-6);
    let neighbourhood = ((0.035 * frames.rate) as usize).max(1);
    let min_gap_frames = (min_gap * frames.rate) as usize;
    let mut onsets: Vec<Onset> = Vec::new();
    let mut last_frame: Option<usize> = None;
    for frame in 1..envelope.len() {
        let value = envelope[frame];
        if value <= local_mean[frame] * 1.4 + 0.08 * scale {
            continue;
        }
        let from = frame.saturating_sub(neighbourhood);
        let to = (frame + neighbourhood + 1).min(envelope.len());
        if envelope[from..to].iter().any(|other| *other > value) {
            continue;
        }
        if last_frame.map_or(false, |last| frame - last < min_gap_frames) {
            continue;
        }
        last_frame = Some(frame);
        onsets.push(Onset { time: frame_time(frame, frames), strength: (value / scale).min(1.0), band });
    }
    onsets
}

/// Tempo from the autocorrelation of the onset envelope, weighted towards common tempos (around 120 BPM).
fn estimate_period(envelope: &[f32], rate: f64) -> (f64, f64) {
    let min_lag = (60.0 / 200.0 * rate).floor() as usize;
    let max_lag = ((60.0 / 60.0 * rate).ceil() as usize).min(envelope.len().saturating_sub(1));
    if max_lag <= min_lag + 2 {
        return (rate * 0.5, 0.0);
    }
    let autocorrelation = |lag: usize| -> f64 {
        let n = envelope.len() - lag;
        (0..n).map(|t| envelope[t] as f64 * envelope[t + lag] as f64).sum::<f64>() / n as f64
    };
    let zero = autocorrelation(0).max(1e-12);
    let values: Vec<f64> = (min_lag..=max_lag).map(autocorrelation).collect();
    let weighted: Vec<f64> = values
        .iter()
        .enumerate()
        .map(|(i, value)| {
            let bpm = 60.0 * rate / (min_lag + i) as f64;
            let octaves = (bpm / 120.0).log2();
            value * (-0.5 * (octaves / 0.9).powi(2)).exp()
        })
        .collect();
    let best = weighted
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.total_cmp(b.1))
        .map(|(i, _)| i)
        .unwrap_or(0);
    // Parabolic interpolation between neighbouring lags for a finer period.
    let mut lag = (min_lag + best) as f64;
    if best > 0 && best + 1 < weighted.len() {
        let (a, b, c) = (weighted[best - 1], weighted[best], weighted[best + 1]);
        let denominator = a - 2.0 * b + c;
        if denominator.abs() > 1e-12 {
            lag += (0.5 * (a - c) / denominator).clamp(-0.5, 0.5);
        }
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let confidence = ((values[best] - mean) / (zero - mean).max(1e-12)).clamp(0.0, 1.0);
    (lag, confidence)
}

/// Beat times by dynamic programming: each beat sits on strong onsets and about one period after the previous one.
fn track_beats(envelope: &[f32], period: f64) -> Vec<usize> {
    let n = envelope.len();
    if n == 0 || period < 2.0 {
        return Vec::new();
    }
    let tightness = 100.0;
    let mut score = vec![0.0f64; n];
    let mut previous = vec![usize::MAX; n];
    let min_back = (period / 2.0).round() as usize;
    let max_back = (period * 2.0).round() as usize;
    for t in 0..n {
        let mut best = 0.0f64;
        let mut best_index = usize::MAX;
        if t >= min_back {
            for back in min_back..=max_back.min(t) {
                let p = t - back;
                let penalty = tightness * ((back as f64) / period).ln().powi(2);
                let candidate = score[p] - penalty;
                if best_index == usize::MAX || candidate > best {
                    best = candidate;
                    best_index = p;
                }
            }
        }
        score[t] = envelope[t] as f64 + best.max(0.0);
        previous[t] = if best > 0.0 { best_index } else { usize::MAX };
    }
    // Start from the best score in the last period and walk back.
    let tail_from = n.saturating_sub(period.round() as usize + 1);
    let mut t = (tail_from..n).max_by(|a, b| score[*a].total_cmp(&score[*b])).unwrap_or(n - 1);
    let mut beats = vec![t];
    while previous[t] != usize::MAX {
        t = previous[t];
        beats.push(t);
    }
    beats.reverse();
    beats
}

/// Section boundaries where the average energy and band balance of the next stretch differ from the last one.
fn find_sections(intensity: &[f32], band_energy: &[[f32; 3]], duration: f64, beats: &[f64]) -> Vec<Section> {
    let rate = INTENSITY_RATE;
    let seconds = intensity.len() as f64 / rate;
    if seconds < 20.0 {
        return vec![Section { start: 0.0, end: duration, intensity: mean(intensity) }];
    }
    // One feature vector per second: intensity and the share of each band.
    let per_second: Vec<[f32; 4]> = (0..seconds.floor() as usize)
        .map(|second| {
            let from = (second as f64 * rate) as usize;
            let to = (((second + 1) as f64 * rate) as usize).min(intensity.len());
            let level = mean(&intensity[from..to]);
            let mut bands = [0.0f32; 3];
            for frame in &band_energy[from..to] {
                for (band, value) in frame.iter().enumerate() {
                    bands[band] += value;
                }
            }
            let total = bands.iter().sum::<f32>().max(1e-9);
            [level, bands[0] / total, bands[1] / total, bands[2] / total]
        })
        .collect();
    let span = 8usize;
    let mut novelty = vec![0.0f32; per_second.len()];
    for second in span..per_second.len().saturating_sub(span) {
        let mut distance = 0.0f32;
        for feature in 0..4 {
            let before = per_second[second - span..second].iter().map(|v| v[feature]).sum::<f32>() / span as f32;
            let after = per_second[second..second + span].iter().map(|v| v[feature]).sum::<f32>() / span as f32;
            distance += (after - before).abs() * if feature == 0 { 1.0 } else { 0.6 };
        }
        novelty[second] = distance;
    }
    let mut boundaries = vec![0.0f64];
    let mut last = 0usize;
    for second in 1..novelty.len().saturating_sub(1) {
        let is_peak = novelty[second] >= novelty[second - 1] && novelty[second] >= novelty[second + 1];
        if is_peak && novelty[second] > 0.12 && second - last >= span {
            // Snap to the nearest beat, so a section starts on the pulse.
            let time = second as f64;
            let snapped = beats
                .iter()
                .copied()
                .min_by(|a, b| (a - time).abs().total_cmp(&(b - time).abs()))
                .filter(|beat| (beat - time).abs() < 1.0)
                .unwrap_or(time);
            boundaries.push(snapped);
            last = second;
        }
    }
    boundaries.push(duration);
    boundaries
        .windows(2)
        .map(|pair| {
            let from = ((pair[0] * rate) as usize).min(intensity.len());
            let to = ((pair[1] * rate) as usize).min(intensity.len()).max(from);
            Section { start: pair[0], end: pair[1], intensity: mean(&intensity[from..to]) }
        })
        .collect()
}

fn mean(values: &[f32]) -> f32 {
    if values.is_empty() {
        0.0
    } else {
        values.iter().sum::<f32>() / values.len() as f32
    }
}

/// Analyses decoded samples into a beatmap (timings are filled in by the caller).
pub fn analyze(pcm: &Pcm) -> Beatmap {
    let (samples, sample_rate) = downsample(pcm);
    let duration = samples.len() as f64 / sample_rate as f64;
    let frames = analyse_frames(&samples, sample_rate);

    // Waveform for display: the peak of every 10 ms.
    let block = ((sample_rate as f64 / WAVEFORM_RATE) as usize).max(1);
    let waveform: Vec<f32> = samples
        .chunks(block)
        .map(|chunk| chunk.iter().fold(0.0f32, |peak, sample| peak.max(sample.abs())))
        .collect();

    // Intensity: loudness in dB, smoothed over ~0.4 s, mapped to 0…1 between the quiet and loud ends of the track.
    let decibels: Vec<f32> = frames.rms.iter().map(|rms| 20.0 * (rms + 1e-9).log10()).collect();
    let smooth = moving_average(&decibels, (0.2 * frames.rate) as usize);
    let quiet = percentile(&smooth, 0.05).max(-60.0);
    let loud = percentile(&smooth, 0.98);
    let range = (loud - quiet).max(6.0);
    let step = frames.rate / INTENSITY_RATE;
    let intensity_count = (frames.rms.len() as f64 / step).floor() as usize;
    let intensity: Vec<f32> = (0..intensity_count)
        .map(|i| {
            let from = (i as f64 * step) as usize;
            let to = (((i + 1) as f64 * step) as usize).min(smooth.len()).max(from + 1);
            ((mean(&smooth[from..to]) - quiet) / range).clamp(0.0, 1.0)
        })
        .collect();

    // Onsets per band, each band normalised so a quiet band still gets its events.
    let normalised: Vec<Vec<f32>> = frames
        .flux
        .iter()
        .map(|flux| {
            let scale = percentile(flux, 0.95).max(1e-6);
            flux.iter().map(|value| value / scale).collect()
        })
        .collect();
    let mut onsets: Vec<Onset> = Vec::new();
    for (band, envelope) in normalised.iter().enumerate() {
        let gap = if band == 0 { 0.1 } else { 0.07 };
        onsets.extend(pick_onsets(envelope, &frames, band as u8, gap));
    }
    // Leading and trailing silence never holds events.
    let silent = |time: f64| {
        let frame = ((time * frames.rate) as usize).min(decibels.len().saturating_sub(1));
        decibels.get(frame).map_or(true, |db| *db < -50.0)
    };
    onsets.retain(|onset| !silent(onset.time));
    onsets.sort_by(|a, b| a.time.total_cmp(&b.time));

    // Tempo and beats on the combined envelope, with its slow trend removed.
    let combined: Vec<f32> = (0..frames.rms.len()).map(|frame| normalised.iter().map(|band| band[frame]).sum()).collect();
    let trend = moving_average(&combined, (0.5 * frames.rate) as usize);
    let detrended: Vec<f32> = combined.iter().zip(&trend).map(|(value, mean)| (value - mean).max(0.0)).collect();
    let (period, tempo_confidence) = estimate_period(&detrended, frames.rate);
    let deviation = (detrended.iter().map(|v| v * v).sum::<f32>() / detrended.len().max(1) as f32).sqrt().max(1e-6);
    let unit: Vec<f32> = detrended.iter().map(|value| value / deviation).collect();
    let mut beats: Vec<f64> = track_beats(&unit, period).into_iter().map(|frame| frame_time(frame, &frames)).collect();
    beats.retain(|time| *time <= duration && !silent(*time));

    let band_energy: Vec<[f32; 3]> = (0..intensity_count)
        .map(|i| {
            let from = (i as f64 * step) as usize;
            let to = (((i + 1) as f64 * step) as usize).min(frames.rms.len()).max(from + 1);
            [0usize, 1, 2].map(|band| mean(&frames.flux[band][from..to]))
        })
        .collect();
    let sections = find_sections(&intensity, &band_energy, duration, &beats);

    Beatmap {
        version: ANALYZER_VERSION,
        duration,
        bpm: 60.0 * frames.rate / period,
        tempo_confidence,
        beats,
        onsets,
        intensity_rate: INTENSITY_RATE,
        intensity,
        waveform_rate: sample_rate as f64 / block as f64,
        waveform,
        sections,
        decode_ms: 0,
        analysis_ms: 0,
        cached: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic noise in -1…1.
    struct Noise(u64);
    impl Noise {
        fn next(&mut self) -> f32 {
            self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((self.0 >> 33) as f32 / (1u64 << 31) as f32) * 2.0 - 1.0
        }
    }

    /// Short decaying noise bursts (like hi-hat / snare hits) every `interval` seconds from `first`.
    fn click_track(seconds: f64, first: f64, interval: f64, rate: u32) -> (Pcm, Vec<f64>) {
        let mut noise = Noise(7);
        let mut samples = vec![0.0f32; (seconds * rate as f64) as usize];
        let mut clicks = Vec::new();
        let mut time = first;
        while time < seconds - 0.1 {
            clicks.push(time);
            let start = (time * rate as f64) as usize;
            for i in 0..(0.03 * rate as f64) as usize {
                let decay = (-(i as f32) / (0.006 * rate as f32)).exp();
                samples[start + i] += noise.next() * 0.8 * decay;
            }
            time += interval;
        }
        (Pcm { samples, sample_rate: rate }, clicks)
    }

    #[test]
    fn a_click_track_gives_its_tempo_beats_and_onsets() {
        let (pcm, clicks) = click_track(30.0, 0.5, 0.5, 44_100);
        let beatmap = analyze(&pcm);
        assert!((beatmap.bpm - 120.0).abs() < 2.0, "bpm {}", beatmap.bpm);
        assert!((beatmap.duration - 30.0).abs() < 0.05);

        let near = |times: &[f64], target: f64| times.iter().any(|time| (time - target).abs() < 0.03);
        let beat_hits = clicks.iter().filter(|click| near(&beatmap.beats, **click)).count();
        assert!(beat_hits as f64 >= clicks.len() as f64 * 0.9, "{beat_hits} of {} clicks on a beat", clicks.len());

        let onset_times: Vec<f64> = beatmap.onsets.iter().map(|onset| onset.time).collect();
        let onset_hits = clicks.iter().filter(|click| near(&onset_times, **click)).count();
        assert!(onset_hits as f64 >= clicks.len() as f64 * 0.9, "{onset_hits} of {} clicks found", clicks.len());
    }

    #[test]
    fn intensity_and_sections_follow_a_quiet_then_loud_track() {
        let rate = 22_050;
        let mut noise = Noise(3);
        let samples: Vec<f32> = (0..rate * 60)
            .map(|i| noise.next() * if i < rate * 30 { 0.03 } else { 0.6 })
            .collect();
        let beatmap = analyze(&Pcm { samples, sample_rate: rate as u32 });
        let half = beatmap.intensity.len() / 2;
        let quiet = mean(&beatmap.intensity[..half - 40]);
        let loud = mean(&beatmap.intensity[half + 40..]);
        assert!(loud - quiet > 0.5, "quiet {quiet}, loud {loud}");
        assert!(
            beatmap.sections.iter().any(|section| (section.start - 30.0).abs() < 2.5),
            "sections {:?}",
            beatmap.sections
        );
    }

    /// Manual check on real music: `BEATMAP_FILE=/path/song.mp3 cargo test --release beatmap_of_a_file -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn beatmap_of_a_file() {
        let path = std::env::var("BEATMAP_FILE").expect("set BEATMAP_FILE");
        let started = std::time::Instant::now();
        let extension = std::path::Path::new(&path).extension().and_then(|ext| ext.to_str()).map(str::to_lowercase);
        let pcm = decode(Box::new(std::fs::File::open(&path).unwrap()), extension.as_deref()).unwrap();
        let decoded = started.elapsed();
        let map = analyze(&pcm);
        let bands = [0u8, 1, 2].map(|band| map.onsets.iter().filter(|onset| onset.band == band).count());
        println!(
            "{path}\n  {:.1}s, decode {:?}, analysis {:?}\n  {:.1} BPM (confidence {:.2}), {} beats, onsets low/mid/high {:?}, {} sections",
            map.duration,
            decoded,
            started.elapsed() - decoded,
            map.bpm,
            map.tempo_confidence,
            map.beats.len(),
            bands,
            map.sections.len()
        );
    }

    #[test]
    fn decodes_a_wav_file_to_mono() {
        let rate = 22_050u32;
        let frames = rate as usize;
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + frames as u32 * 4).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&2u16.to_le_bytes()); // stereo
        wav.extend_from_slice(&rate.to_le_bytes());
        wav.extend_from_slice(&(rate * 4).to_le_bytes());
        wav.extend_from_slice(&4u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(frames as u32 * 4).to_le_bytes());
        for i in 0..frames {
            let value = ((i as f32 * 0.05).sin() * 16_000.0) as i16;
            wav.extend_from_slice(&value.to_le_bytes()); // left
            wav.extend_from_slice(&(-value).to_le_bytes()); // right, opposite phase
        }
        let pcm = decode(Box::new(std::io::Cursor::new(wav)), Some("wav")).unwrap();
        assert_eq!(pcm.sample_rate, rate);
        assert_eq!(pcm.samples.len(), frames);
        // Opposite channels cancel out in the mono mix.
        assert!(pcm.samples.iter().all(|sample| sample.abs() < 1e-3));
    }
}
