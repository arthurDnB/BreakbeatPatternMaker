import {validateBank,type Bank} from '../core/bank.js';
import {validateEffects} from './effects.js';
import {LIBRARY} from './library.js';
import {compile} from '../core/compile.js';
import {ROLES,type Settings} from '../core/model.js';
import type {EditorState} from '../core/editor.js';
import {validateSettings} from '../core/generate.js';
import type {AudioAsset} from './slices.js';
import type {KitState} from './drum-kit.js';
export interface Project {format:'breakbeat-project';version:2|3;bank?:Bank;editor:EditorState;draft:Settings;kit:KitState;assets:{id:string;name:string;sampleRate:number;channels:string[]}[]}
function base64(data:Float32Array){let s='';const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function makeProject(editor:EditorState,draft:Settings,kit:KitState,assets:Map<string,AudioAsset>,bank?:Bank):Project{
  const patterns=[editor.pattern,...(bank?.slots.flatMap(s=>s.editor?[s.editor.pattern]:[])??[])];
  const ids=new Set(patterns.flatMap(p=>p.events).flatMap(h=>h.slice?[h.slice.assetId]:[]));for(const r of ROLES){if(kit[r].assetId)ids.add(kit[r].assetId!);if(kit[r].uploadId)ids.add(kit[r].uploadId!);}
  const v3=draft.algorithm==='groove-v3'||patterns.some(p=>p.settings.algorithm==='groove-v3'||p.events.some(h=>h.articulation));
  return {format:'breakbeat-project',version:v3?3:2,...(bank?{bank:structuredClone(bank)}:{}),editor:structuredClone(editor),draft:structuredClone(draft),kit:structuredClone(kit),assets:[...ids].map(id=>{const a=assets.get(id);if(!a)throw Error('Missing project audio.');return {id,name:a.name,sampleRate:a.sampleRate,channels:a.channels.map(base64)};})};
}
export function readProject(raw:unknown){
  // Migrate a copy: opening an old file must not mutate the caller's data.
  const legacy=structuredClone(raw) as Omit<Project,'version'> & {version:number};
  if(legacy?.format==='breakbeat-project' && legacy.version===1 && legacy.editor?.pattern){
    if(legacy.bank)legacy.bank.songBpm=legacy.editor.pattern.settings.bpm;
    legacy.version=2;
  }
  const p=legacy as Project;
  if(!p||p.format!=='breakbeat-project'||![2,3].includes(p.version)||!p.editor||!p.kit||!Array.isArray(p.assets)||p.assets.length>256)throw Error('Not a supported project.');
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
  for(const role of ROLES){const s=p.kit[role];if(!s||typeof s.choice!=='string'||typeof s.include!=='boolean'||typeof s.mute!=='boolean'||!Number.isFinite(s.level)||s.level<0||s.level>1||!Number.isInteger(s.tune)||s.tune< -24||s.tune>24)throw Error('Invalid instrument settings.');if(s.solo!==undefined&&typeof s.solo!=='boolean')throw Error('Invalid instrument settings.');if(s.reverse!==undefined&&typeof s.reverse!=='boolean')throw Error('Invalid instrument reverse.');if(s.decay!==undefined&&(!Number.isFinite(s.decay)||s.decay<.02||s.decay>1))throw Error('Invalid instrument decay.');if(s.effects!==undefined)validateEffects(s.effects);if(!['synth','upload',...LIBRARY.filter(e=>e.role===role).map(e=>e.id)].includes(s.choice))throw Error('Unknown instrument choice.');if(s.choice!=='synth'&&!s.assetId)throw Error('Instrument has no audio.');if(s.choice==='upload'&&s.assetId!==s.uploadId)throw Error('Upload mapping mismatch.');for(const id of [s.assetId,s.uploadId])if(id!==undefined){const a=assets.get(id);if(!a)throw Error('Missing instrument audio.');if(a.channels[0]!.length/a.sampleRate>20)throw Error('Single-hit audio exceeds twenty seconds.');}}
  for(const h of [p.editor.pattern,...(p.bank?.slots.flatMap(s=>s.editor?[s.editor.pattern]:[])??[])].flatMap(p=>p.events))if(h.slice){const a=assets.get(h.slice.assetId);if(!a||a.sampleRate!==h.slice.sampleRate||h.slice.endFrame>a.channels[0]!.length)throw Error('Missing slice audio.');}
  return {project:p,assets};
}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('breakbeat-workspace',1);request.onupgradeneeded=()=>request.result.createObjectStore('projects');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function localProject(value?:Project){const db=await database();try{return await new Promise<Project|undefined>((resolve,reject)=>{const tx=db.transaction('projects',value?'readwrite':'readonly'),store=tx.objectStore('projects');let result:Project|undefined;const request=value?store.put(value,'latest'):store.get('latest');request.onsuccess=()=>{if(!value)result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
