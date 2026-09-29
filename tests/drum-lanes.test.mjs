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

test('editor variations, simplification and detail work on generated sample hits without touching manual notes or locks',()=>{
 const editor=new Editor(generate({...settings,algorithm:'groove-v4',complexity:.55}));
 editor.addUserTrack(sampleTrack);editor.setSampleTrackGeneration(sampleTrack.id,'snare');
 editor.generateComposition({...settings,algorithm:'groove-v4',complexity:.55},'Generate Beat');
 const generated=editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id);
 const ornament=generated.find(hit=>!hit.anchor);assert.ok(ornament);
 const anchor=generated.find(hit=>hit.anchor);assert.ok(anchor);
 const manual={...ornament,id:'manual-sample-test',baseTick:Math.min(7000,ornament.baseTick+47)};
 delete manual.generatedDrumRole;editor.write(manual);
 editor.state.lockedIds=[ornament.id];
 editor.state.selection={ids:[],rows:null};
 const protectedHits=[anchor,ornament,manual].map(hit=>structuredClone(editor.state.pattern.events.find(item=>item.id===hit.id)));
 const checkProtected=()=>{for(const hit of protectedHits)assert.deepEqual(editor.state.pattern.events.find(item=>item.id===hit.id),hit);};
 const beforeMutation=structuredClone(editor.state.pattern);
 assert.ok(editor.mutate());checkProtected();
 assert.ok(editor.state.pattern.events.some(hit=>hit.trackId===sampleTrack.id&&hit.generatedDrumRole&&JSON.stringify(hit)!==JSON.stringify(beforeMutation.events.find(item=>item.id===hit.id))));
 assert.ok(editor.undo());assert.deepEqual(editor.state.pattern,beforeMutation);assert.ok(editor.redo());
 const countBefore=editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id).length;
 assert.ok(editor.simplify());checkProtected();
 assert.ok(editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id).length<countBefore);
 assert.ok(editor.undo());assert.equal(editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id).length,countBefore);
 assert.ok(editor.increaseComplexity());checkProtected();
 assert.ok(editor.state.pattern.events.some(hit=>hit.id.startsWith('detail-')&&hit.trackId===sampleTrack.id&&hit.generatedDrumRole==='snare'));
 const detailed=structuredClone(editor.state.pattern);
 assert.ok(editor.undo());assert.ok(editor.redo());assert.deepEqual(editor.state.pattern,detailed);
});

test('genre fills route to sample tracks without replacing manually entered or locked hits',()=>{
 const editor=new Editor(generate({...settings,algorithm:'groove-v4'}));editor.addUserTrack(sampleTrack);
 editor.setSampleTrackGeneration(sampleTrack.id,'snare');editor.generateComposition({...settings,algorithm:'groove-v4'},'Generate Beat');
 const note=editor.state.pattern.events.find(hit=>hit.trackId===sampleTrack.id&&!hit.anchor);assert.ok(note);
 const manual={...note,id:'manual-fill-test',baseTick:7*960+120};delete manual.generatedDrumRole;editor.write(manual);
 const locked=editor.state.pattern.events.find(hit=>hit.trackId===sampleTrack.id&&hit.generatedDrumRole);editor.state.lockedIds=[locked.id];
 const before=structuredClone(editor.state.pattern),rows=compile(before).timing.lines;
 editor.state.selection={ids:[],rows:[rows-8,rows-1]};
 assert.ok(editor.fill());
 assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===manual.id),manual);
 assert.deepEqual(editor.state.pattern.events.find(hit=>hit.id===locked.id),locked);
 assert.ok(editor.state.pattern.events.some(hit=>hit.id.startsWith('fill-')&&hit.trackId===sampleTrack.id&&hit.generatedDrumRole==='snare'));
 assert.ok(editor.undo());assert.deepEqual(editor.state.pattern,before);
});

