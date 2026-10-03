import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {generateGrooveV5} from '../dist/core/groove-v5.js';
import {baselineV5Profile,v5ProfileFor} from '../dist/core/groove-v5-baseline.js';
import {genreDefaults} from '../dist/core/profiles.js';
import {LIBRARY,KIT_PRESETS,GENRE_KITS} from '../dist/audio/library.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';
import {decodePcmWav} from './real-break-wav.mjs';

// Run after npm.cmd run build. This is a blind-listening aid, not a reference
// transcription or an automated measure of genre authenticity.
const genre='atmosphericbreakcore',output=join('test-results','atmospheric-breakcore-audition');
const seed=process.argv.find(arg=>arg.startsWith('--seed='))?.slice(7)??'sr20-opening-study';
const preset=KIT_PRESETS.find(item=>item.id===GENRE_KITS[genre]);
if(!preset)throw Error('Missing Atmospheric Breakcore kit preset.');
const oldKit={id:'atmospheric-breakcore-previous',name:'Previous acoustic/cowbell kit',
 slots:{kick:'acoustic-kick-punch',snare:'acoustic-snare-piccolo',hat:'acoustic-hat-tight',percussion:'808-cowbell'},
 levels:{snare:.85,percussion:.82},decays:{snare:.85,percussion:.85}};
