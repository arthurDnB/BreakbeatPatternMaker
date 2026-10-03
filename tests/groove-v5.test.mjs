import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {generateGrooveV5,planV5Phrase,validateV5Profile} from '../dist/core/groove-v5.js';
import {v5ProfileFor} from '../dist/core/groove-v5-baseline.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';

const config=(genre='jungle',overrides={})=>({...genreDefaults(genre),algorithm:'groove-v5',seed:'v5-contract',bars:2,complexity:.7,spicy:.5,...overrides});

test('new genre defaults select Groove V5',()=>{
 for(const genre of Object.keys(PROFILES))assert.equal(genreDefaults(genre).algorithm,'groove-v5',genre);
});
const fixture={
 genre:'jungle',
 anchors:[{id:'spine-a',bars:1,notes:[{bar:0,step:0,role:'kick',gain:.9},{bar:0,step:8,role:'snare',gain:.9}]}],
 layers:[
  {id:'pulse',role:'hat',minimum:0,notes:[{step:2,gain:.4}]},
  {id:'counter',role:'kick',minimum:.5,notes:[{step:5,gain:.55,syncopated:true}]},
  {id:'answer',role:'snare',minimum:1,on:['response','turnaround'],notes:[{step:13,gain:.3,ghost:true}]}
 ],
 cadences:[{id:'ending',role:'hat',minimum:.25,notes:[{step:14,gain:.48}]}],
 timing:{kick:{swing:0,dragMs:0},snare:{swing:0,dragMs:2},hat:{swing:.7,dragMs:0},percussion:{swing:.5,dragMs:0}},
 spice:{gestures:['roll'],roles:['hat','snare'],maxPerBar:3,maxRepeats:4,minRepeatMs:15,pitchSteps:[0,7]},
 responseWeight:1
};
const anchors=p=>p.events.filter(hit=>hit.anchor);

test('V5 contract validates and inherited profiles compile deterministically for every existing genre',()=>{
 for(const genre of Object.keys(PROFILES)){
  const profile=v5ProfileFor(genre),settings=config(genre,{spicy:1,complexity:1,bpm:220});
  validateV5Profile(profile,genre);
  const original=structuredClone(settings),pattern=generate(settings);
  assert.deepEqual(settings,original);
  assert.deepEqual(pattern,generate(settings),genre);
  assert.equal(pattern.settings.algorithm,'groove-v5');
  assert.equal(pattern.engineVersion,'0.5.0-groove.1');
  assert.equal(compile(pattern).notes.length,pattern.events.length,genre);
  assert.ok(pattern.events.every(hit=>hit.baseTick+hit.offsetTick>=0&&hit.baseTick+hit.offsetTick<settings.bars*3840),genre);
 }
});

test('phrase planning respects song offset and only adds automatic cadence at an ending',()=>{
 const early=config('jungle',{bars:1,phraseLength:4,phraseOffset:0,complexity:1,spicy:0,fillAmount:1,ghostAmount:1,syncopation:1});
 const late={...early,phraseOffset:3};
 assert.equal(planV5Phrase(early,fixture).bars[0].function,'opening');
 assert.equal(planV5Phrase(late,fixture).bars[0].function,'turnaround');
 assert.equal(generateGrooveV5(early,fixture).events.some(hit=>hit.baseTick===14*240),false);
 assert.equal(generateGrooveV5(late,fixture).events.some(hit=>hit.baseTick===14*240),true);
 assert.deepEqual(anchors(generateGrooveV5(early,fixture)),anchors(generateGrooveV5(late,fixture)));
});

test('Complexity admits named layers monotonically and Spicy articulates only non-anchors',()=>{
 const base=config('jungle',{bars:2,complexity:0,spicy:0,fillAmount:0,ghostAmount:1,syncopation:1});
 const low=generateGrooveV5(base,fixture),middle=generateGrooveV5({...base,complexity:.5},fixture);
 const high=generateGrooveV5({...base,complexity:1},fixture);
 const expressive=generateGrooveV5({...base,complexity:1,spicy:1},fixture);
 assert.ok(low.events.length<middle.events.length&&middle.events.length<high.events.length);
 assert.deepEqual(anchors(low),anchors(middle));
 assert.deepEqual(anchors(middle),anchors(high));
 assert.deepEqual(anchors(high),anchors(expressive));
 assert.deepEqual(high.events.map(hit=>[hit.id,hit.baseTick]),expressive.events.map(hit=>[hit.id,hit.baseTick]));
 assert.ok(expressive.events.some(hit=>!hit.anchor&&hit.ratchets>1));
 assert.ok(expressive.events.every(hit=>!hit.articulation||hit.articulation.mode==='natural'||hit.baseTick+hit.offsetTick+hit.articulation.durationTicks<=expressive.settings.bars*3840));
});

