import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {drumLane} from '../dist/core/drum-lanes.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
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

const sampleAsset={id:'sample-lane-audio',name:'Snare upload',sampleRate:8000,channels:[Float32Array.from({length:800},(_,i)=>i<300?.45:0)]};
const sampleTrack={id:'track-snare-upload',name:'My snare',role:'percussion',sample:{assetId:sampleAsset.id,startFrame:0,endFrame:800,sampleRate:8000,label:sampleAsset.name},level:1,pan:0,mute:false,solo:false};

test('uploaded sample tracks receive assigned beats, play their own sample, and survive a project roundtrip',()=>{
 const editor=new Editor(generate(settings));editor.addUserTrack(sampleTrack);
 editor.setSampleTrackGeneration(sampleTrack.id,'snare');
 editor.setDrumLane('snare',{generationRole:null});
 editor.generateComposition(settings,'Generate Beat');
 const pattern=editor.state.pattern,notes=pattern.events.filter(hit=>hit.trackId===sampleTrack.id);
 assert.equal(notes.length,generate(settings).events.filter(hit=>hit.role==='snare').length);
 assert.ok(notes.every(hit=>hit.generatedDrumRole==='snare'&&hit.role==='percussion'&&hit.sourceId==='kit.percussion'));
 assert.ok(compile(pattern).notes.some(note=>note.lane===sampleTrack.id));
 const applied=withDrumKit(pattern,{percussion:{assetId:'wrong-kit',startFrame:0,endFrame:10,sampleRate:8000,label:'Wrong kit'}},defaultKitState());
 assert.ok(applied.events.filter(hit=>hit.trackId===sampleTrack.id).every(hit=>hit.slice?.assetId===sampleAsset.id));
 const assets=new Map([[sampleAsset.id,sampleAsset]]),preview=renderPerformance(withDrumKit(pattern,{},defaultKitState()),assets,8000,{}, {loop:true});
 assert.ok(preview.channels[0].some(value=>Math.abs(value)>.01));
 const saved=makeProject(editor.state,settings,defaultKitState(),assets),loaded=readProject(saved);
 assert.equal(loaded.project.editor.pattern.userTracks.find(track=>track.id===sampleTrack.id).generationRole,'snare');
 assert.deepEqual(loaded.project.editor.pattern.events,pattern.events);
 assert.deepEqual(renderPerformance(withDrumKit(loaded.project.editor.pattern,{},defaultKitState()),loaded.assets,8000,{}, {loop:true}).channels,
   renderPerformance(withDrumKit(pattern,{},defaultKitState()),assets,8000,{}, {loop:true}).channels);
});

test('sample-track regeneration replaces only generator notes, keeping hand edits and locked hits in one Undo step',()=>{
 const editor=new Editor(generate(settings));editor.addUserTrack(sampleTrack);editor.setSampleTrackGeneration(sampleTrack.id,'hat');
 editor.generateComposition(settings,'Generate Beat');
 const original=structuredClone(editor.state.pattern),generated=original.events.filter(hit=>hit.trackId===sampleTrack.id);
 assert.ok(generated.length>0);
 const locked=generated[0];editor.state.lockedIds=[locked.id];
 const manual={...generated.at(-1),id:'hand-placed-hit',baseTick:110,anchor:false,reason:'Manually placed.'};
 delete manual.generatedDrumRole;
 editor.write(manual);
 const before=structuredClone(editor.state.pattern);
 editor.generateComposition({...settings,variation:1},'Generate variation');
 const changed=editor.state.pattern;
 assert.deepEqual(changed.events.find(hit=>hit.id===locked.id),locked);
 assert.deepEqual(changed.events.find(hit=>hit.id===manual.id),manual);
 assert.equal(changed.events.filter(hit=>hit.trackId===sampleTrack.id&&hit.generatedDrumRole==='hat').length,generated.length);
 assert.equal(new Set(changed.events.map(hit=>hit.id)).size,changed.events.length);
 assert.equal(editor.undo(),true);assert.deepEqual(editor.state.pattern,before);
 assert.equal(editor.redo(),true);assert.deepEqual(editor.state.pattern,changed);
 const edited=changed.events.find(hit=>hit.trackId===sampleTrack.id&&hit.generatedDrumRole&&hit.id!==locked.id);
 assert.ok(edited);
 editor.editTrackerValue(edited.id,'volume',64);
 assert.equal(editor.state.pattern.events.find(hit=>hit.id===edited.id).generatedDrumRole,undefined);
 editor.generateComposition({...settings,variation:1},'Generate same beat');
 assert.equal(editor.state.pattern.events.find(hit=>hit.id===edited.id).gain,.5,'same-seed regeneration keeps the edited hit');
 editor.setSampleTrackGeneration(sampleTrack.id,null);
 editor.generateComposition({...settings,variation:2},'Generate Beat');
 assert.deepEqual(editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id&&hit.generatedDrumRole),[locked]);
 assert.ok(editor.state.pattern.events.some(hit=>hit.id===manual.id));
 assert.equal(editor.state.pattern.events.find(hit=>hit.id===edited.id).gain,.5);
});

test('all built-in parts can route exclusively into an uploaded sample track while melody generation leaves drums intact',()=>{
 const editor=new Editor(generate(settings));editor.addUserTrack(sampleTrack);
 for(const role of ['kick','snare','hat','percussion'])editor.setDrumLane(role,{generationRole:null});
 editor.setSampleTrackGeneration(sampleTrack.id,'kick');
 editor.generateComposition(settings,'Generate Beat');
 assert.ok(editor.state.pattern.events.length>0);
 assert.ok(editor.state.pattern.events.every(hit=>hit.trackId===sampleTrack.id&&hit.generatedDrumRole==='kick'));
 const before=structuredClone(editor.state.pattern.events);
 editor.generateComposition({...settings,generationMode:'melody',melodyPart:'bassline'},'Generate Bass');
 assert.deepEqual(editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id),before);
 assert.throws(()=>compile({...editor.state.pattern,userTracks:editor.state.pattern.userTracks.map(track=>track.id===sampleTrack.id?{...track,generationRole:'bass'}:track)}),/generation role/);
});
