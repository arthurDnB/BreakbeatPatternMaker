import {PPQ,type Settings} from './model.js';

/** Musical time is measured in quarter-note ticks, regardless of the denominator. */
export function parseTimeSignature(sig?:string){
 const match=/^([1-9]\d?)\s*\/\s*(1|2|4|8|16|32)$/.exec((sig??'4/4').trim());
 if(!match||Number(match[1])>32)throw Error('Time signature must use a numerator from 1 to 32 and denominator 1, 2, 4, 8, 16 or 32 (for example 7/8).');
 const numerator=Number(match[1]),denominator=Number(match[2]),beatTicks=PPQ*4/denominator;
 return {numerator,denominator,beatTicks,barTicks:numerator*beatTicks,stepsPerBar:numerator*16/denominator};
}
export const barTicks=(s:Pick<Settings,'timeSignature'>)=>parseTimeSignature(s.timeSignature).barTicks;
export const patternTicks=(s:Pick<Settings,'timeSignature'|'bars'>)=>s.bars*barTicks(s);
/** Retain the original arithmetic for old projects, including export sample boundaries. */
export const patternSeconds=(s:Pick<Settings,'timeSignature'|'bars'|'bpm'>,bpm=s.bpm)=>s.bars*(barTicks(s)/PPQ*60)/bpm;
export function trackerTiming(s:Pick<Settings,'timeSignature'|'bars'|'lpb'|'resolution'>,lpb=s.lpb??s.resolution/4){
 const meter=parseTimeSignature(s.timeSignature),rowsPerBar=meter.barTicks*lpb/PPQ,lines=rowsPerBar*s.bars;
 if(!Number.isInteger(rowsPerBar)||rowsPerBar<1)throw Error(`${meter.numerator}/${meter.denominator} cannot use LPB ${lpb}: each bar must contain a whole number of rows. Choose a compatible LPB.`);
 if(lines>512)throw Error(`This meter and length need ${lines} rows. Choose a lower LPB or fewer bars (maximum 512 rows).`);
 return {...meter,rowsPerBar,lines};
}
export function meterPosition(s:Pick<Settings,'timeSignature'>,quarterBeats:number){
 const meter=parseTimeSignature(s.timeSignature),tick=quarterBeats*PPQ;
 return {bar:Math.floor(tick/meter.barTicks)+1,beat:Math.floor((tick%meter.barTicks)/meter.beatTicks)+1,fraction:(tick%meter.beatTicks)/meter.beatTicks};
}
/** Group denominator beats, with no single-beat remainder for asymmetric meters. */
export function meterGroups(sig?:string):number[]{
 const {numerator:n,denominator:d}=parseTimeSignature(sig);
 if(d===8&&n%3===0)return Array(n/3).fill(3);
 if(n<=4)return [n];
 const groups:number[]=[];let left=n;
 while(left>0){const size=left===4?2:left>=3&&left!==2?3:left;groups.push(size);left-=size;}
 return groups;
}
