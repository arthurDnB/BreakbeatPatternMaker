import {patternTicks} from '../core/meter.js';
import {PPQ,type Pattern,type Settings,type SliceRef} from '../core/model.js';
export interface AudioAsset {id:string;name:string;sampleRate:number;channels:Float32Array[]}
export function sliceReference(asset:AudioAsset,markers:number[],index:number):SliceRef {
  const startFrame=markers[index],endFrame=markers[index+1];
  if(startFrame===undefined||endFrame===undefined||endFrame<=startFrame||endFrame>asset.channels[0]!.length)throw Error('Select a valid slice.');
  return {assetId:asset.id,startFrame,endFrame,sampleRate:asset.sampleRate,label:`${asset.name} / Slice ${index+1}`};
}
export function reconstruct(asset:AudioAsset,markers:number[],settings:Settings):Pattern {
  const duration=asset.channels[0]!.length/asset.sampleRate,bpm=patternTicks(settings)/960*60/duration;
  if(bpm<32||bpm>999)throw Error('Choose a bar count giving 32–999 BPM for this sample. Use a shorter break if needed.');
  return {engineVersion:'0.2.0',ppq:PPQ,settings:{...settings,bpm,swing:.5,humanizeMs:0},events:markers.slice(0,-1).map((frame,i)=>{
    const tick=frame/asset.sampleRate*bpm/60*PPQ;
    return {id:`original-${i}`,role:'percussion',sourceId:'kit.percussion',baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,slice:sliceReference(asset,markers,i),pitch:0,reason:'This slice starts at its measured position in the original recording. No grid quantization was applied.'};
  })};
}
export function transcribeBreak(asset:AudioAsset,markers:number[],settings:Settings,loopFadeMs=0):Pattern {
  if(markers.length<2||markers.length>121||markers.some((frame,i)=>!Number.isInteger(frame)||frame<0||frame>asset.channels[0]!.length||i>0&&frame<=markers[i-1]!))throw Error('Choose 1–120 valid slices before creating an instrument.');
  const start=markers[0]!,end=markers.at(-1)!,bpm=patternTicks(settings)/960*60/((end-start)/asset.sampleRate);
  if(bpm<32||bpm>999)throw Error('Select the correct region and 1–4 bar count (32–999 BPM).');
  const instrument={id:'break-'+asset.id,name:asset.name.slice(0,100),assetId:asset.id,sampleRate:asset.sampleRate,startFrame:start,endFrame:end,loopFadeMs,
    slices:markers.slice(0,-1).map((frame,i)=>({id:'slice-'+i,note:i,startFrame:frame,endFrame:markers[i+1]!}))};
  return {engineVersion:'0.3.0',ppq:PPQ,sliceInstruments:[instrument],settings:{...settings,bpm,swing:.5,humanizeMs:0,resolution:64},events:instrument.slices.map((slice,i)=>{
    const tick=(slice.startFrame-start)/asset.sampleRate*bpm/60*PPQ;
    return {id:'break-hit-'+i,role:'percussion',sourceId:'kit.percussion',sourceKind:'slice',baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,pitch:0,mapped:{instrumentId:instrument.id,note:slice.note},reason:'Original recorded slice timing. The note selects a slice; pitch is independent.'};
  })};
}
