import test from 'node:test';import assert from 'node:assert/strict';
import {gridMarkers,transientMarkers,moveMarker} from '../dist/audio/chop.js';
test('transient detector finds stereo attacks, respects gaps and handles silence',()=>{
 const rate=44100,a=new Float32Array(rate),b=new Float32Array(rate);
 for(const at of [.2,.5,.8])for(let i=0;i<1000;i++)b[Math.round(at*rate)+i]=Math.sin(i*.3)*Math.exp(-i/180);
 const m=transientMarkers([a,b],rate,.5,80);
 assert.equal(m[0],0);assert.equal(m.at(-1),rate);
 for(const at of [.2,.5,.8])assert.ok(m.some(f=>Math.abs(f/rate-at)<.015));
 assert.deepEqual(transientMarkers([a],rate),[0,rate]);
 for(let i=1;i<m.length;i++)assert.ok(m[i]-m[i-1]>=rate*.08);
 assert.throws(()=>transientMarkers([a],rate,NaN));
});
test('grids and edits preserve integer ordered fixed endpoints',()=>{
 const m=gridMarkers(44101,16);assert.equal(m.length,17);assert.equal(m.at(-1),44101);
 assert.ok(m.every(Number.isInteger));assert.deepEqual(moveMarker(m,0,10),m);
 const moved=moveMarker(m,1,50000);assert.equal(moved[1],m[2]-1);assert.notDeepEqual(moved,m);
 assert.deepEqual(gridMarkers(2,16),[0,1,2]);
});
