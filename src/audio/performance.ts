import {patternSeconds} from '../core/meter.js';
import {effectTail,processEffects,type Effects} from './effects.js';
import {ROLES,isSynthTrack,type Role,type Pattern} from '../core/model.js';
import {compile} from '../core/compile.js';
import type {AudioAsset} from './slices.js';
import {planV3Voices,applyV3Chokes,renderV3Voice,type RenderVoice} from './voice-v3.js';
import {sampleShaper} from './sample-shaping.js';
import {mixVinylTexture} from './vinyl-texture.js';
import {resolvePatternSlices} from '../core/slice-instrument.js';
import {stretchAudio} from './time-stretch.js';
import {protectMaster} from './audio-quality.js';
import {renderSampledPianoNote,renderSynthNote} from './synth-instrument.js';
import {modularTailSeconds,renderModularSynthNote} from './modular-synth.js';
import {pianoBankSample} from './piano-bank.js';
// @ts-expect-error Shared original synth.
import {synthesize} from '../../public/synth.js';
export interface RenderOptions {
  loop?: boolean;
  maxTailSeconds?: number;
  trimSilence?: boolean;
  vinylTexture?:{asset:AudioAsset;levelDb:number};
}
// One renderer for preview and WAV, including stereo slices and pitch repitching.
export function renderPerformance(pattern:Pattern,assets:Map<string,AudioAsset>,rate=44100,effects:Partial<Record<Role,Effects>>={},options:RenderOptions={}){
  return renderSequence([pattern],assets,rate,effects,options);
}
export function renderSequence(patterns:Pattern[],assets:Map<string,AudioAsset>,rate=44100,effects:Partial<Record<Role,Effects>>={},options:RenderOptions={}){
  if(!patterns.length)throw Error('Add a pattern to the arrangement.');
  if(!Number.isInteger(rate)||rate<8000||rate>192000)throw Error('Render sample rate must be 8–192 kHz.');
  patterns.forEach(p=>compile(p));
  patterns=patterns.map(resolvePatternSlices);
  const duration=patterns.reduce((sum,p)=>sum+patternSeconds(p.settings),0);
  if(duration>170)throw Error('Arrangement limit is 170 seconds plus effect tails.');
  let position=0;
  const kit=new Map<string,Float32Array>();
  const stretched=new Map<string,Float32Array[]>();
  const synthCache=new Map<string,Float32Array[]>();let synthCacheBytes=0;
  const voices:RenderVoice[]=patterns.flatMap(pattern=>{
  const origin=position;position+=patternSeconds(pattern.settings);
  const secondsPerTick=60/pattern.settings.bpm/960;
  return pattern.events.flatMap((hit):RenderVoice[]=>{
    const synthTrack=hit.trackId?pattern.userTracks?.find(track=>track.id===hit.trackId):undefined;
    if(hit.synthNote&&isSynthTrack(synthTrack)){
      const start=origin+Math.max(0,(hit.baseTick+hit.offsetTick+(hit.fineOffset??0))*secondsPerTick);
      const noteSeconds=hit.synthNote.durationTicks*secondsPerTick;
      const bankChoice=!synthTrack.instrument.sample&&synthTrack.instrument.sampleBank==='upright-kw'?pianoBankSample(hit.synthNote.note,hit.gain):undefined;
      const sampleId=synthTrack.instrument.sample?.assetId??bankChoice?.assetId;
      const sample=sampleId?assets.get(sampleId):undefined;
      if(synthTrack.instrument.sample&&!sample)throw Error('The piano sample is missing. Re-import it into this track.');
      const key=`${hit.synthNote.note}:${noteSeconds.toFixed(9)}:${rate}:${sampleId??''}:${synthTrack.instrument.patch?hit.gain:''}:${JSON.stringify(synthTrack.instrument)}`;
      let channels=synthCache.get(key);
      if(!channels){
        const bytes=Math.ceil((noteSeconds+(synthTrack.instrument.patch?modularTailSeconds(synthTrack.instrument.patch):synthTrack.instrument.release))*rate)*4*(synthTrack.instrument.patch?2:sample?.channels.length??1);
        if(synthCacheBytes+bytes>128*1024*1024)throw Error('Synth render exceeds 128 MB. Shorten notes or render a smaller arrangement.');
        const instrument=bankChoice?{...synthTrack.instrument,sample:{assetId:bankChoice.assetId,rootNote:bankChoice.rootNote}}:synthTrack.instrument;
        channels=instrument.patch?[0,1].map(channel=>renderModularSynthNote(hit.synthNote!.note,noteSeconds,rate,instrument.patch!,sample,instrument.sample?.rootNote??bankChoice?.rootNote??60,channel,hit.gain)):sample?renderSampledPianoNote(hit.synthNote.note,noteSeconds,rate,instrument,sample):[renderSynthNote(hit.synthNote.note,noteSeconds,rate,instrument)];
        synthCache.set(key,channels);synthCacheBytes+=channels.reduce((sum,data)=>sum+data.byteLength,0);
      }
      return [{hit,channels,from:0,to:channels[0]!.length,start,step:1,length:channels[0]!.length,gated:false}];
    }
    const ratio=(hit.playbackRate??1)*2**((hit.pitch??0)/12),start=origin+Math.max(0,(hit.baseTick+hit.offsetTick+(hit.fineOffset??0))*secondsPerTick);
    let channels:Float32Array[],sourceRate=rate,from=0,to=0;
    if(hit.slice){
      const asset=assets.get(hit.slice.assetId);
      if(!asset)throw Error('The audio for a slice is missing. Re-import and reassign the slice.');
      if(asset.sampleRate!==hit.slice.sampleRate||hit.slice.endFrame>asset.channels[0]!.length)throw Error('Slice audio does not match its saved boundaries.');
      channels=asset.channels;sourceRate=asset.sampleRate;from=hit.slice.startFrame;to=hit.slice.endFrame;
    }else{if(!kit.has(hit.role))kit.set(hit.role,synthesize(hit.role,rate));channels=[kit.get(hit.role)!];to=channels[0]!.length;}
    if(hit.sampleTrim){
      const base=from,limit=to;
      from=Math.min(limit-1,base+Math.round(hit.sampleTrim.startMs*sourceRate/1000));
      to=Math.min(limit,base+Math.round(hit.sampleTrim.endMs*sourceRate/1000));
      if(to<=from)throw Error('The sample trim has no audio. Adjust its start and end.');
    }
    if(hit.stretchRate&&hit.stretchRate!==1){
      const key=`${hit.slice?.assetId??`synth-${hit.role}`}:${from}:${to}:${hit.stretchRate}:${sourceRate}`;
      let prepared=stretched.get(key);
      if(!prepared){prepared=stretchAudio(channels.map(c=>c.subarray(from,to)),sourceRate,hit.stretchRate);stretched.set(key,prepared);}
      channels=prepared;from=0;to=prepared[0]!.length;
    }
    if(hit.effect){
      const command=hit.effect.command,param=hit.effect.param,fxHit={...hit,ratchets:1,articulation:undefined};
      const effectVoices=planV3Voices(pattern,fxHit,channels,sourceRate,from,to,origin,options.loop ? Infinity : position,rate);
      if(command==='0C'){
        const ticks=param&15,level=(param>>4)/15;
        for(const voice of effectVoices){voice.volumeCutAtFrames=Math.round(60/pattern.settings.bpm/pattern.settings.resolution*4*rate*ticks/12);voice.volumeAfterCut=level;}
      }
      if(command==='0R'){
        const tickInterval=param&15;if(!tickInterval)return effectVoices;
        const tickSeconds=60/pattern.settings.bpm/pattern.settings.resolution*4/12;
        const span=Math.round(tickInterval*tickSeconds*rate);
        const mode=param>>4;
        const factor=[1,.97,.94,.88,.75,.5,2/3,.5,1,1.03,1.06,1.12,1.25,1.5,1.5,2][mode]!;
        const repeats=[] as RenderVoice[];
        for(let tick=0;tick<12;tick+=tickInterval){
          const voice={...effectVoices[0]!,start:start+tick*tickSeconds,repeatGain:Math.min(2,Math.max(0,factor**(tick/tickInterval))),length:Math.min(effectVoices[0]!.length,span),gated:true,edgeFade:true};
          if(voice.start<position)repeats.push(voice);
        }
        return repeats;
      }
      return effectVoices;
    }
    if(['groove-v3','groove-v4','groove-v5','groove-v5.1'].includes(pattern.settings.algorithm??''))return planV3Voices(pattern,hit,channels,sourceRate,from,to,origin,options.loop ? Infinity : position,rate);
    const count=hit.ratchets??1,interval=240/pattern.settings.bpm/pattern.settings.resolution/count;
    const naturalLength=Math.ceil((to-from)/sourceRate/ratio*rate),decayActive=hit.decay!==undefined&&hit.decay<1;
    const decayMax=decayActive?Math.max(Math.round(rate*.02),Math.round(naturalLength*hit.decay!)):naturalLength;
    const gated=hit.gate!==undefined||count>1||decayActive;
    const minBody=!hit.slice&&(hit.role==='kick'?Math.round(rate*.08):(hit.role==='snare'&&!hit.ghost&&count===1?Math.round(rate*.065):0));
    return Array.from({length:count},(_,repeat)=>{
      const onset=start+repeat*interval;
      const window=Math.min(interval*(hit.gate??1),Math.max(0,position-onset));
      const length=gated?Math.min(naturalLength,Math.max(minBody||0,Math.min(decayMax,Math.max(0,Math.round(window*rate))))):naturalLength;
      return {hit,channels,from,to,start:onset,step:sourceRate/rate*ratio,length,gated};
    }).filter(v=>v.length>0&&(count===1||v.start<position));
  }).map(voice=>{
    if(voice.hit.mapped){const instrument=pattern.sliceInstruments!.find(i=>i.id===voice.hit.mapped!.instrumentId)!;voice.mappedRegion=instrument;}
    if(voice.hit.sampleTrim){voice.fadeStart=true;voice.fadeEnd=true;voice.fadeMs=2;}
    return voice;
  });
  });
  const synthTrackIds=new Set(patterns.flatMap(p=>(p.userTracks??[]).filter(isSynthTrack).map(track=>track.id)));
  for(const trackId of synthTrackIds){
    const notes=voices.filter(v=>v.hit.synthNote&&v.hit.trackId===trackId).sort((a,b)=>a.start-b.start);
    const piano=patterns.some(pattern=>pattern.userTracks?.some(track=>isSynthTrack(track)&&track.id===trackId&&track.instrument.preset==='piano'));
    const active:RenderVoice[]=[];
    for(const voice of notes){
      for(let i=active.length-1;i>=0;i--)if(active[i]!.start+active[i]!.length/rate<=voice.start)active.splice(i,1);
      if(active.length>=(piano?16:8)){const oldest=active.shift()!;oldest.length=Math.max(0,Math.round((voice.start-oldest.start)*rate));oldest.gated=true;}
      active.push(voice);
    }
  }
  applyV3Chokes(voices,rate,options.loop?duration:undefined);
  // Unedited adjacent source segments must meet exactly. Only discontinuous
  // edges are faded; unconditional fades remove transients from reconstruction.
  for(const voice of voices.filter(v=>v.hit.mapped)){
    const plain=(v:RenderVoice)=>!v.hit.pitch&&!v.hit.reverse&&!v.hit.effect&&!v.hit.gate&&!v.hit.decay&&!v.hit.sampleTrim&&(!v.hit.ratchets||v.hit.ratchets===1)&&(!v.hit.playbackRate||v.hit.playbackRate===1);
    const frame=Math.round(voice.start*rate),end=frame+voice.length;
    const same=(v:RenderVoice)=>v!==voice&&v.hit.mapped?.instrumentId===voice.hit.mapped!.instrumentId&&v.hit.slice?.assetId===voice.hit.slice?.assetId&&v.hit.role===voice.hit.role&&v.hit.gain===voice.hit.gain&&v.hit.pan===voice.hit.pan&&plain(v)&&plain(voice);
    const previous=voices.some(v=>same(v)&&v.to===voice.from&&Math.abs(Math.round(v.start*rate)+v.length-frame)<=1);
    const next=voices.some(v=>same(v)&&v.from===voice.to&&Math.abs(Math.round(v.start*rate)-end)<=1);
    const definition=voice.mappedRegion!;
    const sourceStart=voice.from===definition.startFrame,sourceEnd=voice.to===definition.endFrame;
    voice.fadeStart ||= !previous&&!sourceStart;voice.fadeEnd ||= !next&&!sourceEnd;
    if(definition.loopFadeMs&&options.loop){voice.fadeStart||=sourceStart;voice.fadeEnd||=sourceEnd;voice.fadeMs=definition.loopFadeMs;}
  }
  const end=voices.reduce((end,v)=>Math.max(end,v.start+v.length/rate+effectTail(effects[v.hit.role])),duration+.6);
  if(end>180)throw Error('Rendered audio is limited to three minutes. Shorten the sample or increase its pitch.');
  const loopSamples=Math.round(duration*rate);
  const busLength=Math.ceil(end*rate);
  const outLength=options.loop?loopSamples:busLength;
  const channels=[new Float32Array(outLength),new Float32Array(outLength)];
  for(const lane of [...ROLES,...synthTrackIds]){
  const laneVoices=voices.filter(v=>v.hit.synthNote?v.hit.trackId===lane:v.hit.role===lane);if(!laneVoices.length)continue;
  const bus=[new Float32Array(busLength),new Float32Array(busLength)];
  for(const v of laneVoices){
    if(v.v3){renderV3Voice(v,bus,rate);continue;}
    const shape=sampleShaper(v.hit,rate);
    const offset=Math.round(v.start*rate),pan=v.hit.pan;
    const gains=v.channels.length===1?[Math.cos((pan+1)*Math.PI/4),Math.sin((pan+1)*Math.PI/4)]:[pan>0?1-pan:1,pan<0?1+pan:1];
    // Mono slices stay at unity at centre, demo drums retain the established kit level.
    const level=(v.hit.renderGain??v.hit.gain)*(v.hit.phaseInvert?-1:1)*(v.hit.slice?(v.channels.length===1?Math.SQRT2:1):.65);
    for(let i=0;i<v.length&&offset+i<busLength;i++){
      const pos=v.hit.reverse?v.to-1-i*v.step:v.from+i*v.step,index=Math.floor(pos),fraction=pos-index;if(index>=v.to||index<v.from)break;
      for(let c=0;c<2;c++){const data=v.channels[Math.min(c,v.channels.length-1)]!;
        const value=data[index]!*(1-fraction)+data[Math.min(v.to-1,index+1)]!*fraction;
        const fade=Math.max(1,Math.min(Math.round(rate*.002),Math.floor(v.length/2)));
        let envelope=v.gated?Math.min(1,i/fade,(v.length-1-i)/fade):1;
        if(v.fadeStart)envelope*=Math.min(1,i/Math.max(1,rate*(v.fadeMs??1)/1000));
        if(v.fadeEnd)envelope*=Math.min(1,(v.length-1-i)/Math.max(1,rate*(v.fadeMs??1)/1000));
        if(v.hit.decay!==undefined&&v.hit.decay<1){
          const t=i/v.length;
          envelope*=(1-t)*(1-t);
        }
        bus[c]![offset+i]!+=shape(value,c,i)*level*gains[c]!*envelope;
      }
    }
  }
  processEffects(bus,rate,effects[laneVoices[0]!.hit.role]);
  for(let c=0;c<2;c++){
    const b=bus[c]!,ch=channels[c]!;
    if(options.loop){
      for(let i=0;i<b.length;i++){
        const val=b[i]!;if(val!==0)ch[i%loopSamples]!+=val;
      }
    }else{
      for(let i=0;i<b.length;i++)ch[i]!+=b[i]!;
    }
  }
  }
  if(!options.loop&&(options.trimSilence||options.maxTailSeconds!==undefined)){
    const maxSamples=options.maxTailSeconds!==undefined?Math.round((duration+options.maxTailSeconds)*rate):channels[0]!.length;
    let lastAudible=Math.min(channels[0]!.length-1,maxSamples);
    while(lastAudible>loopSamples&&Math.abs(channels[0]![lastAudible]!)<0.0003&&Math.abs(channels[1]![lastAudible]!)<0.0003){
      lastAudible--;
    }
    const keep=Math.min(channels[0]!.length,Math.max(loopSamples,lastAudible+Math.round(rate*.05)));
    if(keep<channels[0]!.length){
      channels[0]=channels[0]!.slice(0,keep);
      channels[1]=channels[1]!.slice(0,keep);
    }
  }
  if(options.vinylTexture)mixVinylTexture(channels,rate,options.vinylTexture.asset,options.vinylTexture.levelDb,!!options.loop);
  // Preserve published V1–V3 PCM exactly. The cleaner linear output guard is
  // available to new Groove V4 work without rewriting older saved exports.
  if(patterns.some(p=>!['groove-v4','groove-v5','groove-v5.1'].includes(p.settings.algorithm??''))){
    const transparent=patterns.every(p=>p.events.every(h=>h.mapped));
    for(const ch of channels)for(let i=0;i<ch.length;i++){
      const v=ch[i]!,abs=Math.abs(v);
      if(abs>.7&&!transparent)ch[i]=Math.sign(v)*(.7+.28*Math.tanh((abs-.7)/.28));
    }
    let peak=0;for(const channel of channels)for(const value of channel)peak=Math.max(peak,Math.abs(value));
    const attenuation=peak>1?.98/peak:1;
    if(attenuation<1)for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]!*=attenuation;
    return {channels,sampleRate:rate,duration,attenuation,quality:undefined};
  }
  const quality=protectMaster(channels);
  return {channels,sampleRate:rate,duration,attenuation:quality.attenuation,quality};
}
