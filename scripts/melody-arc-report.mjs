// Melody arc A/B: pure rating/metric/verdict logic plus a small CLI.
//
// This module is deliberately dependency-free so the decision rule, the metric
// functions and the verdict builder can be unit-tested without a build and
// without rendering audio. The audition page imports the same functions, so the
// page and the report can never disagree about the scale or the axes.
//
// No generation or product behaviour lives here, and nothing in this file reads
// the network.

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SCHEMA_VERSION = 1;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
/** A case may lose at most this many steps on a single axis before it regresses. */
export const MAX_SINGLE_AXIS_REGRESSION = 1;
/** Rest/figure grid used by restRatio: 240 ticks is a sixteenth note at 960 PPQ. */
export const GRID_TICKS = 240;
export const DEFAULT_RATINGS_PATH = 'test-results/melody-arc-audition/melody-arc-ratings.json';
export const DEFAULT_VERDICT_PATH = 'test-results/melody-arc-audition/verdict.json';
export const RATINGS_FILE_NAME = 'melody-arc-ratings.json';
export const SIDES = ['A', 'B'];
export const SIDE_LABELS = {A: 'previous', B: 'arc'};
export const VERDICTS = ['win', 'tie', 'no-clear-win', 'regression', 'pending'];

/** The four subjective axes. direction +1 = higher is better, -1 = lower is better. */
export const RATING_AXES = [
  {id: 'hookRecall', label: 'Hook recall', direction: 1, low: 'no memorable hook', high: 'instantly recallable hook'},
  {id: 'phrasing', label: 'Phrasing', direction: 1, low: 'shapeless run-on', high: 'clear, well-placed phrases'},
  {id: 'harmonicFit', label: 'Harmonic fit', direction: 1, low: 'clashes with the progression', high: 'locked to the harmony'},
  {id: 'unwantedRepetition', label: 'Unwanted repetition', direction: -1, low: 'no tiresome repeats', high: 'gratingly repetitive'},
];

export const METRIC_IDS = ['noteCount', 'distinctPitchClasses', 'motifRepeatRate', 'contourRepeatRate', 'restRatio'];

/**
 * Definitions and limits for every objective metric. These strings are copied
 * into ratings.json and verdict.json so a stored rating is self-describing.
 */
export const METRIC_DEFINITIONS = {
  noteCount: 'Number of pitched lead events in the pattern (pattern.events that carry a synthNote on the generated lead track). It measures activity, not quality: sparse and busy are both legitimate.',
  distinctPitchClasses: 'Count of distinct pitch classes (note mod 12) across all pitched lead events. 1-3 is a narrow, chant-like line; 4-7 matches most scale-based hooks; 8+ is chromatic or scale-wandering. Any value can be musical.',
  motifRepeatRate: 'Literal self-similarity of interval shape. Tokens are the semitone intervals between consecutive pitched events; overlapping trigrams (runs of 3 intervals) are counted, and the score is the fraction of trigram occurrences whose interval pattern is heard more than once. 0 means no interval shape repeats, 1 means every trigram is a repeat. Fewer than 3 intervals scores 0 by definition, and rests do not contribute because only pitched pairs are chained.',
  contourRepeatRate: 'Direction-only self-similarity. Tokens are the sign of each consecutive interval (+1 up, -1 down, 0 repeated pitch); the score is the same repeated-trigram fraction as motifRepeatRate. High contour repetition with low motifRepeatRate usually means a transposed or rhythmically displaced hook, which is often desirable.',
  restRatio: 'Fraction of the sixteenth-note grid under the rated pattern that contains no lead onset: 1 - (occupied grid slots / total grid slots). Near 0 is a wall of notes; near 1 is mostly silence. The grid step is recorded as gridTicks and the length as totalTicks.',
  gridTicks: 'Grid resolution used by restRatio in PPQ ticks (240 = one sixteenth at 960 PPQ).',
  totalTicks: 'Musical length used as the restRatio denominator, in PPQ ticks (bars x bar ticks for a generated pattern).',
};

