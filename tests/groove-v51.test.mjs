import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {parseTimeSignature,trackerTiming,patternTicks,patternSeconds,meterPosition,meterGroups} from '../dist/core/meter.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {validateV5Profile} from '../dist/core/groove-v5.js';
import {v51ProfileFor,V51_PROFILE_OVERRIDES} from '../dist/core/groove-v51-profiles.js';
import {Editor} from '../dist/core/editor.js';
import {generateMelody} from '../dist/core/melody.js';
import {generatePiano} from '../dist/core/piano.js';
import {harmonyPlan} from '../dist/core/harmony.js';
import {newBank,arrange,songTimeline,songBlocks,songPosition} from '../dist/core/bank.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {encodeWav,validateWav} from '../dist/audio/wav.js';
import {transcribeBreak} from '../dist/audio/slices.js';

const config=(overrides={})=>({...genreDefaults('dnb'),algorithm:'groove-v5.1',seed:'meter-gate',bpm:170,bars:2,lpb:4,complexity:.7,spicy:.6,...overrides});
const inBounds=(p)=>{
 assert.ok(p.events.every(h=>h.baseTick>=0&&h.baseTick<patternTicks(p.settings)&&h.baseTick+h.offsetTick>=0&&h.baseTick+h.offsetTick<patternTicks(p.settings)),'every onset stays inside the pattern');
 compile(p);
};

