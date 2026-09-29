import {PPQ,type Settings} from './model.js';
import {melodyProfile} from './melody-profiles.js';
import {random} from './random.js';

/** Chord changes are shared by independently generated bass, lead and piano. */
export interface HarmonyChange {startTick:number;endTick:number;degree:number;index:number}

export function harmonyPlan(settings:Settings):HarmonyChange[]{
  const progressions=melodyProfile(settings.genre,'lead').progressions;
  const pick=random(settings.seed,`melody:harmony:${settings.genre}:${settings.variation??0}`)();
  const progression=progressions[Math.floor(pick*progressions.length)]!;
  const total=settings.bars*4*PPQ;
  // Short tracker patterns still have enough room to state a four-chord phrase.
  const changes=settings.bars<=2?settings.bars*2:settings.bars;
  return Array.from({length:changes},(_,index)=>({
    startTick:Math.round(index*total/changes),
    endTick:Math.round((index+1)*total/changes),
    degree:progression[Math.floor(index*progression.length/changes)%progression.length]!,
    index
  }));
}

export function harmonyAt(plan:readonly HarmonyChange[],tick:number):HarmonyChange{
  for(let index=plan.length-1;index>=0;index--)if(plan[index]!.startTick<=tick)return plan[index]!;
  return plan[0]!;
}
