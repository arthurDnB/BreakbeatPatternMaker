import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGrooveV5,validateV5Profile} from '../dist/core/groove-v5.js';
import {baselineV5Profile,v5ProfileFor} from '../dist/core/groove-v5-baseline.js';
import {genreDefaults} from '../dist/core/profiles.js';

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
