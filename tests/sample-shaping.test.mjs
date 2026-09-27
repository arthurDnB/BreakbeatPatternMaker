import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {defaultKitState,withDrumKit,effectiveSampleSpeed} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {newBank,arrange} from '../dist/core/bank.js';

const rate=8000;
function fixture(samples=new Float32Array(1600).fill(.4)){
 const asset={id:'sample-shape',name:'Test chop',sampleRate:rate,channels:[samples]};
 const hit={id:'chop',role:'snare',sourceId:'kit.snare',sourceKind:'oneShot',baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'test',slice:{assetId:asset.id,startFrame:0,endFrame:samples.length,sampleRate:rate,label:'Test chop'}};
 const pattern={engineVersion:'0.4.0',ppq:960,settings:{...defaults(),algorithm:'groove-v4',bpm:170,bars:1},events:[hit]};
 const assets=new Map([[asset.id,asset]]),kit=defaultKitState();
 kit.snare.choice='upload';kit.snare.assetId=asset.id;kit.snare.uploadId=asset.id;
 return {pattern,assets,kit};
}
const audio=(pattern,assets,kit)=>renderPerformance(withDrumKit(pattern,{},kit),assets,rate).channels[0];
const lastSound=channel=>{for(let i=channel.length-1;i>=0;i--)if(Math.abs(channel[i])>.001)return i;return -1;};

test('Repitch speed shortens a chop, raises its frequency and respects a hit override',()=>{
 const {pattern,assets,kit}=fixture(Float32Array.from({length:1600},(_,i)=>Math.sin(2*Math.PI*220*i/rate)*.35));
 const normal=audio(pattern,assets,kit);kit.snare.playbackRate=2;
 const fast=audio(pattern,assets,kit);
 assert.ok(lastSound(fast)<lastSound(normal)*.55);
 assert.notDeepEqual(fast.slice(0,100),normal.slice(0,100));
 pattern.events[0].playbackRate=1;
 assert.deepEqual(audio(pattern,assets,kit),normal,'A hit override replaces the sample default');
 assert.equal(withDrumKit(pattern,{},kit).events[0].playbackRate,1);
 kit.snare.sampleProfiles={'sample-shape':{playbackRate:2}};
 delete kit.snare.playbackRate;
 assert.equal(withDrumKit(pattern,{},kit).events[0].playbackRate,1);
});

test('Filter, attack and decay shape only the requested voice and survive project save',()=>{
 const {pattern,assets,kit}=fixture(Float32Array.from({length:1600},(_,i)=>i%2?.4:-.4));
 const plain=audio(pattern,assets,kit);
 kit.snare.lowpassHz=500;kit.snare.attackMs=20;kit.snare.decay=.5;
 const shaped=audio(pattern,assets,kit);
 assert.equal(shaped[0],0);
 assert.ok(lastSound(shaped)<lastSound(plain)*.6);
 const energy=(channel,start,end)=>channel.slice(start,end).reduce((sum,v)=>sum+v*v,0);
 assert.ok(energy(shaped,80,600)<energy(plain,80,600)*.2);
 pattern.events[0].lowpassHz=20000;pattern.events[0].attackMs=0;pattern.events[0].decay=1;
 assert.deepEqual(audio(pattern,assets,kit),plain);
 compile(pattern);
 const editor=new Editor(pattern),snapshot=makeProject(editor.state,pattern.settings,kit,assets);
 const restored=readProject(snapshot);
 assert.deepEqual(restored.project.editor.pattern,pattern);
 assert.deepEqual(restored.project.kit,kit);
 assert.deepEqual(audio(restored.project.editor.pattern,restored.assets,restored.project.kit),plain);
 const old=structuredClone(snapshot);delete old.kit.snare.lowpassHz;delete old.kit.snare.attackMs;delete old.kit.snare.decay;delete old.editor.pattern.events[0].lowpassHz;delete old.editor.pattern.events[0].attackMs;delete old.editor.pattern.events[0].decay;
 assert.ok(readProject(old).project,'Older projects may omit all new shaping fields');
});

