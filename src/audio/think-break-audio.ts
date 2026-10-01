import type {AudioAsset} from './slices.js';
import {validateWav} from './wav.js';
import {THINK_BREAK_ASSET_ID,THINK_BREAK_FRAMES,THINK_BREAK_RATE} from '../core/think-break.js';

/** Decode at the file's native rate so curated frame markers stay exact. */
export async function ensureThinkBreakAudio(assets:Map<string,AudioAsset>):Promise<AudioAsset>{
  const cached=assets.get(THINK_BREAK_ASSET_ID);
  if(cached){if(cached.sampleRate!==THINK_BREAK_RATE||cached.channels[0]?.length!==THINK_BREAK_FRAMES)throw Error('Saved Think break audio does not match its slice map.');return cached;}
  let response:Response;
  try{response=await fetch(new URL('./public/samples/think-passage2-142x.wav',document.baseURI));}
  catch{throw Error('Could not load the Think break. Check your connection and try again.');}
  if(!response.ok)throw Error('Could not load the Think break. Check your connection and try again.');
  const bytes=await response.arrayBuffer(),info=validateWav(bytes);
  if(info.sampleRate!==THINK_BREAK_RATE||info.channels!==1)throw Error('The Think break no longer matches its slice map.');
  const offline=new OfflineAudioContext(1,1,THINK_BREAK_RATE),decoded=await offline.decodeAudioData(bytes);
  if(decoded.length!==THINK_BREAK_FRAMES)throw Error('The Think break length changed; its slice map needs updating.');
  const asset:AudioAsset={id:THINK_BREAK_ASSET_ID,name:'Think Passage 2 · 1.42x',sampleRate:THINK_BREAK_RATE,channels:[decoded.getChannelData(0)]};
  assets.set(asset.id,asset);return asset;
}
