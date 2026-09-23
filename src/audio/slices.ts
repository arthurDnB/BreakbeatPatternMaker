import {PPQ,type Pattern,type Settings,type SliceRef} from '../core/model.js';
export interface AudioAsset {id:string;name:string;sampleRate:number;channels:Float32Array[]}
export function sliceReference(asset:AudioAsset,markers:number[],index:number):SliceRef {
  const startFrame=markers[index],endFrame=markers[index+1];
  if(startFrame===undefined||endFrame===undefined||endFrame<=startFrame||endFrame>asset.channels[0]!.length)throw Error('Select a valid slice.');
  return {assetId:asset.id,startFrame,endFrame,sampleRate:asset.sampleRate,label:`${asset.name} / Slice ${index+1}`};
}
export function reconstruct(asset:AudioAsset,markers:number[],settings:Settings):Pattern {
  const duration=asset.channels[0]!.length/asset.sampleRate,bpm=settings.bars*4*60/duration;
  if(bpm<32||bpm>999)throw Error('Choose a bar count giving 32–999 BPM for this sample. Use a shorter break if needed.');
  return {engineVersion:'0.2.0',ppq:PPQ,settings:{...settings,bpm,swing:.5,humanizeMs:0},events:markers.slice(0,-1).map((frame,i)=>{
    const tick=frame/asset.sampleRate*bpm/60*PPQ;
    return {id:`original-${i}`,role:'percussion',sourceId:'kit.percussion',baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,slice:sliceReference(asset,markers,i),pitch:0,reason:'This slice starts at its measured position in the original recording. No grid quantization was applied.'};
  })};
}
