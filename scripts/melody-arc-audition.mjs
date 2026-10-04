import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {generateLegacyMelody} from '../dist/core/melody.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';

const output=resolve('test-results/melody-arc-audition');
await mkdir(output,{recursive:true});
const genres=['jungle','liquiddnb','boombap','atmosphericbreakcore'];
const rows=[];
for(const genre of genres){
 const settings={...defaults(genre),bars:4,seed:'melody-arc-audition',complexity:.65,spicy:.35,melodyPart:'lead',generationMode:'melody',melodyKey:2,melodyScale:'natural-minor'};
 const editor=new Editor(generate(settings));editor.generateComposition(settings);
 const newer=editor.state.pattern,track=newer.userTracks.find(item=>item.generatedPart==='lead');
 const older=structuredClone(newer);
 older.events=older.events.filter(hit=>hit.trackId!==track.id).concat(generateLegacyMelody(settings,track.id));
 for(const [label,pattern] of [['previous',older],['arc',newer]]){
  const audio=renderPerformance(pattern,new Map(),22050,{},{});
  await writeFile(resolve(output,`${genre}-${label}.wav`),Buffer.from(encodeWav(audio.channels,audio.sampleRate)));
 }
 rows.push(`<section><h2>${genre}</h2><p>Previous lead</p><audio controls src="${genre}-previous.wav"></audio><p>Song arc lead</p><audio controls src="${genre}-arc.wav"></audio><p>Rate hook recall, phrasing, harmonic fit, and unwanted repetition after listening to both.</p></section>`);
}
await writeFile(resolve(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Melody arc A/B</title><style>body{font:16px system-ui;background:#101619;color:#e7faf5;max-width:860px;margin:auto;padding:32px}section{border:1px solid #42605a;border-radius:12px;margin:22px 0;padding:20px}audio{display:block;width:100%}</style><h1>Melody arc A/B</h1><p>Same seed, drums, lead instrument, harmony, and four-bar length in each pair. Review by ear; this page does not record ratings.</p>${rows.join('')}</html>`);
console.log(output);
