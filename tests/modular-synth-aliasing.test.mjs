import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  ANALYSIS,CONTROLS,MATRIX,REPORT_PATH,REPORT_SCHEMA,SUBJECTS,formatTable
} from '../scripts/modular-synth-aliasing-audit.mjs';

// Cheap gate over the frozen record `tests/fixtures/modular-synth-aliasing.json`. It never calls runAudit()
// (one run is ~3.3 minutes). The report itself, and its two-run bit-identical reproducibility, is produced
// and checked by `npm run audit:aliasing` -> `node scripts/modular-synth-aliasing-audit.mjs --verify-twice`.
const FIXTURE_PATH='tests/fixtures/modular-synth-aliasing.json';
const fixture=JSON.parse(readFileSync(FIXTURE_PATH,'utf8'));
const echo=value=>JSON.parse(JSON.stringify(value));
const row=fields=>values=>Object.fromEntries(fields.map((field,index)=>[field,values[index]]));
const renders=fixture.renders.map(row(fixture.renderFields));
const renderEntries=renders.map(entry=>({
  presetId:entry.presetId,noteName:entry.noteName,rate:entry.rate,nonFinite:entry.nonFinite,rms:entry.rms,peak:entry.peak,dcOffset:entry.dcOffset,
  spectrum:{estimatedF0:entry.estimatedF0,centsError:entry.centsError,inharmonicToTotal:entry.inharmonicToTotal}
}));
const floors=fixture.floors.map(row(fixture.floorFields));
const controlValues=fixture.controlValues.map(row(fixture.controlFields));
const velocity=fixture.velocity.map(row(fixture.velocityFields));
const key=entry=>`${entry.presetId}|${entry.noteName}|${entry.velocityName}|${entry.rate}`;
const cell=entry=>`${entry.presetId} ${entry.noteName} -> ${entry.rate}`;
const velocitiesFor=subject=>subject.velocityMode==='both'?MATRIX.velocities:MATRIX.velocities.filter(entry=>entry[0]==='hard');
const pick=(list,predicate,label)=>{const found=list.find(predicate);assert.ok(found,`${label} is missing from the frozen record`);return found;};
const extreme=(list,select,compare)=>list.reduce((best,entry)=>compare(select(entry),select(best))?entry:best,list[0]);
const point=(list,select,compare)=>({cell:cell(extreme(list,select,compare)),value:select(extreme(list,select,compare))});
const summarizeBounds=entries=>({
  maxAbsCentsError:point(entries,entry=>Math.abs(entry.spectrum.centsError),(a,b)=>a>b),
  maxInharmonicToTotal:point(entries,entry=>entry.spectrum.inharmonicToTotal,(a,b)=>a>b),
  minRms:point(entries,entry=>entry.rms,(a,b)=>a<b),
  maxPeak:point(entries,entry=>entry.peak,(a,b)=>a>b),
  nonFinite:entries.reduce((total,entry)=>total+entry.nonFinite,0),
  silent:entries.filter(entry=>entry.rms<1e-6).length,
  clipped:entries.filter(entry=>entry.peak>=0.999).length,
  f0Missing:entries.filter(entry=>entry.spectrum.estimatedF0===null).length,
  dcFlagged:entries.filter(entry=>Math.abs(entry.dcOffset)>1e-4).length,
  maxAbsDcOffset:point(entries,entry=>Math.abs(entry.dcOffset),(a,b)=>a>b)
});
const summarizeProjections=entries=>({
  count:entries.length,
  sourceRate:192000,
  minCorrelation:point(entries,entry=>entry.correlation,(a,b)=>a<b),
  maxResidualDb:point(entries,entry=>entry.residualDb,(a,b)=>a>b),
  minComparedSamples:point(entries,entry=>entry.comparedSamples,(a,b)=>a<b),
  minProjectedRms:point(entries,entry=>entry.projectedRms,(a,b)=>a<b),
  maxProjectedPeak:point(entries,entry=>entry.projectedPeak,(a,b)=>a>b),
  maxInharmonicDelta:point(entries,entry=>Math.abs(entry.nativeInharmonicToTotal-entry.projectedInharmonicToTotal),(a,b)=>a>b)
});

