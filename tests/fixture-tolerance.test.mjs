import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as tolerance from '../scripts/fixture-tolerance.mjs';
import {
  PCM16_LSB,TOLERANCES,compareRender,maximumSampleError,maximumWindowRmsError,onsetFrames,onsetTolerance,spectralDifference
} from '../scripts/fixture-tolerance.mjs';

const contract=readFileSync(new URL('../docs/M1-RENDER-PLAN-CONTRACT.md',import.meta.url),'utf8');
const RATE=44100;
const tone=(frames,rate,frequency,amplitude)=>
  Float32Array.from({length:frames},(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*i/rate));
const silent=frames=>new Float32Array(frames);
const metrics=result=>result.failures.map(failure=>failure.metric);

test('the tracked tolerance table and this module agree row by row',()=>{
  for(const row of Object.values(TOLERANCES))assert.ok(contract.includes(row.doc),`tracked contract is missing tolerance row: ${row.doc}`);
  assert.ok(contract.includes('Fixture tolerance policy (M0 §3.6)'),'the tracked contract still names M0 §3.6');
});

test('PCM16 cannot express the float tolerance, which is why sidecars exist',()=>{
  assert.ok(Math.abs(PCM16_LSB-3.0518e-5)<1e-9,`PCM16 step measured as ${PCM16_LSB}`);
  assert.ok(PCM16_LSB>TOLERANCES.sampleError.value,'PCM16 is coarser than the float tolerance');
  assert.ok(contract.includes('.f32le'),'the tracked contract records the float sidecar fallback');
});

test('a bit-identical render passes every row',()=>{
  const reference=[tone(8192,RATE,440,.5),tone(8192,RATE,660,.5)];
  const result=compareRender(reference,[Float32Array.from(reference[0]),Float32Array.from(reference[1])],{rate:RATE});
  assert.deepEqual(result.failures,[]);
  assert.equal(result.equal,true);
});

test('the per-sample tolerance stops exactly at 1e-5',()=>{
  const reference=Float32Array.from(tone(4096,RATE,440,.7));
  const perturb=delta=>{
    const copy=Float32Array.from(reference);
    copy[100]=copy[100]+delta;
    return [copy];
  };
  const inside=compareRender([reference],perturb(9e-6),{rate:RATE});
  assert.equal(inside.equal,true,`9e-6 should pass, got ${JSON.stringify(inside.failures)}`);
  const outside=compareRender([reference],perturb(1.1e-5),{rate:RATE});
  assert.equal(outside.equal,false);
  assert.deepEqual(metrics(outside),['sampleError']);
  assert.ok(maximumSampleError([reference],perturb(1.1e-5))>1e-5);
});

test('onset tolerance is one frame at 44.1 kHz and two at 8 kHz',()=>{
  assert.equal(onsetTolerance(44100),1);
  assert.equal(onsetTolerance(8000),2);
  const block=Float32Array.from({length:400},(_,i)=>i>=100&&i<160?.8:0);
  const drop=(...indexes)=>[Float32Array.from(block,(value,index)=>indexes.includes(index)?0:value)];
  assert.deepEqual(onsetFrames([block]),[100]);
  assert.deepEqual(onsetFrames(drop(100)),[101]);
  assert.deepEqual(onsetFrames(drop(100,101)),[102]);
  assert.ok(!metrics(compareRender([block],drop(100),{rate:RATE})).includes('onsetPosition'));
  assert.ok(metrics(compareRender([block],drop(100,101),{rate:RATE})).includes('onsetPosition'));
  assert.ok(!metrics(compareRender([block],drop(100,101),{rate:8000})).includes('onsetPosition'));
});

test('peak and true-peak rows have their own tolerances',()=>{
  assert.equal(TOLERANCES.peak.value,1e-4);
  assert.equal(TOLERANCES.truePeak.value,1e-3);
  const reference=Float32Array.from({length:4096},()=>.5);
  const bump=delta=>{
    const copy=Float32Array.from(reference);
    copy[500]=copy[500]+delta;
    return [copy];
  };
  const small=metrics(compareRender([reference],bump(2e-4),{rate:RATE}));
  assert.ok(small.includes('peak'),`a 2e-4 overshoot must fail the peak row: ${JSON.stringify(small)}`);
  assert.ok(!small.includes('truePeak'),'2e-4 stays under the true-peak tolerance');
  assert.ok(metrics(compareRender([reference],bump(3e-3),{rate:RATE})).includes('truePeak'));
});

