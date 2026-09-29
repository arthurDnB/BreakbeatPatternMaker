import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {defaults,PROFILES} from '../dist/core/profiles.js';
import {Editor} from '../dist/core/editor.js';
import {PPQ,ENGINE_VERSION} from '../dist/core/model.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';

// Build first. This writes an ignored local listening set, never bundled samples.
const out=join('test-results','melody-audition');
await mkdir(out,{recursive:true});
const genres=Object.keys(PROFILES);
const chosen=process.argv.includes('--smoke')?genres.slice(0,2):genres;
const rows=[];
for(const genre of chosen)for(const part of ['bassline','lead']){
  const settings={...defaults(genre),algorithm:'groove-v4',seed:'melody-review-v1',bars:4,
    generationMode:'melody',melodyPart:part,melodyKey:0,melodyScale:'natural-minor',complexity:.5,spicy:.35};
  const editor=new Editor({engineVersion:ENGINE_VERSION,settings,ppq:PPQ,events:[]});
  editor.generateComposition(settings);
  const pattern=editor.state.pattern;
  const audio=renderPerformance(withDrumKit(pattern,{},defaultKitState()),new Map(),44100,{}, {loop:false});
  const file=`${genre}-${part}.wav`;
  await writeFile(join(out,file),new Uint8Array(encodeWav(audio.channels,audio.sampleRate)));
  const notes=pattern.events.filter(hit=>hit.synthNote).map(hit=>`${(hit.baseTick/PPQ).toFixed(2)}:${hit.synthNote.note}`).join(' · ');
  rows.push(`<tr><td>${PROFILES[genre].name}</td><td>${part}</td><td><audio controls preload="none" src="${file}"></audio></td><td><code>${notes}</code></td></tr>`);
}
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Melody audition</title><style>
body{font:15px system-ui;background:#111;color:#eee;margin:2rem}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #444;padding:.7rem;vertical-align:top}code{font-size:12px;color:#9bd;line-height:1.8}audio{width:230px}tr:hover{background:#222}
</style><h1>Melody audition</h1><p>Fixed seed melody-review-v1 · C natural minor · 4 bars · Complexity 50% · Spicy 35%. Listen for memorable motifs, genre fit, space, endings, and bass/lead compatibility. These are generated examples, not reference recordings.</p><table><thead><tr><th>Genre</th><th>Part</th><th>Listen</th><th>Beat : MIDI note</th></tr></thead><tbody>${rows.join('')}</tbody></table></html>`;
await writeFile(join(out,'index.html'),page);
console.log(`Wrote ${rows.length} auditions to ${join(out,'index.html')}`);
