import {isSynthTrack,type Pattern} from '../core/model.js';
import type {AudioAsset} from './slices.js';

const ROOTS:readonly {note:number;name:string;layers:readonly ('H'|'L')[]}[]=[
  {note:42,name:'F#2',layers:['H','L']},{note:47,name:'B2',layers:['H']},
  {note:51,name:'D#3',layers:['H','L']},{note:54,name:'F#3',layers:['H','L']},
  {note:57,name:'A3',layers:['H','L']},{note:60,name:'C4',layers:['L']},
  {note:63,name:'D#4',layers:['H','L']},{note:66,name:'F#4',layers:['H','L']},
  {note:69,name:'A4',layers:['H','L']},{note:72,name:'C5',layers:['H','L']},
  {note:75,name:'D#5',layers:['H','L']},{note:78,name:'F#5',layers:['H','L']},
  {note:81,name:'A5',layers:['H','L']},{note:84,name:'C6',layers:['H','L']}
];

export function pianoBankSample(note:number,velocity:number){
  const root=[...ROOTS].sort((a,b)=>Math.abs(a.note-note)-Math.abs(b.note-note)||a.note-b.note)[0]!;
  const preferred=velocity<.57?'L':'H',layer=root.layers.includes(preferred)?preferred:root.layers[0]!;
  return {assetId:`piano-kw-${root.note}-${layer}`,rootNote:root.note,file:`${root.name}v${layer}.flac`};
}

/** Load just the notes needed by the active phrase; source FLACs stay outside saved project JSON. */
export async function ensurePianoBankAudio(patterns:readonly Pattern[],assets:Map<string,AudioAsset>,context:AudioContext):Promise<void>{
  const needed=new Map<string,ReturnType<typeof pianoBankSample>>();
  for(const pattern of patterns)for(const track of pattern.userTracks??[]){
    if(!isSynthTrack(track)||track.instrument.sample||track.instrument.sampleBank!=='upright-kw')continue;
    for(const hit of pattern.events)if(hit.trackId===track.id&&hit.synthNote){const chosen=pianoBankSample(hit.synthNote.note,hit.gain);needed.set(chosen.assetId,chosen);}
  }
  await Promise.all([...needed.values()].filter(entry=>!assets.has(entry.assetId)).map(async entry=>{
    const response=await fetch(new URL(`./public/piano/${encodeURIComponent(entry.file)}`,document.baseURI));
    if(!response.ok)throw Error('Could not load upright piano recording '+entry.file+'.');
    const decoded=await context.decodeAudioData(await response.arrayBuffer());
    const channels=Array.from({length:Math.min(2,decoded.numberOfChannels)},(_,index)=>{const data=new Float32Array(decoded.length);decoded.copyFromChannel(data,index);return data;});
    assets.set(entry.assetId,{id:entry.assetId,name:`Upright Piano KW ${entry.file}`,sampleRate:decoded.sampleRate,channels});
  }));
}
