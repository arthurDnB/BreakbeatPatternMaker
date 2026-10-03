import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {generatePiano} from '../dist/core/piano.js';
import {harmonyPlan} from '../dist/core/harmony.js';
import {MELODY_SCALES} from '../dist/core/melody.js';
import {PROFILES} from '../dist/core/profiles.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {SYNTH_PRESETS,renderSynthNote,renderSampledPianoNote} from '../dist/audio/synth-instrument.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {pianoBankSample} from '../dist/audio/piano-bank.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const settings=(genre='lofihiphop',overrides={})=>({...defaults(genre),seed:'piano-test',bars:2,resolution:16,melodyKey:0,melodyScale:'natural-minor',complexity:.7,swing:.56,humanizeMs:0,...overrides});
const events=(pattern,part)=>pattern.events.filter(hit=>hit.trackId===`melody-${part}`);

test('piano chord generation is deterministic, polyphonic, and scale-safe',()=>{
 const s=settings('lofihiphop',{bars:4}),first=generatePiano(s),second=generatePiano(s);
 assert.deepEqual(first,second);assert.ok(first.length>=15);
 const group=first.filter(hit=>hit.baseTick===0),pitches=new Set(group.map(hit=>hit.synthNote.note));
 assert.ok(pitches.size>=3,'first chord contains multiple voices');
 const pcs=new Set([0,2,3,5,7,8,10]);
 assert.ok(first.every(hit=>pcs.has(hit.synthNote.note%12)),'all chord voices follow C natural minor');
});

test('genre profiles shape chord rhythm while retaining seeded generation',()=>{
 const garage=generatePiano(settings('twostepgarage')),liquid=generatePiano(settings('liquiddnb'));
 assert.notDeepEqual(garage.map(hit=>[hit.baseTick,hit.synthNote.note]),liquid.map(hit=>[hit.baseTick,hit.synthNote.note]));
 assert.ok(garage.some(hit=>hit.baseTick%960!==0),'garage piano uses offbeat chord stabs');
});

test('piano comping adds softer guide-tone answers without smearing chord boundaries',()=>{
 const low=generatePiano(settings('lofihiphop',{bars:4,complexity:.2,spicy:0}));
 const highSettings=settings('lofihiphop',{bars:4,complexity:.92,spicy:.9});
 const high=generatePiano(highSettings),plan=harmonyPlan(highSettings);
 assert.ok(high.length>low.length,'complexity adds comping gestures');
 assert.ok(high.some(hit=>hit.reason.includes('answer')),'extra attacks are musical answers');
 assert.ok(high.some(hit=>hit.reason.includes('pickup')),'spicy adds a restrained pickup');
 assert.deepEqual(high,generatePiano(highSettings),'comping remains deterministic');
 for(const change of plan){
  const gestures=high.filter(hit=>hit.baseTick>=change.startTick&&hit.baseTick<change.endTick);
  const starts=[...new Set(gestures.map(hit=>hit.baseTick))];
  assert.ok(starts.length<=3,'no change gets a machine-gun stack of chord attacks');
  for(const hit of gestures){
   assert.ok(hit.baseTick+hit.synthNote.durationTicks<=change.endTick,'a note ends within its own harmony');
  }
  if(starts.length>1){
   const first=gestures.filter(hit=>hit.baseTick===starts[0]);
   const answer=gestures.filter(hit=>hit.baseTick===starts[1]);
   assert.ok(answer.length<first.length,'response thins the original voicing');
   assert.ok(Math.max(...answer.map(hit=>hit.gain))<Math.min(...first.map(hit=>hit.gain)),'response sits below the statement');
  }
 }
});

test('two-bar harmony has fewer changes while piano voices move smoothly',()=>{
 const s=settings('liquiddnb',{complexity:.7}),plan=harmonyPlan(s),piano=generatePiano(s);
 assert.equal(plan.length,2,'two bars use two harmony changes');
 assert.ok(new Set(plan.map(change=>change.degree)).size>=2,'harmony changes rather than repeating one chord');
 const groups=plan.map(change=>piano.filter(hit=>hit.baseTick>=change.startTick&&hit.baseTick<change.endTick));
 assert.ok(groups.every(group=>group.length>=3));
 assert.equal(new Set(groups.map(group=>group.map(hit=>hit.synthNote.note).join(','))).size,groups.length,'each chord has a distinct voicing');
 for(let i=1;i<groups.length;i++){
  const a=groups[i-1].slice(1).map(hit=>hit.synthNote.note),b=groups[i].slice(1).map(hit=>hit.synthNote.note);
  assert.ok(b.reduce((sum,note,index)=>sum+Math.abs(note-a[index]),0)<26,'upper voices use restrained movement');
 }
 assert.deepEqual(harmonyPlan(s),harmonyPlan(s));
});

