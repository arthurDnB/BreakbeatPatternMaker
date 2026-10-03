import {PPQ,type Settings} from './model.js';
import {melodyProfile} from './melody-profiles.js';
import {random} from './random.js';

/** Chord changes are shared by independently generated bass, lead and piano. */
export type ChordQuality='scale'|'maj9'|'m9'|'m11'|'maj13'|'dom13'|'dom7b9'|'m7b5'|'m6/9'|'dom7sharp11'|'quartal';
export interface HarmonyChange {startTick:number;endTick:number;degree:number;index:number;quality:ChordQuality}

const MAJOR_JAZZ=[
  {degrees:[1,4,0,5],qualities:['m9','dom13','maj9','m9']},
  {degrees:[0,5,1,4],qualities:['maj9','m9','m9','dom13']},
  {degrees:[2,5,1,4],qualities:['m9','dom13','m9','dom7sharp11']},
  {degrees:[3,6,1,4],qualities:['maj9','m7b5','m9','dom13']}
] as const;
const MINOR_JAZZ=[
  {degrees:[1,4,0,5],qualities:['m7b5','dom7b9','m9','maj9']},
  {degrees:[0,3,1,4],qualities:['m9','m11','m7b5','dom7b9']},
  {degrees:[5,1,4,0],qualities:['maj9','m7b5','dom7b9','m9']},
  {degrees:[0,5,2,4],qualities:['m6/9','maj9','m7b5','dom7b9']}
] as const;
const NEO_SOUL=[
  {degrees:[0,2,5,1],qualities:['maj9','m11','m9','dom13']},
  {degrees:[5,1,4,0],qualities:['m9','m11','dom7sharp11','maj13']},
  {degrees:[0,3,5,4],qualities:['maj13','maj9','m9','dom13']}
] as const;

const NAMED_PRESETS: Record<string, {degrees: number[], qualities?: string[]}> = {
  'I-V-vi-IV': {degrees: [0,4,5,3]},
  'vi-IV-I-V': {degrees: [5,3,0,4]},
  'I-vi-IV-V': {degrees: [0,5,3,4]},
  'ii-V-I': {degrees: [1,4,0]},
  'iii-VI-ii-V': {degrees: [2,5,1,4]},
  'minor-i-VI-III-VII': {degrees: [0,5,2,6]},
};

export function parseRomanProgression(input: string): {degrees: number[], qualities: (ChordQuality | null)[]} {
  const parts = input.trim().split(/[\s,]+/);
  if (!parts.length || parts[0] === '') throw new Error('Empty progression');
  
  const degrees: number[] = [];
  const qualities: (ChordQuality | null)[] = [];
  
  for (const part of parts) {
    const match = part.match(/^(iii|vii|iv|vi|ii|i|v)(.*)$/i);
    if (!match) throw new Error(`Invalid Roman numeral: ${part}`);
    
    const roman = match[1]!.toLowerCase();
    const suffix = match[2]!;
    
    let degree = 0;
    switch (roman) {
      case 'i': degree = 0; break;
      case 'ii': degree = 1; break;
      case 'iii': degree = 2; break;
      case 'iv': degree = 3; break;
      case 'v': degree = 4; break;
      case 'vi': degree = 5; break;
      case 'vii': degree = 6; break;
    }
    degrees.push(degree);
    
    if (!suffix) {
      qualities.push(null);
    } else {
      const s = suffix.toLowerCase();
      let q: ChordQuality = 'scale';
      if (s === 'maj9' || s === 'maj7' || s === 'maj') q = 'maj9';
      else if (s === 'maj13') q = 'maj13';
      else if (s === 'm9' || s === 'm7' || s === 'min7' || s === 'min9' || s === 'min' || s === 'm') q = 'm9';
      else if (s === 'm11' || s === 'min11') q = 'm11';
      else if (s === '7' || s === 'dom7' || s === 'dom13' || s === '13') q = 'dom13';
      else if (s === '7b9' || s === 'dom7b9') q = 'dom7b9';
      else if (s === 'dim' || s === 'dim7' || s === 'm7b5' || s === 'halfdim') q = 'm7b5';
      else if (s === 'm6/9' || s === '6/9') q = 'm6/9';
      else if (s === '7#11' || s === 'dom7sharp11') q = 'dom7sharp11';
      else if (s === 'quartal' || s === 'sus4' || s === 'sus') q = 'quartal';
      else throw new Error(`Unknown chord quality suffix: ${suffix}`);
      qualities.push(q);
    }
  }
  return {degrees, qualities};
}

export function harmonyPlan(settings:Settings):HarmonyChange[]{
  const style=settings.harmonyStyle??'genre';
  const mode=settings.chordProgression??'auto';
  
  let progression: {degrees: readonly number[], qualities: readonly (ChordQuality | null)[]} | undefined;
  
  if (mode === 'custom' && settings.customChordProgression) {
    progression = parseRomanProgression(settings.customChordProgression);
  } else if (mode !== 'auto' && NAMED_PRESETS[mode]) {
    progression = {
      degrees: NAMED_PRESETS[mode].degrees,
      qualities: NAMED_PRESETS[mode].qualities ? (NAMED_PRESETS[mode].qualities as ChordQuality[]) : []
    };
  } else {
    // Auto (Genre / Style)
    const progressions=melodyProfile(settings.genre,'lead').progressions;
    const pick=random(settings.seed,`melody:harmony:${settings.genre}:${settings.variation??0}:${style}`)();
    const majorScale=['major','lydian','mixolydian','major-pentatonic'].includes(settings.melodyScale??'natural-minor');
    const pool=style==='jazz'?(majorScale?MAJOR_JAZZ:MINOR_JAZZ):style==='neo-soul'?NEO_SOUL:undefined;
    const poolProg=pool?.[Math.floor(pick*pool.length)]??undefined;
    const genreProgression=progressions[Math.floor(pick*progressions.length)]!;
    
    // We mock the progression object to match the old logic
    if (poolProg) {
      progression = {degrees: poolProg.degrees, qualities: poolProg.qualities};
    } else {
      // Fallback for modal or genre
      const degs = Array.from({length: settings.bars}, (_, index) => 
        style==='modal' ? [0,3,4,6][index%4]! : genreProgression[Math.floor(index*genreProgression.length/settings.bars)%genreProgression.length]!
      );
      progression = {
        degrees: degs,
        qualities: Array.from({length: settings.bars}, () => style==='modal' ? 'quartal' : 'scale')
      };
    }
  }
  
  const total=settings.bars*4*PPQ;
  // Determine number of chord changes evenly distributed.
  // The original engine maps evenly over settings.bars.
  // If custom or preset progression has fewer/more chords, we distribute them evenly across the whole phrase.
  const changes = mode === 'auto' ? settings.bars : (progression.degrees.length > 0 ? progression.degrees.length : settings.bars);
  
  return Array.from({length:changes},(_,index)=>({
    startTick:Math.round(index*total/changes),
    endTick:Math.round((index+1)*total/changes),
    degree:progression!.degrees[index%progression!.degrees.length]!,
    quality:(progression!.qualities[index%progression!.qualities.length] ?? (style==='modal'?'quartal':'scale')) as ChordQuality,
    index
  }));
}
export function harmonyAt(plan:readonly HarmonyChange[],tick:number):HarmonyChange{
  for(let index=plan.length-1;index>=0;index--)if(plan[index]!.startTick<=tick)return plan[index]!;
  return plan[0]!;
}
