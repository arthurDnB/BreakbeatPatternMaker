import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {compile} from '../dist/core/compile.js';
import {V3_RULES} from '../dist/core/groove-v3-profiles.js';
import {developmentFor,phrasePosition} from '../dist/core/groove-v3-development.js';
import {euclideanSteps} from '../dist/core/groove-v3-primitives.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
const config=(genre,extra={})=>({...genreDefaults(genre),algorithm:'groove-v3',seed:'musicality',bars:4,complexity:1,spicy:1,ghostAmount:1,fillAmount:1,...extra});
const anchors=p=>p.events.filter(h=>h.anchor);
const bursts=p=>p.events.filter(h=>(h.ratchets??1)>1);

test('v3 all 38 styles are deterministic, compile at coarse/fine grids and preserve anchors across depth, spice and variation',()=>{
 for(const genre of Object.keys(PROFILES))for(const seed of ['one','two']){
  const s=config(genre,{seed,bpm:220}),p=generate(s),before=structuredClone(s);
  assert.deepEqual(generate(s),p);assert.deepEqual(s,before);
  const low=generate({...s,complexity:0,spicy:0,variation:9});assert.deepEqual(anchors(low),anchors(p),genre);
  for(const resolution of [8,16,32,64]){const q=generate({...s,resolution});compile(q);assert.deepEqual(q.events,p.events,genre+' resolution');}
  assert.ok(p.events.every(h=>h.baseTick+h.offsetTick>=0&&h.baseTick+h.offsetTick<15360));
 }
});

test('v3 complexity adds depth without removing existing rhythm positions; genre styles stay distinct at matched tempo',()=>{
 const fingerprints=new Set();
 for(const genre of Object.keys(PROFILES)){
  let previous=[];
  for(const complexity of [0,.3,.6,1]){
   const p=generate(config(genre,{complexity,spicy:0,fillAmount:0,bpm:140}));
   for(const id of previous)assert.ok(p.events.some(h=>h.id===id),genre+' lost '+id);
   previous=p.events.map(h=>h.id);
  }
  const p=generate(config(genre,{spicy:0,fillAmount:0,bpm:140}));
  fingerprints.add(JSON.stringify(p.events.map(h=>[h.role,h.baseTick,h.offsetTick,h.gain])));
 }
 assert.equal(fingerprints.size,38);
});

test('v3 genre foundations separate four-floor, broken garage, half-time, one-drop and displaced jungle spines',()=>{
 const steps=(genre,role)=>anchors(generate(config(genre,{bars:1}))).filter(h=>h.role===role).map(h=>h.baseTick/240);
 assert.deepEqual(steps('garage','kick'),[0,4,8,12]);assert.deepEqual(steps('speedgarage','kick'),[0,4,8,12]);
 assert.notDeepEqual(steps('twostepgarage','kick'),[0,4,8,12]);
 for(const g of ['trap','drill','dubstep','brostep','halftimednb'])assert.deepEqual(steps(g,'snare'),[8]);
 assert.deepEqual(steps('dub','kick'),[8]);assert.deepEqual(steps('footworkjungle','snare'),[8,12]);
 const motifs=new Set();for(let seed=0;seed<24;seed++)motifs.add(JSON.stringify(anchors(generate(config('jungle',{seed:String(seed),bars:1}))).filter(h=>h.role==='snare').map(h=>h.baseTick/240)));
 assert.ok(motifs.has('[4,10]'));assert.ok(motifs.has('[4,12]'));
});

test('v3 spice obeys genre ceilings, phrase budgets, attack spacing and energy contours even at maximum',()=>{
 for(const genre of Object.keys(PROFILES)){
  const s=config(genre,{bpm:220}),p=generate(s),rule=V3_RULES[genre],dev=developmentFor(genre),perBar=new Map();
  for(const h of bursts(p)){
   assert.equal(h.anchor,false);assert.notEqual(h.role,'kick');assert.ok(h.ratchets<=rule.maxRepeats,genre);
   if(!dev.chop)assert.notEqual(h.articulation.mode,'chop',genre);
   if(dev.style==='hat-roll')assert.equal(h.role,'hat');
   assert.ok([120,240,480,960].includes(h.articulation.durationTicks));
   const minGap=h.role==='hat'?Math.min(18,dev.minGapMs):dev.minGapMs;
   assert.ok(h.articulation.durationTicks*60000/s.bpm/960/h.ratchets>=minGap);
   assert.ok(h.articulation.repeats.reduce((sum,r)=>sum+r.gain*r.gain,0)<=1.001);
   const bar=Math.floor(h.baseTick/3840);perBar.set(bar,(perBar.get(bar)??0)+1);
  }
  for(const [bar,count] of perBar){const phase=phrasePosition(s,bar);assert.ok(count<=(phase.ending?dev.ending:phase.response||phase.turnaround?dev.answer:dev.call),genre);}
 }
 let mild=0,strong=0;for(let i=0;i<20;i++){mild+=bursts(generate(config('liquiddnb',{seed:String(i),spicy:.15}))).length;strong+=bursts(generate(config('liquiddnb',{seed:String(i),spicy:1}))).length;}
 assert.ok(strong>mild,'Liquid still responds audibly without genre-limit bypasses');
});

test('v3 long phrase context reserves full cadences for actual endings, persists, and rejects invalid context',()=>{
 const s=config('amenscience',{phraseLength:16,phraseOffset:0}),early=generate(s),late=generate({...s,phraseOffset:12});
 assert.deepEqual(anchors(early),anchors(late));
 assert.ok(!early.events.some(h=>h.reason.includes('phrase resolution')));
 assert.ok(late.events.some(h=>h.reason.includes('Bar 16 of 16: phrase resolution')));
 assert.equal(phrasePosition({...s,phraseOffset:15},1).position,0);
 const e=new Editor(late),file=makeProject(e.state,late.settings,defaultKitState(),new Map());assert.deepEqual(readProject(file).project.editor.pattern,late);
 for(const extra of [{phraseLength:3},{phraseOffset:16},{phraseOffset:-1},{phraseOffset:1.5},{algorithm:'groove-v2'}])assert.throws(()=>generate({...s,...extra}));
});

test('Euclidean support uses exact periodic patterns and explicit hat/ghost interactions respect exclusions',()=>{
 assert.deepEqual(euclideanSteps(3,8),[0,3,6]);assert.equal(euclideanSteps(5,16,2).length,5);
 const p=generate(config('jungle',{seed:'interaction',spicy:0}));assert.ok(p.events.some(h=>h.reason.includes('links softer drum accents')));
 const muted=generate(config('jungle',{enabledRoles:['kick','hat'],ghostAmount:0}));assert.ok(muted.events.every(h=>['kick','hat'].includes(h.role)));assert.ok(muted.events.every(h=>!h.ghost));
});
