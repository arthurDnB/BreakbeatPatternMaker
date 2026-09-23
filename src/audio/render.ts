import type {Transfer} from '../core/model.js';
// @ts-expect-error Shared original drum renderer.
import {synthesize} from '../../public/synth.js';
import {encodeWav} from './wav.js';
export function renderPatternWav(pattern:Transfer):ArrayBuffer {
  const rate=44100,rowSeconds=60/pattern.timing.bpm/pattern.timing.lpb;
  const buffers=new Map(pattern.lanes.map(l=>[l.id,synthesize(l.id,rate) as Float32Array]));
  const count=Math.ceil((pattern.timing.lines*rowSeconds+.6)*rate);
  const channels=[new Float32Array(count),new Float32Array(count)];
  for(const note of pattern.notes){
    const sound=buffers.get(note.lane)!;
    const start=Math.round((note.row+note.delay/256)*rowSeconds*rate),pan=note.pan/128;
    const gains=[Math.cos(pan*Math.PI/2),Math.sin(pan*Math.PI/2)];
    for(let i=0;i<sound.length&&start+i<count;i++)for(let c=0;c<2;c++)channels[c]![start+i]!+=sound[i]!*note.volume/128*.65*gains[c]!;
  }
  let peak=0;for(const channel of channels)for(const value of channel)peak=Math.max(peak,Math.abs(value));
  // Only attenuate an overloaded mix, never boost a quiet pattern.
  if(peak>.98)for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]!*=.98/peak;
  return encodeWav(channels,rate);
}
export function downloadBytes(bytes:ArrayBuffer,name:string,type='audio/wav'){
  const url=URL.createObjectURL(new Blob([bytes],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
