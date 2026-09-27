import {LIBRARY} from './library.js';
import {prepareLibraryHit} from './sample-prep.js';
import type {AudioAsset} from './slices.js';
import type {Role} from '../core/model.js';
import {isVinylTexture} from './vinyl-texture.js';

export async function ensureLibraryAudio(id:string,role:Role,assets:Map<string,AudioAsset>,context:AudioContext):Promise<AudioAsset>{
  const entry=LIBRARY.find(item=>item.id===id&&item.role===role&&!isVinylTexture(item.id));
  if(!entry)throw Error('Choose a valid sound for this instrument.');
  const assetId='library-'+entry.id;
  const existing=assets.get(assetId);if(existing)return existing;
  let response:Response;
  try{response=await fetch(new URL('./'+entry.path.replace(/^\//,''),document.baseURI));}
  catch{throw Error('Could not load '+entry.name+'. Check your connection and try again.');}
  if(!response.ok)throw Error('Could not load '+entry.name+'. Check your connection and try again.');
  const decoded=await context.decodeAudioData(await response.arrayBuffer());
  if(decoded.duration>20)throw Error('Single hits must be 20 seconds or shorter.');
  const source=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
  const channels=prepareLibraryHit(source,decoded.sampleRate,role);
  const used=[...assets.values()].reduce((total,a)=>total+a.channels.reduce((n,c)=>n+c.byteLength,0),0);
  if(used+channels.reduce((n,c)=>n+c.byteLength,0)>256*1024*1024)throw Error('Session audio limit reached. Save the project before refreshing.');
  const asset:AudioAsset={id:assetId,name:entry.name,sampleRate:decoded.sampleRate,channels};
  // Another request may have completed while this file decoded.
  const ready=assets.get(assetId);if(ready)return ready;
  assets.set(assetId,asset);return asset;
}
