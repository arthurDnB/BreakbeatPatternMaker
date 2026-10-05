import {THINK_BREAK_FRAMES, THINK_BREAK_RATE, THINK_SLICE_FRAMES, THINK_SLICE_ROLES} from '../core/think-break.js';
import type {AudioAsset} from './slices.js';
import {ensureThinkBreakAudio} from './think-break-audio.js';
// @ts-expect-error Shared original drum synthesizer.
import {synthesize} from '../../public/synth.js';

export interface BreakPreset {
  id: string;
  name: string;
  shortName: string;
  category: 'author-reperformance' | 'acoustic-recreation';
  description: string;
  bars: number;
  bpm: number;
  sampleRate: number;
  totalFrames: number;
  defaultFadeMs: number;
  sliceMarkers: number[];
  sliceRoles?: string[];
  knownHashes?: string[];
}

// 1. Think Break: 1 bar, author-performed Think-style re-performance repitched 1.42x (44.1 kHz, 69,255 frames)
const THINK_PRESET: BreakPreset = {
  id: 'think-142x',
  name: 'Think Break (1.42x Classic)',
  shortName: 'Think Break',
  category: 'author-reperformance',
  description: 'Author-performed Think-style break repitched 1.42x (+6.1 semitones). Crisp tambourine, syncopated kick pickups and a high snare. The 1972 Lyn Collins recording is not bundled.',
  bars: 1,
  bpm: 152.8,
  sampleRate: THINK_BREAK_RATE,
  totalFrames: THINK_BREAK_FRAMES,
  defaultFadeMs: 2,
  sliceMarkers: [...THINK_SLICE_FRAMES],
  sliceRoles: [...THINK_SLICE_ROLES],
  knownHashes: ['c920719b0bd350fbd30f1f7bea985399e849cccaf4245c189b30b8b54f0407c3']
};

// Helper: Calculate exact frame for a 16th step at a given BPM and sample rate (2 bars = 32 steps)
function stepFrame(step: number, bpm: number, rate = 44100): number {
  const secondsPerStep = (60 / bpm) / 4;
  return Math.round(step * secondsPerStep * rate);
}

// Total frames for 2 bars (8 beats)
function loopFrames(bars: number, bpm: number, rate = 44100): number {
  return Math.round((bars * 4 * 60 / bpm) * rate);
}

// 2. Amen Break: 2 bars, 165 BPM (16-slice classic broken kick & rolling ghost snare pocket)
// Step onsets for classic 2-bar Amen:
// Bar 1 (steps 0-15): K(0), SnGhost(3), Sn(4), K(6), SnGhost(7), Hat(8), SnGhost(9), K(10), SnGhost(11), Sn(12), SnGhost(15)
// Bar 2 (steps 16-31): K(16), SnGhost(19), Sn(20), K(23), Sn(26), SnGhost(27), K(28), Sn(30), SnGhost(31)
const AMEN_BPM = 165;
const AMEN_STEPS = [0, 3, 4, 6, 7, 8, 9, 10, 11, 12, 15, 16, 19, 20, 23, 26, 28, 30];
const AMEN_FRAMES = loopFrames(2, AMEN_BPM);
const AMEN_MARKERS = [...AMEN_STEPS.map(s => stepFrame(s, AMEN_BPM)), AMEN_FRAMES];

const AMEN_PRESET: BreakPreset = {
  id: 'amen-classic',
  name: 'Amen Break (Acoustic Studio)',
  shortName: 'Amen Break',
  category: 'acoustic-recreation',
  description: 'Author-built recreation: synthesized hits on a fixed 16th-note grid, not the original recording. Rolling ghost snares, offbeat kick syncopation, driving hats.',
  bars: 2,
  bpm: AMEN_BPM,
  sampleRate: 44100,
  totalFrames: AMEN_FRAMES,
  defaultFadeMs: 1,
  sliceMarkers: AMEN_MARKERS,
  knownHashes: ['d1ce72b0ede05781f4921edda0c8cb1c0f429fbc4dd30d136991fdc99e042f29']
};

// 3. Apache Break: 2 bars, 165 BPM (Spaced kicks, backbeat snare, syncopated bongo counter-rhythms)
// Key attacks: K(0), Bongo(1), Bongo(3), Sn(4), Bongo(6), K(8), Bongo(9), K(10), Bongo(11), Sn(12), Bongo(14)
// Bar 2: K(16), Bongo(17), Bongo(19), Sn(20), Bongo(22), K(24), Bongo(25), Sn(28), K(30)
const APACHE_BPM = 165;
const APACHE_STEPS = [0, 1, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 30];
const APACHE_FRAMES = loopFrames(2, APACHE_BPM);
const APACHE_MARKERS = [...APACHE_STEPS.map(s => stepFrame(s, APACHE_BPM)), APACHE_FRAMES];

