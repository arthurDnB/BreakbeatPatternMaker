import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MASTER_BUS_ALGORITHMS,MASTER_BUS_PATHS,MASTER_BUS_GENRE,masterBusFingerprint,masterBusPattern} from '../scripts/master-bus-fixture.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/master-bus-paths.json',import.meta.url),'utf8'));
const RATES=[8000,44100];
const pick=(algorithm,path,rate,loop)=>fixture.entries.find(entry=>entry.algorithm===algorithm&&entry.path===path&&entry.rate===rate&&entry.loop===loop);

test('both legacy master-bus paths are mandatory for every legacy algorithm',()=>{
  assert.deepEqual(MASTER_BUS_ALGORITHMS,['legacy-v1','groove-v2','groove-v3']);
  assert.deepEqual(MASTER_BUS_PATHS,['transparent','clipped']);
  for(const algorithm of MASTER_BUS_ALGORITHMS){
    const entries=fixture.entries.filter(entry=>entry.algorithm===algorithm);
    assert.equal(entries.length,8,`${algorithm} entry count`);
    for(const path of MASTER_BUS_PATHS){
      const rows=entries.filter(entry=>entry.path===path);
      assert.equal(rows.length,4,`${algorithm}/${path} must cover both sample rates and both loop modes`);
      assert.deepEqual([...new Set(rows.map(row=>row.rate))].sort((a,b)=>a-b),RATES);
      assert.deepEqual([...new Set(rows.map(row=>row.loop))].sort(),[false,true]);
    }
  }
  for(const entry of fixture.entries){
    assert.ok(MASTER_BUS_ALGORITHMS.includes(entry.algorithm),`${entry.algorithm} is not a legacy algorithm`);
    assert.equal(entry.genre,MASTER_BUS_GENRE);
  }
});

test('the transparent branch is reached exactly when every event is mapped',()=>{
  for(const entry of fixture.entries){
    const mapped=masterBusPattern(entry.genre,entry.algorithm,entry.path).events.every(hit=>hit.mapped!==undefined);
    assert.equal(mapped,entry.path==='transparent',`${entry.algorithm}/${entry.path} mapped premise`);
    assert.equal(entry.allEventsMapped,mapped,`${entry.algorithm}/${entry.path} recorded premise`);
    assert.ok(entry.events>0,'the fixture must contain events');
  }
});

// attenuation is only below one when the master stage measured a peak above 1.0, and that can only
// happen when the tanh clip was skipped (the clip caps every sample at 0.98). So a transparent entry
// with attenuation < 1 is direct evidence that performance.ts:206 skipped the clip.
test('the transparent render skips the clip and its attenuation fires instead',()=>{
  for(const entry of fixture.entries.filter(row=>row.path==='transparent')){
    const label=`${entry.algorithm}@${entry.rate}`;
    assert.ok(entry.attenuation<1,`${label} should need attenuation, got ${entry.attenuation}`);
    const rawPeak=.98/entry.attenuation;
    assert.ok(rawPeak>1,`${label} raw peak ${rawPeak} must exceed 1.0 for the skip to be observable`);
    assert.ok(Math.abs(entry.samplePeak-.98)<1e-4,`${label} the attenuation trims the render to the .98 ceiling`);
  }
});

// The clip caps samples at 0.98, so a peak above 1.0 is impossible after it runs and attenuation stays
// exactly one. The sibling transparent render measures the same hit material at a raw peak of
// 1.09-1.57, so the clipped peak of 0.95-0.98 is the soft cap rather than a quiet mix.
test('the clipped render stays capped below the attenuation threshold',()=>{
  for(const entry of fixture.entries.filter(row=>row.path==='clipped')){
    const label=`${entry.algorithm}@${entry.rate}`;
    assert.equal(entry.attenuation,1,`${label} the post-clip peak cannot exceed 1.0`);
    assert.ok(entry.samplePeak>.7,`${label} peak ${entry.samplePeak} must be loud enough to engage the clip`);
    assert.ok(entry.samplePeak<=.98,`${label} peak ${entry.samplePeak} exceeds the clip ceiling`);
  }
});

test('legacy master-bus renders still return no quality object',()=>{
  for(const entry of fixture.entries)assert.equal(entry.hasQuality,false,`${entry.algorithm}/${entry.path} quality`);
});

test('the two paths never produce the same PCM16',()=>{
  for(const algorithm of MASTER_BUS_ALGORITHMS)for(const rate of RATES)for(const loop of [false,true]){
    const transparent=pick(algorithm,'transparent',rate,loop),clipped=pick(algorithm,'clipped',rate,loop);
    assert.notEqual(transparent.pcm16Sha256,clipped.pcm16Sha256,`${algorithm}@${rate}/${loop?'loop':'tail'} must differ per path`);
  }
});

test('pre-v3 master-bus PCM16 reproduces bit-exactly',()=>{
  for(const entry of fixture.entries){
    const label=`${entry.algorithm}/${entry.path}/${entry.rate}/${entry.loop?'loop':'tail'}`;
    const actual=masterBusFingerprint(entry.genre,entry.algorithm,entry.path,entry.rate,entry.loop);
    assert.equal(actual.frames,entry.frames,`${label} rendered duration`);
    assert.equal(actual.pcm16Sha256,entry.pcm16Sha256,`${label} exported PCM16`);
    assert.equal(actual.attenuation,entry.attenuation,`${label} attenuation`);
    assert.equal(actual.samplePeak,entry.samplePeak,`${label} sample peak`);
  }
});