export const METRIC_LIMITS = 'A high repetition rate is not automatically bad: anthemic jungle and liquid DnB hooks are expected to repeat more literally than an IDM or atmospheric breakcore line, and the metrics say nothing about register, groove or mix. Treat every metric as one signal next to the ear, never as a verdict on its own.';

export const DECISION_RULE_TEXT = [
  'Side A is the previous lead, side B is the arc (new) lead. Every axis is rated ' + RATING_MIN + '-' + RATING_MAX + '.',
  'Signed deltas are normalised so positive always means "new is better": hookRecall, phrasing and harmonicFit use B - A; unwantedRepetition (lower is better) uses A - B.',
  'A case is WIN when no axis regresses by more than ' + MAX_SINGLE_AXIS_REGRESSION + ' step (worstRegression <= ' + MAX_SINGLE_AXIS_REGRESSION + '), at least one axis improves, and B is not worse than A on hookRecall, harmonicFit or unwantedRepetition.',
  'A case is TIE when no axis changes at all.',
  'A case is REGRESSION when any axis regresses by more than ' + MAX_SINGLE_AXIS_REGRESSION + ' step, or when more axes regress than improve (with at least one regression).',
  'Any other mixed result is NO-CLEAR-WIN.',
  'A case with a missing or out-of-scale axis, or an unknown axis name, cannot be scored and counts as PENDING.',
  'Per genre and overall the case verdicts aggregate as: PENDING if any case is pending; REGRESSION if regressions outnumber wins; WIN if there is at least one win and no regression; TIE if no case wins and no case regresses and none is unclear; otherwise NO-CLEAR-WIN.',
].join(' ');

export const SIGN_OFF_REQUIREMENT = 'signOff is "complete" only when every case in the ratings document is rated on all four axes (' + RATING_AXES.map(axis => axis.id).join(', ') + ') by at least one named listener, and at least one case exists. Anything else is "pending".';

export const RATING_SCALE = {
  min: RATING_MIN,
  max: RATING_MAX,
  meaning: 'Every axis is rated ' + RATING_MIN + '-' + RATING_MAX + ' separately for each side. Only hookRecall, phrasing and harmonicFit are higher-is-better; unwantedRepetition is lower-is-better. The per-axis "low" and "high" strings below state what each end of the scale means, and "direction" is the sign applied by the decision rule.',
  axes: RATING_AXES.map(axis => ({id: axis.id, label: axis.label, direction: axis.direction, low: axis.low, high: axis.high})),
};

const round6 = value => Math.round(value * 1e6) / 1e6;
const finite = value => typeof value === 'number' && Number.isFinite(value);

// ---------------------------------------------------------------------------
// Metrics (pure, no audio, no build)
// ---------------------------------------------------------------------------

/**
 * Extract the melodic event sequence from a generated pattern for one track.
 * Returns [{note, startTick, durationTicks, id}] sorted by (startTick, note, id).
 */