const APACHE_PRESET: BreakPreset = {
  id: 'apache-bongo',
  name: 'Apache Break (Bongo & Breaks)',
  shortName: 'Apache Break',
  category: 'acoustic-recreation',
  description: 'Author-built recreation: synthesized hits on a fixed 16th-note grid, not the original recording. Spaced kick motif, driving backbeat, and syncopated bongo percussion.',
  bars: 2,
  bpm: APACHE_BPM,
  sampleRate: 44100,
  totalFrames: APACHE_FRAMES,
  defaultFadeMs: 1,
  sliceMarkers: APACHE_MARKERS,
  knownHashes: ['0a007b619ae3cc97916759119d5d79cb690b2ee703db152b2c8a5c408aa030cc', '6620355a086e618ab480e09ccd1fd644e8a6270e8f2ac78f438bd5affd0ed155', '8cd89d4a4dfa269a76d9c4d162f65ec1f43012c09a017334a7106d3b47b48aef']
};

// 4. Funky Drummer: 2 bars, 100 BPM (Clyde Stubblefield syncopated 16th hats & ghost snares)
// Onsets on steady 16th groove with ghost snare dialogue
const FUNKY_BPM = 100;
const FUNKY_STEPS = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30];
const FUNKY_FRAMES = loopFrames(2, FUNKY_BPM);
const FUNKY_MARKERS = [...FUNKY_STEPS.map(s => stepFrame(s, FUNKY_BPM)), FUNKY_FRAMES];

const FUNKY_PRESET: BreakPreset = {
  id: 'funky-drummer',
  name: 'Funky Drummer (Clyde 16ths)',
  shortName: 'Funky Drummer',
  category: 'acoustic-recreation',
  description: "Author-built recreation: synthesized hits on a fixed 16th-note grid, not the original recording. Relentless 16th-note hats, subtle ghost snares, and a deep funk pocket.",
  bars: 2,
  bpm: FUNKY_BPM,
  sampleRate: 44100,
  totalFrames: FUNKY_FRAMES,
  defaultFadeMs: 1,
  sliceMarkers: FUNKY_MARKERS,
  knownHashes: ['388c9b3b3abb37b2fb271c333914fefcf9cfb3779c02d3e208df3616692f747f', 'a45f122ec59f9a0476fe5a67dd413c9121240b152a07c741a4e169344296decb', '4e6ac6261744dca55d809dccc75b01030b1873a44e8d7e10338fa21c15aa291c']
};

// 5. Hot Pants: 2 bars, 110 BPM (Bobby Byrd syncopated funk & shaker)
const HOTPANTS_BPM = 110;
const HOTPANTS_STEPS = [0, 2, 4, 5, 7, 8, 10, 12, 13, 15, 16, 18, 20, 22, 24, 26, 28, 31];
const HOTPANTS_FRAMES = loopFrames(2, HOTPANTS_BPM);
const HOTPANTS_MARKERS = [...HOTPANTS_STEPS.map(s => stepFrame(s, HOTPANTS_BPM)), HOTPANTS_FRAMES];

const HOTPANTS_PRESET: BreakPreset = {
  id: 'hot-pants',
  name: 'Hot Pants (Syncopated Funk)',
  shortName: 'Hot Pants',
  category: 'acoustic-recreation',
  description: 'Author-built recreation: synthesized hits on a fixed 16th-note grid, not the original recording. Short kick pickups, snappy snares, and tambourine swing.',
  bars: 2,
  bpm: HOTPANTS_BPM,
  sampleRate: 44100,
  totalFrames: HOTPANTS_FRAMES,
  defaultFadeMs: 1,
  sliceMarkers: HOTPANTS_MARKERS
};

export const BREAK_PRESETS: readonly BreakPreset[] = [
  THINK_PRESET,
  AMEN_PRESET,
  APACHE_PRESET,
  FUNKY_PRESET,
  HOTPANTS_PRESET
];

export function getBreakPreset(id: string): BreakPreset | undefined {
  return BREAK_PRESETS.find(p => p.id === id);
}

