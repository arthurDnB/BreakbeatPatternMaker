import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {drumLane} from '../dist/core/drum-lanes.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {makeProject,readProject} from '../dist/audio/project.js';

const settings={...defaults('jungle'),seed:'flexible-lanes',bars:2};

test('named lanes route a generator part into their own sound lane and survive save/reopen',()=>{
 const editor=new Editor(generate(settings));
 assert.equal(editor.setDrumLane('kick',{name:'Think Snare',generationRole:'snare'}),true);
 editor.setDrumLane('snare',{visible:false,generationRole:null});
 const originalSnareCount=generate(settings).events.filter(hit=>hit.role==='snare').length;
 editor.generateComposition(settings,'Generate Beat');
 const pattern=editor.state.pattern,routed=pattern.events.filter(hit=>hit.role==='kick');
 assert.equal(routed.length,originalSnareCount);
 assert.ok(routed.every(hit=>hit.sourceId==='kit.kick'&&hit.reason.includes('Think Snare')));
 assert.equal(pattern.events.some(hit=>hit.role==='snare'),false);
 assert.equal(compile(pattern).lanes.find(lane=>lane.id==='kick').name,'Think Snare');
 const kickSample={assetId:'kick-test',startFrame:0,endFrame:100,sampleRate:24000,label:'Custom kick lane sample'};
 const rendered=withDrumKit(pattern,{kick:kickSample},defaultKitState());
 assert.ok(rendered.events.filter(hit=>hit.role==='kick').every(hit=>hit.slice?.assetId==='kick-test'));
 const project=makeProject(editor.state,settings,defaultKitState(),new Map());
 const restored=readProject(project).project.editor.pattern;
 assert.deepEqual(restored.drumLanes,pattern.drumLanes);
 assert.deepEqual(restored.events,pattern.events);
});

test('layered role routing is deterministic, undoable and preserves locked hits',()=>{
 const editor=new Editor(generate(settings));
 editor.setDrumLane('kick',{name:'Layered Snare',generationRole:'snare'});
 const before=structuredClone(editor.state.pattern);
 editor.generateComposition(settings,'Generate Beat');
 const pattern=editor.state.pattern;
 assert.ok(pattern.events.some(hit=>hit.role==='kick'));
 assert.ok(pattern.events.some(hit=>hit.role==='snare'));
 assert.equal(new Set(pattern.events.map(hit=>hit.id)).size,pattern.events.length);
 assert.equal(editor.undo(),true);
 assert.deepEqual(editor.state.pattern,before);
 assert.equal(editor.redo(),true);
 assert.deepEqual(editor.state.pattern,pattern);
 const protectedHit=structuredClone(editor.state.pattern.events.find(hit=>hit.role==='kick'));
 editor.state.lockedIds=[protectedHit.id];
 editor.generateComposition({...settings,variation:1},'Variation');
 assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===protectedHit.id),protectedHit);
 assert.equal(drumLane(editor.state.pattern,'kick').generationRole,'snare');
});

test('layout validation rejects unusable lanes and hiding the last empty lane',()=>{
 const editor=new Editor({...generate(settings),events:[]});
 for(const role of ['kick','snare','hat'])editor.setDrumLane(role,{visible:false});
 assert.throws(()=>editor.setDrumLane('percussion',{visible:false}),/Show at least one tracker lane/);
 assert.throws(()=>editor.setDrumLane('percussion',{name:' '}),/Lane name/);
 const invalid={...editor.state.pattern,drumLanes:{...editor.state.pattern.drumLanes,kick:{name:'Kick',visible:true,generationRole:'bass'}}};
 assert.throws(()=>compile(invalid),/generation role/);
 assert.throws(()=>compile({...editor.state.pattern,drumLanes:{kick:null}}),/Invalid drum lane layout/);
});
