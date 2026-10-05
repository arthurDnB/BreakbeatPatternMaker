import {ROLES,isSynthTrack,type Pattern,type Role,type SliceRef} from '../core/model.js';
import {defaultEffects,type Effects} from './effects.js';
import {resolvePatternSlices} from '../core/slice-instrument.js';

export type DrumKit=Partial<Record<Role,SliceRef>>;
export type SampleShape={decay?:number;playbackRate?:number;speedMode?:'repitch'|'stretch';lowpassHz?:number;attackMs?:number;sourceBpm?:number;followBpm?:boolean};
export type KitLayer={choice:string;slice:SliceRef;level:number;offsetMs:number;phaseInvert:boolean};
export type VelocityBand='soft'|'medium'|'accent';
export type VelocityLayer={choice:string;slice:SliceRef;level:number};
export type VelocityLayers=Record<VelocityBand,VelocityLayer>;
export type KitSlot={choice:string;uploadId?:string;assetId?:string;include:boolean;mute:boolean;solo?:boolean;level:number;tune:number;reverse?:boolean;layer?:KitLayer;velocityLayers?:VelocityLayers;effects?:Effects;sampleProfiles?:Record<string,SampleShape>} & SampleShape;
export type KitState=Record<Role,KitSlot>;
const VELOCITY_BLEND_RADIUS=.04;
export function velocityLayerMix(velocity:number):{band:VelocityBand;weight:number}[]{
  const blend=(lower:VelocityBand,upper:VelocityBand,threshold:number)=>{
    const upperWeight=Math.max(0,Math.min(1,(velocity-threshold+VELOCITY_BLEND_RADIUS)/(2*VELOCITY_BLEND_RADIUS)));
    return [{band:lower,weight:1-upperWeight},{band:upper,weight:upperWeight}].filter(part=>part.weight>0);
  };
  if(velocity<=.45-VELOCITY_BLEND_RADIUS)return [{band:'soft',weight:1}];
  if(velocity<.45+VELOCITY_BLEND_RADIUS)return blend('soft','medium',.45);
  if(velocity<=.80-VELOCITY_BLEND_RADIUS)return [{band:'medium',weight:1}];
  if(velocity<.80+VELOCITY_BLEND_RADIUS)return blend('medium','accent',.80);
  return [{band:'accent',weight:1}];
}
const SHAPE_KEYS=['decay','playbackRate','speedMode','lowpassHz','attackMs','sourceBpm'] as const;
const sampleKey=(slot:KitSlot)=>slot.assetId??'synth';
export function rememberShape(slot:KitSlot){const shape:SampleShape={};for(const key of SHAPE_KEYS)if(slot[key]!==undefined)(shape as Record<string,unknown>)[key]=slot[key];if(slot.followBpm!==undefined)shape.followBpm=slot.followBpm;(slot.sampleProfiles??={})[sampleKey(slot)]=shape;}
export function recallShape(slot:KitSlot){const shape=slot.sampleProfiles?.[sampleKey(slot)];for(const key of SHAPE_KEYS){if(shape?.[key]!==undefined)(slot as Record<string,unknown>)[key]=shape[key];else delete slot[key];}if(shape?.followBpm!==undefined)slot.followBpm=shape.followBpm;else delete slot.followBpm;}
export function effectiveSampleSpeed(shape:SampleShape,bpm:number):{rate:number;following:boolean;warning?:string}{
  const manual=shape.playbackRate??1;
  if(!shape.followBpm)return {rate:manual,following:false};
  if(!shape.sourceBpm||!Number.isFinite(shape.sourceBpm))return {rate:manual,following:false,warning:'Enter the original break BPM to follow tempo.'};
  const ratio=bpm/shape.sourceBpm;
  if(!Number.isFinite(ratio)||ratio<.5||ratio>2)return {rate:manual,following:false,warning:'BPM follow needs 0.5×–2× speed. Manual speed is playing.'};
  return {rate:ratio,following:true};
}
export function defaultKitState():KitState{return Object.fromEntries(ROLES.map(r=>[r,{choice:'synth',include:true,mute:false,solo:false,level:1,tune:0,reverse:false,effects:defaultEffects()}])) as KitState;}
export function withDrumKit(pattern:Pattern,kit:DrumKit,mix?:KitState):Pattern{
  pattern=resolvePatternSlices(pattern);
  const userTracks=new Map((pattern.userTracks??[]).map(track=>[track.id,track]));
  const hasSolo=mix&&(Object.values(mix).some(s=>s.solo)||(pattern.userTracks??[]).some(track=>track.solo));
  return {...pattern,events:pattern.events.filter(h=>{
    if(!mix)return true;
    const track=h.trackId?userTracks.get(h.trackId):undefined;
    if(track)return hasSolo?track.solo&&!track.mute:!track.mute;
    if(hasSolo)return !!mix[h.role].solo&&!mix[h.role].mute;
    return !mix[h.role].mute;
  }).flatMap(hit=>{
    const userTrack=hit.trackId?userTracks.get(hit.trackId):undefined;
    if(isSynthTrack(userTrack))return [{...hit,renderGain:hit.gain*userTrack.level,pan:Math.max(-1,Math.min(1,hit.pan+userTrack.pan))}];
    const result=hit.slice?{...hit}:userTrack&&!isSynthTrack(userTrack)?{...hit,slice:{...userTrack.sample}}:!kit[hit.role]?{...hit}:{...hit,slice:{...kit[hit.role]!}};
    if(['groove-v3','groove-v4','groove-v5','groove-v5.1'].includes(pattern.settings.algorithm??''))result.sourceKind=hit.sourceKind??(hit.slice?'slice':'oneShot');
    if(mix){
      result.reverse=!!hit.reverse||!!mix[hit.role].reverse;
      if(['groove-v3','groove-v4','groove-v5','groove-v5.1'].includes(pattern.settings.algorithm??'')&&mix[hit.role].reverse&&hit.articulation?.repeats){
        result.articulation={...hit.articulation,repeats:hit.articulation.repeats.map(r=>({...r,reverse:true}))};
      }
      result.gain*=mix[hit.role].level;
      if(userTrack){result.gain*=userTrack.level;result.pan=Math.max(-1,Math.min(1,result.pan+userTrack.pan));}
      result.pitch=Math.max(-48,Math.min(48,(hit.pitch??0)+mix[hit.role].tune));
      const slot=mix[hit.role];
      const soundShape:SampleShape=hit.slice&&hit.slice.assetId!==sampleKey(slot)?slot.sampleProfiles?.[hit.slice.assetId]??{}:slot;
      if(hit.playbackRate!==undefined||hit.speedMode!==undefined||soundShape.playbackRate!==undefined||soundShape.followBpm){
        const speed=hit.playbackRate??effectiveSampleSpeed(soundShape,pattern.settings.bpm).rate;
        if((hit.speedMode??soundShape.speedMode)==='stretch'){
          // The later pitch resampling changes duration too. Compensate its
          // ratio in the stretch stage so the requested hit speed stays musical.
          const compensated=speed/2**((result.pitch??0)/12);
          result.stretchRate=Math.max(.5,Math.min(2,compensated));
          result.playbackRate=1;
        }else result.playbackRate=speed;
      }
      if(hit.lowpassHz!==undefined||soundShape.lowpassHz!==undefined)result.lowpassHz=hit.lowpassHz??soundShape.lowpassHz;
      if(hit.attackMs!==undefined||soundShape.attackMs!==undefined)result.attackMs=hit.attackMs??soundShape.attackMs;
      const slotDecay=soundShape.decay;
      if(slotDecay!==undefined&&slotDecay<1&&hit.decay===undefined){
        result.decay=slotDecay;
      }
    }
    const velocityLayers=mix?.[hit.role].velocityLayers;
    // A manually chosen slice or trim is tied to its source recording and must
    // never be swapped for a preset sample with different boundaries.
    const velocityVoices=velocityLayers&&!userTrack&&!hit.slice&&!hit.mapped&&!hit.sampleTrim
      ?velocityLayerMix(hit.gain).map(({band,weight},index)=>({
        ...result,id:index===0?hit.id:`velocity-${band}-${hit.id}`,layerOf:index===0?hit.layerOf:hit.id,
        slice:{...velocityLayers[band].slice},gain:result.gain*weight,
        renderGain:(result.renderGain??result.gain)*weight*velocityLayers[band].level,
      })):[result];
    const layer=mix?.[hit.role].layer;
    if(userTrack||!layer||layer.level===0||hit.mapped)return velocityVoices;
    let hash=2166136261;
    for(let i=0;i<hit.id.length;i++)hash=Math.imul(hash^hit.id.charCodeAt(i),16777619);
    const layerId=`layer-${hit.id.slice(0,58)}-${(hash>>>0).toString(16)}`;
    const tickShift=Math.round(layer.offsetMs/1000*pattern.settings.bpm/60*960);
    const secondary={...result,id:layerId,layerOf:hit.id,slice:{...layer.slice},sampleTrim:undefined,sourceKind:'oneShot' as const,
      gain:Math.min(1,result.gain*layer.level),phaseInvert:layer.phaseInvert,
      offsetTick:Math.max(-960,Math.min(960,result.offsetTick+tickShift)),reason:'Layer: '+layer.slice.label};
    return [...velocityVoices,secondary];
  })};
}
