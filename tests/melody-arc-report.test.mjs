import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRID_TICKS,
  MAX_SINGLE_AXIS_REGRESSION,
  RATING_AXES,
  RATING_MAX,
  RATING_MIN,
  SCHEMA_VERSION,
  aggregateVerdict,
  assertCompleteRating,
  buildVerdict,
  caseIssues,
  contourTokens,
  decideVerdict,
  intervalTokens,
  isCaseComplete,
  meanMetrics,
  melodyMetrics,
  melodySequenceFromPattern,
  metricDeltas,
  ratingIssues,
  repeatedNgramRate,
  restRatio,
  sideMetrics,
} from '../scripts/melody-arc-report.mjs';

// Shorthand: the four axes in documented order.
const complete = (hookRecall, phrasing, harmonicFit, unwantedRepetition) => ({hookRecall, phrasing, harmonicFit, unwantedRepetition});
const SETTINGS = {gridTicks: GRID_TICKS, totalTicks: 1920};

test('RATING_AXES is the documented four-axis 1-5 scale with per-axis direction', () => {
  assert.equal(RATING_MIN, 1);
  assert.equal(RATING_MAX, 5);
  assert.equal(MAX_SINGLE_AXIS_REGRESSION, 1);
  assert.deepEqual(RATING_AXES.map(axis => axis.id), ['hookRecall', 'phrasing', 'harmonicFit', 'unwantedRepetition']);
  assert.deepEqual(RATING_AXES.map(axis => axis.direction), [1, 1, 1, -1]);
});

test('ratingIssues reports missing, out-of-scale and unknown axes explicitly', () => {
  assert.deepEqual(ratingIssues(complete(3, 3, 3, 3)), []);
  assert.deepEqual(ratingIssues({hookRecall: 3, phrasing: 3, harmonicFit: 3}), ['missing axis unwantedRepetition']);
  assert.deepEqual(ratingIssues({...complete(3, 3, 3, 3), tempoFeel: 4}), ['unknown axis tempoFeel']);
  assert.deepEqual(ratingIssues(complete(0, 3, 3, 3)), ['axis hookRecall must be an integer 1-5 (got 0)']);
  assert.deepEqual(ratingIssues(complete(3, 3.5, 3, 3)), ['axis phrasing must be an integer 1-5 (got 3.5)']);
  assert.deepEqual(ratingIssues(complete(3, 3, 3, 6)), ['axis unwantedRepetition must be an integer 1-5 (got 6)']);
  assert.deepEqual(ratingIssues(null), ['rating must be an object with keys hookRecall, phrasing, harmonicFit, unwantedRepetition']);
  const mixed = ratingIssues({hookRecall: 3, tempoFeel: 2});
  assert.ok(mixed.includes('missing axis phrasing') && mixed.includes('unknown axis tempoFeel'), mixed.join('; '));
});

test('assertCompleteRating throws naming every problem', () => {
  assert.equal(assertCompleteRating(complete(1, 2, 3, 4)), true);
  assert.throws(() => assertCompleteRating({hookRecall: 3}, 'side B (arc)'), /side B \(arc\) is not a complete 1-5 rating: missing axis phrasing/);
});

test('isCaseComplete requires a caseId and both complete sides', () => {
  const base = {caseId: 'jungle-lead', axisRatings: {A: complete(3, 3, 3, 3), B: complete(4, 3, 4, 2)}};
  assert.equal(isCaseComplete(base), true);
  assert.equal(isCaseComplete({...base, axisRatings: {A: complete(3, 3, 3, 3)}}), false);
  assert.equal(isCaseComplete({axisRatings: base.axisRatings}), false);
  assert.ok(caseIssues({...base, axisRatings: {A: complete(3, 3, 3, 3), B: {hookRecall: 4}}}).some(issue => issue.startsWith('side B (arc)')));
});

test('decideVerdict scores a clean improvement as a win', () => {
  const result = decideVerdict(complete(3, 3, 3, 3), complete(4, 3, 4, 2));
  assert.equal(result.verdict, 'win');
  assert.deepEqual(result.deltas, {hookRecall: 1, phrasing: 0, harmonicFit: 1, unwantedRepetition: 1});
  assert.equal(result.improvements, 3);
  assert.equal(result.losses, 0);
  assert.equal(result.worstRegression, 0);
});

test('decideVerdict scores identical ratings as a tie', () => {
  const result = decideVerdict(complete(2, 4, 5, 1), complete(2, 4, 5, 1));
  assert.equal(result.verdict, 'tie');
  assert.equal(result.improvements, 0);
  assert.equal(result.losses, 0);
  assert.equal(result.worstRegression, 0);
});

