import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialReview, validateReview, verifiedAnnotations } from '../scripts/break-review-state.mjs';

const annotations = JSON.parse(await readFile(new URL('../benchmarks/real-breaks.json', import.meta.url)));

test('review starts with every reference marker pending and preserves the break grouping', () => {
  const draft = initialReview(annotations);
  assert.equal(draft.cases.length, 8);
  assert.equal(draft.cases.reduce((sum, item) => sum + item.markers.length, 0), 152);
  assert.ok(draft.cases.every(item => !item.reviewed && !item.listenedFull && item.markers.every(marker => marker.status === 'pending')));
  assert.deepEqual(validateReview(draft, annotations), draft);
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
