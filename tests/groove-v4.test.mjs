import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {V4_PROFILES} from '../dist/core/groove-v4-profiles.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';

const genres=Object.keys(PROFILES);
const config=(genre,overrides={})=>({...genreDefaults(genre),algorithm:'groove-v4',bars:2,seed:'v4-test',...overrides});
const anchors=pattern=>pattern.events.filter(hit=>hit.anchor);

test('Groove V4 profiles cover all 38 genres and produce deterministic bounded patterns',()=>{
 assert.deepEqual(Object.keys(V4_PROFILES).sort(),genres.sort());
 for(const genre of genres)for(const resolution of [8,16,32,64])for(const seed of ['one','two']){
  const settings=config(genre,{resolution,seed,complexity:.82,spicy:.75});
  const original=structuredClone(settings),pattern=generate(settings);
  assert.deepEqual(settings,original);
  assert.deepEqual(pattern,generate(settings));
  assert.equal(pattern.settings.algorithm,'groove-v4');
  assert.equal(compile(pattern).notes.length,pattern.events.length,genre);
  assert.ok(pattern.events.every(hit=>hit.baseTick+hit.offsetTick>=0&&hit.baseTick+hit.offsetTick<pattern.settings.bars*3840),genre);
 }
});

test('Complexity adds genre notes while Spicy articulates them without changing protected anchors',()=>{
 for(const genre of genres){
  const low=generate(config(genre,{complexity:0,spicy:0,fillAmount:0}));
  const detailed=generate(config(genre,{complexity:1,spicy:0,fillAmount:0}));
  const expressive=generate(config(genre,{complexity:1,spicy:1,fillAmount:0}));
  assert.deepEqual(anchors(low),anchors(detailed),genre+' Complexity moved the spine');
  assert.deepEqual(anchors(detailed),anchors(expressive),genre+' Spicy moved the spine');
  assert.ok(detailed.events.length>low.events.length,genre+' Complexity did not add detail');
  assert.deepEqual(detailed.events.map(hit=>[hit.id,hit.role,hit.baseTick]),expressive.events.map(hit=>[hit.id,hit.role,hit.baseTick]),genre+' Spicy changed the note inventory');
  assert.notDeepEqual(detailed.events,expressive.events,genre+' Spicy did not change any hit');
 }
});

test('The 38 genre grammars differ at matched tempo and phrase context directs changes',()=>{
 const signatures=new Set();
 for(const genre of genres){
  const pattern=generate(config(genre,{bpm:160,bars:2,complexity:.8,spicy:0,fillAmount:0}));
  signatures.add(JSON.stringify(pattern.events.map(hit=>[hit.role,hit.baseTick,hit.offsetTick,hit.ghost])));
 }
 assert.equal(signatures.size,38);
 const first=generate(config('jungle',{bars:1,phraseLength:4,phraseOffset:0,fillAmount:1,complexity:1,spicy:0}));
 const last=generate(config('jungle',{bars:1,phraseLength:4,phraseOffset:3,fillAmount:1,complexity:1,spicy:0}));
 assert.ok(last.events.length>first.events.length);
});

test('Editor variation, locks, selected fill, Undo and project save retain Groove V4',()=>{
 const editor=new Editor(generate(config('amenscience',{complexity:.85,spicy:.8})));
 editor.toggleRole('kick');
 const before=structuredClone(editor.state),kicks=before.pattern.events.filter(hit=>hit.role==='kick');
 assert.ok(editor.variation());
 assert.equal(editor.state.pattern.settings.algorithm,'groove-v4');
 assert.deepEqual(editor.state.pattern.events.filter(hit=>hit.role==='kick'),kicks);
 editor.state.selection.rows=[editor.state.pattern.settings.resolution*2-4,editor.state.pattern.settings.resolution*2-1];
 editor.fill();compile(editor.state.pattern);
 const changed=structuredClone(editor.state);
 assert.ok(editor.undo());assert.ok(editor.redo());assert.deepEqual(editor.state,changed);
 const project=makeProject(editor.state,editor.state.pattern.settings,defaultKitState(),new Map());
 const restored=readProject(project).project;
 assert.equal(restored.version,3);
 assert.deepEqual(restored.editor,editor.state);
});

test('Explicit groove, fill, roll and build structures remain valid at fast tempos',()=>{
 for(const genre of genres)for(const patternStructure of ['groove','auto','fill','roll','build']){
  const settings=config(genre,{bpm:220,bars:2,complexity:1,spicy:1,patternStructure});
  const pattern=generate(settings);
  compile(pattern);
  assert.ok(pattern.events.every(hit=>!hit.articulation||hit.baseTick+hit.offsetTick+hit.articulation.durationTicks<=settings.bars*3840||hit.articulation.mode==='natural'),genre+'/'+patternStructure);
  if(patternStructure==='build')assert.ok(pattern.events.some(hit=>hit.id.endsWith('-roll')),genre);
 }
 const base=config('amenscience',{resolution:64,complexity:.8,spicy:0,patternStructure:'build'});
 assert.notDeepEqual(generate(base).events,generate({...base,spicy:1}).events);
 const singleBeat=config('breakcore',{complexity:0,spicy:0});
 const editor=new Editor(generate(singleBeat));editor.state.selection.rows=[12,15];
 assert.ok(editor.fill(),'Selected one-beat fill should not disappear at low Complexity');
});

test('Groove V4 uses the shared audio voice path for Preview and WAV rendering',()=>{
 const pattern=generate(config('breakcore',{bars:1,complexity:1,spicy:1,patternStructure:'auto'}));
 const mixed=withDrumKit(pattern,{},defaultKitState());
 const audio=renderPerformance(mixed,new Map(),8000,{}, {loop:true});
 assert.equal(audio.channels[0].length,Math.round(pattern.settings.bars*240/pattern.settings.bpm*8000));
 assert.ok(audio.channels.some(channel=>channel.some(sample=>Math.abs(sample)>.01)));
 assert.ok(audio.channels.every(channel=>channel.every(Number.isFinite)));
});

test('V4 chop gestures carry advancing source offsets into the shared renderer',()=>{
 const pattern=generate(config('breakcore',{bars:1,complexity:1,spicy:1,seed:'chop-0'}));
 const chops=pattern.events.filter(hit=>hit.articulation?.mode==='chop');
 assert.ok(chops.length>0);
 for(const hit of chops){
  const offsets=hit.articulation.repeats.map(repeat=>repeat.sourceOffset);
  assert.ok(offsets.every((offset,index)=>index===0||offset>offsets[index-1]));
  assert.ok(offsets.every(offset=>offset>=0&&offset<1));
 }
 const audio=renderPerformance(withDrumKit(pattern,{},defaultKitState()),new Map(),8000,{}, {loop:true});
 assert.ok(audio.channels.every(channel=>channel.every(Number.isFinite)));
});
