import test from 'node:test';
import assert from 'node:assert/strict';
import {velocityLayerMix,withDrumKit,defaultKitState} from '../dist/audio/drum-kit.js';
import {KIT_PRESETS} from '../dist/audio/library.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {Editor} from '../dist/core/editor.js';
import {defaults} from '../dist/core/profiles.js';

const RATE=8000;
const ids={soft:'acoustic-kick-muted',medium:'acoustic-kick-clean',accent:'acoustic-kick-punch'};
const rates={soft:8000,medium:12000,accent:16000};
const levels={soft:.1,medium:.2,accent:.3};
const ref=(id,rate,frames)=>({assetId:'library-'+id,startFrame:0,endFrame:frames,sampleRate:rate,label:id});
function fixture(velocity=.6){
  const assets=new Map(),layers={};
  for(const band of ['soft','medium','accent']){
    const id=ids[band],rate=rates[band],frames=Math.round(rate*.2);
    assets.set('library-'+id,{id:'library-'+id,name:id,sampleRate:rate,channels:[new Float32Array(frames).fill(levels[band])]});
    layers[band]={choice:id,level:1,slice:ref(id,rate,frames)};
  }
  const hit={id:'kick',role:'kick',sourceId:'kit.kick',baseTick:0,offsetTick:0,gain:velocity,pan:0,anchor:false,ghost:false,reason:'Velocity test'};
  const pattern={engineVersion:'0.5.0',ppq:960,settings:{...defaults(),algorithm:'groove-v5',bars:1,bpm:120},events:[hit]};
  const mix=defaultKitState();mix.kick.choice=ids.accent;mix.kick.assetId='library-'+ids.accent;mix.kick.velocityLayers=layers;
  return {assets,layers,hit,pattern,mix,kit:{kick:layers.accent.slice}};
}

test('Acoustic Break provides valid kick and snare velocity families',()=>{
  const preset=KIT_PRESETS.find(item=>item.id==='acoustic-break');
  assert.ok(preset?.velocityLayers?.kick&&preset.velocityLayers.snare);
  assert.equal(preset.velocityLayers.snare.soft,'acoustic-snare-soft');
  assert.equal(preset.velocityLayerLevels.snare.soft,3.2);
});

test('saved pre-fader velocity selects soft, medium, and accent samples',()=>{
  for(const [velocity,band] of [[.2,'soft'],[.6,'medium'],[.95,'accent']]){
    const {pattern,kit,mix}=fixture(velocity),before=structuredClone(pattern);
    mix.kick.level=.3;
    const notes=withDrumKit(pattern,kit,mix).events;
    assert.equal(notes.length,1);
    assert.equal(notes[0].slice.assetId,'library-'+ids[band]);
    assert.ok(Math.abs(notes[0].gain-velocity*.3)<1e-9);
    assert.deepEqual(pattern,before,'render preparation must not change saved hits');
  }
});

test('adjacent layers crossfade continuously near each threshold',()=>{
  for(const [threshold,bands] of [[.45,['soft','medium']],[.80,['medium','accent']]]){
    const {pattern,kit,mix}=fixture(threshold);
    const voices=withDrumKit(pattern,kit,mix).events;
    assert.deepEqual(voices.map(note=>note.slice.assetId),bands.map(band=>'library-'+ids[band]));
    assert.equal(voices.length,2);
    assert.ok(Math.abs(voices.reduce((sum,note)=>sum+note.gain,0)-threshold)<1e-9);
    assert.equal(voices[1].layerOf,pattern.events[0].id,'crossfaded voices share the choke group');
    const justBelow=velocityLayerMix(threshold-.0001),justAbove=velocityLayerMix(threshold+.0001);
    assert.ok(Math.abs(justBelow[0].weight-justAbove[0].weight)<.01);
  }
});

test('single shots, user uploads, explicit slices, and trims retain the old source',()=>{
  const {pattern,kit,mix,layers}=fixture(.2);
  delete mix.kick.velocityLayers;
  assert.equal(withDrumKit(pattern,kit,mix).events[0].slice.assetId,layers.accent.slice.assetId);
  mix.kick.choice='upload';mix.kick.assetId='my-upload';
  const upload={...layers.accent.slice,assetId:'my-upload'};
  assert.equal(withDrumKit(pattern,{kick:upload},mix).events[0].slice.assetId,'my-upload');
  mix.kick.velocityLayers=layers;
  pattern.events[0].slice={...layers.medium.slice};
  assert.equal(withDrumKit(pattern,kit,mix).events[0].slice.assetId,layers.medium.slice.assetId);
  delete pattern.events[0].slice;
  pattern.events[0].sampleTrim={startMs:10,endMs:80};
  assert.equal(withDrumKit(pattern,kit,mix).events[0].slice.assetId,layers.accent.slice.assetId);
  delete pattern.events[0].sampleTrim;
  pattern.events[0].trackId='uploaded-track';
  pattern.userTracks=[{id:'uploaded-track',name:'My kick',role:'kick',level:1,pan:0,mute:false,solo:false,sample:upload}];
  assert.equal(withDrumKit(pattern,kit,mix).events[0].slice.assetId,'my-upload');
});

