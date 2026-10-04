import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPatch,synthModule,validateSynthPatch,renderModularSynthNote} from '../dist/audio/modular-synth.js';
import {SYNTH_PRESETS,validateSynthInstrument} from '../dist/audio/synth-instrument.js';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {encodeWav} from '../dist/audio/wav.js';

test('factory modular patches validate and render deterministic finite audio',()=>{
 const allPresets=[
  'bass','pluck','pad','piano',
  'nylon-guitar','rhodes','overdrive-guitar','upright-piano','strings',
  'flute','brass','slap-bass','vibraphone',
  'reese','acid303','sub808','supersaw','warm-pad','bell-pluck'
 ];
 for(const preset of allPresets){
  const patch=starterPatch(preset),order=validateSynthPatch(patch);
  assert.equal(order.at(-1).type,'output');
  const a=renderModularSynthNote(60,.25,12000,patch),b=renderModularSynthNote(60,.25,12000,patch);
  assert.deepEqual(a,b,`${preset} is deterministic`);
  assert.ok(a.some(value=>Math.abs(value)>.005),`${preset} is audible`);
  assert.ok(a.every(Number.isFinite),`${preset} output is finite`);
 }
});

test('typed cables reject mismatched ports, duplicate edges, cycles and disconnected outputs',()=>{
 const base=starterPatch('bass');
 const badPort=structuredClone(base);badPort.cables[0].input='gain';assert.throws(()=>validateSynthPatch(badPort),/ports/);
 const duplicate=structuredClone(base);duplicate.cables.push({...duplicate.cables[0]});assert.throws(()=>validateSynthPatch(duplicate),/Duplicate/);
 const cycle=structuredClone(base);cycle.cables.push({from:'filter',out:'out',to:'mix',input:'c',depth:1});assert.throws(()=>validateSynthPatch(cycle),/feedback/);
 const detached=structuredClone(base);detached.cables=detached.cables.filter(cable=>cable.to!=='out');assert.throws(()=>validateSynthPatch(detached),/Connect/);
 const invalid=structuredClone(base);invalid.nodes[0].params.level=2;assert.throws(()=>validateSynthPatch(invalid),/level/);
 assert.throws(()=>validateSynthInstrument({...SYNTH_PRESETS.bass,patch:starterPatch('piano','sample')}),/piano sample/);
});

test('patch cables drive modulation and audio effects without modifying the source',()=>{
 const base=starterPatch('pad'),dry=renderModularSynthNote(60,.2,12000,base);
 const modulated=structuredClone(base);modulated.cables.push({from:'lfo',out:'out',to:'filter',input:'cutoff',depth:.8});
 const moved=renderModularSynthNote(60,.2,12000,modulated);
 assert.notDeepEqual(dry,moved);
 const effected=structuredClone(modulated),chorus=synthModule('chorus','chorus',960,300),delay=synthModule('delay','delay',1200,300),reverb=synthModule('reverb','room',1440,300);
 effected.nodes.push(chorus,delay,reverb);
 effected.cables=effected.cables.filter(cable=>cable.to!=='out');
 effected.cables.push({from:'amp',out:'out',to:'chorus',input:'in',depth:1},{from:'chorus',out:'out',to:'delay',input:'in',depth:1},{from:'delay',out:'out',to:'room',input:'in',depth:1},{from:'room',out:'out',to:'out',input:'in',depth:1});
 const wet=renderModularSynthNote(60,.2,12000,effected);
 assert.notDeepEqual(wet,dry);assert.ok(wet.length>dry.length);assert.ok(wet.every(Number.isFinite));
 assert.deepEqual(base,starterPatch('pad'),'editing a copied patch keeps its factory template intact');
 for(const rate of [8000,44100,96000]){
  const audio=renderModularSynthNote(84,.08,rate,effected);
  assert.ok(audio.every(Number.isFinite),`effect graph stays finite at ${rate} Hz`);
  assert.ok(audio.some(value=>Math.abs(value)>.001));
 }
});

test('note velocity can shape timbre through a control cable',()=>{
 const patch=starterPatch('bass');
 patch.nodes.push(synthModule('velocity','velocity',300,540));
 patch.cables.push({from:'velocity',out:'out',to:'filter',input:'cutoff',depth:.8});
 assert.doesNotThrow(()=>validateSynthPatch(patch));
 const soft=renderModularSynthNote(48,.18,12000,patch,undefined,60,0,.2);
 const accent=renderModularSynthNote(48,.18,12000,patch,undefined,60,0,1);
 assert.notDeepEqual(soft,accent);
 assert.ok(soft.every(Number.isFinite));
 assert.ok(accent.every(Number.isFinite));
});

