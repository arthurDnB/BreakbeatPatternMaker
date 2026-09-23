import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesize} from '../public/synth.js';

test('shared drum renderer is deterministic, finite and click-free at supported playback rates',()=>{
 for(const rate of [8000,22050,44100,48000,96000,192000])for(const role of ['kick','snare','hat','percussion']){
  const data=synthesize(role,rate);
  assert.deepEqual(data,synthesize(role,rate));
  assert.equal(data[0],0);assert.equal(Math.abs(data.at(-1)),0);
  let energy=0,tail=0,peak=0;
  for(let i=0;i<data.length;i++){
   assert.ok(Number.isFinite(data[i]));peak=Math.max(peak,Math.abs(data[i]));
   energy+=data[i]**2;if(i>data.length*.9)tail+=data[i]**2;
  }
  assert.ok(peak<=.95&&peak>.3);assert.ok(energy/data.length>.0001);
  assert.ok(tail/energy<.02,role+' tail decays before cutoff');
 }
});
test('renderer rejects invalid roles and rates instead of allocating invalid buffers',()=>{
 assert.throws(()=>synthesize('unknown'));for(const rate of [0,NaN,Infinity,1000000])assert.throws(()=>synthesize('kick',rate));
});
