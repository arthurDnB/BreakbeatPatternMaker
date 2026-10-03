import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {generateGrooveV5,validateV5Profile} from '../dist/core/groove-v5.js';
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
// A listening candidate, not the production profile: the supplied Cichy,
// Fatal Youth and AgonyOST recordings show large within-track changes in
// transient activity. Their mixed attacks do not reveal individual drum hits.
// Try a response-heavy contour without changing Arthur's preferred pattern.
const contrastProfile=structuredClone(v5ProfileFor(genre));
contrastProfile.layers.find(layer=>layer.id==='atmospheric-high-chops').on=['response','turnaround'];
contrastProfile.layers.push({id:'atmospheric-contrast-kick-answer',role:'kick',minimum:.8,
 minimumPhraseProgress:.57,on:['response','turnaround'],notes:[
  {step:8.5,gain:.48,probability:.75,syncopated:true},
  {step:11.5,gain:.42,probability:.64,syncopated:true}]});
contrastProfile.layers.push({id:'atmospheric-contrast-snare-turn',role:'snare',minimum:.8,
 minimumPhraseProgress:.57,on:['turnaround'],notes:[
  {step:10.75,gain:.25,ghost:true,probability:.82,rollRepeats:2}]});
validateV5Profile(contrastProfile,genre);
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
 {id:'contrast-development',label:'Candidate: response-weighted bars 5–8 + layered kit',profile:contrastProfile,phraseOffset:4,kit:preset},
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
const preferred=existsSync(join(output,'v2-opening.wav'))?`<tr><th>Opening you preferred · layered kit (previous version)</th><td><audio controls preload="none" src="v2-opening.wav"></audio></td><td>Saved from the last A/B</td></tr>`:'';
const likedOpening=existsSync(join(output,'liked-opening.wav'))?`<tr><th>Your liked opening · exact saved WAV</th><td><audio controls preload="none" src="liked-opening.wav"></audio></td><td>14 / 16 / 13 / 13 hits per bar</td></tr>`:'';
const likedDevelopment=existsSync(join(output,'liked-development.wav'))?`<tr><th>Your liked bars 5–8 · exact saved WAV</th><td><audio controls preload="none" src="liked-development.wav"></audio></td><td>18 / 23 / 24 / 21 hits per bar</td></tr>`:'';
const rows=likedOpening+likedDevelopment+preferred+previous+report.variants.map(item=>`<tr><th>${item.label}</th><td><audio controls preload="none" src="${item.file}"></audio></td><td>${item.hitsByBar.join(' / ')} hits per bar</td></tr>`).join('');
const otherReferences=`<section><h2>Other supplied references</h2><p>Compare section shape, not individual drum notes: these are mastered mixes with vocals and instruments. The transient figures are audio attack proxies, not a kick/snare transcription.</p><table><tbody>
<tr><th>Cichy — Chaos Contained</th><td><audio controls preload="none" src="../atmospheric-breakcore-references/mix-tracks/01%20-%20Cichy---Chaos-Contained.mp3"></audio></td><td>Quiet intro → break entry; around 1:00–2:30 has more detected attacks.</td></tr>
<tr><th>Fatal Youth — Ryona remix</th><td><audio controls preload="none" src="../atmospheric-breakcore-references/mix-tracks/03%20-%20Fatal-Youth---Ryona-Sewerslvt-Fatal-Youth-Remix.mp3"></audio></td><td>Around 1:00–2:30 attack activity changes while overall level stays similar.</td></tr>
<tr><th>AgonyOST — Light Stops Dripping Through The Stars remix</th><td><audio controls preload="none" src="../atmospheric-breakcore-references/standalone-favorites/AgonyOST%20-%20Light%20Stops%20Dripping%20Through%20The%20Stars%20(Sewerslvt%20Remix).mp3"></audio></td><td>Compare around 3:00 and 4:00 for a lower-activity passage followed by busier attacks.</td></tr>
</tbody></table><p>The candidate below tests a response-heavy version of bars 5–8: fewer constant high chops, two syncopated kick answers, and one short ghost-snare turn. It is an experiment; the production profile and your liked versions remain unchanged.</p></section>`;
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atmospheric Breakcore opening A/B</title><style>body{font:15px system-ui;background:#090d11;color:#e5f5f4;margin:2rem auto;max-width:1000px;padding:0 1rem}section{background:#111b20;border:1px solid #2c4c50;border-radius:10px;padding:1.2rem;margin:1.2rem 0}p{line-height:1.5;color:#b5cac8}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #345;padding:.6rem}audio{width:min(100%,320px)}button{background:#12a99e;color:#071010;border:0;border-radius:6px;padding:.6rem;cursor:pointer;margin:.2rem}textarea{width:100%;min-height:90px;background:#0b1518;color:white;border:1px solid #496;border-radius:5px;padding:.5rem}</style><h1>SR20DET-inspired drum opening study</h1><p>Same 170 BPM, seed, kit and controls. Compare the prior compatibility profile with the dedicated opening and development. These are new generated rhythms, not copies of the reference. The original MP3 stays in local test-results and is not deployed.</p><section><h2>Original reference</h2><audio id="reference" controls preload="metadata" src="../atmospheric-breakcore-references/standalone-favorites/Blksmiith - SR20DET.mp3"></audio><p>Working 170 BPM grid; tentative first downbeat near 0.13 s. Listen to the opening and the transition around 1:30. The exact downbeat and sound roles still need human verification.</p><button data-start="0" data-end="5.65">Opening 0–4 bars</button><button data-start="5.65" data-end="11.30">Bars 5–8</button><button data-start="84.70" data-end="101.65">Around 1:30</button></section><section><h2>Generated A/B</h2><table><thead><tr><th>Version</th><th>Play</th><th>Tracker notes</th></tr></thead><tbody>${rows}</tbody></table><p>Tracker-note counts include hats and ghosts; they do not equal audible transient counts in the mastered song.</p></section><section><h2>Listening notes</h2><p>What works about the opening? Where do the kick, snare and chops actually land? Does the new development feel better than the prior profile?</p><textarea id="notes"></textarea><p><button id="download">Download notes</button></p></section><script>const a=document.querySelector('#reference');for(const b of document.querySelectorAll('[data-start]'))b.onclick=async()=>{a.pause();a.currentTime=Number(b.dataset.start);a.dataset.stop=b.dataset.end;await a.play()};a.ontimeupdate=()=>{if(a.dataset.stop&&a.currentTime>=Number(a.dataset.stop)){a.pause();delete a.dataset.stop}};document.querySelector('#download').onclick=()=>{const blob=new Blob([JSON.stringify({reference:'Blksmiith - SR20DET',seed:${JSON.stringify(seed)},notes:document.querySelector('#notes').value},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='atmospheric-breakcore-opening-notes.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};</script></html>`;
await writeFile(join(output,'index.html'),page.replace('<section><h2>Generated A/B</h2>',otherReferences+'<section><h2>Generated A/B</h2>').replace(
 'Same 170 BPM, seed, kit and controls. Compare the prior compatibility profile with the dedicated opening and development.',
 'Same 170 BPM, seed and controls. Compare your preferred layered-kit opening with this new opening, which adds a few short rolls while retaining its backbone. Then compare the later development.'
));
console.log(`Wrote ${report.variants.length} comparisons to ${output}`);
