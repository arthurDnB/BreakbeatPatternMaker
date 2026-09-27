import {LIBRARY} from './library.js';
import type {AudioAsset} from './slices.js';

export const VINYL_TEXTURES=LIBRARY.filter(item=>/^lofi2-vinyl-0[1-9]$/.test(item.id));
export const DEFAULT_VINYL_TEXTURE={enabled:false,catalogId:'lofi2-vinyl-01',levelDb:-30};
export type VinylTexture=typeof DEFAULT_VINYL_TEXTURE;
export function isVinylTexture(id:string){return VINYL_TEXTURES.some(item=>item.id===id);}
export function validateVinylTexture(value:unknown):VinylTexture{
  if(!value||typeof value!=='object')throw Error('Invalid vinyl texture settings.');
  const v=value as VinylTexture;
  if(typeof v.enabled!=='boolean'||!isVinylTexture(v.catalogId)||!Number.isFinite(v.levelDb)||v.levelDb< -60||v.levelDb>0)throw Error('Invalid vinyl texture settings.');
  return {enabled:v.enabled,catalogId:v.catalogId,levelDb:v.levelDb};
}
export async function loadVinylTexture(id:string,context:AudioContext):Promise<AudioAsset>{
  const entry=VINYL_TEXTURES.find(item=>item.id===id);if(!entry)throw Error('Unknown vinyl texture.');
  let response:Response;
  try{response=await fetch(new URL('./'+entry.path.replace(/^\//,''),document.baseURI));}
  catch{throw Error('Could not load '+entry.name+'. Check your connection and try again.');}
  if(!response.ok)throw Error('Could not load '+entry.name+'. Check your connection and try again.');
  const decoded=await context.decodeAudioData(await response.arrayBuffer());
  return {id:entry.id,name:entry.name,sampleRate:decoded.sampleRate,channels:Array.from({length:Math.min(2,decoded.numberOfChannels)},(_,channel)=>new Float32Array(decoded.getChannelData(channel)))};
}

// Equal-power overlap at each recording repeat. Pattern-loop endpoints receive an
// additional crossfade so an exact-bars WAV joins without a texture discontinuity.
export function mixVinylTexture(output:Float32Array[],rate:number,asset:AudioAsset,levelDb:number,exactLoop=false){
  const source=asset.channels,frames=source[0]?.length??0;if(!frames)return;
  const gain=10**(levelDb/20),repeatFade=Math.min(Math.round(asset.sampleRate*.12),Math.floor(frames/4));
  const read=(channel:number,frame:number)=>{
    const data=source[Math.min(channel,source.length-1)]!;
    const period=frames-repeatFade;
    const at=repeatFade+(frame%period),next=Math.min(frames-1,Math.floor(at)+1),index=Math.floor(at),fraction=at-index;
    const current=data[index]!*(1-fraction)+data[next]! * fraction;
    if(repeatFade<2||at<frames-repeatFade)return current;
    const t=(at-(frames-repeatFade))/repeatFade;
    const head=at-(frames-repeatFade),h0=Math.floor(head),hf=head-h0;
    const wrapped=data[h0]!*(1-hf)+data[Math.min(frames-1,h0+1)]!*hf;
    return current*Math.cos(t*Math.PI/2)+wrapped*Math.sin(t*Math.PI/2);
  };
  const length=output[0]?.length??0,edge=exactLoop?Math.min(Math.round(rate*.08),Math.floor(length/4)):0;
  for(let c=0;c<output.length;c++){
    const out=output[c]!;
    for(let i=0;i<length;i++){
      const pos=i*asset.sampleRate/rate;
      let value=read(c,pos);
      if(edge>1&&i>=length-edge){const t=(i-(length-edge))/edge;value=value*Math.cos(t*Math.PI/2)+read(c,(length-1-i)*asset.sampleRate/rate)*Math.sin(t*Math.PI/2);}
      if(!exactLoop&&i>=length-Math.round(rate*.08))value*=Math.max(0,(length-i)/Math.max(1,Math.round(rate*.08)));
      out[i]=(out[i]??0)+value*gain;
    }
  }
}
