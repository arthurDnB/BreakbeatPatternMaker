import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPatch,synthModule,validateSynthPatch,renderModularSynthNote} from '../dist/audio/modular-synth.js';
import {SYNTH_PRESETS} from '../dist/audio/synth-instrument.js';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {encodeWav} from '../dist/audio/wav.js';

const edge=(from,to,input,depth=1)=>({from,out:'out',to,input,depth});
const rms=(samples,from,to)=>{
  let sum=0;
  for(let i=from;i<to;i++)sum+=samples[i]**2;
  return Math.sqrt(sum/(to-from));
};

test('legacy modular patches retain their original PCM at stable sample points',()=>{
  const expected={
    bass:[.238827914,.229072496,-.168554023,.278770507,-.169947878],
    rhodes:[-.255999953,-.157723576,.560368359,-.374697119,.185882017],
    piano:[-.260122657,-.262053251,.279337227,-.291329265,.172707766]
  };
  for(const [preset,values] of Object.entries(expected)){
    const audio=renderModularSynthNote(60,.25,12000,starterPatch(preset));
    for(const [position,target] of [123,456,789,1234,2300].map((index,i)=>[index,values[i]])){
      assert.ok(Math.abs(audio[position]-target)<1e-6,`${preset} sample ${position} changed`);
    }
  }
});

test('FM operator supports phase, linear, and exponential modulation without cable cycles',()=>{
  const patch={version:1,nodes:[
    synthModule('oscillator','mod'),synthModule('fm-operator','carrier'),synthModule('output','out')
  ],cables:[edge('mod','carrier','mod',.8),edge('carrier','out','in')]};
  patch.nodes[0].params.wave='sine';
  patch.nodes[1].params.index=2;
  assert.doesNotThrow(()=>validateSynthPatch(patch));
  const phase=renderModularSynthNote(60,.15,12000,patch);
  patch.nodes[1].params.mode='linear';patch.nodes[1].params.deviationHz=450;
  const linear=renderModularSynthNote(60,.15,12000,patch);
  patch.nodes[1].params.mode='exponential';patch.nodes[1].params.expSemitones=12;
  const exponential=renderModularSynthNote(60,.15,12000,patch);
  assert.notDeepEqual(phase,linear);
  assert.notDeepEqual(linear,exponential);
  for(const pcm of [phase,linear,exponential]){
    assert.ok(pcm.every(Number.isFinite));
    assert.ok(pcm.some(value=>Math.abs(value)>.01));
  }
  const wrong=structuredClone(patch);
  wrong.cables.push(edge('carrier','mod','pitch'));
  assert.throws(()=>validateSynthPatch(wrong),/ports/);
  const cyclic=structuredClone(patch);
  cyclic.nodes[0]=synthModule('fm-operator','mod');
  cyclic.cables.push(edge('carrier','mod','mod'));
  assert.throws(()=>validateSynthPatch(cyclic),/feedback/);
  const invalid=structuredClone(patch);
  invalid.nodes[1].params.expSemitones=49;
  assert.throws(()=>validateSynthPatch(invalid),/expSemitones/);
});

test('multistage envelope has a bounded attack, break, sustain, and release',()=>{
  const patch={version:1,nodes:[
    synthModule('fm-operator','tone'),synthModule('multi-envelope','shape'),synthModule('amplifier','amp'),synthModule('output','out')
  ],cables:[edge('tone','amp','in'),edge('shape','amp','gain'),edge('amp','out','in')]};
  Object.assign(patch.nodes[1].params,{delay:0,attack:.06,hold:.02,fall:.08,breakLevel:.45,decay2:.08,sustain:.25,release:.08});
  const rate=12000,audio=renderModularSynthNote(60,.35,rate,patch);
  const window=(a,b)=>rms(audio,Math.round(a*rate),Math.round(b*rate));
  assert.ok(window(.035,.045)>window(.005,.015),'attack grows');
  assert.ok(window(.10,.12)>window(.28,.30),'break and sustain differ');
  assert.ok(window(.39,.41)<window(.31,.33),'release decays');
  assert.ok(audio.every(Number.isFinite));
  const early=renderModularSynthNote(60,.025,rate,patch);
  assert.ok(early.every(Number.isFinite),'note-off during attack is safe');
});

test('Rhodes FM audition preset validates and renders across register, velocity, and sample rates',()=>{
  const patch=starterPatch('rhodes-model-v2');
  assert.equal(patch.nodes.filter(node=>node.type==='fm-operator').length,2);
  assert.ok(patch.nodes.some(node=>node.type==='multi-envelope'));
  assert.doesNotThrow(()=>validateSynthPatch(patch));
  for(const rate of [8000,12000,48000,192000])for(const note of [24,48,60,72]){
    const pcm=renderModularSynthNote(note,.08,rate,patch,undefined,60,0,.7);
    assert.ok(pcm.every(Number.isFinite),`${note} at ${rate} Hz is finite`);
    assert.ok(pcm.some(value=>Math.abs(value)>.003),`${note} at ${rate} Hz is audible`);
  }
  const soft=renderModularSynthNote(60,.15,12000,patch,undefined,60,0,.2);
  const hard=renderModularSynthNote(60,.15,12000,patch,undefined,60,0,1);
  assert.notDeepEqual(soft,hard,'velocity changes FM index');
  assert.deepEqual(hard,renderModularSynthNote(60,.15,12000,patch,undefined,60,0,1),'rendering is deterministic');
});

test('new FM patch survives project roundtrip and uses the shared Preview/WAV renderer',()=>{
  const settings={...defaults('liquiddnb'),bars:1,melodyPart:'piano'};
  const editor=new Editor(generate(settings));
  editor.generateComposition({...settings,generationMode:'melody',melodyPart:'piano'});
  const track=editor.state.pattern.userTracks.find(item=>item.generatedPart==='piano');
  assert.ok(track);
  const patch=starterPatch('rhodes-model-v2');
  editor.setSynthInstrument(track.id,{...SYNTH_PRESETS.piano,sampleBank:undefined,patch});
  const rate=12000,assets=new Map();
  const preview=renderPerformance(editor.state.pattern,assets,rate);
  const project=makeProject(editor.state,settings,defaultKitState(),assets);
  assert.equal(project.version,9);
  const opened=readProject(project);
  assert.deepEqual(opened.project.editor.pattern.userTracks.find(item=>item.id===track.id).instrument.patch,patch);
  assert.deepEqual(renderPerformance(opened.project.editor.pattern,opened.assets,rate).channels,preview.channels);
  const wav=encodeWav(preview.channels,rate),bytes=new DataView(wav);
  assert.equal(new TextDecoder().decode(new Uint8Array(wav,0,4)),'RIFF');
  for(const index of [0,123,456,789]){
    const pcm=bytes.getInt16(44+index*preview.channels.length*2,true)/32768;
    assert.ok(Math.abs(pcm-preview.channels[0][index])<1/32768+.00002);
  }
});
