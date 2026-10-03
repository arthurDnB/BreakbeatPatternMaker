import {random} from './random.js';
import type {Hit,Settings} from './model.js';

/** Apply the generator's deterministic reverse chance to freshly generated sample hits. */
export function applyReverseProbability(hits:Hit[],settings:Settings):void{
 const probability=settings.reverseProbability??0;
 if(probability<=0)return;
 const variation=settings.variation??0,engine=settings.algorithm??'legacy-v1';
 for(const hit of hits){
  if(hit.synthNote)continue;
  const chance=random(settings.seed,`reverse-note:${engine}:${variation}:${hit.id}`)();
  if(chance<probability)hit.reverse=true;
 }
}
