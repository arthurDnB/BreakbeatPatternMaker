import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {genreDefaults} from '../dist/core/profiles.js';
import {developmentFor} from '../dist/core/groove-v3-development.js';
import {V3_RULES} from '../dist/core/groove-v3-profiles.js';
import {planV3Voices,applyV3Chokes,renderV3Voice} from '../dist/audio/voice-v3.js';
import {Editor} from '../dist/core/editor.js';
const modes=['groove','auto','fill','roll','build'];
test('Standard Groove is independent of fill probability but still responds to Spicy',()=>{
 for(const genre of ['amenscience','jungle','breakcore','liquiddnb'])for(let seed=0;seed<10;seed++){
  const s={...genreDefaults(genre),seed:'audit-'+seed,patternStructure:'groove'};
  assert.deepEqual(generate({...s,fillAmount:0}).events,generate({...s,fillAmount:1}).events);
 }
 const s={...genreDefaults('amenscience'),patternStructure:'groove'};
 assert.notDeepEqual(generate({...s,spicy:0}).events,generate({...s,spicy:1}).events);
});
test('All structures honor excluded lanes and cadence cannot duplicate a same-lane onset',()=>{
 const roles=['kick','snare','hat','percussion'];
 for(const mode of modes)for(let mask=0;mask<16;mask++){
  const enabledRoles=roles.filter((_,i)=>mask&(1<<i));
  const p=generate({...genreDefaults('amenscience'),enabledRoles,patternStructure:mode});
  assert.ok(p.events.every(h=>enabledRoles.includes(h.role)));
 }
 for(const genre of ['amenscience','breakcore','twostepgarage','jumpup','neurofunk'])for(let i=0;i<20;i++){
  const p=generate({...genreDefaults(genre),seed:'audit-'+i,fillAmount:1,patternStructure:'auto'});
  const attacks=p.events.flatMap(h=>Array.from({length:h.ratchets??1},(_,i)=>h.role+':'+(h.baseTick+h.offsetTick+i*h.articulation.durationTicks/(h.ratchets??1)).toFixed(6)));
  assert.equal(new Set(attacks).size,attacks.length,genre+':'+i);
 }
});
test('Roll density and expression respond to controls and respect spacing and repeat energy',()=>{
 for(const genre of ['amenscience','breakcore','liquiddnb','trap','hardcore'])for(const bpm of [172,220,260,999])for(const humanizeMs of [0,10]){
  const s={...genreDefaults(genre),bpm,humanizeMs,patternStructure:'build',complexity:1,spicy:1};
  const p=generate(s),onsets=[];
  for(const h of p.events){const n=h.ratchets??1;assert.ok(n<=V3_RULES[genre].maxRepeats);assert.ok(h.articulation.repeats.reduce((sum,r)=>sum+r.gain*r.gain,0)<1.001);
   for(let i=0;i<n;i++)onsets.push((h.baseTick+h.offsetTick+i*h.articulation.durationTicks/n)*60000/bpm/960);
  }
  onsets.sort((a,b)=>a-b);for(let i=1;i<onsets.length;i++)assert.ok(onsets[i]-onsets[i-1]>=developmentFor(genre).minGapMs-1e-6);
 }
 const s={...genreDefaults('amenscience'),patternStructure:'build'};
 assert.notDeepEqual(generate({...s,complexity:0}).events,generate({...s,complexity:1}).events);
 assert.notDeepEqual(generate({...s,spicy:0}).events,generate({...s,spicy:1}).events);
});
test('Choking preserves the original decay curve before its final fade',()=>{
 const rate=12000,samples=new Float32Array(rate).fill(.2),p=generate({...genreDefaults('amenscience'),bpm:200});
 const h={id:'a',role:'snare',sourceId:'kit.snare',baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'test',decay:.5,sourceKind:'oneShot'};
 const a=planV3Voices(p,h,[samples],rate,0,rate,0,10,rate)[0];
 const b=planV3Voices(p,{...h,id:'b',baseTick:64},[samples],rate,0,rate,0,10,rate)[0];
 const original=structuredClone(a);applyV3Chokes([a,b],rate);assert.equal(a.length,240);assert.equal(a.envelopeLength,6000);
 const render=v=>{const bus=[new Float32Array(6000),new Float32Array(6000)];renderV3Voice(v,bus,rate);return bus[0];};
 const x=render(a),y=render(original);assert.deepEqual(x.slice(0,210),y.slice(0,210));assert.equal(x[239],0);
});
test('Pre-ending gestures resolve before an explicit fill or roll begins',()=>{
 for(const genre of ['amenscience','atmosphericbreakcore','breakcore'])for(const patternStructure of ['fill','roll'])for(const bpm of [172,220,260]){
  const s={...genreDefaults(genre),bpm,patternStructure,spicy:1},p=generate(s),boundary=s.bars*3840-1920;
  for(const h of p.events.filter(h=>h.baseTick<boundary&&(h.ratchets??1)>1)){
   assert.ok(h.baseTick+h.offsetTick+h.articulation.durationTicks<=boundary,genre+':'+h.id);
  }
 }
});
test('Structure replacements preserve locks and round-trip undo/redo',()=>{
 for(const mode of modes){const s=genreDefaults('amenscience'),e=new Editor(generate(s));e.toggleRole('snare');const before=structuredClone(e.state);
  e.replace(generate({...s,patternStructure:mode}));const after=structuredClone(e.state);
  assert.deepEqual(after.pattern.events.filter(h=>h.role==='snare'),before.pattern.events.filter(h=>h.role==='snare'));
  e.undo();assert.deepEqual(e.state,before);e.redo();assert.deepEqual(e.state,after);
 }
});
