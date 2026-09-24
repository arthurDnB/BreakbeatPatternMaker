import {PPQ,type Settings} from './model.js';
import {random} from './random.js';

export const V3_BAR=4*PPQ;
export const V3_SIXTEENTH=PPQ/4;
/** Named streams make unrelated controls unable to perturb the core motif. */
export function v3Chance(s:Settings,stage:string,key:string,variation=true):number {
 return random(s.seed,`groove-v3:${s.genre}:${stage}:${variation?s.variation??0:0}:${key}`)();
}
export function v3Pick<T>(items:readonly T[],s:Settings,stage:string,key:string,variation=true):T {
 if(items.length===0)throw Error('A groove phrase needs at least one choice.');
 return items[Math.floor(v3Chance(s,stage,key,variation)*items.length)]!;
}
/** Evenly distributed pulses; rotation is in steps, not another probability. */
export function euclideanSteps(pulses:number,steps:number,rotation=0):number[] {
 if(!Number.isInteger(pulses)||!Number.isInteger(steps)||steps<1||pulses<0||pulses>steps||!Number.isInteger(rotation))throw Error('Invalid Euclidean rhythm.');
 return Array.from({length:steps},(_,i)=>i).filter(i=>(((i-rotation)%steps+steps)%steps*pulses)%steps<pulses);
}
/** Round each rational boundary independently: no accumulated tuplet drift. */
export function subdivisionTicks(start:number,duration:number,count:number):number[] {
 if(!Number.isInteger(count)||count<1||!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0)throw Error('Invalid rhythmic subdivision.');
 return Array.from({length:count},(_,i)=>Math.round(start+i*duration/count));
}
export function v3LayerEnabled(s:Settings,stage:string,key:string,activity:number,floor=.2):boolean {
 const admitted=v3Chance(s,stage+':density',key)<activity;
 return admitted&&s.complexity>=floor+(1-floor)*v3Chance(s,stage+':depth',key);
}
