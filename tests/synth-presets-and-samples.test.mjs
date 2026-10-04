import test from 'node:test';
import assert from 'node:assert/strict';
import {SYNTH_PRESETS,SYNTH_PRESET_CATALOG,validateSynthInstrument,renderSynthNote,renderSampledPianoNote} from '../dist/audio/synth-instrument.js';
import {starterPatch,validateSynthPatch,renderModularSynthNote} from '../dist/audio/modular-synth.js';
import {Editor} from '../dist/core/editor.js';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';

test('all categorized synth presets in SYNTH_PRESET_CATALOG validate successfully',()=>{
  const categories=['Bass','Lead','Pad','Keys & Pluck','FX'];
  for(const [key,def] of Object.entries(SYNTH_PRESET_CATALOG)){
    assert.ok(categories.includes(def.category),`${key} must have a valid category`);
    assert.ok(def.name && typeof def.name==='string');
    assert.ok(def.lowpassHz>=100 && def.lowpassHz<=20000);
    assert.ok(def.attack>=0.001 && def.attack<=2);
    assert.ok(def.decay>=0.001 && def.decay<=3);
    assert.ok(def.sustain>=0 && def.sustain<=1);
    assert.ok(def.release>=0.01 && def.release<=4);
    assert.ok(['sine','triangle','saw','square'].includes(def.waveform));

    const instrument=SYNTH_PRESETS[key];
    assert.ok(instrument,`SYNTH_PRESETS must contain ${key}`);
    assert.doesNotThrow(()=>validateSynthInstrument(instrument),`${key} must pass validation`);
  }
  assert.ok(Object.keys(SYNTH_PRESET_CATALOG).length>=20,'should have at least 20 presets across categories');
});

test('simple synth renders deterministic audio across all presets',()=>{
  for(const key of Object.keys(SYNTH_PRESETS)){
    const instrument=SYNTH_PRESETS[key];
    const audio=renderSynthNote(48,0.25,12000,instrument);
    assert.ok(audio.length>0);
    assert.ok(audio.every(Number.isFinite));
    assert.ok(audio.some(val=>Math.abs(val)>0.001),`${key} should produce audible sound`);
  }
});

test('any synth preset (Bass, Lead, Pad, etc.) can load a WAV sample and transpose notes',()=>{
  const rate=24000,length=rate;
  const channel=Float32Array.from({length},(_,i)=>Math.sin(2*Math.PI*55*i/rate)*Math.exp(-i/rate*2));
  const bassAsset={id:'bass-sub-shot',name:'Sub Bass A1.wav',sampleRate:rate,channels:[channel,channel]};

  for(const preset of ['bass','reese','acid303','sub808','supersaw','lush-pad']){
    const instrument={...SYNTH_PRESETS[preset],sample:{assetId:bassAsset.id,rootNote:36}};
    assert.doesNotThrow(()=>validateSynthInstrument(instrument));

    const rendered=renderSampledPianoNote(36,0.5,rate,instrument,bassAsset);
    assert.equal(rendered.length,2);
    assert.ok(rendered[0].some(v=>Math.abs(v)>0.05));

    const transposed=renderSampledPianoNote(48,0.5,rate,instrument,bassAsset);
    assert.equal(transposed.length,2);
    assert.notDeepEqual(rendered[0],transposed[0],'higher note must transpose sample pitch');
  }

  const badAssetId={...SYNTH_PRESETS.bass,sample:{assetId:'invalid/name!',rootNote:36}};
  assert.throws(()=>validateSynthInstrument(badAssetId),/Invalid synth sample/);

  const badRoot={...SYNTH_PRESETS.bass,sample:{assetId:'valid-bass',rootNote:140}};
  assert.throws(()=>validateSynthInstrument(badRoot),/synth sample root/);
});

test('modular starter patches initialize cleanly for new presets',()=>{
  for(const preset of ['reese','sub808','acid303','supersaw','lush-pad','house-organ']){
    const patch=starterPatch(preset);
    const order=validateSynthPatch(patch);
    assert.equal(order.at(-1).type,'output');

    const audio=renderModularSynthNote(48,0.2,12000,patch);
    assert.ok(audio.length>0);
    assert.ok(audio.every(Number.isFinite));
    assert.ok(audio.some(v=>Math.abs(v)>0.01));
  }
});

test('bass synth track with uploaded WAV persists and roundtrips in project file',()=>{
  const rate=24000;
  const channel=Float32Array.from({length:rate},(_,i)=>Math.sin(2*Math.PI*65.4*i/rate)*Math.exp(-i/rate*2.5));
  const asset={id:'user-bass-sample',name:'808 Sub C2.wav',sampleRate:rate,channels:[channel,channel]};
  const s=defaults();
  const editor=new Editor(generate(s));

  editor.generateComposition({...s,generationMode:'melody',melodyPart:'bassline'},'Generate Bassline');
  const bassTrack=editor.state.pattern.userTracks.find(t=>t.generatedPart==='bassline');
  assert.ok(bassTrack);

  const instrument={...SYNTH_PRESETS.sub808,sample:{assetId:asset.id,rootNote:36}};
  editor.setSynthInstrument(bassTrack.id,instrument);

  const assets=new Map([[asset.id,asset]]);
  const originalAudio=renderPerformance(editor.state.pattern,assets,rate);

  const saved=makeProject(editor.state,s,defaultKitState(),assets);
  assert.ok([8,9].includes(saved.version),'project should be saved with sample support');

  const restored=readProject(saved);
  const restoredTrack=restored.project.editor.pattern.userTracks.find(t=>t.id===bassTrack.id);
  assert.ok(restoredTrack.instrument.sample);
  assert.equal(restoredTrack.instrument.sample.assetId,asset.id);
  assert.equal(restoredTrack.instrument.sample.rootNote,36);

  const restoredAudio=renderPerformance(restored.project.editor.pattern,restored.assets,rate);
  assert.deepEqual(restoredAudio.channels,originalAudio.channels,'audio rendering must match exactly after restore');
});
