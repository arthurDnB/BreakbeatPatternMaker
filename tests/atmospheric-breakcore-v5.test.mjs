import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGrooveV5,validateV5Profile} from '../dist/core/groove-v5.js';
import {baselineV5Profile,v5ProfileFor} from '../dist/core/groove-v5-baseline.js';
import {genreDefaults} from '../dist/core/profiles.js';
import {GENRE_KITS,KIT_PRESETS,LIBRARY} from '../dist/audio/library.js';

const genre='atmosphericbreakcore';
const config=(overrides={})=>({
 ...genreDefaults(genre),bars:4,phraseLength:4,phraseOffset:0,bpm:170,
 seed:'sr20-opening-study',complexity:.85,spicy:0,fillAmount:0,
 ghostAmount:1,syncopation:1,humanizeMs:0,swing:.5,...overrides
});
const barOf=hit=>Math.floor(hit.baseTick/3840);
const identity=hit=>`${hit.role}:${hit.baseTick}`;

test('Atmospheric Breakcore has a valid, deterministic two-bar V5 drum motif',()=>{
 const profile=v5ProfileFor(genre);
 assert.equal(profile.genre,genre);
 assert.notEqual(profile,baselineV5Profile(genre));
 assert.doesNotThrow(()=>validateV5Profile(profile,genre));
 const first=generateGrooveV5(config(),profile);
 assert.deepEqual(first,generateGrooveV5(config(),profile));
 const anchors=first.events.filter(hit=>hit.anchor);
 assert.equal(anchors.length,16);
 assert.ok(anchors.every(hit=>hit.role==='kick'||hit.role==='snare'));
 assert.deepEqual(anchors.filter(hit=>barOf(hit)<2).map(identity),
  anchors.filter(hit=>barOf(hit)>=2).map(hit=>`${hit.role}:${hit.baseTick-7680}`));
});

test('four-bar phrase develops drum detail without moving its anchor spine',()=>{
 const profile=v5ProfileFor(genre),settings=config();
 const output=generateGrooveV5(settings,profile);
 const byBar=Array.from({length:4},(_,bar)=>output.events.filter(hit=>barOf(hit)===bar));
 assert.ok(byBar[3].length>byBar[0].length,'ending must add detail after the restrained opening');
 assert.ok(byBar.slice(0,2).flat().every(hit=>!hit.reason.includes('atmospheric-fractured-snare')));
 assert.ok(byBar.slice(2).flat().some(hit=>hit.reason.includes('atmospheric-fractured-snare')));
 const spicy=generateGrooveV5({...settings,spicy:1},profile);
 const firstHalf=spicy.events.filter(hit=>barOf(hit)<2);
 assert.deepEqual(firstHalf,output.events.filter(hit=>barOf(hit)<2),
  'spice should not disturb the opening half of a long phrase');
 assert.deepEqual(spicy.events.filter(hit=>hit.anchor).map(identity),output.events.filter(hit=>hit.anchor).map(identity));
});

test('phrase offset admits the fracture layer only in the second half of an eight-bar section',()=>{
 const profile=v5ProfileFor(genre);
 const opening=generateGrooveV5(config({phraseLength:8,phraseOffset:0}),profile);
 const later=generateGrooveV5(config({phraseLength:8,phraseOffset:4}),profile);
 const fracture=pattern=>pattern.events.filter(hit=>hit.reason.includes('atmospheric-fractured-snare'));
 assert.equal(fracture(opening).length,0);
 assert.ok(fracture(later).length>0);
});

test('increasing Complexity admits detail monotonically, while other genre profiles remain unchanged',()=>{
 const profile=v5ProfileFor(genre);
 const patterns=[0,.25,.5,.75,1].map(complexity=>generateGrooveV5(config({complexity}),profile));
 for(let i=1;i<patterns.length;i++){
  const previous=new Set(patterns[i-1].events.map(identity));
  const current=new Set(patterns[i].events.map(identity));
  for(const hit of previous)assert.ok(current.has(hit),`Complexity removed ${hit}`);
 }
 assert.ok(patterns.at(-1).events.length>patterns[0].events.length);
 assert.equal(v5ProfileFor('breakcore').genre,'breakcore');
 assert.ok(v5ProfileFor('breakcore').anchors.every(motif=>motif.id.startsWith('breakcore-')));
});

