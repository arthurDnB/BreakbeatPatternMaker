export const ENGINE_VERSION = '0.1.0';
export const PPQ = 960;
export const ROLES = ['kick', 'snare', 'hat', 'percussion'] as const;
export type Role = typeof ROLES[number];
/** Presentation and generator assignment for the four legacy sample lanes. */
export interface DrumLane {name:string;visible:boolean;generationRole:Role|null}
export type Genre = 'jungle' | 'dnb' | 'hiphop' | 'trap' | 'rap' | 'drill' | 'breakcore' | 'idm' | 'hardcore' | 'experimental' | 'breaks' | 'bigbeat' | 'nuskoolbreaks' | 'electrobreaks' | 'breakbeathardcore' | 'raggajungle' | 'atmosphericjungle' | 'footworkjungle' | 'downtempo' | 'lofihiphop' | 'boombap' | 'mellowbeats' | 'liquiddnb' | 'jumpup' | 'garage' | 'speedgarage' | 'twostepgarage' | 'dub' | 'psydub' | 'dubstep' | 'brostep' | 'postdubstep' | 'drumfunk' | 'amenscience' | 'atmosphericbreakcore' | 'triphop' | 'halftimednb' | 'neurofunk';
export type BreakStyle = 'genre' | 'amen' | 'think' | 'apache' | 'funkyDrummer' | 'hotPants';
export type BreakLayer = 'off' | 'think-passage2';
export type GenerationMode = 'drums' | 'melody' | 'both';
export type MelodyPart = 'bassline' | 'lead' | 'piano';
export type MelodyScale = 'major' | 'natural-minor' | 'harmonic-minor' | 'melodic-minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'major-pentatonic' | 'minor-pentatonic' | 'blues' | 'whole-tone' | 'diminished' | 'double-harmonic' | 'hirajoshi';
export type HarmonyStyle='genre'|'jazz'|'neo-soul'|'modal';
export interface Settings {
  algorithm?: 'legacy-v1' | 'groove-v2' | 'groove-v3' | 'groove-v4' | 'groove-v5';
  variation?: number;
  phraseLength?:4|8|16; phraseOffset?:number; // V3 section position, zero-based bars.
  breakStyle?: BreakStyle;
  breakLayer?: BreakLayer;
  enabledRoles?: Role[];
  genre: Genre; seed: string; bpm: number; bars: number;
  resolution: 8 | 16 | 32 | 64; /** Tracker lines per beat; omitted patterns follow resolution / 4. */
  lpb?: 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24 | 32;
  complexity: number; syncopation: number;
  swing: number; humanizeMs: number; ghostAmount: number; fillAmount: number;
  spicy?: number;
  /** Optional exact number of drum/sample tracker notes after generation. */
  hitTarget?: number;
  /** Groove V4 per-lane optional-hit density. Missing roles behave as 1 (100%). */
  laneDensity?: Partial<Record<Role,number>>;
  patternStructure?: 'groove'|'auto'|'fill'|'roll'|'build';
  /** Omitted in older projects: drum generation only. */
  generationMode?:GenerationMode; melodyPart?:MelodyPart; melodyKey?:number; melodyScale?:MelodyScale; harmonyStyle?:HarmonyStyle;
}
export interface SliceRef {assetId:string; startFrame:number; endFrame:number; sampleRate:number; label:string}
export interface SliceInstrument {
  id:string; name:string; assetId:string; sampleRate:number; startFrame:number; endFrame:number;
  slices:{id:string; note:number; startFrame:number; endFrame:number}[];
  loopFadeMs?:number;
}
/** User tracks retain a legacy role for compatible mixer and FX routing. */
export interface TrackBase {id:string;name:string;role:Role;level:number;pan:number;mute:boolean;solo:boolean;color?:string}
export interface SampleTrack extends TrackBase {
  kind?:'sample';sample:SliceRef;
  /** Identifies a managed sliced break track without changing user sample tracks. */
  generatedBreakLayer?:'think-passage2';
  /** Beat part assigned to this uploaded-sample track. Omitted means manual-only. */
  generationRole?:Role|null;
  /** Stable fraction of optional generated hits retained on this track. */
  generationDensity?:number;
  /** Chance of retaining each optional hit for a specific variation. */
  generationProbability?:number;
}
export type SynthWaveform='sine'|'triangle'|'saw'|'square';
export type SynthPreset='bass'|'pluck'|'pad'|'piano';
export interface SynthInstrument {preset:SynthPreset;waveform:SynthWaveform;attack:number;decay:number;sustain:number;release:number;lowpassHz:number;sampleBank?:'upright-kw';sample?:{assetId:string;rootNote:number}}
export interface SynthTrack extends TrackBase {kind:'synth';instrument:SynthInstrument;generatedPart?:MelodyPart}
export type UserTrack=SampleTrack|SynthTrack;
export const isSynthTrack=(track:UserTrack|undefined):track is SynthTrack=>track?.kind==='synth';
export interface RepeatArticulation {
  gain:number; pitch?:number; sourceOffset?:number; reverse?:boolean; glide?:number;
}
export interface Articulation {
  // Musical ticks for the complete gesture, independent of the visible tracker grid.
  durationTicks:number; mode:'natural'|'gate'|'chop';
  repeats?:RepeatArticulation[]; chokeGroup?:'hat';
}
// Tracker FX are local to one hit. Commands use Renoise's current letter names;
// 09/01/02 are accepted aliases for familiar older tracker notation.
export interface EffectCommand {command:'0S'|'09'|'0B'|'0U'|'01'|'0D'|'02'|'0C'|'0R';param:number}
export interface Hit {
  /** User-authored or user-edited note; Exact Hits leaves it in place. */
  manual?:boolean;
  /** Source beat part for notes routed into uploaded-sample tracks; manual edits clear this. */
  generatedDrumRole?:Role;
  /** Pitched note on a synth track. Sample hits use pitch as relative semitones instead. */
  synthNote?:{note:number;durationTicks:number};
  /** Render-only fader or velocity-layer gain; saved notes keep their original velocity. */
  renderGain?:number;
  mapped?:{instrumentId:string; note:number};
  effect?:EffectCommand;
  sourceKind?:'oneShot'|'slice';
  articulation?:Articulation;
  reverse?:boolean;
  phaseInvert?:boolean;
  layerOf?:string; // Ephemeral render link; layered voices share the original hit's choke group.
  ratchets?:number; gate?:number; // Repeats within one row; gate is a fraction of each repeat interval.
  decay?:number; // Sample envelope decay ratio (0.02 to 1.0; < 1 tightens sound and removes room reverb)
  playbackRate?:number; // 0.5–2x repitch; hit value overrides the lane sample default.
  speedMode?:'repitch'|'stretch'; // Optional hit override; stretch separates duration from pitch.
  stretchRate?:number; // 0.5–2x duration change that preserves approximate source pitch.
  sampleTrim?:{startMs:number;endMs:number}; // Non-destructive region within the resolved source.
  lowpassHz?:number; attackMs?:number;
  slice?:SliceRef; pitch?:number; fineOffset?:number;
  id: string; role: Role; trackId?:string; sourceId: string; baseTick: number; offsetTick: number;
  gain: number; pan: number; anchor: boolean; ghost: boolean; reason: string;
}
export interface Pattern {
  sliceInstruments?:SliceInstrument[];
  userTracks?:UserTrack[];
  drumLanes?:Partial<Record<Role,DrumLane>>;
  engineVersion: string; settings: Settings; ppq: number; events: Hit[];
}
export interface Source {
  id: string; role: Role; kind: 'oneShot' | 'slice'; label: string;
  note: number; instrument: number;
}
export interface Transfer {
  format: 'breakbeat-pattern'; version: 1; engineVersion: string;
  name: string; genre: Genre; seed: string;
  timing: {bpm: number; lpb: number; tpl: number; bars: number; beatsPerBar: 4; lines: number};
  sources: Source[];
  lanes: {id: string; name: string; columns: number}[];
  notes: {id: string; lane: string; source: string; row: number; column: number;
    volume: number; pan: number; delay: number}[];
  warnings: string[];
}
export const DEFAULT_SOURCES: Source[] = ROLES.map((role, instrument) => ({
  id: `kit.${role}`, role, kind: 'oneShot', label: `BPM ${role}`,
  note: 48, instrument,
}));
export function bounded(value: unknown, min: number, max: number, name: string, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`);
  }
}
export function identifier(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(value)) throw new Error(`${name} is not a valid identifier.`);
}
export function text(value: unknown, name: string, max = 120): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || new TextEncoder().encode(value).length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${name} must contain 1–${max} UTF-8 bytes without control characters.`);
  }
}
export function noteName(note: number): string {
  bounded(note, 0, 119, 'note', true);
  return ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'][note % 12]! + Math.floor(note / 12);
}
export function hex(n: number): string {return n.toString(16).toUpperCase().padStart(2, '0');}
