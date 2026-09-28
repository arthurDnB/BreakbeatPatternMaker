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
