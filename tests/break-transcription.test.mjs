import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeBreak} from '../dist/audio/break-analysis.js';
import {transcribeBreak} from '../dist/audio/slices.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {defaults} from '../dist/core/profiles.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {resolveSlice} from '../dist/core/slice-instrument.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {newBank,addPatternSlot,rememberPattern} from '../dist/core/bank.js';

const asset=(rate=44100)=>({id:'test-break',name:'Test break',sampleRate:rate,channels:[Float32Array.from({length:rate*2},(_,i)=>.9*Math.sin(i*.063)),Float32Array.from({length:rate*2},(_,i)=>-.8*Math.sin(i*.081))]});
const pattern=a=>transcribeBreak(a,[77,413,4410,10003,a.channels[0].length-13],{...defaults(),bars:1});
test('dry mapped reconstruction retains every source frame, stereo and loud transients across all engines',()=>{
  for(const rate of [22050,44100,48000])for(const algorithm of ['legacy-v1','groove-v2','groove-v3','groove-v4']){
    const a=asset(rate),p=pattern(a);p.settings.algorithm=algorithm;
    const audio=renderPerformance(p,new Map([[a.id,a]]),rate,{}, {loop:true});
    assert.equal(audio.channels[0].length,a.channels[0].length-90);
    for(let c=0;c<2;c++){let error=0;for(let i=0;i<audio.channels[c].length;i++)error=Math.max(error,Math.abs(audio.channels[c][i]-a.channels[c][i+77]));assert.ok(error<=1e-5,`${algorithm} ${rate}: ${error}`);}
  }
});
test('mapped note selection is independent of pitch, undoable, and respects locks',()=>{
  const a=asset(),e=new Editor(pattern(a)),id=e.state.pattern.events[0].id;
  e.write({...e.state.pattern.events[0],pitch:7},id);e.editTrackerValue(id,'note',2);
  assert.equal(e.state.pattern.events.find(h=>h.id===id).pitch,7);assert.equal(resolveSlice(e.state.pattern,e.state.pattern.events.find(h=>h.id===id)).startFrame,4410);
  e.undo();assert.equal(e.state.pattern.events.find(h=>h.id===id).mapped.note,0);e.redo();
  e.toggleRole('percussion');assert.throws(()=>e.editTrackerValue(id,'note',1),/Unlock/);
  assert.throws(()=>compile({...e.state.pattern,events:[{...e.state.pattern.events[0],mapped:{instrumentId:'missing',note:0}}]}),/Missing/);
});
test('slice movement, missing referenced slices, history and locked mappings',()=>{
  const e=new Editor(pattern(asset())),updated=structuredClone(e.state.pattern.sliceInstruments[0]);updated.slices[0].endFrame+=12;updated.slices[1].startFrame+=12;
  e.updateSliceInstrument(updated);assert.equal(e.state.pattern.sliceInstruments[0].slices[1].startFrame,425);e.undo();assert.equal(e.state.pattern.sliceInstruments[0].slices[1].startFrame,413);e.redo();
  e.toggleRole('percussion');const moved=structuredClone(updated);moved.slices[0].endFrame++;moved.slices[1].startFrame++;assert.throws(()=>e.updateSliceInstrument(moved),/Unlock/);
});
test('cross-pattern clipboard includes mappings, same-row hits survive and move preserves mapping',()=>{
  const p=pattern(asset()),e=new Editor(p);e.state.selection={ids:[],rows:null,cells:Array.from({length:64},(_,row)=>({row,lane:"percussion"}))};const clip=e.copySelection();
  const target=new Editor({...p,events:[],sliceInstruments:undefined});target.pasteCells(clip,0,'percussion');assert.equal(target.state.pattern.events.length,4);assert.ok(target.state.pattern.sliceInstruments.length);
  assert.ok(compile(target.state.pattern).notes.some(n=>n.column>0));target.state.selection={ids:[],rows:null,cells:[{row:0,lane:'percussion'}]};target.moveCells(target.state.selection.cells,1,'hat');assert.ok(target.state.pattern.events.filter(h=>h.role==='hat').every(h=>h.mapped));target.undo();
});
test('version 4 projects retain unused slices, bank/history audio and reject missing PCM',()=>{
  const a=asset(),p=pattern(a),editor=new Editor(p),bank=newBank(p);rememberPattern(bank.slots[0],editor.state,'Original');addPatternSlot(bank,'Break copy',editor.state);
  const project=makeProject(editor.state,p.settings,defaultKitState(),new Map([[a.id,a]]),bank);assert.equal(project.version,4);
  const loaded=readProject(JSON.parse(JSON.stringify(project)));assert.deepEqual(loaded.project.editor,editor.state);assert.deepEqual(loaded.project.bank,bank);
  const missing=structuredClone(project);missing.assets=[];assert.throws(()=>readProject(missing),/Missing/);
  const empty=new Editor({...p,events:[]});assert.equal(makeProject(empty.state,p.settings,defaultKitState(),new Map([[a.id,a]])).assets.length,1);
});
test('default mix, song rendering, and duplicate loops preserve mapped audio',()=>{
  const a=asset(),p=pattern(a),assets=new Map([[a.id,a]]),mix=defaultKitState();const dry=renderPerformance(p,assets,a.sampleRate,{}, {loop:true});
  const prepared=renderPerformance(withDrumKit(p,{},mix),assets,a.sampleRate,{}, {loop:true});assert.deepEqual(prepared.channels,dry.channels);
  const song=renderSequence([p,p],assets,a.sampleRate,{}, {loop:true});assert.equal(song.channels[0].length,2*dry.channels[0].length);
  assert.deepEqual(song.channels[0].slice(0,dry.channels[0].length),dry.channels[0]);
});
test('analysis is deterministic, phase-safe, cancellable worker input friendly, and preserves manual markers',()=>{
  const rate=44100,c=new Float32Array(rate);for(const at of [.1,.3,.55,.8])for(let i=0;i<1800;i++)c[Math.round(at*rate)+i]=Math.sin(i*.19)*Math.exp(-i/350);
  const options={sensitivity:.5,minGapMs:25,startFrame:0,endFrame:rate,manualMarkers:[1234]};
  const result=analyzeBreak([c,Float32Array.from(c,v=>-v)],rate,options);assert.deepEqual(result,analyzeBreak([c,Float32Array.from(c,v=>-v)],rate,options));assert.ok(result.markers.includes(1234));
  for(const at of [.1,.3,.55,.8])assert.ok(result.markers.some(f=>Math.abs(f/rate-at)<.01));
  assert.deepEqual(analyzeBreak([new Float32Array(rate)],rate,{...options,manualMarkers:[]}).markers,[0,rate]);
  assert.throws(()=>analyzeBreak([c],rate,{...options,sensitivity:NaN}),/Invalid/);
  assert.throws(()=>transcribeBreak(asset(),Array.from({length:122},(_,i)=>i),defaults()),/120/);
});
test('song patterns retain independent loop smoothing for the same instrument ID',()=>{
  const a=asset(),first=pattern(a),second=structuredClone(first),length=a.channels[0].length-90;
  second.sliceInstruments[0].loopFadeMs=5;
  const song=renderSequence([first,second],new Map([[a.id,a]]),a.sampleRate,{}, {loop:true});
  assert.ok(Math.abs(song.channels[0][0])>.1);assert.equal(song.channels[0][length],0);assert.equal(song.channels[0].at(-1),0);
  assert.ok(song.channels.every(c=>c.every(Number.isFinite)));
});
test('moving a mapped instrument to a drum lane does not introduce automatic drum chokes',()=>{
  const a=asset(),p=pattern(a);p.events=p.events.map(h=>({...h,role:'hat',sourceId:'kit.hat'}));
  const audio=renderPerformance(p,new Map([[a.id,a]]),a.sampleRate,{}, {loop:true});
  for(let i=0;i<audio.channels[0].length;i++)assert.ok(Math.abs(audio.channels[0][i]-a.channels[0][i+77])<1e-5);
});
