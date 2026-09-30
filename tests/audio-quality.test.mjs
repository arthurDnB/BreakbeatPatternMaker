import test from 'node:test';
import assert from 'node:assert/strict';
import {measureAudioQuality,protectMaster,assessLayerMono} from '../dist/audio/audio-quality.js';
import {stretchAudio} from '../dist/audio/time-stretch.js';
import {defaults} from '../dist/core/profiles.js';
import {withDrumKit,defaultKitState} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {encodeWav} from '../dist/audio/wav.js';

const rate=12000;
const sine=(frequency,frames)=>Float32Array.from({length:frames},(_,i)=>.3*Math.sin(2*Math.PI*frequency*i/rate));
function frequency(channel){let crossings=0;for(let i=1;i<channel.length;i++)if(channel[i-1]<=0&&channel[i]>0)crossings++;return crossings*rate/channel.length;}

test('pitch-preserving speed changes duration while repitch changes frequency',()=>{
  const source=sine(220,rate*2),original=source.slice();
  for(const speed of [.5,1.5,2]){
    const output=stretchAudio([source,Float32Array.from(source,v=>-v)],rate,speed);
    assert.ok(Math.abs(output[0].length-source.length/speed)<=1);
    assert.ok(Math.abs(frequency(output[0])-220)<12,`frequency at ${speed}×`);
    assert.ok(output[0].every(Number.isFinite));
    assert.ok(output[0].every((v,i)=>Math.abs(v+output[1][i])<1e-6),'stereo channels share alignment');
  }
  assert.deepEqual(source,original);
  assert.deepEqual(stretchAudio([source],rate,1)[0],source);
  assert.throws(()=>stretchAudio([source],rate,3),/0.5/);
});

