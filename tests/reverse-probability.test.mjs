import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,validateSettings} from '../dist/core/generate.js';
import {defaults,genreDefaults} from '../dist/core/profiles.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';

const config=(patch={})=>({...genreDefaults('jungle'),algorithm:'groove-v5',bars:2,seed:'reverse-test',spicy:0,...patch});

test('reverse probability validates as a normalized 0–1 setting and defaults off',()=>{
 assert.equal(defaults().reverseProbability,0);
 assert.doesNotThrow(()=>validateSettings(config({reverseProbability:0})));
 assert.doesNotThrow(()=>validateSettings(config({reverseProbability:1})));
 assert.throws(()=>validateSettings(config({reverseProbability:-.01})),/reverseProbability/);
 assert.throws(()=>validateSettings(config({reverseProbability:1.01})),/reverseProbability/);
});

test('omitted and zero probability preserve generated hits; full probability reverses every sample hit',()=>{
 const settings=config(),baseline=generate(settings),omitted={...settings};delete omitted.reverseProbability;
 assert.deepEqual(generate(omitted).events,baseline.events);
 assert.ok(baseline.events.every(hit=>!hit.reverse));
 const reversed=generate({...settings,reverseProbability:1});
 assert.equal(reversed.events.length,baseline.events.length);
 assert.ok(reversed.events.length>0&&reversed.events.every(hit=>hit.reverse===true));
});

test('full probability works consistently across every retained drum engine',()=>{
 for(const algorithm of ['legacy-v1','groove-v2','groove-v3','groove-v4','groove-v5']){
  const pattern=generate(config({algorithm,reverseProbability:1}));
  assert.ok(pattern.events.length>0,algorithm);
  assert.ok(pattern.events.every(hit=>hit.reverse===true),algorithm);
 }
});

test('midpoint selection is deterministic per seed and variation and excludes synth notes',()=>{
 const settings=config({reverseProbability:.5}),first=generate(settings),again=generate(settings);
 assert.deepEqual(first.events.map(hit=>[hit.id,!!hit.reverse]),again.events.map(hit=>[hit.id,!!hit.reverse]));
 const signature=pattern=>pattern.events.filter(hit=>hit.reverse).map(hit=>hit.id).join('|');
 assert.notEqual(signature(first),signature(generate({...settings,seed:'another-reverse-seed'})));
 assert.notEqual(signature(first),signature(generate({...settings,variation:1})));
 const synthEditor=new Editor(generate(settings));
 assert.ok(synthEditor.generateComposition({...settings,generationMode:'melody',melodyPart:'piano'}));
 assert.ok(synthEditor.state.pattern.events.filter(hit=>hit.synthNote).length>0);
 assert.ok(synthEditor.state.pattern.events.filter(hit=>hit.synthNote).every(hit=>!hit.reverse));
});

test('Think slices follow the setting while manual hits survive regeneration unchanged',()=>{
 const settings=config({reverseProbability:0,hitTarget:32}),editor=new Editor(generate(settings));
 const manual={id:'manual-before-reverse',role:'hat',sourceId:'kit.hat',baseTick:333,offsetTick:0,gain:.5,pan:0,anchor:false,ghost:false,reason:'manual'};
 editor.write(manual);
 assert.ok(editor.generateComposition({...settings,reverseProbability:1,breakLayer:'think-passage2'}));
 const pattern=editor.state.pattern;
 assert.ok(pattern.events.filter(hit=>hit.mapped?.instrumentId==='think-passage2-drums'||hit.mapped?.instrumentId==='think-passage2-uh').every(hit=>hit.reverse===true));
 assert.equal(pattern.events.find(hit=>hit.id===manual.id).reverse,undefined);
 assert.equal(pattern.events.filter(hit=>!hit.synthNote).length,32);
});

test('reverse probability and reversed hits roundtrip in projects; older missing settings load as off',()=>{
 const pattern=generate(config({reverseProbability:.8})),editor=new Editor(pattern);
 const project=makeProject(editor.state,pattern.settings,defaultKitState(),new Map());
 const loaded=readProject(project).project.editor.pattern;
 assert.equal(loaded.settings.reverseProbability,.8);
 assert.deepEqual(loaded.events,pattern.events);
 const older=structuredClone(project);delete older.draft.reverseProbability;delete older.editor.pattern.settings.reverseProbability;
 const oldLoaded=readProject(older).project.editor.pattern;
 assert.equal(oldLoaded.settings.reverseProbability,undefined);
 assert.deepEqual(generate({...oldLoaded.settings,reverseProbability:oldLoaded.settings.reverseProbability??0}).events,
  generate({...oldLoaded.settings,reverseProbability:0}).events);
});
