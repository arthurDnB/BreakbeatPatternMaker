import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  AUDITION_CASES,AUDITION_LABELS,AUDITION_PEAK_CEILING,AUDITION_TARGET_RMS,
  measureAuditionWindow,renderAuditionSide
} from '../scripts/modular-rhodes-audition.mjs';

// Guards the listener-facing claim that the Rhodes A/B pairs are level-matched in a way that
// is fair, and pins the peak/crest numbers docs/MODULAR-SYNTH-ALIASING.md quotes about it.
// Renders the same ten sides in memory; it never writes the WAVs or the audition page.
const db=value=>value<=0?-Infinity:20*Math.log10(value);
const key=entry=>`${entry.preset}-${entry.note}-${entry.velocity100}`;

// Measured from the generated WAVs on 2026-10-05; regenerate with
// `npm run build && node scripts/modular-rhodes-audition.mjs`.
const FROZEN_PEAK_DB={
  'rhodes-36-25':-11.839,
  'rhodes-36-95':-11.839,
  'rhodes-60-25':-10.447,
  'rhodes-60-95':-10.447,
  'rhodes-72-95':-11.742,
  'rhodes-model-v2-36-25':-13.914,
  'rhodes-model-v2-36-95':-13.876,
  'rhodes-model-v2-60-25':-14.625,
  'rhodes-model-v2-60-95':-14.585,
  'rhodes-model-v2-72-95':-13.889
};
const FROZEN_CREST_DB={
  'rhodes-36-25':6.58,
  'rhodes-36-95':6.58,
  'rhodes-60-25':7.97,
  'rhodes-60-95':7.97,
  'rhodes-72-95':6.67,
  'rhodes-model-v2-36-25':4.50,
  'rhodes-model-v2-36-95':4.54,
  'rhodes-model-v2-60-25':3.79,
  'rhodes-model-v2-60-95':3.83,
  'rhodes-model-v2-72-95':4.53
};
// Draft minus current, per case, for the first-0.5 s sample peak.
const FROZEN_PAIR_PEAK_DELTA_DB={'C2 soft':-2.08,'C2 accent':-2.04,'C4 soft':-4.18,'C4 accent':-4.14,'C5 accent':-2.15};

const sides=AUDITION_CASES.flatMap(([caseLabel,note,velocity])=>AUDITION_LABELS.map(([sideLabel,preset])=>{
  const side=renderAuditionSide(preset,note,velocity);
  const matchedRms=side.rms*side.gain;
  return {
    caseLabel,
    sideLabel,
    preset,
    note,
    velocity100:Math.round(velocity*100),
    matchedRms,
    matchedRmsDb:db(matchedRms),
    matchedPeakDb:db(side.peak*side.gain),
    crestDb:db(side.filePeak)-db(matchedRms),
    ceilingBound:Math.abs(side.gain-AUDITION_TARGET_RMS/side.rms)>1e-12,
    windowPeakDb:db(side.peak*side.gain),
    filePeakDb:db(side.filePeak)
  };
}));
const pairFor=caseLabel=>{
  const pair=sides.filter(entry=>entry.caseLabel===caseLabel);
  assert.equal(pair.length,2,`expected exactly two sides for ${caseLabel}`);
  const current=pair.find(entry=>entry.preset==='rhodes');
  const draft=pair.find(entry=>entry.preset==='rhodes-model-v2');
  assert.ok(current&&draft,`expected a rhodes/rhodes-model-v2 pair for ${caseLabel}`);
  return {current,draft};
};

test('the audition matrix is five pairs at the documented notes and velocities',()=>{
  assert.equal(AUDITION_CASES.length,5);
  assert.deepEqual(AUDITION_CASES.map(entry=>[entry[1],Math.round(entry[2]*100)]),[[36,25],[36,95],[60,25],[60,95],[72,95]]);
  assert.deepEqual(AUDITION_LABELS.map(entry=>entry[1]),['rhodes','rhodes-model-v2']);
  assert.equal(sides.length,10);
});