test('piano chord density scales with phrase length and preserves the four-bar arrangement',()=>{
 const make=bars=>settings('liquiddnb',{bars,complexity:.2,spicy:0,seed:'bar-density'});
 const twoBarPlan=harmonyPlan(make(2)),fourBarPlan=harmonyPlan(make(4));
 const twoBar=generatePiano(make(2)),fourBar=generatePiano(make(4));
 assert.equal(twoBarPlan.length,2);
 assert.equal(fourBarPlan.length,4);
 assert.equal(new Set(twoBar.map(hit=>hit.baseTick)).size,2,'each two-bar chord gets room for one statement');
 assert.equal(new Set(fourBar.map(hit=>hit.baseTick)).size,4,'the four-bar phrase retains four chord statements');
 assert.equal(twoBar.length*2,fourBar.length,'two bars contain half the four-bar piano notes at matched settings');
});

test('piano Lushness, Tension and Density independently shape a seeded four-bar phrase',()=>{
 const make=controls=>settings('liquiddnb',{bars:4,seed:'lush-test',harmonyStyle:'jazz',complexity:.7,spicy:.4,pianoLushness:.65,pianoTension:.35,pianoDensity:.45,...controls});
 const narrow=generatePiano(make({pianoLushness:0})),open=generatePiano(make({pianoLushness:1}));
 const width=notes=>[...new Set(notes.map(hit=>hit.baseTick))].reduce((sum,tick)=>{const pitches=notes.filter(hit=>hit.baseTick===tick).map(hit=>hit.synthNote.note);return sum+Math.max(...pitches)-Math.min(...pitches);},0);
 assert.ok(width(open)>width(narrow),'Lushness opens the chord spacing');
 assert.notDeepEqual(open.map(hit=>hit.synthNote.note),narrow.map(hit=>hit.synthNote.note));
 const calm=generatePiano(make({pianoTension:0})),bright=generatePiano(make({pianoTension:1}));
 assert.notDeepEqual(calm.map(hit=>hit.synthNote.note),bright.map(hit=>hit.synthNote.note),'Tension changes harmonic color');
 const sparse=generatePiano(make({pianoDensity:0})),busy=generatePiano(make({pianoDensity:1}));
 assert.ok(busy.length>sparse.length,'Density raises voices and comping activity');
 assert.deepEqual(generatePiano(make({pianoDensity:1})),busy,'new controls remain deterministic');
});

test('Jazz harmony uses functional ii–V motion and richer chord extensions',()=>{
 const s=settings('liquiddnb',{bars:4,harmonyStyle:'jazz',melodyScale:'natural-minor',complexity:.85}),plan=harmonyPlan(s),notes=generatePiano(s);
 assert.equal(plan.length,4);
 const dominant=plan.findIndex(change=>change.degree===4);
 assert.ok(dominant>=0&&plan[(dominant+1)%plan.length].degree===0,'the V chord resolves to tonic');
 assert.equal(plan[dominant].quality,'dom7b9');
 assert.equal(plan[(dominant+plan.length-1)%plan.length].quality,'m7b5','the half-diminished ii approaches the V');
 assert.ok(notes.some(hit=>hit.reason.includes('dom7b9')),'dominant chord should state a strong altered tension');
 assert.ok(notes.some(hit=>hit.reason.includes('m7b5')),'minor ii chord should create a functional approach to V');
 const jazzNotes=new Set(notes.filter(hit=>hit.baseTick===plan[dominant].startTick).map(hit=>hit.synthNote.note%12));
 assert.ok(jazzNotes.has(8),'the G7b9 includes an A-flat ninth in C minor');
 const genre=generatePiano(settings('liquiddnb',{harmonyStyle:'genre'}));
 assert.notDeepEqual(notes.map(hit=>[hit.baseTick,hit.synthNote.note]),genre.map(hit=>[hit.baseTick,hit.synthNote.note]));
});

test('Neo-soul, modal and genre harmony styles are deterministic and distinct',()=>{
 for(const harmonyStyle of ['jazz','neo-soul','modal','genre']){
  const s=settings('mellowbeats',{harmonyStyle,seed:'style-test'});
  assert.deepEqual(generatePiano(s),generatePiano(s));
  assert.ok(generatePiano(s).length>=6);
 }
 const patterns=['jazz','neo-soul','modal','genre'].map(harmonyStyle=>generatePiano(settings('mellowbeats',{harmonyStyle})).map(hit=>hit.synthNote.note));
 assert.equal(new Set(patterns.map(JSON.stringify)).size,patterns.length);
});

test('all genre and scale combinations avoid doubled pitches in high-complexity chords',()=>{
 for(const genre of Object.keys(PROFILES))for(const scale of Object.keys(MELODY_SCALES)){
  const s=settings(genre,{melodyScale:scale,complexity:.9}),notes=generatePiano(s);
  for(const tick of new Set(notes.map(hit=>hit.baseTick))){
   const pitches=notes.filter(hit=>hit.baseTick===tick).map(hit=>hit.synthNote.note);
   assert.equal(new Set(pitches).size,pitches.length,`${genre} ${scale} at ${tick}`);
  }
 }
});