test('edit target limits mutate, simplify, added detail and fills to one of two uploaded tracks',()=>{
 const opts={...settings,algorithm:'groove-v4',complexity:.45};
 const second={...sampleTrack,id:'track-snare-layer',name:'Second snare'};
 const setup=(role)=>{
  const editor=new Editor(generate(opts));editor.addUserTrack(sampleTrack);editor.addUserTrack(second);
  editor.setSampleTrackGeneration(sampleTrack.id,role);editor.setSampleTrackGeneration(second.id,role);
  editor.generateComposition(opts,'Generate Beat');return editor;
 };
 const otherLanes=(pattern)=>pattern.events.filter(hit=>hit.trackId!==sampleTrack.id);
 for(const method of ['mutate','simplify','increaseComplexity']){
  const editor=setup('hat'),before=structuredClone(editor.state.pattern);
  assert.ok(editor[method](sampleTrack.id),`${method} should edit the target track`);
  assert.deepEqual(otherLanes(editor.state.pattern),otherLanes(before),`${method} changed another track`);
  assert.ok(editor.undo());assert.deepEqual(editor.state.pattern,before);
 }
 const editor=setup('snare'),before=structuredClone(editor.state.pattern),rows=compile(before).timing.lines;
 editor.state.selection={ids:[],rows:[rows-8,rows-1]};
 assert.ok(editor.fill(sampleTrack.id));
 assert.deepEqual(otherLanes(editor.state.pattern),otherLanes(before));
 assert.ok(editor.state.pattern.events.some(hit=>hit.id.startsWith('fill-')&&hit.trackId===sampleTrack.id));
 assert.ok(editor.undo());assert.deepEqual(editor.state.pattern,before);
});

test('sample-track density keeps a stable subset and chance changes optional notes without moving anchors',()=>{
 const s={...settings,algorithm:'groove-v4',seed:'track-shape',bars:4,complexity:.9,spicy:.5};
 const editor=new Editor(generate(s));editor.addUserTrack(sampleTrack);editor.setSampleTrackGeneration(sampleTrack.id,'hat');
 const notes=()=>editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id);
 editor.generateComposition(s,'Generate Beat');const full=notes(),anchors=full.filter(hit=>hit.anchor);
 assert.ok(full.length>anchors.length+5);
 editor.setSampleTrackGenerationAmount(sampleTrack.id,'generationDensity',.5);
 editor.generateComposition(s,'Generate Beat');const half=notes();
 assert.equal(half.filter(hit=>!hit.anchor).length,Math.round((full.length-anchors.length)*.5));
 assert.deepEqual(half.filter(hit=>hit.anchor),anchors);
 editor.generateComposition(s,'Generate Beat');assert.deepEqual(notes(),half,'same settings produce the same routed notes');
 editor.setSampleTrackGenerationAmount(sampleTrack.id,'generationProbability',0);
 editor.generateComposition(s,'Generate Beat');assert.deepEqual(notes(),anchors);
 editor.setSampleTrackGenerationAmount(sampleTrack.id,'generationProbability',.5);
 editor.generateComposition(s,'Generate Beat');const first=notes();
 editor.generateComposition({...s,variation:1},'Variation');const second=notes();
 assert.deepEqual(first.filter(hit=>hit.anchor),anchors);
 assert.deepEqual(second.filter(hit=>hit.anchor),anchors);
 assert.notDeepEqual(first.map(hit=>hit.id),second.map(hit=>hit.id),'chance changes the optional hits across variations');
});

test('sample-track controls are independent, undoable, validated, and saved with the project',()=>{
 const editor=new Editor(generate(settings));editor.addUserTrack(sampleTrack);
 const second={...sampleTrack,id:'track-second-upload',name:'Second layer'};editor.addUserTrack(second);
 editor.setSampleTrackGeneration(sampleTrack.id,'hat');editor.setSampleTrackGeneration(second.id,'hat');
 editor.setSampleTrackGenerationAmount(sampleTrack.id,'generationDensity',0);
 editor.setSampleTrackGenerationAmount(sampleTrack.id,'generationProbability',.25);
 assert.equal(editor.undo(),true);assert.equal(editor.state.pattern.userTracks.find(track=>track.id===sampleTrack.id).generationProbability,undefined);
 assert.equal(editor.redo(),true);assert.equal(editor.state.pattern.userTracks.find(track=>track.id===sampleTrack.id).generationProbability,.25);
 editor.generateComposition(settings,'Generate Beat');
 const first=editor.state.pattern.events.filter(hit=>hit.trackId===sampleTrack.id),other=editor.state.pattern.events.filter(hit=>hit.trackId===second.id);
 assert.ok(other.length>first.length);
 assert.ok(first.every(hit=>hit.anchor));
 const assets=new Map([[sampleAsset.id,sampleAsset]]),loaded=readProject(makeProject(editor.state,settings,defaultKitState(),assets)).project.editor.pattern;
 assert.equal(loaded.userTracks.find(track=>track.id===sampleTrack.id).generationDensity,0);
 assert.equal(loaded.userTracks.find(track=>track.id===sampleTrack.id).generationProbability,.25);
 assert.throws(()=>editor.setSampleTrackGenerationAmount(sampleTrack.id,'generationDensity',-1),/between 0% and 100%/);
 assert.throws(()=>compile({...loaded,userTracks:loaded.userTracks.map(track=>track.id===sampleTrack.id?{...track,generationProbability:1.1}:track)}),/sample track probability/);
});