test('decideVerdict boundary: a single-step loss is not a regression but blocks a win', () => {
  const allowed = decideVerdict(complete(3, 3, 3, 3), complete(4, 3, 4, 4));
  assert.equal(allowed.worstRegression, MAX_SINGLE_AXIS_REGRESSION);
  assert.equal(allowed.losses, 1);
  assert.equal(allowed.verdict, 'no-clear-win');

  const phrasingOnly = decideVerdict(complete(3, 3, 3, 3), complete(4, 2, 4, 2));
  assert.equal(phrasingOnly.worstRegression, 1);
  assert.equal(phrasingOnly.verdict, 'win');
});

test('decideVerdict scores a two-step loss as a regression', () => {
  const result = decideVerdict(complete(3, 3, 3, 3), complete(4, 3, 4, 5));
  assert.equal(result.verdict, 'regression');
  assert.equal(result.worstRegression, 2);
  assert.match(result.reasons[0], /regresses by 2 steps .* allowed maximum of 1/);
});

test('decideVerdict regresses when more axes lose than improve', () => {
  const result = decideVerdict(complete(3, 3, 3, 3), complete(2, 2, 4, 3));
  assert.equal(result.worstRegression, 1);
  assert.equal(result.losses, 2);
  assert.equal(result.improvements, 1);
  assert.equal(result.verdict, 'regression');
  assert.match(result.reasons[0], /regresses on 2 axes and improves on 1/);
});

test('decideVerdict throws for incomplete, out-of-scale or unknown ratings', () => {
  assert.throws(() => decideVerdict(complete(3, 3, 3, 3), {hookRecall: 4}), /missing axis phrasing/);
  assert.throws(() => decideVerdict(complete(3, 3, 3, 3), complete(4, 3, 4, 9)), /axis unwantedRepetition must be an integer 1-5/);
  assert.throws(() => decideVerdict(complete(3, 3, 3, 3), {...complete(4, 3, 4, 2), vibe: 5}), /unknown axis vibe/);
});

test('aggregateVerdict applies the documented genre and overall rollup', () => {
  assert.equal(aggregateVerdict([]), 'pending');
  assert.equal(aggregateVerdict(['win', 'win', 'tie']), 'win');
  assert.equal(aggregateVerdict(['win', 'regression']), 'no-clear-win');
  assert.equal(aggregateVerdict(['win', 'regression', 'regression']), 'regression');
  assert.equal(aggregateVerdict(['tie', 'tie']), 'tie');
  assert.equal(aggregateVerdict(['tie', 'no-clear-win']), 'no-clear-win');
  assert.equal(aggregateVerdict(['pending', 'win']), 'pending');
  assert.equal(aggregateVerdict(['nonsense']), 'pending');
});

test('repeatedNgramRate is a documented repeated-occurrence fraction and guards short input', () => {
  assert.equal(repeatedNgramRate([2, 2, -5, 2, 2, -5], 3), 0.5);
  assert.equal(repeatedNgramRate([1, 2, 3], 3), 0);
  assert.equal(repeatedNgramRate([1, 2], 3), 0);
  assert.equal(repeatedNgramRate([], 3), 0);
  assert.equal(repeatedNgramRate([5, 5, 5, 5], 3), 1);
  assert.equal(repeatedNgramRate([1, 2, 3, 4], 3), 0);
  assert.equal(repeatedNgramRate([1, 2, 3], 0), 0);
});

test('melodyMetrics matches a hand-computed synthetic melody', () => {
  const notes = [60, 62, 64, 59, 61, 63, 58];
  const sequence = notes.map((note, index) => ({note, startTick: index * 240, durationTicks: 240}));
  assert.deepEqual(intervalTokens(sequence), [2, 2, -5, 2, 2, -5]);
  assert.deepEqual(contourTokens(sequence), [1, 1, -1, 1, 1, -1]);
  const metrics = melodyMetrics(sequence, SETTINGS);
  assert.equal(metrics.noteCount, 7);
  assert.equal(metrics.distinctPitchClasses, 7);
  assert.equal(metrics.motifRepeatRate, 0.5);
  assert.equal(metrics.contourRepeatRate, 0.5);
  assert.equal(metrics.restRatio, 0.125);
  assert.equal(metrics.gridTicks, GRID_TICKS);
  assert.equal(metrics.totalTicks, 1920);

  // Without an explicit length the grid ends at the last note off (1680 ticks -> 7 slots).
  const derived = melodyMetrics(sequence);
  assert.equal(derived.totalTicks, 1680);
  assert.equal(derived.restRatio, 0);

  const varied = melodyMetrics([60, 63, 66, 70, 62].map((note, index) => ({note, startTick: index * 240, durationTicks: 240})), SETTINGS);
  assert.equal(varied.motifRepeatRate, 0);
  assert.equal(varied.contourRepeatRate, 0);
  assert.equal(varied.noteCount, 5);
  assert.equal(varied.restRatio, 0.375);
});

