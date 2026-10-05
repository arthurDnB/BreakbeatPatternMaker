import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {starterPatch,renderModularSynthNote} from '../dist/audio/modular-synth.js';
import {encodeWav} from '../dist/audio/wav.js';

// Every constant and the matching window are exported so
// tests/modular-rhodes-audition.test.mjs can re-derive the level-matching numbers that
// docs/MODULAR-SYNTH-ALIASING.md quotes, without writing any files.
export const AUDITION_RATE=48000;
export const AUDITION_DURATION=.65;
export const AUDITION_TARGET_RMS=.12;
export const AUDITION_PEAK_CEILING=.9;
export const AUDITION_OUT=join('test-results','modular-rhodes-audition');
export const AUDITION_CASES=[['C2 soft',36,.25],['C2 accent',36,.95],['C4 soft',60,.25],['C4 accent',60,.95],['C5 accent',72,.95]];
export const AUDITION_LABELS=[['Current Rhodes','rhodes'],['FM Rhodes audition','rhodes-model-v2']];

// The audition matches on the first 0.5 s of the raw render, with a peak ceiling.
export function measureAuditionWindow(raw,rate=AUDITION_RATE){
  const sampleCount=Math.min(raw.length,Math.round(rate*.5));
  let square=0,peak=0;
  for(let i=0;i<sampleCount;i++){square+=raw[i]**2;peak=Math.max(peak,Math.abs(raw[i]));}
  const rms=Math.sqrt(square/sampleCount);
  return {rms,peak,gain:Math.min(AUDITION_TARGET_RMS/Math.max(rms,1e-8),AUDITION_PEAK_CEILING/Math.max(peak,1e-8))};
}

// One side of one pair: the raw render plus the measured window and the gain the
// audition applies to it, plus the whole-file peak after that gain (the crest factor).
export function renderAuditionSide(preset,note,velocity){
  const raw=renderModularSynthNote(note,AUDITION_DURATION,AUDITION_RATE,starterPatch(preset),undefined,60,0,velocity);
  const {rms,peak,gain}=measureAuditionWindow(raw);
  let filePeak=0;
  for(let i=0;i<raw.length;i++)filePeak=Math.max(filePeak,Math.abs(raw[i]));
  return {raw,rms,peak,gain,filePeak:filePeak*gain};
}

async function main(){
  const out=AUDITION_OUT;
  await mkdir(out,{recursive:true});
  const cards=[];
  for(const [label,note,velocity] of AUDITION_CASES){
    const players=[];
    for(const [name,preset] of AUDITION_LABELS){
      const {raw,gain}=renderAuditionSide(preset,note,velocity);
      const matched=Float32Array.from(raw,value=>value*gain);
      const filename=`${preset}-${note}-${Math.round(velocity*100)}.wav`;
      await writeFile(join(out,filename),Buffer.from(encodeWav([matched],AUDITION_RATE)));
      players.push(`<div><strong>${name}</strong><audio controls preload="none" src="${filename}"></audio></div>`);
    }
    cards.push(`<section><h2>${label}</h2><div class="pair">${players.join('')}</div></section>`);
  }
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Rhodes modular A/B</title><style>
body{background:#090e13;color:#dce9ee;font:16px system-ui;max-width:1000px;margin:30px auto;padding:0 18px}h1{color:#79e5db}
section{background:#122029;border:1px solid #2b5555;border-radius:12px;padding:12px 18px;margin:12px 0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}audio{display:block;width:100%;margin-top:8px}small{color:#9bb4bd}
@media(max-width:650px){.pair{grid-template-columns:1fr}}
</style><h1>Rhodes A/B audition</h1><p>Compare the current Rhodes patch with the new FM draft at identical notes and note lengths. Each WAV is level-matched over its first 0.5 seconds, with a peak ceiling. Listen to the attack, tine character, sustain, note-off, and C2–C5 consistency. The new patch is an experimental starting point, not an authenticated Rhodes model.</p>${cards.join('')}<small>Generated locally from the app's shared modular note renderer at 48 kHz; original exports remain unchanged.</small></html>`;
  await writeFile(join(out,'index.html'),html);
  console.log(`Wrote ${cards.length} matched Rhodes A/B pairs to ${join(out,'index.html')}`);
}

const invokedDirectly=process.argv[1]?resolve(process.argv[1]).toLowerCase()===fileURLToPath(import.meta.url).toLowerCase():false;
if(invokedDirectly)await main();