test('layered voices retain the independent user-added second sound',()=>{
  const {pattern,kit,mix,layers}=fixture(.45);
  mix.kick.layer={choice:ids.accent,slice:layers.accent.slice,level:.5,offsetMs:0,phaseInvert:false};
  const notes=withDrumKit(pattern,kit,mix).events;
  assert.equal(notes.length,3);
  assert.equal(notes.filter(note=>note.reason.startsWith('Layer:')).length,1);
  assert.ok(notes.every(note=>(note.layerOf??note.id)===pattern.events[0].id));
});

test('soft snare level matching remains render-only and keeps saved velocity valid',()=>{
  const preset=KIT_PRESETS.find(item=>item.id==='acoustic-break');
  const ids=preset.velocityLayers.snare,mix=defaultKitState(),assets=new Map(),layers={};
  for(const band of ['soft','medium','accent']){
    const id='library-'+ids[band],data=new Float32Array(1600).fill(band==='soft'?.03:.12);
    assets.set(id,{id,name:id,sampleRate:RATE,channels:[data]});
    layers[band]={choice:ids[band],slice:ref(ids[band],RATE,data.length),level:preset.velocityLayerLevels.snare[band]??1};
  }
  mix.snare.choice=ids.medium;mix.snare.assetId='library-'+ids.medium;mix.snare.velocityLayers=layers;
  const hit={id:'ghost',role:'snare',sourceId:'kit.snare',baseTick:0,offsetTick:0,gain:.4,pan:0,anchor:false,ghost:true,reason:'Soft snare'};
  const pattern={engineVersion:'0.5.0',ppq:960,settings:{...defaults(),algorithm:'groove-v5',bars:1,bpm:120},events:[hit]};
  const prepared=withDrumKit(pattern,{snare:layers.medium.slice},mix);
  assert.equal(prepared.events[0].gain,.4);
  assert.ok(prepared.events[0].renderGain>1);
  const output=renderPerformance(prepared,assets,RATE,{}, {loop:true}).channels[0];
  assert.ok(output.some(value=>Math.abs(value)>.01));
  assert.equal(pattern.events[0].renderGain,undefined);
});

test('sample-rate conversion, pitch, crossfade, and kick choke produce finite sound',()=>{
  const {pattern,kit,mix,assets}=fixture(.45);
  pattern.events[0].pitch=7;
  const preview=renderPerformance(withDrumKit(pattern,kit,mix),assets,RATE,{}, {loop:true});
  assert.ok(preview.channels[0].some(value=>Math.abs(value)>.005));
  assert.ok(preview.channels.every(channel=>channel.every(Number.isFinite)));
  const wavRender=renderSequence([withDrumKit(pattern,kit,mix)],assets,RATE,{}, {loop:true});
  assert.deepEqual(preview.channels,wavRender.channels,'preview and export share the resolved voices');
  const repeated=structuredClone(pattern);repeated.events.push({...pattern.events[0],id:'next-kick',baseTick:120,gain:.95});
  const combined=renderPerformance(withDrumKit(repeated,kit,mix),assets,RATE,{}, {loop:true}).channels[0];
  const second={...pattern,events:[{...pattern.events[0],id:'next-kick',baseTick:120,gain:.95}]};
  const isolated=renderPerformance(withDrumKit(second,kit,mix),assets,RATE,{}, {loop:true}).channels[0];
  for(let frame=800;frame<1000;frame++)assert.ok(Math.abs(combined[frame]-isolated[frame])<1e-5,'new kick chokes both prior velocity voices');
});

test('velocity samples roundtrip with projects and old kits render unchanged',()=>{
  const {pattern,kit,mix,assets}=fixture(.6);
  const saved=makeProject(new Editor(pattern).state,pattern.settings,mix,assets);
  assert.equal(saved.assets.length,3);
  const restored=readProject(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.project.kit.kick.velocityLayers.medium.choice,ids.medium);
  const reopened=renderPerformance(withDrumKit(restored.project.editor.pattern,kit,restored.project.kit),restored.assets,RATE,{}, {loop:true});
  const original=renderPerformance(withDrumKit(pattern,kit,mix),assets,RATE,{}, {loop:true});
  assert.deepEqual(reopened.channels,original.channels);
  const old=structuredClone(saved);delete old.kit.kick.velocityLayers;old.assets=old.assets.filter(asset=>asset.id==='library-'+ids.accent);
  const oldProject=readProject(old);
  assert.equal(withDrumKit(oldProject.project.editor.pattern,kit,oldProject.project.kit).events[0].slice.assetId,'library-'+ids.accent);
  const broken=structuredClone(saved);broken.kit.kick.velocityLayers.soft.level=Infinity;
  assert.throws(()=>readProject(broken),/velocity layer/);
});