test('meter parser preserves denominator32 precision and rejects malformed fractions',()=>{
 assert.equal(parseTimeSignature().barTicks,3840);
 for(let n=1;n<=32;n++)for(const d of [1,2,4,8,16,32]){
  const m=parseTimeSignature(`${n}/${d}`);assert.equal(m.barTicks,n*960*4/d);assert.equal(m.stepsPerBar,n*16/d);
 }
 assert.equal(parseTimeSignature('1/32').stepsPerBar,.5);
 assert.equal(parseTimeSignature(' 11 / 8 ').barTicks,5280);
 for(const s of ['', '0/4','33/4','4/0','4/3','4/64','4','4/4/4','1.5/4','-3/4','7/8x'])assert.throws(()=>parseTimeSignature(s));
 assert.deepEqual(meterGroups('5/4'),[3,2]);assert.deepEqual(meterGroups('7/8'),[3,2,2]);assert.deepEqual(meterGroups('6/8'),[3,3]);
});
test('tracker counts quarter-note LPB, validates each bar and enforces 512 rows',()=>{
 for(const [sig,rows] of [['4/4',32],['3/4',24],['5/4',40],['7/8',28],['6/8',24]]){
  const s=config({timeSignature:sig});assert.equal(compile(generate(s)).timing.lines,rows);
 }
 assert.throws(()=>trackerTiming(config({timeSignature:'7/8',lpb:3})),/whole number/);
 assert.throws(()=>trackerTiming(config({timeSignature:'1/32',lpb:4})),/whole number/);
 assert.equal(trackerTiming(config({timeSignature:'1/32',lpb:8})).lines,2);
 assert.equal(trackerTiming(config({timeSignature:'32/1',bars:4,lpb:1})).lines,512);
 assert.throws(()=>trackerTiming(config({timeSignature:'32/1',bars:4,lpb:2})),/512/);
 assert.throws(()=>generate(config({algorithm:'groove-v5',timeSignature:'7/8'})),/V5.1/);
 assert.deepEqual(meterPosition({timeSignature:'7/8'},3.5),{bar:2,beat:1,fraction:0});
 assert.deepEqual(meterPosition({timeSignature:'6/8'},2.5),{bar:1,beat:6,fraction:0});
});
test('every prior V5 genre/length retains its pre-change fingerprint and default engine',()=>{
 const h=createHash('sha256');
 for(const genre of Object.keys(PROFILES)){
  assert.equal(genreDefaults(genre).algorithm,'groove-v5');
  for(const bars of [1,2,4])h.update(JSON.stringify(generate({...genreDefaults(genre),algorithm:'groove-v5',seed:'meter-compat',bars,complexity:.73,spicy:.61})));
 }
 assert.equal(h.digest('hex'),'bade7c45d3cf41a1b448b0c83b46f2028e3333eef7a4c8fefdbf1a8016f2955c');
});
test('V5.1 profiles validate, have distinct anchors and monotonic layer admission',()=>{
 const rhythms=new Set();
 for(const genre of Object.keys(V51_PROFILE_OVERRIDES)){
  validateV5Profile(v51ProfileFor(genre),genre);
  const s=config({genre,bars:2,spicy:0,fillAmount:0,ghostAmount:1,syncopation:1});
  rhythms.add(JSON.stringify(generate(s).events.filter(h=>h.anchor).map(h=>[h.role,h.baseTick])));
  let prior=new Set();
  for(const complexity of [0,.25,.5,.75,1]){
   const events=generate({...s,complexity}).events;const ids=new Set(events.map(h=>h.id));
   for(const id of prior)assert.ok(ids.has(id),`${genre}: ${id}`);prior=ids;
  }
 }
 assert.equal(rhythms.size,5);
 const half=generate(config({genre:'halftimednb',complexity:1,fillAmount:1}));
 assert.ok(half.events.filter(h=>h.role==='snare').every(h=>h.baseTick%3840===1920));
 const ghosts=v51ProfileFor('drumfunk').layers.flatMap(l=>l.notes).filter(n=>n.ghost);
 assert.ok(ghosts.length>=4&&ghosts.every(n=>n.gain>=.25&&n.gain<=.55));
});
test('odd meter structures, break recipes, Think slices and seed replay stay in bounds',()=>{
 for(const timeSignature of ['1/32','3/4','5/4','6/8','7/8','11/8','7/4'])for(const patternStructure of ['groove','auto','fill','roll','build']){
  const s=config({timeSignature,lpb:8,patternStructure,complexity:1,spicy:1});
  const p=generate(s);inBounds(p);assert.deepEqual(p,generate(s));
  for(const breakStyle of ['amen','think'])inBounds(generate({...s,breakStyle}));
  const editor=new Editor(p);editor.generateComposition({...s,breakLayer:'think-passage2'});inBounds(editor.state.pattern);
  assert.ok(editor.state.pattern.events.some(h=>h.mapped?.instrumentId==='think-passage2-uh'));
 }
});
test('5/4 and 7/8 anchors follow additive groups rather than a cropped 4/4 loop',()=>{
 const five=generate(config({bars:1,timeSignature:'5/4',complexity:0,fillAmount:0}));
 assert.deepEqual(five.events.filter(h=>h.anchor).map(h=>[h.role,h.baseTick/240]),[['kick',0],['snare',6],['kick',12],['snare',16]]);
 const seven=generate(config({bars:1,timeSignature:'7/8',complexity:0,fillAmount:0}));
 assert.deepEqual(seven.events.filter(h=>h.anchor&&h.role==='kick').map(h=>h.baseTick/240),[0,6,10]);
});
test('maximum supported BPM and expressiveness cannot overflow tracker offsets',()=>{
 for(const genre of Object.keys(PROFILES))for(const timeSignature of ['1/32','4/4','7/8']){
  inBounds(generate(config({genre,timeSignature,lpb:8,bpm:999,seed:'extreme-c',complexity:1,spicy:1,swing:.67,humanizeMs:10})));
 }
});
test('all genres compose bounded piano, bass and lead in both tiny and long measures',()=>{
 for(const genre of Object.keys(PROFILES))for(const timeSignature of ['1/32','7/8','32/1']){
  const s=config({genre,timeSignature,bars:4,lpb:timeSignature==='32/1'?1:8,complexity:1,spicy:1});
  const p=generate(s);inBounds(p);
  const changes=harmonyPlan(s);assert.equal(changes.at(-1).endTick,patternTicks(s));
  for(const melodyPart of ['bassline','lead','piano']){
   const editor=new Editor(p);editor.generateComposition({...s,generationMode:'melody',melodyPart});inBounds(editor.state.pattern);
   assert.ok(editor.state.pattern.events.some(h=>h.synthNote));
  }
  for(const melodyPart of ['bassline','lead'])assert.deepEqual(generateMelody({...s,melodyPart},'test'),generateMelody({...s,melodyPart},'test'));
  assert.deepEqual(generatePiano(s,'test'),generatePiano(s,'test'));
 }
});
test('V5.1 exact target, manual hits, locks, fills and Undo/Redo survive generation',()=>{
 const s=config({timeSignature:'7/8',spicy:0,fillAmount:0,complexity:1});const editor=new Editor(generate(s));
 const manual={...editor.state.pattern.events[0],id:'manual-meter-hat',role:'hat',sourceId:'kit.hat',baseTick:350,anchor:false,manual:true};editor.write(manual);
 editor.toggleRole('kick');const held=structuredClone(editor.state.pattern.events.filter(h=>h.role==='kick'));
 editor.generateComposition(s);assert.ok(editor.state.pattern.events.some(h=>h.id===manual.id));assert.deepEqual(editor.state.pattern.events.filter(h=>h.role==='kick'),held);
 const before=structuredClone(editor.state.pattern);editor.variation();assert.equal(editor.state.pattern.settings.algorithm,'groove-v5.1');editor.undo();assert.deepEqual(editor.state.pattern,before);editor.redo();
 editor.state.selection={ids:[],rows:[24,27]};editor.fill();inBounds(editor.state.pattern);
 assert.throws(()=>editor.generateComposition({...s,timeSignature:'3/4'}),/Unlock/);
 const anchors=generate(s).events.filter(h=>h.anchor).length;
 assert.equal(generate({...s,hitTarget:anchors}).events.length,anchors);
 const unchanged=structuredClone(editor.state);assert.throws(()=>editor.setLpb(3),/whole number/);assert.deepEqual(editor.state,unchanged);
});
test('mixed-meter arrangements and portable projects retain individual timing',()=>{
 const a=generate(config({bars:1,timeSignature:'3/4',bpm:120})),b=generate(config({bars:1,timeSignature:'7/8',bpm:120}));
 const bank=newBank(a);bank.slots[1].editor=new Editor(b).state;bank.sequence=[{slot:0,repeats:1},{slot:1,repeats:2}];
 const timeline=songTimeline(bank);assert.deepEqual(timeline.map(x=>x.duration),[1.5,1.75,1.75]);assert.equal(songPosition(timeline,1.6).slot,1);
 assert.deepEqual(songBlocks(bank).map(x=>x.duration),[1.5,3.5]);
 const project=makeProject(new Editor(a).state,a.settings,defaultKitState(),new Map(),bank);
 const restored=readProject(project).project;assert.deepEqual(restored.bank,bank);assert.equal(restored.editor.pattern.settings.timeSignature,'3/4');
 const audio=renderSequence(arrange(restored.bank),new Map(),8000,{}, {loop:true});assert.equal(audio.duration,5);assert.equal(audio.channels[0].length,40000);
});
test('meter resizing preserves user notes and bounds generated synth offsets and lengths',()=>{
 const s=config({timeSignature:'1/32',lpb:8,bars:2,humanizeMs:10});const editor=new Editor(generate(s));
 editor.generateComposition({...s,generationMode:'melody',melodyPart:'lead'});
 editor.generateComposition({...s,timeSignature:'32/1',lpb:1,generationMode:'drums'});inBounds(editor.state.pattern);
 editor.generateComposition({...s,generationMode:'drums'});inBounds(editor.state.pattern);
 const big=new Editor(generate(config({timeSignature:'5/4',bars:1})));
 big.write({...big.state.pattern.events[0],id:'late-manual',baseTick:4500,offsetTick:0,anchor:false,manual:true});
 const before=structuredClone(big.state);
 assert.throws(()=>big.generateComposition(config({timeSignature:'3/4',bars:1})),/preserved notes/);assert.deepEqual(big.state,before);
});
test('odd-meter shared Preview PCM encodes exact WAV duration and sample values',()=>{
 for(const timeSignature of ['3/4','5/4','7/8','1/32']){
  const s=config({timeSignature,lpb:8,bpm:120,bars:1});const p=withDrumKit(generate(s),{},defaultKitState());
  const audio=renderPerformance(p,new Map(),8000,{}, {loop:true});assert.equal(audio.duration,patternSeconds(s));
  assert.ok(audio.channels[0].some(x=>Math.abs(x)>.005));
  const wav=encodeWav(audio.channels,8000),info=validateWav(wav),view=new DataView(wav);assert.equal(info.duration,patternSeconds(s));
  for(let i=0;i<audio.channels[0].length;i+=137){const x=Math.max(-1,Math.min(1,audio.channels[0][i]));assert.equal(view.getInt16(44+i*4,true),Math.round(x<0?x*32768:x*32767)||0);}
 }
});
test('meter metadata validates against the transfer schema',()=>{
 const validate=new Ajv().compile(JSON.parse(readFileSync('schemas/bbpattern-v1.schema.json','utf8')));
 for(const timeSignature of ['3/4','4/4','5/4','7/8','11/16'])assert.ok(validate(compile(generate(config({timeSignature,lpb:8})))),JSON.stringify(validate.errors));
});
test('break import infers quarter-note BPM from the selected meter',()=>{
 const asset={id:'meter-break',name:'test.wav',sampleRate:8000,channels:[new Float32Array(16000)]};
 const p=transcribeBreak(asset,[0,4000,8000,12000,16000],config({timeSignature:'7/8',bars:1,lpb:8}));
 assert.equal(p.settings.bpm,105);assert.equal(patternSeconds(p.settings),2);inBounds(p);
});
