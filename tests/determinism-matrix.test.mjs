import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate} from '../dist/core/generate.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {hash} from '../scripts/engine-compatibility-fixture.mjs';
import {F_DET_CASES,F_DET_ENGINES,F_DET_SEEDS,F_DET_KNOBS,firstDivergence,locateDrift} from '../scripts/engine-determinism-fixture.mjs';

// F-DET: the determinism matrix demanded by M0 audit section 3.8 and the two hashing decisions
// settled in docs/M1-RENDER-PLAN-CONTRACT.md — the pinned hash is over JSON.stringify(pattern), so
// JSON member order is part of the contract, `reason` stays inside it as user-visible provenance, and
// `layerOf` is render-only (src/core/model.ts:116) so it is asserted absent instead of serialized.
// Every case is regenerated from the settings the fixture records and compared byte for byte.
const fixture=JSON.parse(readFileSync('tests/fixtures/determinism-matrix.json','utf8'));
const VERSIONS=new Map(F_DET_ENGINES);

test('the F-DET matrix covers six engines, four seeds and every required knob',()=>{
  const cases=fixture.cases;
  assert.equal(cases.length,F_DET_CASES.length,'capture and case list disagree');
  assert.deepEqual(cases.map(c=>c.id),F_DET_CASES.map(c=>c.id),'the fixture must be captured from the case list, in order, with no hand edits');
  assert.equal(new Set(cases.map(c=>c.id)).size,cases.length,'duplicate case id');
  for(const [algorithm,engineVersion] of F_DET_ENGINES){
    const own=cases.filter(c=>c.algorithm===algorithm);
    assert.ok(own.length>=F_DET_SEEDS.length,`${algorithm} is pinned by only ${own.length} case(s)`);
    assert.deepEqual([...new Set(own.map(c=>c.engineVersion))],[engineVersion],`${algorithm} has a mixed or unexpected version stamp`);
    assert.ok(own.some(c=>c.axes.includes('engine')),`${algorithm} is not claimed by the engine axis`);
  }
  for(const seed of F_DET_SEEDS)assert.ok(cases.some(c=>c.seed===seed&&c.axes.includes('seed')),`seed ${JSON.stringify(seed)} is missing from the matrix`);
  for(const knob of F_DET_KNOBS){
    const owning=cases.filter(c=>c.axes.includes(knob));
    assert.ok(owning.length>=2,`${knob} is exercised by only ${owning.length} case(s)`);
    const values=new Set(owning.map(c=>JSON.stringify(c.settings[knob]??'unset')));
    assert.ok(values.size>=2,`${knob} takes ${values.size} distinct value(s) across its own cases`);
  }
});

test('every pinned case stamps its literal engine version',()=>{
  for(const item of fixture.cases){
    const pattern=generate(structuredClone(item.settings));
    assert.equal(pattern.engineVersion,VERSIONS.get(item.algorithm),`${item.id} stamped an unexpected engine version`);
    assert.equal(item.engineVersion,pattern.engineVersion,`${item.id} fixture stamp and live stamp disagree`);
    assert.equal(pattern.ppq,item.ppq,`${item.id} changed PPQ`);
  }
});

test('every golden pattern reproduces bit-exactly',()=>{
  for(const item of fixture.cases){
    const pattern=generate(structuredClone(item.settings));
    assert.equal(pattern.events.length,item.eventCount,`${item.id} event count changed`);
    const drift=locateDrift(pattern,item);
    assert.equal(drift,null,`${item.id} drifted: ${JSON.stringify(drift)}`);
    assert.equal(hash(JSON.stringify(pattern)),item.sha256,`${item.id} whole-pattern digest changed`);
  }
});

test('two generations in one process never diverge',()=>{
  for(const item of fixture.cases){
    const settings=structuredClone(item.settings);
    const first=generate(settings),second=generate(structuredClone(item.settings));
    assert.equal(firstDivergence(first,second),null,`${item.id} diverged between two generations: ${JSON.stringify(firstDivergence(first,second))}`);
    assert.equal(JSON.stringify(first),JSON.stringify(second),`${item.id} is nondeterministic`);
  }
});

test('reason is inside the pinned digest and layerOf never is',()=>{
  for(const [algorithm] of F_DET_ENGINES){
    const item=fixture.cases.find(c=>c.algorithm===algorithm&&c.seed==='break-042');
    assert.ok(item,`${algorithm} has no break-042 case`);
    const pattern=generate(structuredClone(item.settings));
    assert.ok(pattern.events.length>0,`${item.id} produced no events`);
    for(const hit of pattern.events)assert.notEqual(hit.reason,undefined,`${item.id} hit ${hit.id} lost its reason`);
    assert.equal(JSON.stringify(pattern).includes('layerOf'),false,`${item.id} serialized layerOf`);
    const detached=structuredClone(pattern);
    for(const hit of detached.events)hit.reason='detached';
    assert.notEqual(hash(JSON.stringify(detached)),item.sha256,`${item.id} kept its digest without reason, so reason is not pinned`);
    const reordered=Object.fromEntries(Object.entries(pattern).reverse());
    assert.deepEqual(reordered,pattern,'reordering must not change any value');
    assert.notEqual(hash(JSON.stringify(reordered)),item.sha256,`${item.id} kept its digest with reordered members, so member order is not pinned`);
  }
});

test('layerOf stays undefined and the pattern survives a render attempt',()=>{
  for(const item of fixture.cases){
    const pattern=generate(structuredClone(item.settings));
    try{renderPerformance(pattern,new Map(),8000,{},{});}catch(error){assert.ok(error instanceof Error,`${item.id} threw something that is not an Error: ${String(error)}`);}
    for(const hit of pattern.events)assert.equal(hit.layerOf,undefined,`${item.id} left layerOf on hit ${hit.id} after rendering`);
    assert.equal(JSON.stringify(pattern).includes('layerOf'),false,`${item.id} serialized layerOf after rendering`);
    assert.equal(hash(JSON.stringify(pattern)),item.sha256,`${item.id} was rewritten while rendering`);
  }
});

test('the drift reporter names the first divergent hit and the field that moved',()=>{
  const item=fixture.cases.find(c=>c.id==='core-groove-v4-break-042');
  const pattern=generate(structuredClone(item.settings));
  assert.equal(locateDrift(pattern,item),null,'an untouched pattern must not report drift');
  const ticked=structuredClone(pattern);ticked.events[3].baseTick+=1;
  const located=locateDrift(ticked,item);
  assert.equal(located.kind,'hit');
  assert.equal(located.index,3,`expected the first divergent hit index to be 3, got ${located.index}`);
  assert.ok(located.fields.includes('baseTick'),`expected baseTick among the moved fields, got ${JSON.stringify(located.fields)}`);
  const shortened=structuredClone(pattern);shortened.events.pop();
  assert.equal(locateDrift(shortened,item).kind,'event-count');
  const reworded=structuredClone(pattern);reworded.events[3].reason='a different reason';
  assert.ok(locateDrift(reworded,item).fields.includes('reason'),'a changed reason must be named as the field that moved');
  assert.equal(firstDivergence(pattern,structuredClone(pattern)),null);
  const bumped=structuredClone(pattern);bumped.events[2].baseTick+=1;
  const first=firstDivergence(pattern,bumped);
  assert.equal(first.kind,'hit');
  assert.equal(first.index,2);
  assert.equal(first.field,'baseTick');
});
