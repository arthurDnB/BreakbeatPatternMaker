import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {addThinkBreakLayer,THINK_BREAK_ASSET_ID,THINK_BREAK_FRAMES,THINK_BREAK_INSTRUMENT_ID,THINK_VOCAL_INSTRUMENT_ID,THINK_SLICE_FRAMES,THINK_SLICE_ROLES} from '../dist/core/think-break.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';

const off={...defaults('jungle'),seed:'think-layer-test',bars:2,algorithm:'groove-v4'};
const on={...off,breakLayer:'think-passage2'};
const make=()=>{const editor=new Editor(generate(off));editor.generateComposition(on);return editor;};

function bundledAsset(){
  const data=readFileSync(new URL('../public/samples/think-passage2-142x.wav',import.meta.url));
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.readUInt32LE(24),44100);
  const start=data.indexOf(Buffer.from('data'))+8;
  const samples=new Float32Array((data.length-start)/2);
  for(let i=0;i<samples.length;i++)samples[i]=data.readInt16LE(start+2*i)/32768;
  assert.equal(samples.length,THINK_BREAK_FRAMES);
  return {id:THINK_BREAK_ASSET_ID,name:'Think Passage 2 · 1.42x',sampleRate:44100,channels:[samples]};
}

test('Off leaves the original generation unchanged; On adds a separate, valid mapped Think track',()=>{
  const original=new Editor(generate(off));original.generateComposition(off);
  assert.deepEqual(original.state.pattern.events,generate(off).events);
  assert.equal(addThinkBreakLayer(generate(off),generate(off)).events.length,generate(off).events.length);
  const editor=make(),pattern=editor.state.pattern,layer=pattern.userTracks.find(t=>t.generatedBreakLayer==='think-passage2');
  assert.equal(layer.name,'Think Break');
  assert.equal(layer.sample.assetId,THINK_BREAK_ASSET_ID);
  assert.deepEqual(pattern.events.filter(hit=>!hit.trackId),generate(on).events);
  assert.ok(pattern.events.some(hit=>hit.trackId===layer.id&&hit.mapped?.instrumentId===THINK_BREAK_INSTRUMENT_ID));
  assert.ok(pattern.events.some(hit=>hit.trackId===layer.id&&hit.mapped?.instrumentId===THINK_VOCAL_INSTRUMENT_ID));
  assert.equal(pattern.sliceInstruments[0].slices.length,THINK_SLICE_ROLES.length);
  assert.deepEqual(pattern.sliceInstruments[0].slices.map(slice=>slice.startFrame),THINK_SLICE_FRAMES.slice(0,-1));
  assert.ok(compile(pattern).notes.some(note=>note.lane===layer.id));
});

test('same seed is stable, variation changes supporting notes, and slice roles follow their anchors',()=>{
  const a=make(),b=make();
  assert.deepEqual(a.state.pattern,b.state.pattern);
  const mapped=a.state.pattern.events.filter(hit=>hit.mapped?.instrumentId===THINK_BREAK_INSTRUMENT_ID);
  assert.ok(mapped.length>5);
  for(const hit of mapped)assert.equal(THINK_SLICE_ROLES[hit.mapped.note],hit.generatedDrumRole);
  const before=structuredClone(a.state.pattern);
  a.variation();
  assert.equal(a.state.pattern.settings.variation,1);
  assert.notDeepEqual(a.state.pattern.events.filter(hit=>hit.trackId),before.events.filter(hit=>hit.trackId));
  assert.ok(a.undo());assert.deepEqual(a.state.pattern,before);
  assert.ok(a.redo());
});

test('Think slices follow the selected genre grammar rather than a fixed MIDI loop',()=>{
  const jungle=make().state.pattern;
  const hiphopSettings={...defaults('hiphop'),seed:on.seed,bars:on.bars,bpm:on.bpm,algorithm:on.algorithm,breakLayer:'think-passage2'};
  const editor=new Editor(generate({...hiphopSettings,breakLayer:undefined}));
  editor.generateComposition(hiphopSettings);
  const signature=pattern=>pattern.events.filter(hit=>hit.trackId&&hit.mapped?.instrumentId===THINK_BREAK_INSTRUMENT_ID)
    .map(hit=>`${hit.baseTick+hit.offsetTick}:${hit.generatedDrumRole}:${hit.mapped.note}`);
  assert.notDeepEqual(signature(jungle),signature(editor.state.pattern));
  assert.ok(signature(jungle).length>0&&signature(editor.state.pattern).length>0);
});

test('manual and locked Think hits survive regeneration; Off removes generated slices in one undo step',()=>{
  const editor=make(),track=editor.state.pattern.userTracks[0];
  const held=structuredClone(editor.state.pattern.events.find(hit=>hit.trackId===track.id&&hit.mapped?.instrumentId===THINK_BREAK_INSTRUMENT_ID));
  editor.state.lockedIds.push(held.id);
  const manual={...held,id:'manual-think-accent',baseTick:1430,anchor:false};
  delete manual.generatedDrumRole;
  editor.write(manual);
  editor.generateComposition({...on,variation:2});
  assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===held.id),held);
  assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===manual.id),manual);
  const before=structuredClone(editor.state.pattern);
  editor.generateComposition({...off,variation:3});
  assert.ok(editor.state.pattern.events.some(hit=>hit.id===manual.id));
  assert.ok(editor.state.pattern.events.some(hit=>hit.id===held.id));
  assert.ok(editor.undo());assert.deepEqual(editor.state.pattern,before);
});

test('edited Think slice boundaries remain available after the layer is switched off and on',()=>{
  const editor=make(),original=editor.state.pattern.sliceInstruments.find(item=>item.id===THINK_BREAK_INSTRUMENT_ID);
  const adjusted=structuredClone(original);adjusted.slices[0].endFrame+=12;adjusted.slices[1].startFrame+=12;
  editor.updateSliceInstrument(adjusted);
  editor.generateComposition(off);
  assert.equal(editor.state.pattern.userTracks?.filter(track=>track.generatedBreakLayer==='think-passage2').length??0,0);
  assert.deepEqual(editor.state.pattern.sliceInstruments.find(item=>item.id===THINK_BREAK_INSTRUMENT_ID),adjusted);
  editor.generateComposition(on);
  assert.deepEqual(editor.state.pattern.sliceInstruments.find(item=>item.id===THINK_BREAK_INSTRUMENT_ID),adjusted);
});

test('mapped Think PCM survives project roundtrip and the shared renderer produces the same Preview/WAV frames',()=>{
  const editor=make(),asset=bundledAsset(),assets=new Map([[asset.id,asset]]),kit=defaultKitState();
  const initial=renderPerformance(withDrumKit(editor.state.pattern,{},kit),assets,22050,{}, {loop:true});
  assert.ok(initial.channels[0].some(sample=>Math.abs(sample)>.01));
  const saved=makeProject(editor.state,on,kit,assets),loaded=readProject(saved);
  assert.equal(saved.version,5);
  assert.equal(loaded.assets.get(asset.id).channels[0].length,THINK_BREAK_FRAMES);
  assert.deepEqual(loaded.project.editor.pattern,editor.state.pattern);
  const reopened=renderPerformance(withDrumKit(loaded.project.editor.pattern,{},kit),loaded.assets,22050,{}, {loop:true});
  assert.deepEqual(reopened.channels,initial.channels);
});
