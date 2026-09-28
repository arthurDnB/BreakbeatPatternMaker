import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';

const asset={id:'user-loop',name:'User loop',sampleRate:8000,channels:[Float32Array.from({length:1600},(_,i)=>Math.sin(i*.15)*.5)]};
const track={id:'track-user-loop',name:'User loop',role:'percussion',sample:{assetId:asset.id,startFrame:0,endFrame:1600,sampleRate:8000,label:asset.name},level:1,pan:0,mute:false,solo:false};
const addHit=(editor,id='user-hit',baseTick=0)=>editor.write({id,role:'percussion',trackId:track.id,sourceId:'kit.percussion',slice:{...track.sample},baseTick,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'User sample track hit.'});

test('sample tracks compile as independent lanes and remain editable through generator replacement',()=>{
 const editor=new Editor(generate({...defaults(),bars:2}));editor.addUserTrack(track);assert.ok(addHit(editor));
 let transfer=compile(editor.state.pattern);assert.ok(transfer.lanes.some(l=>l.id===track.id&&l.name===track.name));assert.ok(transfer.notes.some(n=>n.id==='user-hit'&&n.lane===track.id));
 assert.match(transfer.warnings.join(' '),/Custom sample-track audio is not embedded/);
 assert.throws(()=>compile({...editor.state.pattern,userTracks:[{...track,id:'kick'}]}),/Invalid or duplicate user track/);
 const before=structuredClone(editor.state.pattern.events.find(h=>h.id==='user-hit'));
 editor.replace(generate({...defaults(),bars:2,seed:'regenerated'}));
 assert.deepEqual(editor.state.pattern.events.find(h=>h.id==='user-hit'),before);assert.ok(compile(editor.state.pattern).lanes.some(l=>l.id===track.id));
 assert.equal(editor.renameUserTrack(track.id,'Texture'),true);assert.equal(compile(editor.state.pattern).lanes.find(l=>l.id===track.id).name,'Texture');
 assert.equal(editor.reorderUserTrack(track.id,1),false);assert.equal(editor.deleteUserTrack(track.id),true);assert.equal(editor.undo(),true);assert.ok(editor.state.pattern.userTracks.some(t=>t.id===track.id));
});

test('sample-track mute/solo, track data, and audio survive project save/reopen',()=>{
 const editor=new Editor(generate({...defaults(),bars:1}));editor.addUserTrack(track);addHit(editor);editor.state.pattern.events=editor.state.pattern.events.filter(h=>h.trackId===track.id);
 const kit=defaultKitState(),assets=new Map([[asset.id,asset]]),project=makeProject(editor.state,defaults(),kit,assets);
 assert.equal(project.version,5);assert.ok(project.assets.some(a=>a.id===asset.id));
 const restored=readProject(project);assert.equal(restored.project.editor.pattern.userTracks[0].sample.assetId,asset.id);assert.equal(restored.assets.get(asset.id).channels[0].length,1600);
 const rendered=renderPerformance(withDrumKit(restored.project.editor.pattern,{},kit),restored.assets,8000);
 assert.ok(rendered.channels[0].some(value=>Math.abs(value)>.05));
 const muted=structuredClone(restored.project.editor.pattern);muted.userTracks[0].mute=true;
 const silent=renderPerformance(withDrumKit(muted,{},kit),restored.assets,8000);
 assert.ok(silent.channels[0].every(value=>value===0));
 const solo=structuredClone(restored.project.editor.pattern);solo.userTracks[0].solo=true;
 const soloed=renderPerformance(withDrumKit(solo,{},kit),restored.assets,8000);
 assert.ok(soloed.channels[0].some(value=>Math.abs(value)>.05));
});
