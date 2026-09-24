import {effectTail,processEffects,type Effects} from './effects.js';
import {ROLES,type Role,type Pattern} from '../core/model.js';
import {compile} from '../core/compile.js';
import type {AudioAsset} from './slices.js';
// @ts-expect-error Shared original synth.
import {synthesize} from '../../public/synth.js';
// One renderer for preview and WAV, including stereo slices and pitch repitching.
export function renderPerformance(pattern:Pattern,assets:Map<string,AudioAsset>,rate=44100,effects:Partial<Record<Role,Effects>>={}){
  return renderSequence([pattern],assets,rate,effects);
}
export function renderSequence(patterns:Pattern[],assets:Map<string,AudioAsset>,rate=44100,effects:Partial<Record<Role,Effects>>={}){
  if(!patterns.length)throw Error('Add a pattern to the arrangement.');
  patterns.forEach(p=>compile(p));
  const duration=patterns.reduce((sum,p)=>sum+p.settings.bars*240/p.settings.bpm,0);
  if(duration>170)throw Error('Arrangement limit is 170 seconds plus effect tails.');
  let position=0;
  const kit=new Map<string,Float32Array>();
  const voices=patterns.flatMap(pattern=>{
  const origin=position;position+=pattern.settings.bars*240/pattern.settings.bpm;
  const secondsPerTick=60/pattern.settings.bpm/960;
  return pattern.events.flatMap(hit=>{
    const ratio=2**((hit.pitch??0)/12),start=origin+Math.max(0,(hit.baseTick+hit.offsetTick+(hit.fineOffset??0))*secondsPerTick);
    let channels:Float32Array[],sourceRate=rate,from=0,to=0;
    if(hit.slice){
      const asset=assets.get(hit.slice.assetId);if(!asset)throw Error('The audio for a slice is missing. Re-import and reassign the slice.');
      if(asset.sampleRate!==hit.slice.sampleRate||hit.slice.endFrame>asset.channels[0]!.length)throw Error('Slice audio does not match its saved boundaries.');
      channels=asset.channels;sourceRate=asset.sampleRate;from=hit.slice.startFrame;to=hit.slice.endFrame;
    }else{if(!kit.has(hit.role))kit.set(hit.role,synthesize(hit.role,rate));channels=[kit.get(hit.role)!];to=channels[0]!.length;}
    const count=hit.ratchets??1,interval=240/pattern.settings.bpm/pattern.settings.resolution/count;
    const naturalLength=Math.ceil((to-from)/sourceRate/ratio*rate),gated=hit.gate!==undefined||count>1;
    return Array.from({length:count},(_,repeat)=>{
      const onset=start+repeat*interval;
      const window=Math.min(interval*(hit.gate??1),Math.max(0,position-onset));
      const length=gated?Math.min(naturalLength,Math.max(0,Math.round(window*rate))):naturalLength;
      return {hit,channels,from,to,start:onset,step:sourceRate/rate*ratio,length,gated};
    }).filter(v=>v.length>0&&(count===1||v.start<position));
  });
  });
  const end=voices.reduce((end,v)=>Math.max(end,v.start+v.length/rate+effectTail(effects[v.hit.role])),duration+.6);
  if(end>180)throw Error('Rendered audio is limited to three minutes. Shorten the sample or increase its pitch.');
  const channels=[new Float32Array(Math.ceil(end*rate)),new Float32Array(Math.ceil(end*rate))];
  for(const role of ROLES){
  const laneVoices=voices.filter(v=>v.hit.role===role);if(!laneVoices.length)continue;
  const bus=[new Float32Array(channels[0]!.length),new Float32Array(channels[0]!.length)];
  for(const v of laneVoices){
    const offset=Math.round(v.start*rate),pan=v.hit.pan;
    const gains=v.channels.length===1?[Math.cos((pan+1)*Math.PI/4),Math.sin((pan+1)*Math.PI/4)]:[pan>0?1-pan:1,pan<0?1+pan:1];
    // Mono slices stay at unity at centre, demo drums retain the established kit level.
    const level=v.hit.gain*(v.hit.slice?(v.channels.length===1?Math.SQRT2:1):.65);
    for(let i=0;i<v.length&&offset+i<channels[0]!.length;i++){
      const pos=v.hit.reverse?v.to-1-i*v.step:v.from+i*v.step,index=Math.floor(pos),fraction=pos-index;if(index>=v.to||index<v.from)break;
      for(let c=0;c<2;c++){const data=v.channels[Math.min(c,v.channels.length-1)]!;
        const value=data[index]!*(1-fraction)+data[Math.min(v.to-1,index+1)]!*fraction;
        const fade=Math.max(1,Math.min(Math.round(rate*.001),Math.floor(v.length/2)));
        const envelope=v.gated?Math.min(1,i/fade,(v.length-1-i)/fade):1;
        bus[c]![offset+i]!+=value*level*gains[c]!*envelope;
      }
    }
  }
  processEffects(bus,rate,effects[role]);for(let c=0;c<2;c++)for(let i=0;i<bus[c]!.length;i++)channels[c]![i]!+=bus[c]![i]!;
  }
  // Master bus glue & soft saturation: warm analog tape curve for peaks above 0.7
  for(let c=0;c<2;c++){
    const ch=channels[c]!;
    for(let i=0;i<ch.length;i++){
      const v=ch[i]!,abs=Math.abs(v);
      if(abs>0.7){
        const sign=v<0?-1:1;
        ch[i]=sign*(0.7+0.28*Math.tanh((abs-0.7)/0.28));
      }
    }
  }
  let peak=0;for(const channel of channels)for(const value of channel)peak=Math.max(peak,Math.abs(value));
  const attenuation=peak>1?.98/peak:1;
  if(attenuation<1)for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]!*=attenuation;
  return {channels,sampleRate:rate,duration,attenuation};
}
