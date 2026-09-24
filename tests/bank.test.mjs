import test from 'node:test';import assert from 'node:assert/strict';
import {newBank,arrange,validateBank,songTimeline,songPosition,moveSequenceStep,addPatternSlot,duplicatePatternSlot,deletePatternSlot,slotLabel} from '../dist/core/bank.js';
import {generate} from '../dist/core/generate.js';import {defaults} from '../dist/core/profiles.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';import {defaultKitState} from '../dist/audio/drum-kit.js';

test('bank order, repeats, tempo and independent copies',()=>{
  const p=generate(defaults()),b=newBank(p);
  b.slots[1].editor=structuredClone(b.slots[0].editor);
  b.slots[1].editor.pattern.settings.seed='other';
  b.sequence=[{slot:0,repeats:2},{slot:1,repeats:1}];
  const ps=arrange(b,150);
  assert.deepEqual(ps.map(p=>p.settings.seed),[p.settings.seed,p.settings.seed,'other']);
  assert.ok(ps.every(p=>p.settings.bpm===150));
  ps[0].events[0].gain=0;
  assert.notEqual(b.slots[0].editor.pattern.events[0].gain,0);
  b.sequence[1].slot=2;
  assert.throws(()=>validateBank(b));
});

test('sequence renders full repeated timing with continuous delay and bounded length',()=>{
  const p=generate({...defaults(),bars:1,bpm:240});
  p.events=[{...p.events[0],baseTick:0,offsetTick:0}];
  const fx={kick:{bypass:false,highpass:0,lowpass:20000,drive:0,delayMs:300,feedback:.7,mix:.5}};
  const one=renderPerformance(p,new Map(),8000,fx),two=renderSequence([p,p],new Map(),8000,fx);
  assert.equal(two.duration,2);
  assert.ok(two.channels[0].length>=16000);
  assert.deepEqual(two.channels[0].slice(0,7900),one.channels[0].slice(0,7900));
  assert.throws(()=>renderSequence(Array(171).fill(p),new Map(),8000),/170/);
});

test('bank project roundtrip and legacy compatibility',()=>{
  const p=generate(defaults()),b=newBank(p);
  const project=makeProject(b.slots[0].editor,p.settings,defaultKitState(),new Map(),b);
  assert.deepEqual(readProject(project).project.bank,b);
  delete project.bank;
  assert.equal(readProject(project).project.bank,undefined);
});

test('unlimited pattern bank dynamic add, duplicate, delete and reorder',()=>{
  const p=generate(defaults()),b=newBank(p);
  assert.equal(b.slots.length,4);
  assert.equal(slotLabel(0),'A');
  assert.equal(slotLabel(3),'Fill');
  assert.equal(slotLabel(4),'P5');
  
  // Add new pattern slot
  const idx4=addPatternSlot(b,'Amen Verse');
  assert.equal(idx4,4);
  assert.equal(b.slots.length,5);
  assert.equal(b.slots[4].name,'Amen Verse');
  assert.equal(b.slots[4].editor,null);
  
  // Duplicate active slot
  const idx5=duplicatePatternSlot(b,0);
  assert.equal(idx5,5);
  assert.equal(b.slots.length,6);
  assert.equal(b.slots[5].name,'A (Copy)');
  assert.ok(b.slots[5].editor!==null);
  
  // Arrange works with new slots
  b.sequence.push({slot:5,repeats:1});
  validateBank(b);
  const arranged=arrange(b,165);
  assert.equal(arranged.length,3);
  
  // Delete slot updates active index and sequence
  deletePatternSlot(b,1);
  assert.equal(b.slots.length,5);
  validateBank(b);
  
  // Cannot delete last pattern
  while(b.slots.length>1) deletePatternSlot(b,0);
  assert.equal(b.slots.length,1);
  assert.throws(()=>deletePatternSlot(b,0),/Cannot delete the last pattern/);
});


test('song tempo survives active pattern changes and version 1 projects migrate without mutation',()=>{
 const p=generate(defaults()),b=newBank(p);
 b.songBpm=128.5;
 b.slots[1].editor=structuredClone(b.slots[0].editor);
 b.slots[1].editor.pattern.settings.bpm=200;
 b.active=1;
 assert.equal(arrange(b)[0].settings.bpm,128.5);
 const project=makeProject(b.slots[1].editor,p.settings,defaultKitState(),new Map(),b);
 assert.equal(project.version,2);
 assert.equal(readProject(project).project.bank.songBpm,128.5);
 const legacy=structuredClone(project);legacy.version=1;delete legacy.bank.songBpm;
 const migrated=readProject(legacy).project;
 assert.equal(migrated.version,2);assert.equal(migrated.bank.songBpm,200);
 assert.equal(legacy.version,1);assert.equal(legacy.bank.songBpm,undefined);
 delete legacy.bank;
 assert.equal(readProject(legacy).project.editor.pattern.settings.bpm,200);
 for(const bpm of [null,undefined,NaN,31,1000,'120']){
  const invalid=structuredClone(project);invalid.bank.songBpm=bpm;
  assert.throws(()=>readProject(invalid),/Song BPM/);
 }
});

test('song position follows repeats, different lengths, resolutions and final tails',()=>{
 const b=newBank(generate({...defaults(),bars:1,resolution:16}));b.songBpm=120;
 b.slots[1].editor=structuredClone(b.slots[0].editor);
 b.slots[1].editor.pattern.settings.bars=2;b.slots[1].editor.pattern.settings.resolution=32;
 b.sequence=[{slot:0,repeats:2},{slot:1,repeats:1}];
 const timeline=songTimeline(b);
 assert.deepEqual(timeline.map(e=>[e.start,e.duration,e.lines]),[[0,2,16],[2,2,16],[4,4,64]]);
 assert.equal(songPosition(timeline,1).row,8);
 assert.equal(songPosition(timeline,2).repeat,1);
 assert.equal(songPosition(timeline,4).slot,1);
 assert.equal(songPosition(timeline,7.99).row,63);
 assert.equal(songPosition(timeline,8),undefined);
 assert.equal(songPosition(timeline,-1),undefined);
 const audio=renderSequence(arrange(b),new Map(),8000);
 assert.equal(audio.duration,8);
});

test('tactile and drag reordering retain repeats and reject invalid positions',()=>{
 const b=newBank(generate(defaults()));b.sequence=[{slot:0,repeats:1},{slot:0,repeats:2},{slot:0,repeats:3}];
 moveSequenceStep(b,0,2);assert.deepEqual(b.sequence.map(s=>s.repeats),[2,3,1]);
 moveSequenceStep(b,2,0);assert.deepEqual(b.sequence.map(s=>s.repeats),[1,2,3]);
 const before=structuredClone(b);assert.throws(()=>moveSequenceStep(b,-1,0));assert.deepEqual(b,before);
});
