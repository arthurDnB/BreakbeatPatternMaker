import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {generatePiano} from '../dist/core/piano.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {SYNTH_PRESETS,renderSynthNote} from '../dist/audio/synth-instrument.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';

const settings=(genre='lofihiphop',overrides={})=>({...defaults(genre),seed:'piano-test',bars:2,resolution:16,melodyKey:0,melodyScale:'natural-minor',complexity:.7,swing:.56,humanizeMs:0,...overrides});
const events=(pattern,part)=>pattern.events.filter(hit=>hit.trackId===`melody-${part}`);

test('piano chord generation is deterministic, polyphonic, and scale-safe',()=>{
 const s=settings(),first=generatePiano(s),second=generatePiano(s);
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
 assert.equal(project.version,7);assert.equal(restored.editor.pattern.userTracks[0].instrument.preset,'piano');assert.equal(restored.editor.pattern.events.length,pattern.events.length);
});