test('the frozen record stamps the schema and the live audit protocol',()=>{
  assert.equal(fixture.schema,'modular-synth-aliasing-gates/v1');
  assert.equal(REPORT_SCHEMA,'modular-synth-aliasing-audit/v1');
  assert.equal(fixture.auditSchema,REPORT_SCHEMA);
  assert.equal(fixture.report.path,REPORT_PATH.split(/[\\/]/).join('/'),'the frozen record points at a different report path');
  assert.deepEqual(fixture.analysis,echo(ANALYSIS),'ANALYSIS drifted from the frozen record');
  assert.deepEqual(fixture.matrix,echo(MATRIX),'MATRIX drifted from the frozen record');
  assert.deepEqual(fixture.subjects,echo(SUBJECTS),'SUBJECTS drifted from the frozen record');
  assert.deepEqual(fixture.controls,echo(CONTROLS),'CONTROLS drifted from the frozen record');
  assert.equal(ANALYSIS.analysisSeconds,0.75);
  assert.equal(ANALYSIS.startOffsetSeconds,0.05);
  assert.equal(ANALYSIS.maxFftSize,262144);
  assert.equal(ANALYSIS.harmonicToleranceCents,25);
  assert.equal(ANALYSIS.f0TrackingRatio,1.6);
  assert.equal(ANALYSIS.analysisLowHz,20);
  assert.equal(ANALYSIS.excludeHarmonicsAboveNyquist,true);
  assert.equal(ANALYSIS.decimationTaps,161);
  assert.equal(ANALYSIS.projectionCutoffRatio,0.45);
});

test('the frozen record covers every intended subject x note x rate x velocity exactly once',()=>{
  const expected=SUBJECTS.flatMap(subject=>MATRIX.notes.flatMap(([noteName])=>velocitiesFor(subject).flatMap(([velocityName])=>MATRIX.rates.map(rate=>`${subject.presetId}|${noteName}|${velocityName}|${rate}`))));
  const actual=renders.map(key);
  assert.equal(actual.length,expected.length,`the frozen record has ${actual.length} renders, the matrix asks for ${expected.length}`);
  assert.deepEqual([...actual].sort(),[...expected].sort(),'the frozen matrix is not the intended matrix');
  assert.equal(new Set(actual).size,actual.length,'a matrix cell is frozen twice');
  assert.equal(fixture.coverage.renders,renders.length);
  assert.equal(fixture.coverage.projections,SUBJECTS.length*MATRIX.notes.length*MATRIX.projectionTargets.length);
  assert.equal(fixture.coverage.floors,SUBJECTS.length*MATRIX.notes.length);
  assert.equal(fixture.coverage.velocityInvariance,SUBJECTS.filter(subject=>subject.velocityMode==='both').length*MATRIX.notes.length);
  assert.equal(fixture.coverage.controls,CONTROLS.reduce((total,entry)=>total+entry.notes.length*entry.rates.length,0));
  assert.deepEqual([...fixture.coverage.controlIds].sort(),CONTROLS.map(entry=>entry.id).sort());
  assert.equal(controlValues.length,fixture.coverage.controls);
  assert.equal(fixture.coverage.projectionSourceRate,192000);
  assert.deepEqual(fixture.coverage.projectionMethods,{
    8000:'bandlimited-resample-192k-to-8000',
    22050:'bandlimited-resample-192k-to-22050',
    44100:'fir-lowpass+decimate-by-4+bandlimited-resample-48k-to-44k1',
    48000:'fir-lowpass+decimate-by-4',
    96000:'bandlimited-resample-192k-to-96000'
  });
  assert.deepEqual(floors.map(entry=>`${entry.presetId}|${entry.noteName}|${entry.referenceRate}`).sort(),
    SUBJECTS.flatMap(subject=>MATRIX.notes.map(([noteName])=>`${subject.presetId}|${noteName}|192000`)).sort());
  assert.deepEqual(velocity.map(entry=>`${entry.presetId}|${entry.noteName}`).sort(),
    SUBJECTS.filter(subject=>subject.velocityMode==='both').flatMap(subject=>MATRIX.notes.map(([noteName])=>`${subject.presetId}|${noteName}`)).sort());
});

test('every frozen product render is finite, audible, unclipped and on pitch',()=>{
  const offenders=[];
  for(const entry of renders){
    if(entry.nonFinite!==0)offenders.push(`${key(entry)} nonFinite=${entry.nonFinite}`);
    else if(!(entry.rms>=1e-3))offenders.push(`${key(entry)} rms=${entry.rms}`);
    else if(!(entry.peak<0.999))offenders.push(`${key(entry)} peak=${entry.peak}`);
    else if(!(entry.peak>0.01))offenders.push(`${key(entry)} near-empty peak=${entry.peak}`);
    else if(entry.estimatedF0===null)offenders.push(`${key(entry)} produced no f0 estimate`);
    else if(!(Math.abs(entry.centsError)<=25))offenders.push(`${key(entry)} f0 error ${entry.centsError} cents`);
  }
  assert.deepEqual(offenders,[],`frozen product renders failed sanity (measured max |centsError| ${fixture.bounds.maxAbsCentsError.value}, min rms ${fixture.bounds.minRms.value}, max peak ${fixture.bounds.maxPeak.value}): ${offenders.slice(0,8).join('; ')}`);
});

