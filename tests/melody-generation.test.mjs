import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,PROFILES} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {generateMelody,MELODY_SCALES} from '../dist/core/melody.js';
import {melodyProfile} from '../dist/core/melody-profiles.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {newBank,arrange} from '../dist/core/bank.js';
import {SYNTH_PRESETS} from '../dist/audio/synth-instrument.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';
import {makeProject,readProject} from '../dist/audio/project.js';

const settings=(overrides={})=>({...defaults('jungle'),algorithm:'groove-v4',seed:'melody-test',bars:2,spicy:.4,generationMode:'both',melodyPart:'bassline',melodyKey:0,melodyScale:'natural-minor',...overrides});
const generated=(pattern,part='bassline')=>pattern.userTracks?.find(track=>track.generatedPart===part);
const notes=(pattern,part='bassline')=>pattern.events.filter(hit=>hit.trackId===generated(pattern,part)?.id);

test('every genre and scale produces deterministic, playable pitches within the selected scale and register',()=>{
 for(const genre of Object.keys(PROFILES)){
  const s=settings({genre,bars:1});
  const first=generateMelody(s,'melody-bassline'),second=generateMelody(s,'melody-bassline');
  assert.deepEqual(first,second,genre);
  assert.ok(first.length>0,genre);
  const profile=melodyProfile(genre,'bassline');
  assert.ok(first.every(hit=>hit.synthNote.note>=profile.low&&hit.synthNote.note<=profile.high),genre);
 }
 for(const [scale,definition] of Object.entries(MELODY_SCALES)){
  const s=settings({melodyScale:scale,melodyKey:6,melodyPart:'lead'});
  const output=generateMelody(s,'melody-lead');
  assert.ok(output.length>0,scale);
  assert.ok(output.every(hit=>definition.intervals.includes((hit.synthNote.note-s.melodyKey+120)%12)),scale);
 }
 const jungle=generateMelody(settings({genre:'jungle'}),'melody-bassline').map(hit=>hit.baseTick);
 const garage=generateMelody(settings({genre:'twostepgarage'}),'melody-bassline').map(hit=>hit.baseTick);
 assert.notDeepEqual(jungle,garage);
});

test('complexity adds rhythmic detail and Spicy adds bounded, scale-safe pickups',()=>{
 const count=s=>generateMelody(s,'melody-lead').length;
 const low=settings({melodyPart:'lead',complexity:0,spicy:0,bars:4});
 const high=settings({melodyPart:'lead',complexity:1,spicy:0,bars:4});
 const spicy=settings({melodyPart:'lead',complexity:1,spicy:1,bars:4});
 assert.ok(count(high)>count(low));
 assert.ok(count(spicy)>count(high));
 assert.ok(generateMelody(spicy,'melody-lead').every(hit=>hit.baseTick>=0&&hit.baseTick<4*4*960&&hit.synthNote.durationTicks>0));
});

test('every genre produces a distinct phrase at matched tempo without a sustained ascending scale run',()=>{
 const genres=Object.keys(PROFILES);
 for(const part of ['bassline','lead']){
  const phrases=new Set();
  for(const genre of genres){
   const s=settings({genre,bpm:120,bars:4,melodyPart:part,complexity:.8,spicy:.8,seed:'phrase-audit'});
   const output=generateMelody(s,`melody-${part}`);
   phrases.add(output.map(hit=>`${hit.baseTick}:${hit.synthNote.note}`).join('|'));
   const pitches=output.map(hit=>hit.synthNote.note);
   assert.ok(new Set(pitches).size>1,`${genre} ${part} must have pitch movement`);
   for(let index=3;index<pitches.length;index++){
    const fragment=pitches.slice(index-3,index+1);
    assert.ok(!fragment.every((note,i)=>i===0||note>fragment[i-1]&&note-fragment[i-1]<=4),`${genre} ${part} has a four-note ascending scale run`);
   }
   assert.ok(output.some(hit=>hit.reason.includes('motif')),`${genre} ${part} should explain its phrase`);
  }
  assert.equal(phrases.size,genres.length,`${part} profiles should differ in audible notes or rhythm`);
 }
});

test('short scales retain key-safe harmony movement and bassline phrase roots',()=>{
 const s=settings({genre:'liquiddnb',bars:4,melodyPart:'bassline',melodyScale:'minor-pentatonic',seed:'harmony-audit',complexity:.2,spicy:0});
 const output=generateMelody(s,'melody-bassline');
 const firstInBar=Array.from({length:4},(_,bar)=>output.find(hit=>Math.floor(hit.baseTick/(4*960))===bar));
 assert.ok(firstInBar.every(Boolean));
 const pitchClasses=firstInBar.map(hit=>hit.synthNote.note%12);
 assert.ok(new Set(pitchClasses).size>1,'the harmony should move between bars');
 assert.ok(pitchClasses.every(pc=>MELODY_SCALES['minor-pentatonic'].intervals.includes(pc)));
 assert.ok(firstInBar.every(hit=>hit.reason.includes('root')));
});