const assets=new Map();
async function loadAsset(id){
 if(assets.has(id))return assets.get(id);
 const entry=LIBRARY.find(item=>item.id===id);
 if(!entry)throw Error(`Missing bundled sample ${id}`);
 const bytes=await readFile(new URL(`../public/samples/${id}.wav`,import.meta.url));
 const decoded=decodePcmWav(bytes);
 const asset={id,name:entry.name,sampleRate:decoded.rate,channels:decoded.channels};
 assets.set(id,asset);
 return asset;
}
async function kitFor(selected){
 const mix=defaultKitState(),kit={};
 for(const [role,id] of Object.entries(selected.slots)){
  const asset=await loadAsset(id);
 kit[role]={assetId:id,startFrame:0,endFrame:asset.channels[0].length,sampleRate:asset.sampleRate,label:asset.name};
  mix[role].level=selected.levels?.[role]??1;
  if(selected.decays?.[role]!==undefined)mix[role].decay=selected.decays[role];
  if(selected.velocityLayers?.[role]){
   mix[role].velocityLayers=Object.fromEntries(await Promise.all(
    Object.entries(selected.velocityLayers[role]).map(async([band,choice])=>{
     const layer=await loadAsset(choice);
     return [band,{choice,level:selected.velocityLayerLevels?.[role]?.[band]??1,
      slice:{assetId:choice,startFrame:0,endFrame:layer.channels[0].length,sampleRate:layer.sampleRate,label:layer.name}}];
    })));
  }
 }
 return {kit,mix};
}
await mkdir(output,{recursive:true});
const variants=[
 {id:'baseline',label:'Previous V5 compatibility profile + previous kit',profile:baselineV5Profile(genre),phraseOffset:0,kit:oldKit},
 {id:'new-opening',label:'Refined profile, phrase bars 1–4 + layered kit',profile:v5ProfileFor(genre),phraseOffset:0,kit:preset},
 {id:'new-development',label:'Refined profile, phrase bars 5–8 + layered kit',profile:v5ProfileFor(genre),phraseOffset:4,kit:preset},
 {id:'new-development-old-kit',label:'Same refined development + previous kit',profile:v5ProfileFor(genre),phraseOffset:4,kit:oldKit}
];
const report={seed,bpm:170,bars:4,phraseLength:8,variants:[]};
for(const variant of variants){
 const settings={...genreDefaults(genre),algorithm:'groove-v5',seed,bpm:170,bars:4,
  phraseLength:8,phraseOffset:variant.phraseOffset,complexity:.85,spicy:.35,
  fillAmount:.4,ghostAmount:.7,syncopation:.7,patternStructure:'auto'};
 const pattern=generateGrooveV5(settings,variant.profile);
 const {kit,mix}=await kitFor(variant.kit);
 const audio=renderPerformance(withDrumKit(pattern,kit,mix),assets,22050,{}, {loop:true});
 const file=`${variant.id}.wav`;
 await writeFile(join(output,file),new Uint8Array(encodeWav(audio.channels,audio.sampleRate)));
 report.variants.push({id:variant.id,label:variant.label,file,kit:variant.kit.id,phraseOffset:variant.phraseOffset,
  hits:pattern.events.length,hitsByBar:Array.from({length:4},(_,bar)=>pattern.events.filter(hit=>Math.floor(hit.baseTick/3840)===bar).length),
  anchors:pattern.events.filter(hit=>hit.anchor).length});
}
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
const previous=existsSync(join(output,'v1-development.wav'))?`<tr><th>Previous dedicated development + previous kit (last review)</th><td><audio controls preload="none" src="v1-development.wav"></audio></td><td>Saved from the earlier A/B</td></tr>`:'';
const rows=previous+report.variants.map(item=>`<tr><th>${item.label}</th><td><audio controls preload="none" src="${item.file}"></audio></td><td>${item.hitsByBar.join(' / ')} hits per bar</td></tr>`).join('');
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atmospheric Breakcore opening A/B</title><style>body{font:15px system-ui;background:#090d11;color:#e5f5f4;margin:2rem auto;max-width:1000px;padding:0 1rem}section{background:#111b20;border:1px solid #2c4c50;border-radius:10px;padding:1.2rem;margin:1.2rem 0}p{line-height:1.5;color:#b5cac8}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #345;padding:.6rem}audio{width:min(100%,320px)}button{background:#12a99e;color:#071010;border:0;border-radius:6px;padding:.6rem;cursor:pointer;margin:.2rem}textarea{width:100%;min-height:90px;background:#0b1518;color:white;border:1px solid #496;border-radius:5px;padding:.5rem}</style><h1>SR20DET-inspired drum opening study</h1><p>Same 170 BPM, seed, kit and controls. Compare the prior compatibility profile with the dedicated opening and development. These are new generated rhythms, not copies of the reference. The original MP3 stays in local test-results and is not deployed.</p><section><h2>Original reference</h2><audio id="reference" controls preload="metadata" src="../atmospheric-breakcore-references/standalone-favorites/Blksmiith - SR20DET.mp3"></audio><p>Working 170 BPM grid; tentative first downbeat near 0.13 s. Listen to the opening and the transition around 1:30. The exact downbeat and sound roles still need human verification.</p><button data-start="0" data-end="5.65">Opening 0–4 bars</button><button data-start="5.65" data-end="11.30">Bars 5–8</button><button data-start="84.70" data-end="101.65">Around 1:30</button></section><section><h2>Generated A/B</h2><table><thead><tr><th>Version</th><th>Play</th><th>Tracker notes</th></tr></thead><tbody>${rows}</tbody></table><p>Tracker-note counts include hats and ghosts; they do not equal audible transient counts in the mastered song.</p></section><section><h2>Listening notes</h2><p>What works about the opening? Where do the kick, snare and chops actually land? Does the new development feel better than the prior profile?</p><textarea id="notes"></textarea><p><button id="download">Download notes</button></p></section><script>const a=document.querySelector('#reference');for(const b of document.querySelectorAll('[data-start]'))b.onclick=async()=>{a.pause();a.currentTime=Number(b.dataset.start);a.dataset.stop=b.dataset.end;await a.play()};a.ontimeupdate=()=>{if(a.dataset.stop&&a.currentTime>=Number(a.dataset.stop)){a.pause();delete a.dataset.stop}};document.querySelector('#download').onclick=()=>{const blob=new Blob([JSON.stringify({reference:'Blksmiith - SR20DET',seed:${JSON.stringify(seed)},notes:document.querySelector('#notes').value},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='atmospheric-breakcore-opening-notes.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};</script></html>`;
await writeFile(join(output,'index.html'),page.replace(
 'Same 170 BPM, seed, kit and controls. Compare the prior compatibility profile with the dedicated opening and development.',
 'Same 170 BPM, seed and controls. Compare the previous development with the refined rhythm, then compare the refined rhythm across old and layered kits.'
));
console.log(`Wrote ${report.variants.length} comparisons to ${output}`);