test('melodyMetrics is deterministic and independent of event identity', () => {
  const sequence = [60, 62, 64, 59, 61, 63, 58].map((note, index) => ({id: 'note-' + index, note, startTick: index * 240, durationTicks: 240}));
  const first = melodyMetrics(sequence, SETTINGS);
  const second = melodyMetrics(sequence, SETTINGS);
  assert.deepEqual(first, second);
  const renamed = sequence.map((item, index) => ({...item, id: 'other-' + index}));
  assert.deepEqual(melodyMetrics(renamed, SETTINGS), first);
  const flat = melodyMetrics(sequence.map(({note, startTick, durationTicks}) => ({note, startTick, durationTicks})), SETTINGS);
  assert.deepEqual(flat, first);
});

test('restRatio uses the recorded grid and ignores onsets past the end', () => {
  const sequence = [{note: 60, startTick: 0, durationTicks: 240}, {note: 62, startTick: 1920, durationTicks: 240}];
  assert.equal(restRatio(sequence, {gridTicks: 240, totalTicks: 960}), 0.75);
  assert.equal(restRatio(sequence, {gridTicks: 240, totalTicks: 1920}), 0.875);
  assert.equal(restRatio([], {gridTicks: 240, totalTicks: 960}), 1);
  assert.equal(restRatio([], {gridTicks: 240, totalTicks: 0}), 0);
  assert.throws(() => restRatio(sequence, {gridTicks: 0, totalTicks: 960}), /gridTicks must be a positive number/);
  assert.throws(() => restRatio(sequence, {gridTicks: 240, totalTicks: -1}), /totalTicks must be a number >= 0/);
  assert.throws(() => melodyMetrics([{note: 'C4', startTick: 0}]), /needs a numeric note/);
});

test('melodySequenceFromPattern keeps only the target track pitched events', () => {
  const pattern = {
    events: [
      {id: 'c', trackId: 'lead-1', role: 'lead', baseTick: 960, offsetTick: 0, synthNote: {note: 67, durationTicks: 240}, sourceId: 'x', gain: 1, pan: 0, anchor: false, ghost: false, reason: ''},
      {id: 'a', trackId: 'lead-1', role: 'lead', baseTick: 0, offsetTick: 0, synthNote: {note: 60, durationTicks: 480}, sourceId: 'x', gain: 1, pan: 0, anchor: false, ghost: false, reason: ''},
      {id: 'b', trackId: 'lead-1', role: 'lead', baseTick: 480, offsetTick: -10, synthNote: {note: 62, durationTicks: 240}, sourceId: 'x', gain: 1, pan: 0, anchor: false, ghost: false, reason: ''},
      {id: 'd', trackId: 'lead-1', role: 'lead', baseTick: 1200, offsetTick: 0, sourceId: 'x', gain: 1, pan: 0, anchor: false, ghost: false, reason: ''},
      {id: 'e', trackId: 'bass-1', role: 'bassline', baseTick: 0, offsetTick: 0, synthNote: {note: 36, durationTicks: 240}, sourceId: 'x', gain: 1, pan: 0, anchor: false, ghost: false, reason: ''},
    ],
  };
  const sequence = melodySequenceFromPattern(pattern, 'lead-1');
  assert.deepEqual(sequence.map(item => item.id), ['a', 'b', 'c']);
  assert.deepEqual(sequence.map(item => item.startTick), [0, 470, 960]);
  assert.deepEqual(sequence.map(item => item.note), [60, 62, 67]);
  assert.equal(sequence[0].durationTicks, 480);
  assert.deepEqual(melodySequenceFromPattern({}, 'lead-1'), []);
});

