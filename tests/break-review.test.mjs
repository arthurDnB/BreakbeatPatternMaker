import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialReview, validateReview, verifiedAnnotations } from '../scripts/break-review-state.mjs';
import { compareReviews } from '../scripts/break-review-agreement.mjs';

const annotations = JSON.parse(await readFile(new URL('../benchmarks/real-breaks.json', import.meta.url)));

test('review starts with every reference marker pending and preserves the break grouping', () => {
  const draft = initialReview(annotations);
  assert.equal(draft.cases.length, 8);
  assert.equal(draft.cases.reduce((sum, item) => sum + item.markers.length, 0), 152);
  assert.ok(draft.cases.every(item => !item.reviewed && !item.listenedFull && item.markers.every(marker => marker.status === 'pending')));
  assert.deepEqual(validateReview(draft, annotations), draft);
});

test('blind second review starts empty without exposing proposed onset markers', () => {
  const draft = initialReview(annotations, { blind: true });
  assert.equal(draft.cases.length, 8);
  assert.ok(draft.cases.every(item => item.markers.length === 0));
  assert.doesNotThrow(() => validateReview(draft, annotations, { blind: true }));
  assert.throws(() => validateReview(initialReview(annotations), annotations, { blind: true }), /mode does not match/);
});

test('a passage needs full listening and decisions before it can be marked reviewed', () => {
  const draft = initialReview(annotations);
  const first = draft.cases[0];
  first.reviewed = true;
  assert.throws(() => validateReview(draft, annotations), /Finish listening/);
  first.listenedFull = true;
  assert.throws(() => validateReview(draft, annotations), /Finish listening/);
  first.markers.forEach(marker => { marker.status = 'accepted'; });
  first.markers[0].status = 'uncertain';
  assert.throws(() => validateReview(draft, annotations), /Finish listening/);
  first.markers[0].status = 'rejected';
  assert.doesNotThrow(() => validateReview(draft, annotations));
});

test('verified export keeps source identities and only accepted, corrected onset times', () => {
  const draft = initialReview(annotations);
  for (const item of draft.cases) {
    item.listenedFull = true; item.reviewed = true;
    item.markers.forEach(marker => { marker.status = 'accepted'; });
  }
  draft.cases[0].markers[0].time += .001;
  draft.cases[0].markers[1].status = 'rejected';
  draft.cases[0].markers.push({ id: 'added-by-listener', time: .2, status: 'accepted' });
  const exported = verifiedAnnotations(draft, annotations);
  assert.equal(exported.reviewComplete, true);
  assert.equal(exported.cases[0].sha256, annotations.cases[0].sha256);
  assert.ok(exported.cases[0].onsetsSeconds.includes(.2));
  assert.ok(exported.cases[0].onsetsSeconds.includes(Number((annotations.cases[0].onsetsSeconds[0] + .001).toFixed(5))));
  assert.ok(!exported.cases[0].onsetsSeconds.includes(annotations.cases[0].onsetsSeconds[1]));
  assert.equal(annotations.cases[0].onsetsSeconds.length, 20);
});

test('second-review export is distinct and reports inter-listener agreement at multiple tolerances', () => {
  const firstDraft = initialReview(annotations);
  const secondDraft = initialReview(annotations, { blind: true });
  for (const item of firstDraft.cases) {
    item.listenedFull = true; item.reviewed = true;
    item.markers.forEach(marker => { marker.status = 'accepted'; });
  }
  for (const item of secondDraft.cases) {
    const source = annotations.cases.find(entry => entry.id === item.id);
    item.listenedFull = true; item.reviewed = true;
    item.markers = source.onsetsSeconds.map((time, index) => ({ id: `second-${index}`, time, status: 'accepted' }));
  }
  const first = verifiedAnnotations(firstDraft, annotations);
  const second = verifiedAnnotations(secondDraft, annotations, { reviewer: 'independent-blind-listener' });
  assert.equal(second.reviewer, 'independent-blind-listener');
  assert.deepEqual(second.cases.map(item => item.onsetsSeconds), first.cases.map(item => item.onsetsSeconds));
  const report = compareReviews(first, second);
  assert.equal(report.reportType, 'inter-reviewer-onset-agreement');
  assert.equal(report.summary[10].familyMacroF1, 1);
  assert.equal(report.files.length, 8);
  assert.equal(report.files[0].tolerances[5].matched, first.cases[0].onsetsSeconds.length);
});

test('agreement report identifies onset disagreements and rejects mismatched source recordings', () => {
  const makeReviewed = (reviewer, shift = 0) => {
    const draft = initialReview(annotations, { blind: reviewer !== 'primary-listener' });
    for (const item of draft.cases) {
      const source = annotations.cases.find(entry => entry.id === item.id);
      item.listenedFull = true; item.reviewed = true;
      item.markers = source.onsetsSeconds.map((time, index) => ({ id: `${reviewer}-${index}`, time: time + (item.id === annotations.cases[0].id ? shift : 0), status: 'accepted' }));
    }
    return verifiedAnnotations(draft, annotations, { reviewer });
  };
  const report = compareReviews(makeReviewed('primary-listener'), makeReviewed('independent-blind-listener', .012));
  assert.ok(report.files[0].tolerances[10].missed.length > 0);
  assert.ok(report.files[0].tolerances[20].missed.length < report.files[0].tolerances[10].missed.length);
  const mismatched = makeReviewed('independent-blind-listener');
  mismatched.cases[0].sha256 = '0'.repeat(64);
  assert.throws(() => compareReviews(makeReviewed('primary-listener'), mismatched), /source mismatch/);
});
