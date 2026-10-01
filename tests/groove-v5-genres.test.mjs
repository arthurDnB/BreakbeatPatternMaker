import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGrooveV5,planV5Phrase,validateV5Profile} from '../dist/core/groove-v5.js';
import {V5_PROFILE_OVERRIDES} from '../dist/core/groove-v5-profiles.js';
import {generate} from '../dist/core/generate.js';
import {genreDefaults} from '../dist/core/profiles.js';

const PILOTS=[
 'jungle','liquiddnb','boombap','trap','twostepgarage','dubstep','breakcore','amenscience'
];
const registered=PILOTS.filter(genre=>Object.hasOwn(V5_PROFILE_OVERRIDES,genre));
const profilesStarted=Object.keys(V5_PROFILE_OVERRIDES).length>0;
const complete=registered.length===PILOTS.length;
const settings=(genre,seed='v5-pilot-gate',complexity=0)=>({
 ...genreDefaults(genre),algorithm:'groove-v5',seed,bpm:170,bars:2,
 phraseLength:4,phraseOffset:0,complexity,spicy:0,fillAmount:0,
 ghostAmount:1,syncopation:1,humanizeMs:0,swing:.5,patternStructure:'groove'
});
const signature=hits=>hits.map(hit=>`${hit.role}:${hit.baseTick}`).sort();
const anchors=pattern=>pattern.events.filter(hit=>hit.anchor);
const optional=pattern=>new Set(signature(pattern.events.filter(hit=>!hit.anchor)));

// The fixture can land before DeepSeek's profiles. Once the first override is
// registered, a partial eight-genre submission fails the normal unit suite.
test('Groove V5 pilot registry is complete once profile authoring starts',{skip:!profilesStarted},()=>{
 assert.deepEqual(registered.toSorted(),PILOTS.toSorted(),
  'All eight pilot overrides must ship together; inherited baselines are not reviewed profiles.');
});

for(const genre of PILOTS){
 test(`Groove V5 ${genre} obeys the typed profile and generates its declared anchor motif`,
  {skip:!Object.hasOwn(V5_PROFILE_OVERRIDES,genre)},()=>{
   const profile=V5_PROFILE_OVERRIDES[genre];
   assert.equal(profile.genre,genre);
   assert.doesNotThrow(()=>validateV5Profile(profile,genre));
   for(const seed of ['v5-pilot-gate','v5-pilot-alternate']){
    const s=settings(genre,seed),original=structuredClone(profile),plan=planV5Phrase(s,profile);
    const motif=profile.anchors.find(item=>item.id===plan.motifId);
    assert.ok(motif,`${genre}: chosen motif must be declared in its profile`);
    const pattern=generateGrooveV5(s,profile);
    assert.deepEqual(generate(s),pattern,`${genre}: public V5 dispatch did not use the registered profile`);
    assert.deepEqual(profile,original,`${genre}: generation mutated the profile`);
    assert.deepEqual(pattern,generateGrooveV5(s,profile),`${genre}: output must be deterministic`);
    const expected=plan.bars.flatMap(bar=>motif.notes
     .filter(note=>note.bar===bar.absoluteBar%motif.bars)
     .map(note=>`${note.role}:${bar.bar*3840+note.step*240}`)).toSorted();
    assert.deepEqual(signature(anchors(pattern)),expected,`${genre}: generated anchors differ from the declared motif`);
    assert.ok(expected.some(note=>note.startsWith('kick:')),`${genre}: missing kick foundation`);
    assert.ok(expected.some(note=>note.startsWith('snare:')),`${genre}: missing snare foundation`);
   }
  });

 test(`Groove V5 ${genre} admits Complexity layers monotonically`,
  {skip:!Object.hasOwn(V5_PROFILE_OVERRIDES,genre)},()=>{
   const profile=V5_PROFILE_OVERRIDES[genre];
   for(const seed of ['v5-pilot-gate','v5-pilot-alternate']){
    const patterns=[0,.25,.5,.75,1].map(level=>generateGrooveV5(settings(genre,seed,level),profile));
    const spine=signature(anchors(patterns[0]));
    for(let index=1;index<patterns.length;index++){
     const prior=optional(patterns[index-1]),next=optional(patterns[index]);
     assert.deepEqual(signature(anchors(patterns[index])),spine,`${genre}: Complexity changed protected anchors`);
     for(const hit of prior)assert.ok(next.has(hit),`${genre}: Complexity removed ${hit}`);
    }
    assert.ok(optional(patterns.at(-1)).size>optional(patterns[0]).size,
     `${genre}: full Complexity must add at least one non-anchor hit`);
   }
  });
}

test('all eight pilots have distinct combined kick/snare anchor rhythms at matched tempo',
 {skip:!complete},()=>{
  for(const seed of ['v5-pilot-gate','v5-pilot-alternate']){
   const motifs=new Map();
   for(const genre of PILOTS){
    const pattern=generateGrooveV5(settings(genre,seed),V5_PROFILE_OVERRIDES[genre]);
    const rhythm=signature(anchors(pattern)).join('|');
    assert.ok(!motifs.has(rhythm),`${genre} duplicates ${motifs.get(rhythm)}'s kick/snare motif for seed ${seed}`);
    motifs.set(rhythm,genre);
   }
   assert.equal(motifs.size,PILOTS.length);
  }
 });