export function melodySequenceFromPattern(pattern, trackId) {
  const events = Array.isArray(pattern?.events) ? pattern.events : [];
  return events
    .filter(hit => hit && hit.trackId === trackId && hit.synthNote && finite(hit.synthNote.note))
    .map(hit => ({
      id: typeof hit.id === 'string' ? hit.id : '',
      note: hit.synthNote.note,
      startTick: Math.round((hit.baseTick ?? 0) + (hit.offsetTick ?? 0)),
      durationTicks: finite(hit.synthNote.durationTicks) ? hit.synthNote.durationTicks : 0,
    }))
    .sort((a, b) => a.startTick - b.startTick || a.note - b.note || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Interval tokens in semitones between consecutive pitched events. */
export function intervalTokens(sequence) {
  const notes = normalizeSequence(sequence).map(item => item.note);
  return notes.slice(1).map((note, index) => note - notes[index]);
}

/** Contour tokens: sign of each consecutive interval. */
export function contourTokens(sequence) {
  return intervalTokens(sequence).map(interval => Math.sign(interval));
}

export function sign(value) {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * Fraction of overlapping n-gram occurrences that belong to an n-gram heard
 * more than once. Returns 0 when there are fewer than n tokens.
 */
export function repeatedNgramRate(tokens, n) {
  if (!Array.isArray(tokens) || !Number.isInteger(n) || n < 1 || tokens.length < n) return 0;
  const counts = new Map();
  for (let index = 0; index + n <= tokens.length; index += 1) {
    const key = tokens.slice(index, index + n).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = tokens.length - n + 1;
  if (total <= 0) return 0;
  let repeated = 0;
  for (const count of counts.values()) if (count > 1) repeated += count;
  return round6(repeated / total);
}

/** Fraction of the grid under totalTicks with no lead onset. */
export function restRatio(sequence, options = {}) {
  const gridTicks = options.gridTicks ?? GRID_TICKS;
  if (!finite(gridTicks) || gridTicks <= 0) throw new Error('gridTicks must be a positive number.');
  const items = normalizeSequence(sequence);
  const lastEnd = items.reduce((end, item) => Math.max(end, item.startTick + item.durationTicks), 0);
  const totalTicks = options.totalTicks ?? lastEnd;
  if (!finite(totalTicks) || totalTicks < 0) throw new Error('totalTicks must be a number >= 0.');
  const slots = Math.ceil(totalTicks / gridTicks);
  if (slots <= 0) return 0;
  const occupied = new Set();
  for (const item of items) {
    if (item.startTick < 0 || item.startTick >= totalTicks) continue;
    occupied.add(Math.floor(item.startTick / gridTicks));
  }
  return round6(1 - Math.min(occupied.size, slots) / slots);
}

/** All objective metrics for one melodic event sequence. Pure and deterministic. */
export function melodyMetrics(sequence, options = {}) {
  const items = normalizeSequence(sequence);
  const gridTicks = options.gridTicks ?? GRID_TICKS;
  const lastEnd = items.reduce((end, item) => Math.max(end, item.startTick + item.durationTicks), 0);
  const totalTicks = options.totalTicks ?? lastEnd;
  return {
    noteCount: items.length,
    distinctPitchClasses: new Set(items.map(item => ((item.note % 12) + 12) % 12)).size,
    motifRepeatRate: repeatedNgramRate(intervalTokens(items), 3),
    contourRepeatRate: repeatedNgramRate(contourTokens(items), 3),
    restRatio: restRatio(items, {gridTicks, totalTicks}),
    gridTicks,
    totalTicks,
  };
}

function normalizeSequence(sequence) {
  if (!Array.isArray(sequence)) throw new Error('A melody sequence must be an array.');
  return sequence.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('Melody sequence item ' + index + ' must be an object.');
    if (!finite(item.note)) throw new Error('Melody sequence item ' + index + ' needs a numeric note.');
    if (!finite(item.startTick)) throw new Error('Melody sequence item ' + index + ' needs a numeric startTick.');
    return {
      note: item.note,
      startTick: item.startTick,
      durationTicks: finite(item.durationTicks) ? item.durationTicks : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Rating validation
// ---------------------------------------------------------------------------

/** Explicit problems with one side's rating object, including unknown axis names. */
export function ratingIssues(ratings) {
  const issues = [];
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
    return ['rating must be an object with keys ' + RATING_AXES.map(axis => axis.id).join(', ')];
  }
  for (const axis of RATING_AXES) {
    const value = ratings[axis.id];
    if (value === undefined || value === null) {
      issues.push('missing axis ' + axis.id);
      continue;
    }
    if (!Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) {
      issues.push('axis ' + axis.id + ' must be an integer ' + RATING_MIN + '-' + RATING_MAX + ' (got ' + JSON.stringify(value) + ')');
    }
  }
  for (const key of Object.keys(ratings)) {
    if (!RATING_AXES.some(axis => axis.id === key)) issues.push('unknown axis ' + key);
  }
  return issues;
}

export function assertCompleteRating(ratings, label = 'rating') {
  const issues = ratingIssues(ratings);
  if (issues.length) throw new Error(label + ' is not a complete ' + RATING_MIN + '-' + RATING_MAX + ' rating: ' + issues.join('; ') + '.');
  return true;
}

/** Explicit problems with one exported case record (both sides). */
export function caseIssues(record) {
  if (!record || typeof record !== 'object') return ['case must be an object'];
  const issues = [];
  if (typeof record.caseId !== 'string' || !record.caseId.trim()) issues.push('caseId is required');
  for (const side of SIDES) {
    for (const issue of ratingIssues(record.axisRatings?.[side])) {
      issues.push('side ' + side + ' (' + SIDE_LABELS[side] + '): ' + issue);
    }
  }
  return issues;
}

export function isCaseComplete(record) {
  return caseIssues(record).length === 0;
}

// ---------------------------------------------------------------------------
// Decision rule
// ---------------------------------------------------------------------------

/**
 * Score one paired case. Throws when either side is incomplete, out of scale,
 * or carries an unknown axis, so an unscoreable case can never silently pass.
 */
export function decideVerdict(oldRatings, newRatings) {
  assertCompleteRating(oldRatings, 'side A (' + SIDE_LABELS.A + ')');
  assertCompleteRating(newRatings, 'side B (' + SIDE_LABELS.B + ')');
  const deltas = {};
  for (const axis of RATING_AXES) {
    deltas[axis.id] = (newRatings[axis.id] - oldRatings[axis.id]) * axis.direction;
  }
  const values = RATING_AXES.map(axis => deltas[axis.id]);
  const improvements = values.filter(delta => delta > 0).length;
  const losses = values.filter(delta => delta < 0).length;
  const worstRegression = Math.max(0, ...values.map(delta => -delta));
  const reasons = [];
  let verdict;
  if (worstRegression > MAX_SINGLE_AXIS_REGRESSION) {
    verdict = 'regression';
    reasons.push('side B regresses by ' + worstRegression + ' steps on at least one axis, above the allowed maximum of ' + MAX_SINGLE_AXIS_REGRESSION + '.');
  } else if (losses > improvements) {
    verdict = 'regression';
    reasons.push('side B regresses on ' + losses + ' axes and improves on ' + improvements + '.');
  } else if (improvements === 0) {
    verdict = 'tie';
    reasons.push('no axis changed in either direction.');
  } else if (deltas.hookRecall >= 0 && deltas.harmonicFit >= 0 && deltas.unwantedRepetition >= 0) {
    verdict = 'win';
    reasons.push('side B improves on ' + improvements + ' axes and does not regress on hookRecall, harmonicFit or unwantedRepetition.');
  } else {
    verdict = 'no-clear-win';
    reasons.push('side B improves on some axes but loses ground on hookRecall, harmonicFit or unwantedRepetition.');
  }
  return {verdict, deltas, improvements, losses, worstRegression, reasons};
}

/** Aggregate case verdicts into one genre or overall verdict. */
export function aggregateVerdict(verdicts) {
  const list = (Array.isArray(verdicts) ? verdicts : []).filter(value => typeof value === 'string');
  const count = name => list.filter(value => value === name).length;
  if (!list.length) return 'pending';
  const wins = count('win');
  const regressions = count('regression');
  const ties = count('tie');
  const noClear = count('no-clear-win');
  const known = wins + regressions + ties + noClear;
  if (list.length !== known) return 'pending';
  if (regressions > wins) return 'regression';
  if (wins > 0 && regressions === 0) return 'win';
  if (wins === 0 && regressions === 0 && noClear === 0) return 'tie';
  return 'no-clear-win';
}

// ---------------------------------------------------------------------------
// Verdict document
// ---------------------------------------------------------------------------

/** Read the metrics for one side out of a flat or {A,B} metrics object. */
export function sideMetrics(metrics, side) {
  if (!metrics || typeof metrics !== 'object') return null;
  const nested = metrics[side];
  if (nested && typeof nested === 'object' && finite(nested.noteCount)) return nested;
  return finite(metrics.noteCount) ? metrics : null;
}

export function metricsBySide(metrics) {
  return {A: sideMetrics(metrics, 'A'), B: sideMetrics(metrics, 'B')};
}

/** Raw B - A per metric. Interpretation depends on the metric; see METRIC_DEFINITIONS. */
export function metricDeltas(metrics) {
  const sides = metricsBySide(metrics);
  if (!sides.A || !sides.B) return null;
  const deltas = {};
  let any = false;
  for (const id of METRIC_IDS) {
    if (finite(sides.A[id]) && finite(sides.B[id])) {
      deltas[id] = round6(sides.B[id] - sides.A[id]);
      any = true;
    }
  }
  return any ? deltas : null;
}

/** Mean of a list of flat metric objects (null entries skipped). */
export function meanMetrics(metricsList) {
  const list = (Array.isArray(metricsList) ? metricsList : []).filter(metrics => metrics && typeof metrics === 'object');
  if (!list.length) return null;
  const out = {};
  for (const id of METRIC_IDS) {
    const values = list.map(metrics => metrics[id]).filter(finite);
    if (values.length) out[id] = round6(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  const grids = list.map(metrics => metrics.gridTicks).filter(finite);
  const totals = list.map(metrics => metrics.totalTicks).filter(finite);
  if (grids.length && new Set(grids).size === 1) out.gridTicks = grids[0];
  if (totals.length) out.totalTicksMean = round6(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  return Object.keys(out).length ? out : null;
}

function meanRatings(cases) {
  const scored = cases.filter(item => item.ratings);
  if (!scored.length) return null;
  const out = {A: {}, B: {}};
  for (const side of SIDES) {
    for (const axis of RATING_AXES) {
      const values = scored.map(item => item.ratings[side][axis.id]).filter(finite);
      out[side][axis.id] = round6(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
  }
  return out;
}

function countBreakdown(cases) {
  const breakdown = {win: 0, tie: 0, 'no-clear-win': 0, regression: 0, pending: 0};
  for (const item of cases) {
    if (breakdown[item.verdict] === undefined) breakdown.pending += 1;
    else breakdown[item.verdict] += 1;
  }
  breakdown.total = cases.length;
  return breakdown;
}

/**
 * Build the verdict document from one or more ratings documents.
 * Accepts [{doc, source}] entries or bare documents.
 */
export function buildVerdict(documents, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const raw = Array.isArray(documents) ? documents : [documents];
  const entries = raw.filter(Boolean).map(entry => (entry && entry.doc ? entry : {doc: entry, source: null}));
  const caseOrder = [];
  const buckets = new Map();
  const sources = [];
  for (const {doc, source} of entries) {
    if (source) sources.push(source);
    const docListener = typeof doc?.listener === 'string' ? doc.listener.trim() : '';
    const docSeed = typeof doc?.seed === 'string' ? doc.seed : null;
    for (const record of Array.isArray(doc?.cases) ? doc.cases : []) {
      if (!record || typeof record.caseId !== 'string' || !record.caseId.trim()) continue;
      let bucket = buckets.get(record.caseId);
      if (!bucket) {
        bucket = {
          caseId: record.caseId,
          genre: typeof record.genre === 'string' ? record.genre : '',
          part: typeof record.part === 'string' ? record.part : 'lead',
          seed: docSeed,
          metrics: null,
          submissions: [],
        };
        buckets.set(record.caseId, bucket);
        caseOrder.push(record.caseId);
      }
      if (!bucket.metrics && record.metrics && typeof record.metrics === 'object') bucket.metrics = record.metrics;
      const recordSeed = typeof record.seed === 'string' ? record.seed : null;
      if (!bucket.seed && (recordSeed ?? docSeed)) bucket.seed = recordSeed ?? docSeed;
      const listener = typeof record.listener === 'string' && record.listener.trim() ? record.listener.trim() : docListener;
      bucket.submissions.push({
        caseId: record.caseId,
        listener,
        axisRatings: record.axisRatings,
        notes: typeof record.notes === 'string' ? record.notes : '',
        source,
      });
    }
  }

  const cases = caseOrder.map(caseId => {
    const bucket = buckets.get(caseId);
    const scored = bucket.submissions.find(submission => isCaseComplete(submission)) ?? null;
    const scoredBy = scored && scored.listener ? scored.listener : null;
    const submitted = bucket.submissions
      .map(submission => submission.axisRatings)
      .filter(axisRatings => axisRatings && typeof axisRatings === 'object');
    // Most complete submission first, so a pending reason names the axes that
    // are really missing instead of restating the whole requirement.
    submitted.sort((left, right) => caseIssues({caseId, axisRatings: right}).length - caseIssues({caseId, axisRatings: left}).length);
    const result = scored
      ? decideVerdict(scored.axisRatings.A, scored.axisRatings.B)
      : {
          verdict: 'pending',
          deltas: null,
          improvements: 0,
          losses: 0,
          worstRegression: 0,
          reasons: ['no complete ' + RATING_MIN + '-' + RATING_MAX + ' rating on all four axes from a named listener.'],
        };
    return {
      caseId,
      genre: bucket.genre,
      part: bucket.part,
      seed: bucket.seed,
      sideLabels: {...SIDE_LABELS},
      metrics: metricsBySide(bucket.metrics),
      metricDeltas: metricDeltas(bucket.metrics),
      ratings: scored ? {A: {...scored.axisRatings.A}, B: {...scored.axisRatings.B}} : null,
      partialRatings: submitted.length ? submitted[0] : null,
      ratedBy: [...new Set(bucket.submissions.map(submission => submission.listener).filter(Boolean))],
      scoredBy,
      signedOff: Boolean(scoredBy),
      notes: bucket.submissions.filter(submission => submission.notes).map(submission => ({listener: submission.listener, notes: submission.notes})),
      verdict: result.verdict,
      deltas: result.deltas,
      improvements: result.improvements,
      losses: result.losses,
      worstRegression: result.worstRegression,
      reasons: result.reasons,
    };
  });

  const genres = [...new Set(cases.map(item => item.genre))].sort().map(genre => {
    const list = cases.filter(item => item.genre === genre);
    return {
      genre,
      caseIds: list.map(item => item.caseId),
      verdict: aggregateVerdict(list.map(item => item.verdict)),
      countBreakdown: countBreakdown(list),
      ratings: meanRatings(list),
      metrics: {A: meanMetrics(list.map(item => sideMetrics(item.metrics, 'A'))), B: meanMetrics(list.map(item => sideMetrics(item.metrics, 'B')))},
    };
  });

  const pendingReasons = [];
  if (!cases.length) pendingReasons.push('the ratings document contains no cases.');
  for (const item of cases) {
    if (item.signedOff) continue;
    if (item.ratings) pendingReasons.push(item.caseId + ': complete rating has no listener name.');
    else if (!item.partialRatings) pendingReasons.push(item.caseId + ': no ratings submitted by any listener.');
    else pendingReasons.push(item.caseId + ': ' + caseIssues({caseId: item.caseId, axisRatings: item.partialRatings}).join('; '));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'melody-arc-verdict',
    generatedAt,
    sources,
    evaluationSeed: options.seed ?? cases.map(item => item.seed).find(seed => typeof seed === 'string') ?? null,
    ratingScale: RATING_SCALE,
    sideLabels: {...SIDE_LABELS},
    decisionRule: DECISION_RULE_TEXT,
    metricDefinitions: METRIC_DEFINITIONS,
    metricLimits: METRIC_LIMITS,
    signOff: cases.length && cases.every(item => item.signedOff) ? 'complete' : 'pending',
    signOffRequirement: SIGN_OFF_REQUIREMENT,
    pendingReasons,
    cases,
    genres,
    overall: {
      verdict: aggregateVerdict(cases.map(item => item.verdict)),
      countBreakdown: countBreakdown(cases),
      ratings: meanRatings(cases),
      metrics: {A: meanMetrics(cases.map(item => sideMetrics(item.metrics, 'A'))), B: meanMetrics(cases.map(item => sideMetrics(item.metrics, 'B')))},
    },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function formatSummary(verdict) {
  const lines = [];
  lines.push('Melody arc A/B verdict (schema v' + verdict.schemaVersion + ')');
  lines.push('  sign-off: ' + verdict.signOff.toUpperCase());
  for (const item of verdict.cases) {
    lines.push('  ' + item.genre + '/' + item.caseId + ': ' + item.verdict.toUpperCase() +
      (item.ratings ? ' (rated by ' + (item.scoredBy ?? 'unnamed') + ')' : ' (unrated)'));
  }
  const genreText = verdict.genres.map(item => item.genre + '=' + item.verdict).join(', ');
  if (genreText) lines.push('  genres: ' + genreText);
  lines.push('  overall: ' + verdict.overall.verdict);
  if (verdict.pendingReasons.length) lines.push('  pending: ' + verdict.pendingReasons.join(' | '));
  return lines.join('\n');
}

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: node scripts/melody-arc-report.mjs [ratings.json ...] [--out=<verdict.json>] [--print]');
    console.log('Reads exported melody-arc-ratings.json files (default ' + DEFAULT_RATINGS_PATH + '),');
    console.log('writes ' + DEFAULT_VERDICT_PATH + ', and prints a per-case summary. Multiple');
    console.log('files are merged by caseId so several listeners can sign off the same cases.');
    return;
  }
  const outArg = argv.find(value => value.startsWith('--out='));
  const files = argv.filter(value => !value.startsWith('-'));
  if (!files.length) files.push(DEFAULT_RATINGS_PATH);
  const documents = [];
  for (const file of files) {
    const absolute = resolve(file);
    let doc;
    try {
      doc = JSON.parse(await readFile(absolute, 'utf8'));
    } catch (error) {
      throw new Error('Could not read ratings JSON ' + absolute + ': ' + error.message);
    }
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.cases)) {
      throw new Error(absolute + ' is not a melody-arc ratings document (expected a "cases" array).');
    }
    if (doc.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(absolute + ' has schemaVersion ' + JSON.stringify(doc.schemaVersion) + '; this report expects ' + SCHEMA_VERSION + '.');
    }
    documents.push({doc, source: file});
  }
  const verdict = buildVerdict(documents);
  const outPath = resolve(outArg ? outArg.slice('--out='.length) : DEFAULT_VERDICT_PATH);
  await mkdir(dirname(outPath), {recursive: true});
  await writeFile(outPath, JSON.stringify(verdict, null, 2) + '\n');
  console.log(formatSummary(verdict));
  console.log('  wrote: ' + outPath);
  if (argv.includes('--print')) console.log(JSON.stringify(verdict, null, 2));
}

const invokedDirectly = process.argv[1] ? resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase() : false;
if (invokedDirectly) {
  main(process.argv.slice(2)).catch(error => {
    console.error('melody-arc-report: ' + error.message);
    process.exitCode = 1;
  });
}