test('individual layer generation preserves others, locks, undo, and track reuse',()=>{
 const s=settings('jungle'),editor=new Editor(generate(s));
 editor.generateComposition({...s,generationMode:'melody',melodyPart:'bassline'},'Generate Bass');
 const bass=structuredClone(events(editor.state.pattern,'bassline'));
 editor.generateComposition({...s,generationMode:'melody',melodyPart:'lead'},'Generate Melody');
 const lead=structuredClone(events(editor.state.pattern,'lead'));
 editor.generateComposition({...s,generationMode:'melody',melodyPart:'piano'},'Generate Piano');
 const piano=events(editor.state.pattern,'piano');assert.ok(piano.length>0);
 assert.deepEqual(events(editor.state.pattern,'bassline'),bass);assert.deepEqual(events(editor.state.pattern,'lead'),lead);
 assert.equal(editor.state.pattern.userTracks.find(track=>track.generatedPart==='piano').instrument.preset,'piano');
 compile(editor.state.pattern);
 editor.state.lockedIds=[piano[0].id];
 editor.generateComposition({...s,generationMode:'melody',melodyPart:'piano',variation:1},'Generate Piano');
 assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===piano[0].id),piano[0]);
 assert.equal(editor.state.pattern.userTracks.filter(track=>track.generatedPart==='piano').length,1);
 assert.equal(editor.undo(),true);assert.deepEqual(events(editor.state.pattern,'piano'),piano);
});

test('piano preset produces a decaying struck-string timbre in the shared renderer',()=>{
 const voice=renderSynthNote(60,.6,24000,SYNTH_PRESETS.piano);
 assert.ok(voice.length>14400);assert.ok(voice.some(value=>Math.abs(value)>.01));
 const tail=voice.slice(12000,14000).reduce((sum,value)=>sum+value*value,0);
 const early=voice.slice(1000,3000).reduce((sum,value)=>sum+value*value,0);
 assert.ok(tail<early,'piano partials naturally decay');
 const s=settings('mellowbeats',{generationMode:'melody',melodyPart:'piano',bars:1}),pattern={...generate(s),userTracks:[{id:'melody-piano',name:'Generated Piano',kind:'synth',generatedPart:'piano',role:'percussion',instrument:SYNTH_PRESETS.piano,level:1,pan:0,mute:false,solo:false}],events:generatePiano(s,'melody-piano')};
 assert.ok(renderPerformance(pattern,new Map(),24000).channels[0].some(value=>Math.abs(value)>.001));
 const editor=new Editor(pattern),project=makeProject(editor.state,s,defaultKitState(),new Map()),restored=readProject(project).project;
 assert.equal(project.version,8);assert.equal(restored.editor.pattern.userTracks[0].instrument.preset,'piano');assert.equal(restored.editor.pattern.events.length,pattern.events.length);
});

test('curated upright piano bank has verified local recordings and velocity layers',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/piano/catalog.json',import.meta.url)));
 assert.equal(catalog.length,26);
 const ids=new Set(catalog.map(entry=>entry.id));
 for(const entry of catalog){
  const bytes=await readFile(fileURLToPath(new URL('..'+entry.path,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 }
 assert.ok(ids.has(pianoBankSample(60,.3).assetId));
 assert.ok(ids.has(pianoBankSample(60,.8).assetId));
 assert.notEqual(pianoBankSample(69,.3).assetId,pianoBankSample(69,.8).assetId);
});

test('a user piano one-shot transposes, renders, and persists as project v8',()=>{
 const rate=24000,length=rate,channel=Float32Array.from({length},(_,i)=>Math.sin(2*Math.PI*523.25*i/rate)*Math.exp(-i/rate*3));
 const asset={id:'piano-test-c',name:'Piano C.wav',sampleRate:rate,channels:[channel,channel]};
 const instrument={...SYNTH_PRESETS.piano,sample:{assetId:asset.id,rootNote:72}};
 const direct=renderSampledPianoNote(72,.6,rate,instrument,asset);
 assert.equal(direct.length,2);assert.ok(direct[0].some(value=>Math.abs(value)>.1));
 assert.notDeepEqual(renderSampledPianoNote(74,.6,rate,instrument,asset)[0],direct[0]);
 const s=settings('liquiddnb',{bars:1}),editor=new Editor(generate(s));
 editor.generateComposition({...s,generationMode:'melody',melodyPart:'piano'},'Generate Piano');
 const track=editor.state.pattern.userTracks.find(track=>track.generatedPart==='piano');
 editor.setSynthInstrument(track.id,instrument);
 const assets=new Map([[asset.id,asset]]),original=renderPerformance(editor.state.pattern,assets,rate);
 const saved=makeProject(editor.state,s,defaultKitState(),assets),restored=readProject(saved);
 assert.equal(saved.version,8);assert.equal(restored.project.editor.pattern.userTracks.find(track=>track.id===track.id).instrument.sample.assetId,asset.id);
 assert.deepEqual(renderPerformance(restored.project.editor.pattern,restored.assets,rate).channels,original.channels);
 assert.throws(()=>readProject({...saved,assets:[]}),/Missing piano sample audio/);
});
