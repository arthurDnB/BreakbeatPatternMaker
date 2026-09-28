import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {newBank,arrange} from '../dist/core/bank.js';
import {SYNTH_PRESETS,renderSynthNote} from '../dist/audio/synth-instrument.js';
import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';

const track={id:'synth-bass',name:'Bass',kind:'synth',role:'percussion',instrument:structuredClone(SYNTH_PRESETS.bass),level:1,pan:0,mute:false,solo:false};
const pattern=()=>({...generate({...defaults(),bars:1,bpm:120,algorithm:'groove-v4'}),events:[]});
const note=(id,pitch=48,row=0)=>({id,role:'percussion',trackId:track.id,sourceId:'kit.percussion',baseTick:row*240,offsetTick:0,gain:.8,pan:0,anchor:false,ghost:false,synthNote:{note:pitch,durationTicks:960},reason:'Bass note.'});

test('synth tracks compile, edit, transpose, and survive generation and history',()=>{
 const editor=new Editor(pattern());editor.addUserTrack(track);editor.write(note('first'));
 assert.equal(compile(editor.state.pattern).notes.find(n=>n.id==='first').lane,track.id);
 assert.equal(editor.editTrackerValue('first','note',60),true);
 assert.equal(editor.state.pattern.events[0].synthNote.note,60);
 assert.equal(editor.setSynthNoteDuration('first',1920),true);
 assert.equal(editor.state.pattern.events[0].synthNote.durationTicks,1920);
 assert.equal(editor.undo(),true);assert.equal(editor.state.pattern.events[0].synthNote.durationTicks,960);
 assert.equal(editor.redo(),true);assert.equal(editor.state.pattern.events[0].synthNote.durationTicks,1920);
 editor.replace(generate({...defaults(),bars:1,bpm:120,seed:'another-beat'}));
 assert.equal(editor.state.pattern.events.find(e=>e.id==='first').synthNote.note,60);
 assert.deepEqual(editor.state.pattern.userTracks.find(t=>t.id===track.id).instrument,track.instrument);
 assert.throws(()=>compile({...editor.state.pattern,events:[{...note('wrong'),synthNote:undefined}]}),/pitched notes/);
});

test('synth notes copy and move within synth lanes, with incompatible lanes rejected',()=>{
 const editor=new Editor(pattern());editor.addUserTrack(track);editor.write(note('first'));
 editor.state.selection={ids:['first'],rows:null};const clip=editor.copySelection();
 assert.equal(editor.pasteCells(clip,1,track.id),true);
 assert.equal(editor.state.pattern.events.filter(e=>e.synthNote).length,2);
 assert.equal(editor.moveCells([{row:1,lane:track.id}],2,track.id),true);
 assert.ok(compile(editor.state.pattern).notes.some(n=>n.row===2&&n.lane===track.id));
 assert.throws(()=>editor.moveCells([{row:2,lane:track.id}],2,'percussion'),/synth notes only/);
 editor.state.selection={ids:[],rows:null,cells:[{row:2,lane:track.id}]};assert.equal(editor.toggleSelectedLocks(),true);
 assert.throws(()=>editor.moveCells([{row:2,lane:track.id}],3,track.id),/Unlock selected hits/);
});

test('synth audio is deterministic, pitched, and saved without embedded sample data',()=>{
 const settings={...SYNTH_PRESETS.bass,waveform:'sine',lowpassHz:12000};
 const low=renderSynthNote(48,.5,44100,settings),high=renderSynthNote(60,.5,44100,settings);
 const crossings=data=>{let count=0;for(let i=4410;i<8820;i++)if(data[i-1]<0&&data[i]>=0)count++;return count;};
 assert.ok(Math.abs(crossings(high)/crossings(low)-2)<.15);
 const editor=new Editor(pattern());editor.addUserTrack({...track,instrument:settings});editor.write(note('first'));
 const project=makeProject(editor.state,defaults(),defaultKitState(),new Map());assert.equal(project.version,6);assert.equal(project.assets.length,0);
 const restored=readProject(project);assert.equal(restored.project.editor.pattern.events.find(e=>e.id==='first').synthNote.note,48);
 const kit=defaultKitState(),render=()=>renderPerformance(withDrumKit(restored.project.editor.pattern,{},kit),new Map(),8000);
 const first=render(),second=render();assert.deepEqual(first.channels,second.channels);assert.ok(first.channels[0].some(v=>Math.abs(v)>.01));
 const louder=structuredClone(restored.project.editor.pattern);louder.userTracks[0].level=1.5;
 const boosted=renderPerformance(withDrumKit(louder,{},kit),new Map(),8000);
 const energy=data=>data.slice(0,2000).reduce((sum,value)=>sum+Math.abs(value),0);
 assert.ok(energy(boosted.channels[0])>energy(first.channels[0])*1.3);
 const muted=structuredClone(restored.project.editor.pattern);muted.userTracks[0].mute=true;
 assert.ok(renderPerformance(withDrumKit(muted,{},kit),new Map(),8000).channels[0].every(v=>v===0));
});

test('song arrangements retain independent synth notes and instruments across slots',()=>{
 const first=new Editor(pattern());first.addUserTrack(track);first.write(note('bass-note',48));
 const second=new Editor(pattern());second.addUserTrack({...track,instrument:structuredClone(SYNTH_PRESETS.pad)});second.write(note('pad-note',60));
 const bank=newBank(first.state.pattern);bank.slots[0].editor=structuredClone(first.state);bank.slots[1].editor=structuredClone(second.state);bank.sequence=[{slot:0,repeats:1},{slot:1,repeats:1}];
 const saved=makeProject(first.state,defaults(),defaultKitState(),new Map(),bank),loaded=readProject(saved).project;
 assert.equal(loaded.version,6);assert.equal(loaded.bank.slots[1].editor.pattern.userTracks[0].instrument.preset,'pad');
 const sequence=arrange(loaded.bank),audio=renderSequence(sequence,new Map(),8000);
 assert.ok(audio.channels[0].slice(0,8000).some(v=>Math.abs(v)>.01));
 assert.ok(audio.channels[0].slice(16000,24000).some(v=>Math.abs(v)>.01));
});