test('Malformed speed and tone controls are rejected before rendering or project import',()=>{
 const {pattern,assets,kit}=fixture();
 for(const [key,value] of [['playbackRate',0],['lowpassHz',40],['attackMs',Infinity]]){
  pattern.events[0][key]=value;assert.throws(()=>compile(pattern));delete pattern.events[0][key];
 }
 const editor=new Editor(pattern),project=makeProject(editor.state,pattern.settings,kit,assets);
 project.kit.snare.sampleProfiles={'sample-shape':{playbackRate:20}};
 assert.throws(()=>readProject(project),/sample speed/);
});

test('Hit speed and tone overrides form one reversible editor change',()=>{
 const {pattern}=fixture(),editor=new Editor(pattern);
 const hit=editor.state.pattern.events[0];
 assert.ok(editor.write({...hit,playbackRate:1.8,lowpassHz:2300,attackMs:12,decay:.5},hit.id));
 const edited=structuredClone(editor.state.pattern.events[0]);
 assert.ok(editor.undo());assert.equal(editor.state.pattern.events[0].playbackRate,undefined);
 assert.ok(editor.redo());assert.deepEqual(editor.state.pattern.events[0],edited);
});

test('BPM follow tracks pattern and song tempo in the shared renderer, with hit and range precedence',()=>{
 const {pattern,assets,kit}=fixture(Float32Array.from({length:1600},(_,i)=>Math.sin(2*Math.PI*220*i/rate)*.35));
 kit.snare.playbackRate=1.1;kit.snare.sourceBpm=100;kit.snare.followBpm=true;
 const first=withDrumKit(pattern,{},kit);
 assert.equal(first.events[0].playbackRate,1.7);
 const firstAudio=audio(pattern,assets,kit);
 pattern.settings.bpm=150;
 assert.equal(withDrumKit(pattern,{},kit).events[0].playbackRate,1.5);
 assert.notDeepEqual(audio(pattern,assets,kit).slice(0,250),firstAudio.slice(0,250));
 const bank=newBank(pattern);bank.songBpm=180;
 assert.equal(withDrumKit(arrange(bank)[0],{},kit).events[0].playbackRate,1.8);
 pattern.events[0].playbackRate=.8;
 assert.equal(withDrumKit(pattern,{},kit).events[0].playbackRate,.8);
 delete pattern.events[0].playbackRate;
 assert.deepEqual(effectiveSampleSpeed(kit.snare,250),{rate:1.1,following:false,warning:'BPM follow needs 0.5×–2× speed. Manual speed is playing.'});
 pattern.settings.bpm=250;
 assert.equal(withDrumKit(pattern,{},kit).events[0].playbackRate,1.1);
});

test('BPM follow survives project save and rejects invalid saved settings',()=>{
 const {pattern,assets,kit}=fixture();
 kit.snare.playbackRate=1.2;kit.snare.sourceBpm=110;kit.snare.followBpm=true;
 kit.snare.sampleProfiles={'sample-shape':{sourceBpm:110,followBpm:true,playbackRate:1.2}};
 const saved=makeProject(new Editor(pattern).state,pattern.settings,kit,assets);
 const restored=readProject(saved);
 assert.equal(restored.project.kit.snare.followBpm,true);
 assert.equal(withDrumKit(restored.project.editor.pattern,{},restored.project.kit).events[0].playbackRate,170/110);
 const old=structuredClone(saved);delete old.kit.snare.followBpm;delete old.kit.snare.sampleProfiles['sample-shape'].followBpm;
 assert.ok(readProject(old).project);
 const invalid=structuredClone(saved);invalid.kit.snare.followBpm='yes';assert.throws(()=>readProject(invalid),/BPM follow/);
 invalid.kit.snare.followBpm=true;invalid.kit.snare.sampleProfiles['sample-shape'].sourceBpm=undefined;assert.throws(()=>readProject(invalid),/BPM follow/);
});