test('buildVerdict marks sign-off pending when a case is incomplete or unnamed', () => {
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '2026-01-01T00:00:00.000Z',
    listener: 'Ada',
    seed: 'melody-arc-audition',
    cases: [
      {
        caseId: 'jungle-lead', genre: 'jungle', part: 'lead',
        axisRatings: {A: complete(3, 3, 3, 3), B: complete(4, 3, 4, 2)},
        notes: 'tighter hook',
        metrics: {A: {noteCount: 8, distinctPitchClasses: 4, motifRepeatRate: 0.5, contourRepeatRate: 0.5, restRatio: 0.25, gridTicks: 240, totalTicks: 7680}, B: {noteCount: 9, distinctPitchClasses: 4, motifRepeatRate: 0.25, contourRepeatRate: 0.5, restRatio: 0.125, gridTicks: 240, totalTicks: 7680}},
      },
      {caseId: 'liquiddnb-lead', genre: 'liquiddnb', part: 'lead', axisRatings: {A: complete(3, 3, 3, 3), B: {hookRecall: 4}}, notes: ''},
    ],
  };
  const verdict = buildVerdict([{doc, source: 'test-results/melody-arc-audition/melody-arc-ratings.json'}]);
  assert.equal(verdict.schemaVersion, SCHEMA_VERSION);
  assert.equal(verdict.signOff, 'pending');
  assert.equal(verdict.cases[0].verdict, 'win');
  assert.equal(verdict.cases[0].signedOff, true);
  assert.equal(verdict.cases[0].scoredBy, 'Ada');
  assert.deepEqual(verdict.cases[0].ratings.A, complete(3, 3, 3, 3));
  assert.equal(verdict.cases[0].metrics.B.noteCount, 9);
  assert.equal(verdict.cases[0].metricDeltas.noteCount, 1);
  assert.deepEqual(verdict.cases[0].notes, [{listener: 'Ada', notes: 'tighter hook'}]);
  assert.equal(verdict.cases[1].verdict, 'pending');
  assert.equal(verdict.cases[1].ratings, null);
  assert.equal(verdict.cases[1].signedOff, false);
  assert.ok(verdict.pendingReasons.some(reason => reason.startsWith('liquiddnb-lead:')), verdict.pendingReasons.join(' | '));
  assert.match(verdict.pendingReasons.find(reason => reason.startsWith('liquiddnb-lead:')) ?? '', /side B \(arc\): missing axis phrasing/);
  assert.deepEqual(verdict.cases[1].partialRatings, {A: complete(3, 3, 3, 3), B: {hookRecall: 4}});
  assert.deepEqual(verdict.sources, ['test-results/melody-arc-audition/melody-arc-ratings.json']);
  assert.deepEqual(verdict.genres.map(item => item.genre), ['jungle', 'liquiddnb']);
  assert.equal(verdict.genres[0].verdict, 'win');
  assert.equal(verdict.genres[1].verdict, 'pending');
  assert.equal(verdict.overall.verdict, 'pending');
  assert.deepEqual(verdict.overall.countBreakdown, {win: 1, tie: 0, 'no-clear-win': 0, regression: 0, pending: 1, total: 2});
  assert.equal(verdict.overall.ratings.A.hookRecall, 3);
  assert.equal(verdict.evaluationSeed, 'melody-arc-audition');

  const unnamed = buildVerdict([{doc: {...doc, listener: '   ', cases: [doc.cases[0]]}, source: 'unnamed.json'}]);
  assert.equal(unnamed.cases[0].ratings !== null, true);
  assert.equal(unnamed.cases[0].scoredBy, null);
  assert.equal(unnamed.cases[0].signedOff, false);
  assert.equal(unnamed.signOff, 'pending');
  assert.match(unnamed.pendingReasons[0], /complete rating has no listener name/);
});

test('buildVerdict signs off only when every case has a named complete listener', () => {
  const rated = (hookRecall, unwantedRepetition) => ({A: complete(3, 3, 3, 3), B: complete(hookRecall, 3, 3, unwantedRepetition)});
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    listener: 'Ada',
    seed: 'melody-arc-audition',
    cases: [
      {caseId: 'jungle-lead', genre: 'jungle', part: 'lead', axisRatings: rated(4, 2), notes: ''},
      {caseId: 'boombap-lead', genre: 'boombap', part: 'lead', axisRatings: rated(3, 3), notes: ''},
    ],
  };
  const verdict = buildVerdict(doc);
  assert.equal(verdict.signOff, 'complete');
  assert.deepEqual(verdict.pendingReasons, []);
  assert.equal(verdict.cases[0].verdict, 'win');
  assert.equal(verdict.cases[1].verdict, 'tie');
  assert.equal(verdict.genres.length, 2);
  assert.equal(verdict.overall.verdict, 'win');
  assert.deepEqual(verdict.overall.countBreakdown, {win: 1, tie: 1, 'no-clear-win': 0, regression: 0, pending: 0, total: 2});
  assert.equal(verdict.signOffRequirement.includes('at least one named listener'), true);
  assert.equal(buildVerdict({schemaVersion: SCHEMA_VERSION, cases: []}).signOff, 'pending');
  assert.match(buildVerdict({schemaVersion: SCHEMA_VERSION, cases: []}).pendingReasons[0], /contains no cases/);
});