test('high-complexity ending resolves the snare run with a simultaneous kick',()=>{
 const profile=v5ProfileFor(genre),ending=3*3840+15.5*240;
 for(const seed of ['sr20-opening-study','alternate-break-01']){
  const settings=config({seed,phraseLength:8,phraseOffset:4,complexity:.85,spicy:1,fillAmount:1});
  const hits=generateGrooveV5(settings,profile).events;
  const resolution=hits.filter(hit=>hit.baseTick===ending&&['kick','snare'].includes(hit.role));
  assert.deepEqual(resolution.map(hit=>hit.role).sort(),['kick','snare']);
  assert.ok(Math.abs(resolution[0].offsetTick-resolution[1].offsetTick)<8,
   'the closing kick and snare must still land together after Spicy edits');
  assert.ok(hits.some(hit=>hit.role==='snare'&&hit.baseTick===3*3840+14.5*240),
   'the closing pair needs a preceding snare run');
 }
 const dry=generateGrooveV5(config({phraseLength:8,phraseOffset:4,fillAmount:0}),profile);
 assert.ok(!dry.events.some(hit=>hit.reason.includes('cadence-atmospheric-kick-with-final-snare')),
  'Fill Amount zero must remove the closing cadence');
});

test('higher Complexity adds bounded authored rolls to the opening without changing its kick/snare spine',()=>{
 const profile=v5ProfileFor(genre);
 const low=generateGrooveV5(config({phraseLength:8,phraseOffset:0,complexity:.3,spicy:0,fillAmount:0}),profile);
 const high=generateGrooveV5(config({phraseLength:8,phraseOffset:0,complexity:.85,spicy:0,fillAmount:0}),profile);
 const anchors=pattern=>pattern.events.filter(hit=>hit.anchor).map(identity);
 assert.deepEqual(anchors(high),anchors(low));
 assert.ok(!low.events.some(hit=>hit.ratchets>1));
 const rolls=high.events.filter(hit=>hit.ratchets>1);
 assert.ok(rolls.some(hit=>hit.role==='snare'&&barOf(hit)<4));
 assert.ok(rolls.length<=8,'opening should not become a constant stream of rolls');
 for(const hit of rolls){
  assert.ok([2,3,4].includes(hit.ratchets));
  assert.equal(hit.articulation?.repeats?.length,hit.ratchets);
  assert.ok(hit.articulation.durationTicks>0&&hit.articulation.durationTicks<=480);
 }
 const invalid=structuredClone(profile);
 invalid.layers.find(layer=>layer.id==='atmospheric-opening-snare-cuts').notes[0].rollRepeats=5;
 assert.throws(()=>validateV5Profile(invalid,genre),/authored roll/);

 const short=generateGrooveV5(config({bars:2,phraseLength:undefined,complexity:.85,
  spicy:0,fillAmount:0}),profile);
 const counts=[0,1].map(bar=>short.events.filter(hit=>barOf(hit)===bar).length);
 assert.ok(counts[0]<counts[1],'a two-bar pattern should move from a simpler opening to a broken response');
 assert.ok(short.events.some(hit=>barOf(hit)===1&&hit.role==='snare'&&hit.ratchets>1));
});

test('the two listener-approved phrase renders remain stable at the study settings',()=>{
 const profile=v5ProfileFor(genre);
 const settings=config({phraseLength:8,spicy:.35,fillAmount:.4,ghostAmount:.7,
  syncopation:.7,patternStructure:'auto'});
 const counts=offset=>{
  const pattern=generateGrooveV5({...settings,phraseOffset:offset},profile);
  return Array.from({length:4},(_,bar)=>pattern.events.filter(hit=>barOf(hit)===bar).length);
 };
 assert.deepEqual(counts(0),[14,16,13,13]);
 assert.deepEqual(counts(4),[18,23,24,21]);
 const invalid=structuredClone(profile);
 invalid.layers.find(layer=>layer.id==='atmospheric-opening-snare-cuts').maximumPhraseProgress=1.1;
 assert.throws(()=>validateV5Profile(invalid,genre),/phrase progress/);
});

test('the genre kit replaces the cowbell with layered break drums',()=>{
 assert.equal(genreDefaults(genre).bpm,170);
 const kit=KIT_PRESETS.find(item=>item.id===GENRE_KITS[genre]);
 assert.ok(kit);
 assert.equal(kit.slots.percussion,'udnb-perc-13');
 assert.equal(kit.slots.hat,'udnb-hat-11');
 for(const role of ['kick','snare']){
  assert.ok(kit.velocityLayers?.[role]);
  for(const id of Object.values(kit.velocityLayers[role]))
   assert.ok(LIBRARY.some(sound=>sound.id===id&&sound.role===role),`${role} layer ${id} is missing`);
 }
});
