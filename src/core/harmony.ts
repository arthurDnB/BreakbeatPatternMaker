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

export function harmonyPlan(settings:Settings):HarmonyChange[]{
  const style=settings.harmonyStyle??'genre';
  const progressions=melodyProfile(settings.genre,'lead').progressions;
  const pick=random(settings.seed,`melody:harmony:${settings.genre}:${settings.variation??0}:${style}`)();
  const majorScale=['major','lydian','mixolydian','major-pentatonic'].includes(settings.melodyScale??'natural-minor');
  const pool=style==='jazz'?(majorScale?MAJOR_JAZZ:MINOR_JAZZ):style==='neo-soul'?NEO_SOUL:undefined;
  const progression=pool?.[Math.floor(pick*pool.length)]??undefined;
  const genreProgression=progressions[Math.floor(pick*progressions.length)]!;
  const total=settings.bars*4*PPQ;
  // Short tracker patterns still have enough room to state a four-chord phrase.
  const changes=settings.bars<=2?settings.bars*2:settings.bars;
  return Array.from({length:changes},(_,index)=>({
    startTick:Math.round(index*total/changes),
    endTick:Math.round((index+1)*total/changes),
    degree:progression?.degrees[index%progression.degrees.length]??(style==='modal'?[0,3,4,6][index%4]!:genreProgression[Math.floor(index*genreProgression.length/changes)%genreProgression.length]!),
    quality:progression?.qualities[index%progression.qualities.length] as ChordQuality??(style==='modal'?'quartal':'scale'),
    index
  }));
}

export function harmonyAt(plan:readonly HarmonyChange[],tick:number):HarmonyChange{
  for(let index=plan.length-1;index>=0;index--)if(plan[index]!.startTick<=tick)return plan[index]!;
  return plan[0]!;
}