test('buildVerdict merges several listeners and rolls up genres and overall', () => {
  const ada = {
    schemaVersion: SCHEMA_VERSION,
    listener: 'Ada',
    seed: 'melody-arc-audition',
    cases: [
      {caseId: 'jungle-lead', genre: 'jungle', part: 'lead', axisRatings: {A: complete(3, 3, 3, 3), B: complete(4, 3, 4, 2)}, notes: 'yes', metrics: {A: {noteCount: 8, restRatio: 0.5}, B: {noteCount: 10, restRatio: 0.25}}},
      {caseId: 'boombap-lead', genre: 'boombap', part: 'lead', axisRatings: {A: complete(3, 3, 3, 3), B: {phrasing: 4}}, notes: ''},
    ],
  };
  const bea = {
    schemaVersion: SCHEMA_VERSION,
    listener: 'Bea',
    seed: 'melody-arc-audition',
    cases: [
      {caseId: 'boombap-lead', genre: 'boombap', part: 'lead', axisRatings: {A: complete(4, 4, 4, 4), B: complete(3, 3, 3, 5)}, notes: 'worse', metrics: {A: {noteCount: 6, restRatio: 0.375}, B: {noteCount: 7, restRatio: 0.25}}},
    ],
  };
  const verdict = buildVerdict([{doc: ada, source: 'ada.json'}, {doc: bea, source: 'bea.json'}]);
  assert.equal(verdict.signOff, 'complete');
  assert.deepEqual(verdict.sources, ['ada.json', 'bea.json']);
  assert.equal(verdict.cases.length, 2);
  assert.equal(verdict.cases[0].scoredBy, 'Ada');
  assert.equal(verdict.cases[1].scoredBy, 'Bea');
  assert.equal(verdict.cases[1].verdict, 'regression');
  assert.deepEqual(verdict.cases[1].ratedBy, ['Ada', 'Bea']);
  assert.deepEqual(verdict.cases[1].notes, [{listener: 'Bea', notes: 'worse'}]);
  const boombap = verdict.genres.find(item => item.genre === 'boombap');
  assert.equal(boombap.verdict, 'regression');
  assert.equal(boombap.ratings.B.unwantedRepetition, 5);
  assert.equal(boombap.metrics.B.noteCount, 7);
  assert.equal(verdict.overall.verdict, 'no-clear-win');
  assert.equal(verdict.overall.metrics.B.noteCount, 8.5);
});

test('metricDeltas, sideMetrics and meanMetrics agree on nested and flat metrics', () => {
  const nested = {
    A: {noteCount: 8, distinctPitchClasses: 4, motifRepeatRate: 0.5, contourRepeatRate: 0.5, restRatio: 0.25, gridTicks: 240, totalTicks: 1920},
    B: {noteCount: 10, distinctPitchClasses: 4, motifRepeatRate: 0.25, contourRepeatRate: 0.5, restRatio: 0.125, gridTicks: 240, totalTicks: 1920},
  };
  assert.equal(sideMetrics(nested, 'A').noteCount, 8);
  assert.equal(sideMetrics(nested, 'B').restRatio, 0.125);
  assert.equal(sideMetrics({noteCount: 5}, 'A').noteCount, 5);
  assert.equal(sideMetrics(undefined, 'A'), null);
  assert.equal(sideMetrics({A: {restRatio: 0.5}}, 'A'), null);
  assert.deepEqual(metricDeltas(nested), {noteCount: 2, distinctPitchClasses: 0, motifRepeatRate: -0.25, contourRepeatRate: 0, restRatio: -0.125});
  assert.equal(metricDeltas({A: {noteCount: 8}}), null);
  assert.equal(meanMetrics([{noteCount: 8, restRatio: 0.25}, {noteCount: 10, restRatio: 0.125}]).noteCount, 9);
  assert.equal(meanMetrics([{noteCount: 8, restRatio: 0.25}, {noteCount: 10, restRatio: 0.125}]).restRatio, 0.1875);
  assert.equal(meanMetrics([{noteCount: 8, gridTicks: 240, totalTicks: 1920}, {noteCount: 10, gridTicks: 240, totalTicks: 3840}]).gridTicks, 240);
  assert.equal(meanMetrics([{noteCount: 8, gridTicks: 240}, {noteCount: 10, gridTicks: 480}]).gridTicks, undefined);
  assert.equal(meanMetrics([]), null);
  assert.equal(meanMetrics([null, undefined]), null);
});