// Render acoustic recreation break audio using deterministic synthesis
function renderAcousticLoop(preset: BreakPreset): AudioAsset {
  const rate = preset.sampleRate;
  const length = preset.totalFrames;
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  // Pre-generate drum hits
  const kick = synthesize('kick', rate) as Float32Array;
  const snare = synthesize('snare', rate) as Float32Array;
  const hat = synthesize('hat', rate) as Float32Array;
  const perc = synthesize('percussion', rate) as Float32Array;

  const bpm = preset.bpm;
  const stepCount = preset.bars * 16;

  // Render pattern events depending on preset
  for (let s = 0; s < stepCount; s++) {
    const frame = stepFrame(s, bpm, rate);
    const isBar2 = s >= 16;
    const barStep = s % 16;

    let playKick = false;
    let playSnare = false;
    let snareGain = 0.9;
    let playHat = false;
    let playPerc = false;

    if (preset.id === 'amen-classic') {
      // Bar 1: K: 0, 6, 10. Sn: 4, 12. SnGhost: 3, 7, 9, 11, 15. Hat: 8ths
      // Bar 2: K: 0, 7, 10, 15. Sn: 4, 10(ghost), 12.
      if (!isBar2) {
        if ([0, 6, 10].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([3, 7, 9, 11, 15].includes(barStep)) { playSnare = true; snareGain = 0.38; }
      } else {
        if ([0, 7, 10, 15].includes(barStep)) playKick = true;
        if ([4, 10, 14].includes(barStep)) playSnare = true;
        if ([3, 9, 11, 13].includes(barStep)) { playSnare = true; snareGain = 0.38; }
      }
      if (barStep % 2 === 0) playHat = true;
    } else if (preset.id === 'apache-bongo') {
      if (!isBar2) {
        if ([0, 8, 10].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([7, 15].includes(barStep)) { playSnare = true; snareGain = 0.35; }
        if ([1, 3, 6, 9, 11, 14].includes(barStep)) playPerc = true;
      } else {
        if ([0, 8, 14].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([1, 3, 6, 9, 11, 13].includes(barStep)) playPerc = true;
      }
      if ([0, 2, 6, 8, 10, 14].includes(barStep)) playHat = true;
    } else if (preset.id === 'funky-drummer') {
      if (!isBar2) {
        if ([0, 7, 8].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([2, 3, 6, 10, 11, 14, 15].includes(barStep)) { playSnare = true; snareGain = 0.28; }
      } else {
        if ([0, 6, 10].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([2, 3, 7, 10, 11, 14, 15].includes(barStep)) { playSnare = true; snareGain = 0.28; }
      }
      playHat = true; // 16th hats
      if (barStep === 13) playPerc = true;
    } else if (preset.id === 'hot-pants') {
      if (!isBar2) {
        if ([0, 2, 7, 10].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([3, 6, 11].includes(barStep)) { playSnare = true; snareGain = 0.35; }
        if ([5, 9, 13, 15].includes(barStep)) playPerc = true;
      } else {
        if ([0, 3, 8, 11].includes(barStep)) playKick = true;
        if ([4, 12].includes(barStep)) playSnare = true;
        if ([2, 7, 10].includes(barStep)) { playSnare = true; snareGain = 0.35; }
        if ([5, 9, 13, 15].includes(barStep)) playPerc = true;
      }
      if ([0, 2, 4, 7, 8, 10, 12, 15].includes(barStep)) playHat = true;
    }

    // Mix into channels
    const mixSound = (buf: Float32Array, gain: number, pan: number) => {
      const gl = Math.cos((pan + 1) * Math.PI / 4) * gain;
      const gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
      for (let i = 0; i < buf.length && frame + i < length; i++) {
        const idx = frame + i;
        left[idx] = (left[idx] ?? 0) + (buf[i] ?? 0) * gl;
        right[idx] = (right[idx] ?? 0) + (buf[i] ?? 0) * gr;
      }
    };

    if (playKick) mixSound(kick, 0.95, 0);
    if (playSnare) mixSound(snare, snareGain, 0.05);
    if (playHat) mixSound(hat, 0.52, -0.2);
    if (playPerc) mixSound(perc, 0.65, 0.25);
  }

  // Soft peak normalize to -0.3 dB
  let peak = 0;
  for (let i = 0; i < length; i++) {
    peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
  }
  if (peak > 0.001) {
    const scale = 0.92 / peak;
    for (let i = 0; i < length; i++) {
      left[i] = (left[i] ?? 0) * scale;
      right[i] = (right[i] ?? 0) * scale;
    }
  }

  return {
    id: 'preset-' + preset.id,
    name: preset.name,
    sampleRate: rate,
    channels: [left, right]
  };
}

// Retrieve or generate the preset audio asset
export async function getBreakPresetAsset(presetId: string, assets: Map<string, AudioAsset>): Promise<AudioAsset> {
  const preset = getBreakPreset(presetId);
  if (!preset) throw new Error(`Unknown break preset: ${presetId}`);

  // Check cache first
  const cachedId = 'preset-' + preset.id;
  const cached = assets.get(cachedId);
  if (cached) return cached;

  if (preset.id === 'think-142x') {
    const asset = await ensureThinkBreakAudio(assets);
    assets.set(cachedId, asset);
    return asset;
  }

  // Generate synthetic acoustic loop
  const synthesized = renderAcousticLoop(preset);
  assets.set(cachedId, synthesized);
  return synthesized;
}