test('frozen products stay below the inharmonic ceiling at every rate',()=>{
  const worst=fixture.bounds.maxInharmonicToTotal;
  assert.ok(worst.value<=0.05,`worst frozen product render ${worst.cell} measured ${worst.value}, ceiling 0.05`);
  assert.ok(fixture.bounds.minRms.value>=1e-3,`quietest frozen render ${fixture.bounds.minRms.cell} measured rms ${fixture.bounds.minRms.value}`);
  assert.ok(fixture.bounds.maxPeak.value<0.999,`loudest frozen render ${fixture.bounds.maxPeak.cell} measured peak ${fixture.bounds.maxPeak.value}`);
});

test('the frozen bounds are exactly the extremes of the frozen render rows',()=>{
  assert.deepEqual(summarizeBounds(renderEntries),fixture.bounds,'the frozen bounds do not describe the frozen rows');
  assert.equal(fixture.bounds.nonFinite,0);
  assert.equal(fixture.bounds.silent,0);
  assert.equal(fixture.bounds.clipped,0);
  assert.equal(fixture.bounds.f0Missing,0);
});

test('every frozen floor is the same subject/note 192 kHz hard render',()=>{
  for(const floor of floors){
    const reference=pick(renders,entry=>entry.presetId===floor.presetId&&entry.noteName===floor.noteName&&entry.rate===floor.referenceRate&&entry.velocityName==='hard',`${floor.presetId} ${floor.noteName} 192 kHz hard render`);
    assert.equal(floor.inharmonicToTotal,reference.inharmonicToTotal,`${floor.presetId} ${floor.noteName} recorded a floor of ${floor.inharmonicToTotal} but its 192 kHz render measured ${reference.inharmonicToTotal}`);
  }
  assert.ok(Math.max(...floors.map(entry=>entry.inharmonicToTotal))<=0.05,`a frozen floor exceeds 0.05: ${Math.max(...floors.map(entry=>entry.inharmonicToTotal))}`);
});

test('the frozen alias-positive controls dwarf the product matrix',()=>{
  const at=(controlId,noteName,rate)=>pick(controlValues,entry=>entry.controlId===controlId&&entry.noteName===noteName&&entry.rate===rate,`${controlId} ${noteName}/${rate}`);
  const fmLow=at('control-fm-index-8','C5',8000),fmHigh=at('control-fm-index-8','C5',192000);
  const source=pick(renders,entry=>entry.presetId==='rhodes-model-v2'&&entry.noteName==='C5'&&entry.rate===8000&&entry.velocityName==='hard','the rhodes-model-v2 C5/8000 source render');
  const loudest=extreme(renders.filter(entry=>entry.noteName==='C5'&&entry.rate===8000),entry=>entry.inharmonicToTotal,(a,b)=>a>b);
  assert.ok(fmLow.inharmonicToTotal>=0.5,`control-fm-index-8 measured ${fmLow.inharmonicToTotal} at C5/8000, floor 0.5 (unmutated source at the same cell: ${source.inharmonicToTotal})`);
  assert.ok(fmLow.inharmonicToTotal>=100*source.inharmonicToTotal,`control-fm-index-8 measured ${fmLow.inharmonicToTotal} vs its unmutated source ${source.inharmonicToTotal} at C5/8000 (measured ratio ${(fmLow.inharmonicToTotal/source.inharmonicToTotal).toFixed(1)}x, required 100x)`);
  assert.ok(fmLow.inharmonicToTotal>=10*loudest.inharmonicToTotal,`control-fm-index-8 measured ${fmLow.inharmonicToTotal} vs the largest product C5/8000 value ${loudest.inharmonicToTotal} (measured ratio ${(fmLow.inharmonicToTotal/loudest.inharmonicToTotal).toFixed(1)}x, required 10x)`);
  assert.ok(fmHigh.inharmonicToTotal<=0.001,`control-fm-index-8 measured ${fmHigh.inharmonicToTotal} at C5/192000, ceiling 0.001: the excess is not rate-induced`);
  const sawLow=at('control-saw-foldback','C7',8000),sawHigh=at('control-saw-foldback','C7',192000);
  const sawNyquist=at('control-saw-foldback','C8',8000),sawNyquistHigh=at('control-saw-foldback','C8',192000);
  assert.ok(sawLow.inharmonicToTotal>=0.01,`control-saw-foldback measured ${sawLow.inharmonicToTotal} at C7/8000, floor 0.01`);
  assert.ok(sawLow.inharmonicToTotal>=100*sawHigh.inharmonicToTotal,`control-saw-foldback measured ${sawLow.inharmonicToTotal} at C7/8000 vs ${sawHigh.inharmonicToTotal} at C7/192000 (measured ratio ${(sawLow.inharmonicToTotal/sawHigh.inharmonicToTotal).toFixed(0)}x, required 100x)`);
  assert.ok(sawNyquist.inharmonicToTotal>=0.9,`control-saw-foldback measured ${sawNyquist.inharmonicToTotal} at C8/8000, floor 0.9: 4186 Hz is above the 4000 Hz Nyquist, so no harmonic grid exists`);
  assert.ok(sawNyquistHigh.inharmonicToTotal<=0.001,`control-saw-foldback measured ${sawNyquistHigh.inharmonicToTotal} at C8/192000, ceiling 0.001`);
  assert.equal(fmHigh.inharmonicToTotal,0,'the FM control is expected to be free of inharmonic energy at 192 kHz');
});

