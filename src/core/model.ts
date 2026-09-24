export const ENGINE_VERSION = '0.1.0';
export const PPQ = 960;
export const ROLES = ['kick', 'snare', 'hat', 'percussion'] as const;
export type Role = typeof ROLES[number];
export type Genre = 'jungle' | 'dnb' | 'hiphop' | 'trap' | 'rap' | 'drill' | 'breakcore' | 'idm' | 'hardcore' | 'experimental' | 'breaks' | 'bigbeat' | 'nuskoolbreaks' | 'electrobreaks' | 'breakbeathardcore' | 'raggajungle' | 'atmosphericjungle' | 'footworkjungle' | 'downtempo' | 'lofihiphop' | 'boombap' | 'mellowbeats' | 'liquiddnb' | 'jumpup' | 'garage' | 'speedgarage' | 'twostepgarage' | 'dub' | 'psydub' | 'dubstep' | 'brostep' | 'postdubstep' | 'drumfunk' | 'amenscience' | 'atmosphericbreakcore' | 'triphop' | 'halftimednb' | 'neurofunk';
export type BreakStyle = 'genre' | 'amen' | 'think' | 'apache' | 'funkyDrummer' | 'hotPants';
export interface Settings {
  algorithm?: 'legacy-v1' | 'groove-v2' | 'groove-v3';
  variation?: number;
  phraseLength?:4|8|16; phraseOffset?:number; // V3 section position, zero-based bars.
  breakStyle?: BreakStyle;
  enabledRoles?: Role[];
  genre: Genre; seed: string; bpm: number; bars: number;
  resolution: 8 | 16 | 32 | 64; complexity: number; syncopation: number;
  swing: number; humanizeMs: number; ghostAmount: number; fillAmount: number;
  spicy?: number;
}
export interface SliceRef {assetId:string; startFrame:number; endFrame:number; sampleRate:number; label:string}
export interface RepeatArticulation {
  gain:number; pitch?:number; sourceOffset?:number; reverse?:boolean; glide?:number;
}
export interface Articulation {
  // Musical ticks for the complete gesture, independent of the visible tracker grid.
  durationTicks:number; mode:'natural'|'gate'|'chop';
  repeats?:RepeatArticulation[]; chokeGroup?:'hat';
}
export interface Hit {
  sourceKind?:'oneShot'|'slice';
  articulation?:Articulation;
  reverse?:boolean;
  ratchets?:number; gate?:number; // Repeats within one row; gate is a fraction of each repeat interval.
  decay?:number; // Sample envelope decay ratio (0.02 to 1.0; < 1 tightens sound and removes room reverb)
  slice?:SliceRef; pitch?:number; fineOffset?:number;
  id: string; role: Role; sourceId: string; baseTick: number; offsetTick: number;
  gain: number; pan: number; anchor: boolean; ghost: boolean; reason: string;
}
export interface Pattern {
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
  lanes: {id: Role; name: string; columns: number}[];
  notes: {id: string; lane: Role; source: string; row: number; column: number;
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