test('every genre and part commits a valid four-bar composition when details overlap a core step',()=>{
 for(const genre of Object.keys(PROFILES))for(const part of ['bassline','lead']){
  const s=settings({genre,bars:4,generationMode:'melody',melodyPart:part,enabledRoles:[],complexity:.8,spicy:.8});
  const editor=new Editor(generate(settings({genre,bars:4})));
  assert.equal(editor.generateComposition(s),true,`${genre} ${part}`);
  assert.ok(compile(editor.state.pattern).notes.length>0);
  assert.ok(notes(editor.state.pattern,part).length>0);
 }
});

test('three generation modes preserve unrelated layers and regenerate only the chosen melody part',()=>{
 const editor=new Editor(generate(settings()));
 editor.generateComposition(settings());
 const first=structuredClone(editor.state.pattern),bass=generated(first),drums=first.events.filter(hit=>!hit.trackId);
 assert.ok(bass&&notes(first).length&&drums.length);
 editor.generateComposition(settings({generationMode:'drums',seed:'new-drums'}));
 assert.deepEqual(notes(editor.state.pattern),notes(first));
 assert.notDeepEqual(editor.state.pattern.events.filter(hit=>!hit.trackId),drums);
 const beforeMelody=structuredClone(editor.state.pattern.events.filter(hit=>!hit.trackId));
 editor.generateComposition(settings({generationMode:'melody',enabledRoles:[],seed:'new-melody'}));
 assert.deepEqual(editor.state.pattern.events.filter(hit=>!hit.trackId),beforeMelody);
 assert.notDeepEqual(notes(editor.state.pattern),notes(first));
 assert.equal(editor.state.pattern.userTracks.filter(track=>track.generatedPart==='bassline').length,1);
 editor.generateComposition(settings({generationMode:'melody',melodyPart:'lead',enabledRoles:[]}));
 assert.ok(notes(editor.state.pattern,'lead').length);
 assert.ok(notes(editor.state.pattern,'bassline').length);
 assert.deepEqual(editor.state.pattern.events.filter(hit=>!hit.trackId),beforeMelody);
 assert.ok(compile(editor.state.pattern).notes.length>0);
});

test('locked generated notes and user synth tracks survive regeneration, with one undo step',()=>{
 const editor=new Editor(generate(settings()));
 editor.generateComposition(settings());
 const bass=generated(editor.state.pattern),held=structuredClone(notes(editor.state.pattern)[0]);
 editor.state.selection={ids:[held.id],rows:null};editor.toggleSelectedLocks();
 const user={id:'my-pad',name:'My Pad',kind:'synth',role:'percussion',instrument:structuredClone(SYNTH_PRESETS.pad),level:1,pan:0,mute:false,solo:false};
 editor.addUserTrack(user);
 const manual={...held,id:'manual-note',trackId:user.id,synthNote:{note:64,durationTicks:1920}};
 editor.write(manual);
 const before=structuredClone(editor.state.pattern);
 editor.generateComposition(settings({generationMode:'both',seed:'fresh-motif'}));
 assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===held.id),held);
 assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id==='manual-note'),manual);
 assert.equal(editor.state.pattern.userTracks.filter(track=>track.generatedPart==='bassline').length,1);
 assert.equal(editor.undo(),true);
 assert.deepEqual(editor.state.pattern,before);
 assert.equal(editor.redo(),true);
 assert.equal(editor.state.pattern.events.find(hit=>hit.id==='manual-note').synthNote.note,64);
 assert.equal(bass.id,generated(editor.state.pattern).id);
});

test('melody-only projects round-trip and render through the shared WAV path',()=>{
 const s=settings({generationMode:'melody',enabledRoles:[],bars:1,melodyPart:'lead',melodyScale:'dorian'});
 const editor=new Editor(generate(s));editor.generateComposition(s);
 assert.equal(editor.state.pattern.events.filter(hit=>!hit.trackId).length,0);
 const project=makeProject(editor.state,s,defaultKitState(),new Map());
 const restored=readProject(project).project;
 assert.equal(restored.draft.generationMode,'melody');
 assert.equal(restored.editor.pattern.settings.melodyScale,'dorian');
 assert.equal(generated(restored.editor.pattern,'lead').instrument.preset,'pluck');
 const audio=renderPerformance(withDrumKit(restored.editor.pattern,{},defaultKitState()),new Map(),8000,{},{loop:true});
 const wav=encodeWav(audio.channels,audio.sampleRate);
 assert.equal(new TextDecoder().decode(new Uint8Array(wav).slice(0,4)),'RIFF');
 assert.ok(audio.channels[0].some(value=>Math.abs(value)>.001));
 const bank=newBank(restored.editor.pattern);bank.sequence=[{slot:0,repeats:2}];
 const song=renderSequence(arrange(bank),new Map(),8000);
 assert.ok(song.channels[0].some(value=>Math.abs(value)>.001));
});