test('the frozen projections track the native low-rate renders',()=>{
  const summary=fixture.projections;
  assert.equal(summary.count,fixture.coverage.projections);
  assert.equal(summary.sourceRate,192000);
  assert.ok(summary.minCorrelation.value>=0.95,`worst frozen projection correlation ${summary.minCorrelation.value} at ${summary.minCorrelation.cell}, floor 0.95`);
  assert.ok(summary.minComparedSamples.value>0,`${summary.minComparedSamples.cell} compared ${summary.minComparedSamples.value} samples`);
  assert.ok(summary.minProjectedRms.value>=1e-3,`${summary.minProjectedRms.cell} projected rms ${summary.minProjectedRms.value}`);
  assert.ok(summary.maxProjectedPeak.value<0.999,`${summary.maxProjectedPeak.cell} projected peak ${summary.maxProjectedPeak.value}`);
  assert.ok(summary.maxInharmonicDelta.value<=0.02,`${summary.maxInharmonicDelta.cell} moved the inharmonic ratio by ${summary.maxInharmonicDelta.value}, ceiling 0.02`);
});

test('the frozen velocity record shows only rhodes-keys ignores velocity',()=>{
  assert.equal(velocity.length,6);
  assert.deepEqual(velocity.filter(entry=>entry.identical).map(entry=>entry.presetId),['rhodes-keys','rhodes-keys','rhodes-keys'],'the set of velocity-invariant subjects changed; update docs/MODULAR-SYNTH-ALIASING.md');
  assert.ok(velocity.some(entry=>!entry.identical),'no frozen subject responded to velocity');
});

test('the on-disk report matches the frozen record',{skip:existsSync(REPORT_PATH)?false:`${REPORT_PATH} is absent; run \`npm run audit:aliasing\` to regenerate it, then re-run this test`},()=>{
  const text=readFileSync(REPORT_PATH,'utf8');
  const report=JSON.parse(text);
  assert.equal(Buffer.byteLength(text),fixture.report.bytes,`${REPORT_PATH} is ${Buffer.byteLength(text)} bytes, the frozen record expects ${fixture.report.bytes}`);
  const sha256=createHash('sha256').update(text).digest('hex');
  assert.equal(sha256,fixture.report.sha256,`${REPORT_PATH} hashes to ${sha256}, the frozen record expects ${fixture.report.sha256}; re-run the audit, inspect the gate table, then update tests/fixtures/modular-synth-aliasing.json in the same commit`);
  assert.deepEqual(report.analysis,fixture.analysis);
  assert.deepEqual(report.matrix,fixture.matrix);
  assert.deepEqual(report.renders.map(entry=>[entry.presetId,entry.noteName,entry.rate,entry.velocityName,entry.nonFinite,entry.rms,entry.peak,entry.dcOffset,entry.spectrum.estimatedF0,entry.spectrum.centsError,entry.spectrum.inharmonicToTotal]),fixture.renders,'the report render rows drifted from the frozen record');
  assert.deepEqual(report.floors.map(entry=>[entry.presetId,entry.noteName,entry.referenceRate,entry.inharmonicToTotal]),fixture.floors,'the report floors drifted from the frozen record');
  assert.deepEqual(report.controls.map(entry=>[entry.controlId,entry.noteName,entry.rate,entry.inharmonicToTotal,entry.inharmonicToHarmonicDb,entry.centsError]),fixture.controlValues,'the report control values drifted from the frozen record');
  assert.deepEqual(report.velocityInvariance.map(entry=>[entry.presetId,entry.noteName,entry.identical]),fixture.velocity,'the report velocity checks drifted from the frozen record');
  assert.deepEqual(summarizeBounds(report.renders),fixture.bounds,'the report render bounds drifted from the frozen record');
  assert.deepEqual(summarizeProjections(report.projections),fixture.projections,'the report projections drifted from the frozen record');
  const lines=formatTable(report).split('\n');
  assert.ok(lines.length>=report.renders.length+report.projections.length+report.controls.length+5,`the table has ${lines.length} lines for ${report.renders.length}+${report.projections.length}+${report.controls.length} rows`);
  assert.ok(lines[0].startsWith('preset'),'the table lost its column header');
  assert.ok(lines.some(line=>line.includes('alias-positive controls')),'the table lost the controls section');
});
