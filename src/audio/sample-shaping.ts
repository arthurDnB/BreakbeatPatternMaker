import type {Hit} from '../core/model.js';

/** Per-voice shaping keeps overlapping hits independent and leaves source PCM untouched. */
export function sampleShaper(hit:Hit,rate:number){
 const cutoff=hit.lowpassHz??20000;
 const filtering=cutoff<Math.min(20000,rate*.45);
 const alpha=filtering?1-Math.exp(-2*Math.PI*cutoff/rate):1;
 const memory=[0,0];
 const attack=Math.round((hit.attackMs??0)*rate/1000);
 return (value:number,channel:number,frame:number)=>{
  if(filtering){memory[channel]!+=alpha*(value-memory[channel]!);value=memory[channel]!;}
  return attack>0?value*Math.min(1,frame/attack):value;
 };
}