test('sample source and modular patches persist through project preview and WAV export',()=>{
 const rate=12000,pcm=Float32Array.from({length:rate},(_,i)=>Math.sin(2*Math.PI*261.63*i/rate)*Math.exp(-i/rate*4));
 const asset={id:'modular-piano-note',name:'Piano C.wav',sampleRate:rate,channels:[pcm,Float32Array.from(pcm,value=>value*.7)]};
 const patch=starterPatch('piano','sample'),note=renderModularSynthNote(72,.25,rate,patch,asset,72);
 assert.ok(note.some(value=>Math.abs(value)>.01));
 assert.throws(()=>renderModularSynthNote(72,.25,rate,patch),/missing/);
 const settings={...defaults('liquiddnb'),bars:1,melodyPart:'piano'},editor=new Editor(generate(settings));
 editor.generateComposition({...settings,generationMode:'melody',melodyPart:'piano'});
 const track=editor.state.pattern.userTracks.find(track=>track.generatedPart==='piano');
 editor.setSynthInstrument(track.id,{...SYNTH_PRESETS.piano,sampleBank:undefined,sample:{assetId:asset.id,rootNote:72},patch});
 const assets=new Map([[asset.id,asset]]),preview=renderPerformance(editor.state.pattern,assets,rate);
 assert.ok(preview.channels[0].some(value=>Math.abs(value)>.001));
 assert.notDeepEqual(preview.channels[0],preview.channels[1],'the modular sample path preserves stereo source differences');
 const saved=makeProject(editor.state,settings,defaultKitState(),assets),opened=readProject(saved);
 assert.equal(saved.version,9);assert.deepEqual(opened.project.editor.pattern.userTracks.find(item=>item.id===track.id).instrument.patch,patch);
 assert.deepEqual(renderPerformance(opened.project.editor.pattern,opened.assets,rate).channels,preview.channels);
 assert.equal(new TextDecoder().decode(new Uint8Array(encodeWav(preview.channels,rate)).slice(0,4)),'RIFF');
});

test('sine wave oscillator renders audible finite output across C1-C5 and warmth adds harmonic drive',()=>{
 const patch=starterPatch('bass');
 const osc=patch.nodes.find(n=>n.id==='source-a');
 osc.params.wave='sine';
 osc.params.level=0.8;
 for(const note of [24,36,48,60,72]){
  const audio=renderModularSynthNote(note,.2,12000,patch);
  assert.ok(audio.every(Number.isFinite),`sine wave at note ${note} is finite`);
  assert.ok(audio.some(val=>Math.abs(val)>.005),`sine wave at note ${note} is audible`);
 }
 osc.params.warmth=0;
 const pureSine=renderModularSynthNote(48,.2,12000,patch);
 osc.params.warmth=0.5;
 const warmSine=renderModularSynthNote(48,.2,12000,patch);
 assert.notDeepEqual(pureSine,warmSine,'warmth parameter introduces subtle harmonic drive to sine wave');
 assert.ok(warmSine.every(Number.isFinite));
});

test('distortion and noise modules render finite audio and shape timbre',()=>{
 const base=starterPatch('bass');
 const distPatch=structuredClone(base);
 const dist=synthModule('distortion','dist',650,200);
 dist.params.drive=4;
 dist.params.tone=3000;
 dist.params.wet=1;
 distPatch.nodes.push(dist);
 distPatch.cables=distPatch.cables.filter(c=>c.to!=='out');
 distPatch.cables.push(
  {from:'amp',out:'out',to:'dist',input:'in',depth:1},
  {from:'dist',out:'out',to:'out',input:'in',depth:1}
 );
 assert.doesNotThrow(()=>validateSynthPatch(distPatch));
 const dry=renderModularSynthNote(48,.2,12000,base);
 const driven=renderModularSynthNote(48,.2,12000,distPatch);
 assert.notDeepEqual(dry,driven,'distortion modifies the signal');
 assert.ok(driven.every(Number.isFinite),'distortion audio is finite');
 assert.ok(driven.some(val=>Math.abs(val)>.01),'distortion audio is audible');

 const noisePatch={
  version:1,
  nodes:[
   synthModule('noise','noise-source',40,100),
   synthModule('filter','filt',300,100),
   synthModule('output','out',600,100)
  ],
  cables:[
   {from:'noise-source',out:'out',to:'filt',input:'in',depth:1},
   {from:'filt',out:'out',to:'out',input:'in',depth:1}
  ]
 };
 assert.doesNotThrow(()=>validateSynthPatch(noisePatch));
 const noiseAudio=renderModularSynthNote(60,.15,12000,noisePatch);
 assert.ok(noiseAudio.every(Number.isFinite),'noise generator audio is finite');
 assert.ok(noiseAudio.some(val=>Math.abs(val)>.005),'noise generator produces audible sound');
});

