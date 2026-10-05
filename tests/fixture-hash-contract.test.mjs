// Precondition 4 — the two fixture-hashing decisions, encoded.
//
// Arthur's standing decision (m00516–m00530): the pinned compatibility fixture hash covers the
// pattern's JSON member order AND its `reason` provenance field. This test binds that decision
// to the real hash used by scripts/engine-compatibility-fixture.mjs, so neither the decision nor
// the fixture script can drift without a failing test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,compatibilitySettings} from '../scripts/engine-compatibility-fixture.mjs';
import {generate} from '../dist/core/generate.js';

test('the pinned fixture hash is taken over JSON text, so member order is load-bearing',()=>{
  const ordered={engineVersion:'0.1.0',events:[{tick:1,gain:.5}]};
  const reordered={events:[{gain:.5,tick:1}],engineVersion:'0.1.0'};
  assert.deepEqual(reordered,ordered,'the two objects hold the same members with the same values');
  // Which is why captureCompatibility hashes JSON.stringify(pattern) rather than the object.
  assert.notEqual(hash(JSON.stringify(ordered)),hash(JSON.stringify(reordered)));
  assert.equal(hash(JSON.stringify(ordered)).length,64);
});

test('number formatting is therefore part of the contract too',()=>{
  // A native renderer must reproduce JavaScript's shortest round-trip form byte for byte,
  // because the hash is over that text. This is the concrete cost of pinning member order.
  assert.equal(JSON.stringify({gain:1}),'{"gain":1}');
  assert.equal(JSON.stringify({gain:.5}),'{"gain":0.5}');
  assert.equal(JSON.stringify({gain:1/3}),'{"gain":0.3333333333333333}');
  assert.equal(JSON.stringify({tick:1e21}),'{"tick":1e+21}');
  assert.equal(JSON.stringify({gain:-0}),'{"gain":0}');
});

test('the pinned fixture hash covers provenance, not only musical values',()=>{
  const engines=['legacy-v1','groove-v2','groove-v3','groove-v4','groove-v5','groove-v5.1'];
  const withReason=[];
  for(const algorithm of engines){
    const text=JSON.stringify(generate(compatibilitySettings('jungle',algorithm)));
    if(text.includes('"reason"'))withReason.push([algorithm,text]);
  }
  assert.ok(withReason.length>0,'expected at least one generation engine to record provenance in the pattern');
  for(const [algorithm,text] of withReason){
    const stripped=text.replace(/,"reason":(?:"[^"]*"|null)/g,'');
    assert.notEqual(hash(text),hash(stripped),`stripping reason from a ${algorithm} pattern must change the pinned hash`);
  }
});