test('every matched side reaches the 0.5 s RMS target under the peak ceiling',()=>{
  for(const side of sides){
    assert.ok(Math.abs(side.matchedRmsDb-db(AUDITION_TARGET_RMS))<0.01,`${key(side)} matched to ${side.matchedRmsDb.toFixed(3)} dBFS, not the -18.417 dBFS target`);
    assert.ok(side.matchedPeakDb<=db(AUDITION_PEAK_CEILING)+1e-6,`${key(side)} peaks at ${side.matchedPeakDb.toFixed(3)} dBFS, above the 0.9 peak ceiling`);
    assert.equal(side.ceilingBound,false,`${key(side)} was limited by the peak ceiling rather than the RMS target, which would break the pair match`);
  }
});

test('pair RMS is identical while the draft is always the lower-peak side',()=>{
  for(const [caseLabel] of AUDITION_CASES){
    const {current,draft}=pairFor(caseLabel);
    assert.ok(Math.abs(draft.matchedRmsDb-current.matchedRmsDb)<0.005,`${caseLabel} pair RMS differs by ${(draft.matchedRmsDb-current.matchedRmsDb).toFixed(3)} dB`);
    const delta=draft.matchedPeakDb-current.matchedPeakDb;
    assert.ok(delta<0,`${caseLabel} expects the draft to be the lower-peak side, measured ${delta.toFixed(2)} dB`);
    assert.ok(Math.abs(delta-FROZEN_PAIR_PEAK_DELTA_DB[caseLabel])<0.02,`${caseLabel} peak delta measured ${delta.toFixed(2)} dB, frozen at ${FROZEN_PAIR_PEAK_DELTA_DB[caseLabel]} dB`);
  }
});

test('the frozen peak and crest numbers match the generated renders',()=>{
  for(const side of sides){
    assert.ok(Math.abs(side.matchedPeakDb-FROZEN_PEAK_DB[key(side)])<0.02,`${key(side)} peak ${side.matchedPeakDb.toFixed(3)} dBFS, frozen at ${FROZEN_PEAK_DB[key(side)]} dBFS`);
    assert.ok(Math.abs(side.crestDb-FROZEN_CREST_DB[key(side)])<0.02,`${key(side)} crest ${side.crestDb.toFixed(2)} dB, frozen at ${FROZEN_CREST_DB[key(side)]} dB`);
    assert.ok(Math.abs(side.filePeakDb-side.windowPeakDb)<0.01,`${key(side)} peaks outside the matched window, so the documented crest factor would be wrong`);
  }
  const peaks=sides.map(side=>side.matchedPeakDb);
  assert.ok(Math.min(...peaks)>-15,`expected the quieter side to stay above -15 dBFS, measured ${Math.min(...peaks).toFixed(3)}`);
});

test('the aliasing documentation quotes these measured numbers',()=>{
  const doc=readFileSync('docs/MODULAR-SYNTH-ALIASING.md','utf8');
  assert.ok(doc.includes('scripts/modular-rhodes-audition.mjs'),'the doc does not name the audition script');
  assert.ok(doc.includes('first 0.5 s RMS'),'the doc does not state the matching window');
  assert.ok(doc.includes('2.04–4.18 dB'),'the doc does not quote the measured pair peak difference');
  assert.ok(doc.includes('6.58–7.97 dB'),'the doc does not quote the current Rhodes crest factor');
  assert.ok(doc.includes('3.79–4.54 dB'),'the doc does not quote the draft crest factor');
});

test('the matching window is measured over the first half second',()=>{
  const raw=Float32Array.from({length:48000},(_,index)=>index<24000?0.5:0.0001);
  const measured=measureAuditionWindow(raw);
  assert.ok(Math.abs(measured.rms-0.5)<1e-9,`expected the loud first half to dominate, measured rms ${measured.rms}`);
  assert.ok(Math.abs(measured.peak-0.5)<1e-9);
});
