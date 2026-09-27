import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLibraryHit} from '../dist/audio/sample-prep.js';
import {GENRE_KITS,KIT_PRESETS,LIBRARY} from '../dist/audio/library.js';

test('library preparation trims dead air and keeps channel alignment',()=>{
  const left=new Float32Array(1000),right=new Float32Array(1000);
  left[300]=.4;right[300]=.2;left[301]=-.4;right[301]=-.2;
  const original=left.slice();
  const out=prepareLibraryHit([left,right],1000,'snare');
  assert.equal(out[0].length,out[1].length);
  assert.ok(out[0].length<original.length);
  assert.deepEqual(left,original,'source PCM is unchanged');
  assert.ok(Math.max(...out[0])<=.800001);
  assert.ok(out[0].some(v=>v!==0));
});

test('preparation balances dense and sparse hits without exceeding role ceiling',()=>{
  const sparse=new Float32Array(2000),dense=new Float32Array(2000).fill(.5);
  sparse.set([.5,-.5,.4,-.4],10);
  const a=prepareLibraryHit([sparse],10000,'kick')[0];
  const b=prepareLibraryHit([dense],10000,'kick')[0];
  assert.ok(Math.max(...a)<=.920001&&Math.max(...b)<=.920001);
  assert.ok(b[500]<a[10]||b[500]<.5,'dense source is attenuated to preserve headroom');
});

test('every genre default kit resolves to playable library sounds',()=>{
  for(const [genre,id] of Object.entries(GENRE_KITS)){
    const preset=KIT_PRESETS.find(p=>p.id===id);
    assert.ok(preset,genre);
    for(const [role,choice] of Object.entries(preset.slots)){
      assert.ok(choice==='synth'||choice==='synth-scratch'||LIBRARY.some(s=>s.id===choice&&s.role===role),`${genre}: ${role} ${choice}`);
    }
  }
});