test('variation retains anchor motif, excluded roles disappear, and invalid profiles fail early',()=>{
 const settings=config('jungle',{bars:2,complexity:1,spicy:0,fillAmount:1,ghostAmount:1,syncopation:1});
 const first=generateGrooveV5(settings,fixture);
 for(let variation=1;variation<=5;variation++)assert.deepEqual(anchors(first),anchors(generateGrooveV5({...settings,variation},fixture)));
 const excluded=generateGrooveV5({...settings,enabledRoles:['kick','snare']},fixture);
 assert.ok(excluded.events.every(hit=>hit.role==='kick'||hit.role==='snare'));
 assert.throws(()=>generateGrooveV5(settings,{...fixture,layers:[{...fixture.layers[0],notes:[{step:16,gain:.4}]}]}),/Invalid Groove V5 step/);
});

test('V5 variation, locks, exact target, project roundtrip and shared audio path remain functional',()=>{
 const settings=config('jungle',{bars:1,complexity:.8,spicy:.7,fillAmount:0});
 const original=generate(settings),editor=new Editor(original);
 editor.toggleRole('kick');
 const held=structuredClone(editor.state.pattern.events.filter(hit=>hit.role==='kick'));
 assert.ok(editor.variation());
 assert.equal(editor.state.pattern.settings.algorithm,'groove-v5');
 assert.deepEqual(editor.state.pattern.events.filter(hit=>hit.role==='kick'),held);
 assert.ok(editor.undo());assert.ok(editor.redo());
 const project=makeProject(editor.state,editor.state.pattern.settings,defaultKitState(),new Map());
 assert.deepEqual(readProject(project).project.editor.pattern,editor.state.pattern);
 const protectedCount=original.events.filter(hit=>hit.anchor).length;
 assert.throws(()=>generate({...settings,hitTarget:protectedCount-1}),/Exact hits needs at least/);
 assert.equal(generate({...settings,hitTarget:protectedCount}).events.length,protectedCount);
 const mixed=withDrumKit(original,{},defaultKitState());
 const a=renderPerformance(mixed,new Map(),8000,{}, {loop:true});
 const b=renderPerformance(mixed,new Map(),8000,{}, {loop:true});
 assert.deepEqual(a.channels,b.channels);
 assert.ok(a.channels.some(channel=>channel.some(sample=>Math.abs(sample)>.01)));
});

test('V5 exact target is applied after the optional Think layer and retained manual hits',()=>{
 const settings=config('jungle',{bars:2,complexity:1,spicy:0,ghostAmount:1,fillAmount:1,hitTarget:40});
 const editor=new Editor(generate(settings));
 const manual={id:'v5-manual-hat',role:'hat',sourceId:'kit.hat',sourceKind:'oneShot',baseTick:1350,offsetTick:0,
  gain:.45,pan:0,anchor:false,ghost:false,reason:'User hat.'};
 editor.write(manual);editor.toggleRole('kick');
 const held=structuredClone(editor.state.pattern.events.filter(hit=>hit.role==='kick'));
 assert.ok(editor.generateComposition({...settings,hitTarget:50,breakLayer:'think-passage2'}));
 assert.equal(editor.state.pattern.events.filter(hit=>!hit.synthNote).length,50);
 assert.deepEqual(editor.state.pattern.events.filter(hit=>hit.role==='kick'&&!hit.trackId),held);
 assert.ok(editor.state.pattern.events.some(hit=>hit.id===manual.id&&hit.manual));
 assert.ok(editor.state.pattern.events.some(hit=>hit.mapped?.instrumentId==='think-passage2-uh'));
 assert.ok(editor.undo());assert.ok(editor.redo());
});
