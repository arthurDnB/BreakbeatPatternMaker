import test from 'node:test';import assert from 'node:assert/strict';
import {withDrumKit} from '../dist/audio/drum-kit.js';import {generate} from '../dist/core/generate.js';import {defaults} from '../dist/core/profiles.js';import {renderPerformance} from '../dist/audio/performance.js';
test('kit selection maps lane hits and ghosts without mutating notes or replacing explicit slices',()=>{
 const p=generate({...defaults(),ghostAmount:1}),before=structuredClone(p);
 const ref={assetId:'snare-test',startFrame:0,endFrame:100,sampleRate:44100,label:'Custom snare'};
 const mapped=withDrumKit(p,{snare:ref});assert.deepEqual(p,before);
 for(const h of mapped.events)assert.equal(!!h.slice,h.role==='snare');
 assert.ok(mapped.events.some(h=>h.ghost&&h.slice));
 const first=p.events[0];first.slice={...ref,assetId:'break-test'};assert.equal(withDrumKit(p,{kick:ref}).events[0].slice.assetId,'break-test');
});
test('uploaded single hit is the PCM source for the renderer and inactive slots restore synth',()=>{
 const p=generate(defaults());p.events=[{...p.events[0],gain:1,pan:0}];
 const asset={id:'kick-test',name:'Kick',sampleRate:44100,channels:[new Float32Array(100).fill(.25)]};
 const ref={assetId:asset.id,startFrame:0,endFrame:100,sampleRate:44100,label:'Kick'};
 const audio=renderPerformance(withDrumKit(p,{kick:ref}),new Map([[asset.id,asset]]));assert.equal(audio.channels[0][10],.25);assert.equal(audio.channels[0][110],0);
 assert.notEqual(renderPerformance(withDrumKit(p,{}),new Map()).channels[0][10],.25);
});
