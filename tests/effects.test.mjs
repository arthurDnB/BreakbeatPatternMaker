import test from 'node:test';import assert from 'node:assert/strict';
import {defaultEffects,processEffects} from '../dist/audio/effects.js';import {renderPerformance} from '../dist/audio/performance.js';import {generate} from '../dist/core/generate.js';import {defaults} from '../dist/core/profiles.js';import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';import {makeProject,readProject} from '../dist/audio/project.js';import {Editor} from '../dist/core/editor.js';
test('reverse reads only the assigned region and does not change source audio',()=>{
 const p=generate(defaults());const source=new Float32Array([.1,.2,.3,.4,.5]),before=source.slice(),asset={id:'reverse-test',name:'test',sampleRate:44100,channels:[source]};
 p.events=[{...p.events[0],gain:1,reverse:true,slice:{assetId:asset.id,startFrame:1,endFrame:4,sampleRate:44100,label:'slice'}}];
 const audio=renderPerformance(p,new Map([[asset.id,asset]]));assert.deepEqual([...audio.channels[0].slice(0,3)],[source[3],source[2],source[1]]);assert.deepEqual(source,before);
 const mix=defaultKitState();mix.kick.reverse=true;p.events[0].reverse=false;assert.equal(withDrumKit(p,{},mix).events[0].reverse,true);
});
test('effects bypass is exact; delay creates bounded echoes and filters attenuate',()=>{
 const rate=44100,input=new Float32Array(rate*2);input[0]=.5;const bypass=[input.slice()];processEffects(bypass,rate,{...defaultEffects(),drive:1,mix:.6,bypass:true});assert.deepEqual(bypass[0],input);
 const delayed=[input.slice()];processEffects(delayed,rate,{...defaultEffects(),delayMs:100,mix:.5,feedback:.5});assert.equal(delayed[0][0],.25);assert.equal(delayed[0][4410],.25);assert.equal(delayed[0][8820],.125);
 const dc=[new Float32Array(rate).fill(.25)];processEffects(dc,rate,{...defaultEffects(),highpass:300});assert.ok(Math.abs(dc[0][rate-1])<1e-6);
 const signal=Float32Array.from({length:rate},(_,i)=>Math.sin(i*2*Math.PI*8000/rate)*.1),low=[signal.slice()];processEffects(low,rate,{...defaultEffects(),lowpass:300});assert.ok(low[0].reduce((a,x)=>a+x*x,0)<signal.reduce((a,x)=>a+x*x,0)*.1);
 const driven=[signal.slice()];processEffects(driven,rate,{...defaultEffects(),drive:.8});assert.ok(driven[0].every(Number.isFinite));assert.notDeepEqual(driven[0],signal);
});
test('effects and reverse persist; malformed effect values are rejected; old projects still load',()=>{
 const editor=new Editor(generate(defaults())),kit=defaultKitState();kit.snare.effects={...defaultEffects(),drive:.3,mix:.2};kit.snare.reverse=true;editor.state.pattern.events[0].reverse=true;
 const p=makeProject(editor.state,defaults(),kit,new Map());assert.deepEqual(readProject(p).project.kit,kit);
 const bad=structuredClone(p);bad.kit.snare.effects.feedback=1;assert.throws(()=>readProject(bad),/effect/);
 for(const slot of Object.values(p.kit)){delete slot.effects;delete slot.reverse;}assert.doesNotThrow(()=>readProject(p));
});