test('lane stretch survives shared playback rendering without changing the source',()=>{
  const samples=sine(220,rate),asset={id:'tone',name:'Tone',sampleRate:rate,channels:[samples]};
  const hit={id:'tone-hit',role:'percussion',sourceId:'kit.percussion',baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Quality test'};
  const pattern={engineVersion:'0.3.0',ppq:960,settings:{...defaults(),algorithm:'groove-v4',bars:1,bpm:120},events:[hit]};
  const kit={percussion:{assetId:asset.id,startFrame:0,endFrame:samples.length,sampleRate:rate,label:asset.name}},mix=defaultKitState();
  mix.percussion.playbackRate=2;mix.percussion.speedMode='stretch';
  const rendered=withDrumKit(pattern,kit,mix);
  assert.equal(rendered.events[0].stretchRate,2);assert.equal(rendered.events[0].playbackRate,1);
  const output=renderPerformance(rendered,new Map([[asset.id,asset]]),rate).channels[0];
  assert.ok(Math.abs(frequency(output.slice(0,rate/2))-220)<12);
  assert.deepEqual(samples,asset.channels[0]);
  mix.percussion.speedMode='repitch';assert.equal(withDrumKit(pattern,kit,mix).events[0].playbackRate,2);
});

test('per-hit trim and speed mode share render, undo, and project storage',()=>{
  const samples=sine(220,rate),asset={id:'trim-tone',name:'Trim tone',sampleRate:rate,channels:[samples]};
  const slice={assetId:asset.id,startFrame:0,endFrame:samples.length,sampleRate:rate,label:asset.name};
  const hit={id:'trim-hit',role:'percussion',sourceId:'kit.percussion',baseTick:0,offsetTick:0,gain:.5,pan:0,anchor:false,ghost:false,reason:'Trim test',slice,sampleTrim:{startMs:100,endMs:500},playbackRate:1.5,speedMode:'stretch'};
  const pattern={engineVersion:'0.3.0',ppq:960,settings:{...defaults(),algorithm:'groove-v4',bars:1,bpm:120},events:[hit]};
  const kit={percussion:slice},mix=defaultKitState(),assets=new Map([[asset.id,asset]]);
  const prepared=withDrumKit(pattern,kit,mix);
  assert.equal(prepared.events[0].stretchRate,1.5);assert.equal(prepared.events[0].playbackRate,1);
  const preview=renderPerformance(prepared,assets,rate).channels;
  assert.ok(Math.abs(frequency(preview[0].slice(0,rate/5))-220)<15);
  assert.ok(preview[0].slice(0,rate/5).some(v=>Math.abs(v)>.01));
  assert.equal(preview[0][0],0,'trim fades the new cut edge');
  assert.ok(preview[0].slice(Math.round(rate*.31)).every(v=>v===0));
  const pitched=withDrumKit({...pattern,events:[{...hit,pitch:5}]},kit,mix);
  assert.ok(Math.abs(pitched.events[0].stretchRate-1.5/2**(5/12))<1e-9);
  const pitchedAudio=renderPerformance(pitched,assets,rate).channels[0];
  assert.ok(pitchedAudio.slice(Math.round(rate*.31)).every(v=>v===0),'pitch and speed keep the trimmed duration');
  mix.percussion.speedMode='stretch';
  const repitched=withDrumKit({...pattern,events:[{...hit,speedMode:'repitch'}]},kit,mix);
  assert.equal(repitched.events[0].playbackRate,1.5);
  assert.equal(repitched.events[0].stretchRate,undefined);
  const editor=new Editor(pattern);editor.write({...hit,sampleTrim:{startMs:150,endMs:450}},hit.id);
  assert.deepEqual(editor.state.pattern.events[0].sampleTrim,{startMs:150,endMs:450});
  editor.undo();assert.deepEqual(editor.state.pattern.events[0].sampleTrim,{startMs:100,endMs:500});
  editor.redo();assert.deepEqual(editor.state.pattern.events[0].sampleTrim,{startMs:150,endMs:450});
  const saved=makeProject(editor.state,pattern.settings,mix,assets),loaded=readProject(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.project.editor.pattern.events[0].sampleTrim,{startMs:150,endMs:450});
  assert.deepEqual(renderPerformance(withDrumKit(loaded.project.editor.pattern,kit,mix),loaded.assets,rate).channels,
    renderPerformance(withDrumKit(editor.state.pattern,kit,mix),assets,rate).channels);
});

test('master protection links channels, keeps clean audio unchanged, and estimates intersample peaks',()=>{
  const quiet=[Float32Array.from([0,.2,-.2,0]),Float32Array.from([0,-.1,.1,0])];
  const before=quiet.map(c=>c.slice());const clean=protectMaster(quiet);
  assert.equal(clean.attenuation,1);assert.deepEqual(quiet,before);
  const loud=[Float32Array.from([0,1.4,-1.4,0]),Float32Array.from([0,-.7,.7,0])];
  const result=protectMaster(loud);
  assert.ok(result.attenuation<1);assert.ok(result.after.estimatedTruePeak<=.961);
  assert.ok(Math.abs(loud[0][1]/loud[1][1]+2)<1e-6,'left/right ratio is preserved');
  assert.equal(result.after.clippedSamples,0);
  const anti=[Float32Array.from([.5,-.5,.5]),Float32Array.from([-.5,.5,-.5])];
  const metrics=measureAudioQuality(anti);assert.equal(metrics.monoRms,0);assert.ok(metrics.stereoCorrelation<-.99);
  assert.throws(()=>measureAudioQuality([Float32Array.of(NaN)]),/non-finite/);
});

test('layering is reversible, mono-aware, and survives project save and reopen',()=>{
  const samples=sine(220,rate/2),asset={id:'layer-tone',name:'Layer tone',sampleRate:rate,channels:[samples]};
  const hit={id:'source',role:'percussion',sourceId:'kit.percussion',baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Test'};
  const pattern={engineVersion:'0.3.0',ppq:960,settings:{...defaults(),algorithm:'groove-v4',bars:1,bpm:120},events:[hit]};
  const kit={percussion:{assetId:asset.id,startFrame:0,endFrame:samples.length,sampleRate:rate,label:asset.name}},mix=defaultKitState();
  mix.percussion.uploadId=asset.id;
  mix.percussion.layer={choice:'upload',slice:kit.percussion,level:1,offsetMs:0,phaseInvert:true};
  const applied=withDrumKit(pattern,kit,mix);
  assert.equal(applied.events.length,2);assert.equal(applied.events[1].phaseInvert,true);
  const output=renderPerformance(applied,new Map([[asset.id,asset]]),rate).channels[0];
  assert.ok(output.every(v=>Math.abs(v)<1e-5),'inverse layer cancels identical sample');
  assert.ok(assessLayerMono(asset,asset,1,0,true).warning);
  mix.percussion.layer.phaseInvert=false;
  assert.ok(!assessLayerMono(asset,asset,1,0,false).warning);
  const doubled=renderPerformance(withDrumKit(pattern,kit,mix),new Map([[asset.id,asset]]),rate).channels[0];
  assert.ok(Math.max(...doubled.slice(0,4000))>.5,'positive layer is audible');
  mix.percussion.layer.offsetMs=5;
  assert.equal(withDrumKit(pattern,kit,mix).events[1].offsetTick,10);
  const editor=new Editor(pattern),project=makeProject(editor.state,pattern.settings,mix,new Map([[asset.id,asset]]));
  const loaded=readProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(loaded.project.kit.percussion.layer,mix.percussion.layer);
  assert.ok(loaded.assets.has(asset.id));
  const invalid=structuredClone(project);invalid.kit.percussion.layer.offsetMs=40;
  assert.throws(()=>readProject(invalid),/Invalid instrument layer/);
});

test('groove v4 loop and WAV share a protected master with deterministic output',()=>{
  const source=new Float32Array(rate).fill(.95),asset={id:'loud',name:'Loud',sampleRate:rate,channels:[source]};
  const hit={id:'loud-hit',role:'percussion',sourceId:'kit.percussion',baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Test',slice:{assetId:asset.id,startFrame:0,endFrame:source.length,sampleRate:rate,label:asset.name}};
  const pattern={engineVersion:'0.3.0',ppq:960,settings:{...defaults(),algorithm:'groove-v4',bpm:120,bars:1},events:[hit,{...hit,id:'loud-two'}]};
  const assets=new Map([[asset.id,asset]]),render=()=>renderPerformance(pattern,assets,rate,{}, {loop:true});
  const a=render(),b=render();
  assert.ok(a.attenuation<1);assert.ok(a.quality.after.estimatedTruePeak<=.961);
  assert.deepEqual(a.channels,b.channels);
  assert.deepEqual(encodeWav(a.channels,rate),encodeWav(b.channels,rate));
  assert.deepEqual(source,asset.channels[0]);
});

test('layered kick offset does not choke its own primary hit',()=>{
  const source=new Float32Array(rate/2).fill(.2),asset={id:'kick-layer',name:'Kick',sampleRate:rate,channels:[source]};
  const hit={id:'kick-a',role:'kick',sourceId:'kit.kick',baseTick:0,offsetTick:0,gain:.3,pan:0,anchor:true,ghost:false,reason:'Test'};
  const pattern={engineVersion:'0.3.0',ppq:960,settings:{...defaults(),algorithm:'groove-v4',bpm:120,bars:1},events:[hit]};
  const slice={assetId:asset.id,startFrame:0,endFrame:source.length,sampleRate:rate,label:asset.name};
  const mix=defaultKitState();mix.kick.layer={choice:'upload',slice,level:1,offsetMs:5,phaseInvert:false};
  const output=renderPerformance(withDrumKit(pattern,{kick:slice},mix),new Map([[asset.id,asset]]),rate).channels[0];
  assert.ok(output[Math.round(rate*.1)]>.1,'both kick bodies survive beyond the layer onset');
});