test('RMS keeps a relative tolerance with an absolute floor',()=>{
  const loud=Float32Array.from(tone(4096,RATE,440,.5));
  const louder=[Float32Array.from(loud,value=>value*1.02)];
  const loudResult=compareRender([loud],louder,{rate:RATE});
  assert.ok(metrics(loudResult).includes('rms'),`2 % gain must fail RMS: ${JSON.stringify(loudResult.failures)}`);
  const quiet=Float32Array.from(tone(4096,RATE,440,1e-6));
  const louderQuiet=[Float32Array.from(quiet,value=>value*1.5)];
  const quietResult=compareRender([quiet],louderQuiet,{rate:RATE});
  assert.ok(!metrics(quietResult).includes('rms'),'the 1e-4 absolute floor absorbs inaudible level error');
});

test('a 100 ms window catches divergence that whole-render RMS hides',()=>{
  const frames=RATE*8;
  const reference=Float32Array.from(tone(frames,RATE,440,.5));
  const candidate=Float32Array.from(reference);
  for(let i=frames-Math.round(RATE*.1);i<frames;i++)candidate[i]=candidate[i]*1.02;
  const result=compareRender([reference],[candidate],{rate:RATE});
  const rmsError=Math.abs(result.reference.rms-result.candidate.rms);
  assert.ok(rmsError<result.reference.rms*TOLERANCES.rms.relative,`whole-render RMS error ${rmsError} should hide the change`);
  assert.ok(maximumWindowRmsError([reference],[candidate],RATE)>TOLERANCES.window.value);
  assert.ok(!metrics(result).includes('rms'));
  assert.ok(metrics(result).includes('window'));
});

test('the spectral row separates sub-bin divergence',()=>{
  const identical=spectralDifference([tone(8192,RATE,440,.6)],[tone(8192,RATE,440,.6)]);
  assert.equal(identical.maxBinError,0);
  assert.equal(identical.aggregateDb,0);
  const shifted=spectralDifference([tone(8192,RATE,440,.6)],[tone(8192,RATE,448,.6)]);
  assert.ok(shifted.aggregateDb>TOLERANCES.spectral.aggregateDb,`aggregate ${shifted.aggregateDb} dB should exceed 0.25 dB`);
  assert.ok(metrics(compareRender([tone(8192,RATE,440,.6)],[tone(8192,RATE,448,.6)],{rate:RATE})).includes('spectralAggregate'));
});

test('the clipped-sample count must match exactly',()=>{
  const reference=Float32Array.from(tone(4096,RATE,440,.5));
  const clippedReference=Float32Array.from(reference);
  clippedReference[512]=1;
  const result=compareRender([clippedReference],[reference],{rate:RATE});
  assert.ok(metrics(result).includes('clippedSamples'));
  assert.equal(result.reference.clippedSamples,1);
  assert.equal(result.candidate.clippedSamples,0);
});

test('gain errors are never normalised away',()=>{
  assert.equal('normalizeGain' in tolerance,false);
  assert.equal('normalize' in tolerance,false);
  const reference=Float32Array.from(tone(8192,RATE,440,.5));
  const gained=[Float32Array.from(reference,value=>value*1.02)];
  const result=compareRender([reference],gained,{rate:RATE});
  assert.equal(result.equal,false);
  assert.ok(metrics(result).includes('sampleError'));
});

test('silence is not evidence of parity',()=>{
  const result=compareRender([silent(4096)],[silent(4096)],{rate:RATE});
  assert.equal(result.equal,false);
  assert.deepEqual(metrics(result),['silence']);
  assert.equal(compareRender([silent(4096)],[silent(4096)],{rate:RATE,expectSilence:true}).equal,true);
});
