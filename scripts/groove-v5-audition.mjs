import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {LIBRARY,KIT_PRESETS,GENRE_KITS} from '../dist/audio/library.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';
import {decodePcmWav} from './real-break-wav.mjs';

// Run after npm.cmd run build. The ignored test-results output is a listening
// aid, not a claim that a numerical metric proves genre authenticity.
const PILOTS=['jungle','liquiddnb','boombap','trap','twostepgarage','dubstep','breakcore','amenscience'];
const seed=process.argv.find(arg=>arg.startsWith('--seed='))?.slice(7)??'v5-listening-01';
const genres=process.argv.includes('--smoke')?PILOTS.slice(0,1):PILOTS;
const variants=[
 {id:'v4',label:'V4 baseline',algorithm:'groove-v4',complexity:.55,spicy:.35},
 {id:'v5',label:'V5 baseline',algorithm:'groove-v5',complexity:.55,spicy:.35},
 {id:'complex',label:'V5 more Complexity',algorithm:'groove-v5',complexity:.85,spicy:.35},
 {id:'spicy',label:'V5 more Spicy',algorithm:'groove-v5',complexity:.55,spicy:.85},
 {id:'both',label:'V5 both high',algorithm:'groove-v5',complexity:.85,spicy:.85},
];
const output=join('test-results','groove-v5-audition');
await mkdir(output,{recursive:true});
const assetCache=new Map();
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function loadAsset(id){
 if(assetCache.has(id))return assetCache.get(id);
 const entry=LIBRARY.find(item=>item.id===id);
 if(!entry)throw Error(`Missing licensed sample ${id}`);
 const bytes=await readFile(new URL(`../public/samples/${id}.wav`,import.meta.url));
 const decoded=decodePcmWav(bytes);
 const asset={id,name:entry.name,sampleRate:decoded.rate,channels:decoded.channels};
 assetCache.set(id,asset);
 return asset;
}
async function kitFor(genre){
 const preset=KIT_PRESETS.find(item=>item.id===GENRE_KITS[genre]);
 if(!preset)throw Error(`Missing kit preset for ${genre}`);
 const mix=defaultKitState(),kit={},assets=new Map();
 for(const [role,id] of Object.entries(preset.slots)){
  const asset=await loadAsset(id);assets.set(asset.id,asset);
  kit[role]={assetId:id,startFrame:0,endFrame:asset.channels[0].length,sampleRate:asset.sampleRate,label:asset.name};
  mix[role].level=preset.levels?.[role]??1;
  if(preset.decays?.[role]!==undefined)mix[role].decay=preset.decays[role];
 }
 return {preset,kit,mix,assets};
}
const report={seed,settings:{bars:4,phraseLength:4,patternStructure:'auto',fillAmount:.5,ghostAmount:.6,syncopation:.65},variants:[]};
const sections=[];
for(const genre of genres){
 const {preset,kit,mix,assets}=await kitFor(genre),rows=[];
 for(const variant of variants){
  const settings={...genreDefaults(genre),...report.settings,seed,algorithm:variant.algorithm,
   complexity:variant.complexity,spicy:variant.spicy};
  const pattern=generate(settings),audio=renderPerformance(withDrumKit(pattern,kit,mix),assets,22050,{}, {loop:true});
  const filename=`${genre}-${variant.id}.wav`;
  await writeFile(join(output,filename),new Uint8Array(encodeWav(audio.channels,audio.sampleRate)));
  const peak=Math.max(...audio.channels.map(channel=>channel.reduce((max,value)=>Math.max(max,Math.abs(value)),0)));
  const stats={genre,variant:variant.id,algorithm:variant.algorithm,bpm:settings.bpm,kit:preset.id,
   hits:pattern.events.length,anchors:pattern.events.filter(hit=>hit.anchor).length,
   expressive:pattern.events.filter(hit=>hit.ratchets>1||hit.reverse||hit.pitch!==undefined).length,
   peak:Number(peak.toFixed(4)),file:filename};
  report.variants.push(stats);
  rows.push(`<tr><th scope="row">${escape(variant.label)}</th><td><audio controls preload="none" src="${escape(filename)}"></audio></td><td>${stats.hits} hits · ${stats.anchors} anchors · ${stats.expressive} expressive</td><td><input type="number" min="1" max="5" aria-label="Genre fit score for ${escape(genre)} ${escape(variant.label)}" data-key="${escape(genre)}:${variant.id}:fit"></td><td><input type="number" min="1" max="5" aria-label="Groove score for ${escape(genre)} ${escape(variant.label)}" data-key="${escape(genre)}:${variant.id}:groove"></td></tr>`);
 }
 sections.push(`<section><h2>${escape(PROFILES[genre].name)} <small>${escape(preset.name)}</small></h2><table><thead><tr><th>Version</th><th>Listen</th><th>Structure</th><th>Genre fit</th><th>Groove</th></tr></thead><tbody>${rows.join('')}</tbody></table><label>Listening notes for ${escape(PROFILES[genre].name)}<textarea data-key="${escape(genre)}:notes" rows="3"></textarea></label></section>`);
}
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Groove V5 listening comparison</title><style>body{background:#090c11;color:#e5edf5;font:15px system-ui;margin:2rem auto;max-width:1100px;padding:0 1rem}section{background:#151c24;border:1px solid #324151;border-radius:10px;padding:1rem;margin:1rem 0}h2 small{font-size:.65em;font-weight:400;color:#aac2cc}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #334;padding:.55rem;text-align:left}audio{width:230px}input{width:3rem;background:#0c1118;color:white;border:1px solid #546;border-radius:4px;padding:.3rem}textarea{display:block;width:98%;margin-top:.4rem;background:#0c1118;color:white;border:1px solid #546;padding:.5rem}button{background:#0cae9c;color:#071111;border:0;border-radius:5px;padding:.7rem;cursor:pointer}@media(max-width:700px){audio{width:150px}td,th{padding:.25rem;font-size:12px}}</style><h1>Groove V5 listening comparison</h1><p>Seed ${escape(seed)} · four bars · licensed genre kit · same kit and tempo within each genre. Compare V4/V5 and each slider independently. Scores are your listening judgments, not automated authenticity grades. Export responses when done.</p><button id="export">Download listening notes</button>${sections.join('')}<script>const inputs=[...document.querySelectorAll('[data-key]')];document.getElementById('export').onclick=()=>{const answers=Object.fromEntries(inputs.map(input=>[input.dataset.key,input.value]));const blob=new Blob([JSON.stringify({seed:${JSON.stringify(seed)},answers},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='groove-v5-listening-notes.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};</script></html>`;
await writeFile(join(output,'index.html'),page);
console.log(`Wrote ${report.variants.length} WAVs and a listening page to ${output}`);
