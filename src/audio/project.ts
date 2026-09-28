import {validateBank,type Bank} from '../core/bank.js';
import {validateEffects} from './effects.js';
import {LIBRARY} from './library.js';
import {resolveSlice} from '../core/slice-instrument.js';
import {compile} from '../core/compile.js';
import {ROLES,type Settings} from '../core/model.js';
import type {EditorState} from '../core/editor.js';
import {validateSettings} from '../core/generate.js';
import type {AudioAsset} from './slices.js';
import type {KitState} from './drum-kit.js';
import {DEFAULT_VINYL_TEXTURE,isVinylTexture,validateVinylTexture,type VinylTexture} from './vinyl-texture.js';
export interface Project {format:'breakbeat-project';version:2|3|4;bank?:Bank;editor:EditorState;draft:Settings;kit:KitState;vinylTexture?:VinylTexture;assets:{id:string;name:string;sampleRate:number;channels:string[]}[]}
function base64(data:Float32Array){let s='';const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
const legacyId=(id:string)=>id==='synth-scratch'||isVinylTexture(id)||id.startsWith('library-')&&isVinylTexture(id.slice(8));
const projectPatterns=(p:Project)=>[p.editor.pattern,...(p.bank?.slots.flatMap(s=>[...(s.editor?[s.editor.pattern]:[]),...(s.patternHistory?.map(h=>h.editor.pattern)??[])])??[])];
export function needsVinylMigration(raw:unknown){
  if(!raw||typeof raw!=='object')return false;
  const p=raw as Project;
  return !!(p.kit&&Object.values(p.kit).some(s=>s&&[s.choice,s.assetId,s.uploadId].some(id=>typeof id==='string'&&legacyId(id)))||p.editor&&projectPatterns(p).some(pattern=>pattern?.events?.some(hit=>hit.slice&&legacyId(hit.slice.assetId))));
}
export function makeProject(editor:EditorState,draft:Settings,kit:KitState,assets:Map<string,AudioAsset>,bank?:Bank,vinylTexture:VinylTexture=DEFAULT_VINYL_TEXTURE):Project{
  const patterns=[editor.pattern,...(bank?.slots.flatMap(s=>[...(s.editor?[s.editor.pattern]:[]),...(s.patternHistory?.map(h=>h.editor.pattern)??[])])??[])];
  const ids=new Set(patterns.flatMap(p=>[...(p.sliceInstruments??[]).map(i=>i.assetId),...p.events.flatMap(h=>h.slice?[h.slice.assetId]:[])]));for(const r of ROLES){if(kit[r].assetId)ids.add(kit[r].assetId!);if(kit[r].uploadId)ids.add(kit[r].uploadId!);}
  const v3=['groove-v3','groove-v4'].includes(draft.algorithm??'')||patterns.some(p=>['groove-v3','groove-v4'].includes(p.settings.algorithm??'')||p.events.some(h=>h.articulation||h.effect));
  if([...ids].some(legacyId)||Object.values(kit).some(s=>legacyId(s.choice)))throw Error('Old vinyl instrument must be migrated before saving.');
  return {format:'breakbeat-project',version:patterns.some(p=>p.sliceInstruments?.length)?4:v3?3:2,...(bank?{bank:structuredClone(bank)}:{}),editor:structuredClone(editor),draft:structuredClone(draft),kit:structuredClone(kit),vinylTexture:validateVinylTexture(vinylTexture),assets:[...ids].map(id=>{const a=assets.get(id);if(!a)throw Error('Missing project audio.');return {id,name:a.name,sampleRate:a.sampleRate,channels:a.channels.map(base64)};})};
}
export function readProject(raw:unknown,replacement?:AudioAsset){
  // Migrate a copy: opening an old file must not mutate the caller's data.
  const legacy=structuredClone(raw) as Omit<Project,'version'> & {version:number};
  if(legacy?.format==='breakbeat-project' && legacy.version===1 && legacy.editor?.pattern){
    if(legacy.bank)legacy.bank.songBpm=legacy.editor.pattern.settings.bpm;
    legacy.version=2;
  }
  const p=legacy as Project;
  if(!p||p.format!=='breakbeat-project'||![2,3,4].includes(p.version)||!p.editor||!p.kit||!Array.isArray(p.assets)||p.assets.length>256)throw Error('Not a supported project.');
  let migrated=false;
  if(needsVinylMigration(p)){
    if(!replacement||replacement.id!=='library-lofi2-perc-02')throw Error('Load the replacement percussion sample before opening this older project.');
    migrated=true;
    const selected=Object.values(p.kit).map(s=>s.choice).find(id=>typeof id==='string'&&isVinylTexture(id)) as string|undefined
      ??projectPatterns(p).flatMap(pattern=>pattern.events).map(hit=>hit.slice?.assetId??'').map(id=>id.startsWith('library-')?id.slice(8):id).find(isVinylTexture);
    p.vinylTexture=selected?{enabled:true,catalogId:selected,levelDb:-10}:p.vinylTexture??{...DEFAULT_VINYL_TEXTURE};
    for(const slot of Object.values(p.kit))if(legacyId(slot.choice)||slot.assetId&&legacyId(slot.assetId)){
      slot.choice='lofi2-perc-02';slot.assetId=replacement.id;
      if(slot.uploadId&&legacyId(slot.uploadId))delete slot.uploadId;
      if(slot.sampleProfiles)for(const key of Object.keys(slot.sampleProfiles))if(legacyId(key))delete slot.sampleProfiles[key];
    }
    for(const pattern of projectPatterns(p))for(const hit of pattern.events)if(hit.slice&&legacyId(hit.slice.assetId)){
      hit.slice={assetId:replacement.id,startFrame:0,endFrame:replacement.channels[0]!.length,sampleRate:replacement.sampleRate,label:replacement.name};
      if(legacyId(hit.sourceId))hit.sourceId='kit.percussion';
    }
    if(!p.assets.some(a=>a.id===replacement.id))p.assets.push({id:replacement.id,name:replacement.name,sampleRate:replacement.sampleRate,channels:replacement.channels.map(base64)});
  }
  p.assets=p.assets.filter(a=>!legacyId(a.id));
  p.vinylTexture=validateVinylTexture(p.vinylTexture??DEFAULT_VINYL_TEXTURE);
  compile(p.editor.pattern);validateSettings(p.draft);if(p.bank){validateBank(p.bank);if(JSON.stringify(p.bank.slots[p.bank.active]!.editor)!==JSON.stringify(p.editor))throw Error('Active slot mismatch.');}
  if(!Array.isArray(p.editor.lockedRoles)||p.editor.lockedRoles.some(r=>!ROLES.includes(r))||!Array.isArray(p.editor.lockedIds)||p.editor.lockedIds.some(id=>typeof id!=='string')||!Number.isInteger(p.editor.revision)||p.editor.revision<0)throw Error('Invalid project editor state.');
  const selection=p.editor.selection;
  if(!selection||!Array.isArray(selection.ids)||selection.ids.some(id=>typeof id!=='string')||(selection.rows!==null&&(!Array.isArray(selection.rows)||selection.rows.length!==2||selection.rows.some(r=>!Number.isInteger(r)||r<0)||selection.rows[1]!>=p.editor.pattern.settings.bars*p.editor.pattern.settings.resolution)))throw Error('Invalid project selection.');
  const assets=new Map<string,AudioAsset>();let total=0;
  for(const a of p.assets){
    if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(a.id)||assets.has(a.id)||typeof a.name!=='string'||a.name.length>1000||!Number.isInteger(a.sampleRate)||a.sampleRate<8000||a.sampleRate>192000||!Array.isArray(a.channels)||a.channels.length<1||a.channels.length>2)throw Error('Invalid project audio metadata.');
    const channels=a.channels.map(encoded=>{
      if(typeof encoded!=='string'||encoded.length>128*1024*1024)throw Error('Audio asset too large.');
      total+=encoded.length*.75;if(total>256*1024*1024)throw Error('Project audio exceeds 256 MB.');
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(!bytes.length||bytes.length%4)throw Error('Invalid PCM data.');
      const values=new Float32Array(bytes.buffer);if(values.length>a.sampleRate*120||values.some(v=>!Number.isFinite(v)||Math.abs(v)>8))throw Error('Invalid PCM samples.');return values;
    });
    if(channels.some(c=>c.length!==channels[0]!.length))throw Error('Channel lengths differ.');assets.set(a.id,{id:a.id,name:a.name,sampleRate:a.sampleRate,channels});
  }
  for(const role of ROLES){const s=p.kit[role];if(!s||typeof s.choice!=='string'||typeof s.include!=='boolean'||typeof s.mute!=='boolean'||!Number.isFinite(s.level)||s.level<0||s.level>1||!Number.isInteger(s.tune)||s.tune< -24||s.tune>24)throw Error('Invalid instrument settings.');if(s.solo!==undefined&&typeof s.solo!=='boolean')throw Error('Invalid instrument settings.');if(s.reverse!==undefined&&typeof s.reverse!=='boolean')throw Error('Invalid instrument reverse.');if(s.decay!==undefined&&(!Number.isFinite(s.decay)||s.decay<.02||s.decay>1))throw Error('Invalid instrument decay.');if(s.playbackRate!==undefined&&(!Number.isFinite(s.playbackRate)||s.playbackRate<.5||s.playbackRate>2))throw Error('Invalid instrument speed.');if(s.lowpassHz!==undefined&&(!Number.isFinite(s.lowpassHz)||s.lowpassHz<200||s.lowpassHz>20000))throw Error('Invalid instrument low-pass.');if(s.attackMs!==undefined&&(!Number.isFinite(s.attackMs)||s.attackMs<0||s.attackMs>50))throw Error('Invalid instrument attack.');if(s.sourceBpm!==undefined&&(!Number.isFinite(s.sourceBpm)||s.sourceBpm<40||s.sourceBpm>300))throw Error('Invalid source BPM.');if(s.followBpm!==undefined&&typeof s.followBpm!=='boolean'||s.followBpm&&!s.sourceBpm)throw Error('Invalid instrument BPM follow.');if(s.effects!==undefined)validateEffects(s.effects);if(!['synth','upload',...LIBRARY.filter(e=>e.role===role&&!isVinylTexture(e.id)).map(e=>e.id)].includes(s.choice))throw Error('Unknown instrument choice.');if(s.choice!=='synth'&&!s.assetId)throw Error('Instrument has no audio.');if(s.choice==='upload'&&s.assetId!==s.uploadId)throw Error('Upload mapping mismatch.');for(const id of [s.assetId,s.uploadId])if(id!==undefined){const a=assets.get(id);if(!a)throw Error('Missing instrument audio.');if(a.channels[0]!.length/a.sampleRate>20)throw Error('Single-hit audio exceeds twenty seconds.');}}
  for(const role of ROLES){
    const profiles=p.kit[role].sampleProfiles;
    if(profiles===undefined)continue;
    if(!profiles||typeof profiles!=='object'||Array.isArray(profiles)||Object.keys(profiles).length>512)throw Error('Invalid sample profiles.');
    for(const [key,shape] of Object.entries(profiles)){
      if(!/^[a-zA-Z0-9._-]{1,80}$/.test(key)||!shape||typeof shape!=='object'||Array.isArray(shape))throw Error('Invalid sample profile.');
      if(shape.playbackRate!==undefined&&(!Number.isFinite(shape.playbackRate)||shape.playbackRate<.5||shape.playbackRate>2))throw Error('Invalid sample speed.');
      if(shape.lowpassHz!==undefined&&(!Number.isFinite(shape.lowpassHz)||shape.lowpassHz<200||shape.lowpassHz>20000))throw Error('Invalid sample low-pass.');
      if(shape.attackMs!==undefined&&(!Number.isFinite(shape.attackMs)||shape.attackMs<0||shape.attackMs>50))throw Error('Invalid sample attack.');
      if(shape.decay!==undefined&&(!Number.isFinite(shape.decay)||shape.decay<.02||shape.decay>1))throw Error('Invalid sample decay.');
      if(shape.sourceBpm!==undefined&&(!Number.isFinite(shape.sourceBpm)||shape.sourceBpm<40||shape.sourceBpm>300))throw Error('Invalid sample BPM.');
      if(shape.followBpm!==undefined&&typeof shape.followBpm!=='boolean'||shape.followBpm&&!shape.sourceBpm)throw Error('Invalid sample BPM follow.');
    }
  }
  for(const pattern of projectPatterns(p)){
    for(const instrument of pattern.sliceInstruments??[]){const a=assets.get(instrument.assetId);if(!a||a.sampleRate!==instrument.sampleRate||instrument.endFrame>a.channels[0]!.length)throw Error('Missing instrument audio.');}
    for(const hit of pattern.events){const slice=resolveSlice(pattern,hit);if(slice){const a=assets.get(slice.assetId);if(!a||a.sampleRate!==slice.sampleRate||slice.endFrame>a.channels[0]!.length)throw Error('Missing slice audio.');}}
  }
  return {project:p,assets,migrated};
}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('breakbeat-workspace',1);request.onupgradeneeded=()=>request.result.createObjectStore('projects');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function localProject(value?:Project){const db=await database();try{return await new Promise<Project|undefined>((resolve,reject)=>{const tx=db.transaction('projects',value?'readwrite':'readonly'),store=tx.objectStore('projects');let result:Project|undefined;const request=value?store.put(value,'latest'):store.get('latest');request.onsuccess=()=>{if(!value)result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
