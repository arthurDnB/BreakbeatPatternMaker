import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {Editor} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';

const config=(genre='jungle',patch={})=>({...genreDefaults(genre),seed:'exact-notes',bars:2,algorithm:'groove-v4',...patch});
const drumCount=pattern=>pattern.events.filter(hit=>!hit.synthNote).length;

test('Exact Hits reaches the chosen tracker-note count across genres and structures',()=>{
 for(const genre of Object.keys(PROFILES))for(const target of [24,48]){
  const settings=config(genre,{hitTarget:target,complexity:.15,spicy:.85});
  const pattern=generate(settings);
  assert.equal(drumCount(pattern),target,genre);
  assert.deepEqual(pattern,generate(settings),genre+' must be repeatable');
  compile(pattern);
 }
 for(const structure of ['groove','auto','fill','roll','build']){
  const pattern=generate(config('amenscience',{hitTarget:56,patternStructure:structure,spicy:1}));
  assert.equal(drumCount(pattern),56,structure);
  assert.ok(pattern.events.some(hit=>hit.anchor),structure);
 }
 const sparse=generate(config('jungle',{hitTarget:20}));
 assert.ok(sparse.events.some(hit=>hit.role==='hat'),'a sparse target should retain the hat pulse');
 assert.equal(sparse.events.filter(hit=>hit.baseTick<3840).length,10,'hits should span both bars');
});

test('Auto leaves the existing V4 output unchanged and targets reject impossible minima',()=>{
 const settings=config('jungle');
 assert.deepEqual(generate(settings).events,generate({...settings,hitTarget:undefined}).events);
 assert.throws(()=>generate({...settings,hitTarget:0}),/at least \d+ notes/);
 assert.throws(()=>generate({...settings,hitTarget:300}),/hit target/);
 const noHats=generate({...settings,hitTarget:24,laneDensity:{hat:0}});
 assert.equal(noHats.events.length,24);
 assert.equal(noHats.events.filter(hit=>hit.role==='hat').length,0);
});

test('Final count includes Think slices and respects manual notes, locks and Undo',()=>{
 const base=config('jungle',{hitTarget:46,breakLayer:'off'});
 const editor=new Editor(generate(base));
 const manual={id:'manual-hat',role:'hat',sourceId:'kit.hat',sourceKind:'oneShot',baseTick:1350,offsetTick:0,gain:.5,pan:0,anchor:false,ghost:false,reason:'Manual hat.'};
 assert.ok(editor.write(manual));
 editor.toggleRole('kick');
 const kicks=structuredClone(editor.state.pattern.events.filter(hit=>hit.role==='kick'&&!hit.trackId));
 const before=structuredClone(editor.state.pattern);
 assert.ok(editor.generateComposition({...base,breakLayer:'think-passage2'}));
 assert.equal(drumCount(editor.state.pattern),46);
 assert.deepEqual(editor.state.pattern.events.filter(hit=>hit.role==='kick'&&!hit.trackId),kicks);
 assert.ok(editor.state.pattern.events.some(hit=>hit.id===manual.id&&hit.manual));
 assert.ok(editor.state.pattern.events.some(hit=>hit.trackId==='think-break-layer'));
 assert.ok(editor.state.pattern.events.some(hit=>hit.mapped?.instrumentId==='think-passage2-uh'));
 const sparseSettings={...base,hitTarget:24};
 const sparseThink=new Editor(generate(sparseSettings));
 sparseThink.generateComposition({...sparseSettings,breakLayer:'think-passage2'});
 assert.equal(drumCount(sparseThink.state.pattern),24);
 assert.ok(sparseThink.state.pattern.events.some(hit=>hit.mapped?.instrumentId==='think-passage2-uh'),'low targets should still keep the requested Think vocal');
 assert.ok(editor.undo());assert.deepEqual(editor.state.pattern,before);
 assert.ok(editor.redo());assert.equal(drumCount(editor.state.pattern),46);
 const thinkAudio={id:'think-passage2-raw',name:'Think test audio',sampleRate:44100,channels:[new Float32Array(69255)]};
 const saved=makeProject(editor.state,editor.state.pattern.settings,defaultKitState(),new Map([[thinkAudio.id,thinkAudio]]));
 assert.equal(readProject(saved).project.editor.pattern.settings.hitTarget,46);
});

test('Manual sample tracks, generated sample tracks and synth notes count correctly',()=>{
 const settings=config('garage',{hitTarget:40});
 const editor=new Editor(generate(settings));
 const sample={id:'user-drum',name:'User Drum',kind:'sample',role:'percussion',generationRole:'hat',sample:{assetId:'test-sample',sampleRate:44100,startFrame:0,endFrame:1000,label:'test'},level:1,pan:0,mute:false,solo:false};
 editor.addUserTrack(sample);
 editor.generateComposition(settings);
 assert.equal(drumCount(editor.state.pattern),40);
 assert.ok(editor.state.pattern.events.some(hit=>hit.trackId===sample.id));
 const melodySettings={...settings,generationMode:'melody',melodyPart:'bassline'};
 editor.generateComposition(melodySettings);
 assert.equal(drumCount(editor.state.pattern),40);
 assert.ok(editor.state.pattern.events.some(hit=>hit.synthNote));
});
