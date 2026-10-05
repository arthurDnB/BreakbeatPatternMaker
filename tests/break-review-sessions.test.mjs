import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import {
  CHECKLIST_ITEMS, DEFAULT_CHECKLIST, SESSION_MODES, baselineSession, blankChecklist, checklistRequired,
  classifyRegionLength, deriveChecklist, findPassage, fixedStartOnsets, groupByMode, groupByRegionLength,
  isChecklistComplete, loadAnnotationTables, newChecklist, parsePcmWavDuration, passthroughOnsets,
  requiredChecklistIds, resolveSessionsManifest, reviewIdentityHash, validateSessionsManifest,
} from '../scripts/break-review-sessions.mjs';
import { compareReviews } from '../scripts/break-review-agreement.mjs';
import { interiorOnsets, scoreOnsets } from '../scripts/real-break-metrics.mjs';
import {
  REGISTRATION_FIELDS, REGISTRATION_STEPS, registrationReport, registrationStub, requiredSupplyFor,
  validateSourcePaths,
} from '../scripts/break-review-registration.mjs';
import { startBreakReviewServer } from '../scripts/break-review-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sessionsManifest = JSON.parse(await readFile(new URL('../benchmarks/break-review-sessions.json', import.meta.url)));
const verified = JSON.parse(await readFile(new URL('../benchmarks/verified-real-breaks.json', import.meta.url)));

const baseManifest = () => ({
  version: 1,
  kind: 'break-review-sessions',
  description: 'focused test sessions',
  sessions: [{
    id: 's1',
    label: 'Session one',
    mode: 'fixed',
    description: 'two second excerpt',
    checklist: [...DEFAULT_CHECKLIST],
    passages: [{
      id: 'p1',
      recordingId: 'r1',
      family: 'amen',
      sha256: 'a'.repeat(64),
      startSeconds: 0,
      endSeconds: 2,
      bars: 1,
      referenceState: 'verified',
      reference: 'benchmarks/verified-real-breaks.json',
    }],
  }],
});

const codesFor = manifest => validateSessionsManifest(manifest).issues.map(issue => issue.code);

test('manifest validation names every failure mode', () => {
  assert.equal(validateSessionsManifest(baseManifest()).ok, true);
  assert.deepEqual(codesFor(baseManifest()), []);

  const invalidVersion = baseManifest();
  invalidVersion.version = 2;

  const wrongKind = baseManifest();
  wrongKind.kind = 'something-else';

  const noSessions = baseManifest();
  delete noSessions.sessions;

  const noSessionId = baseManifest();
  noSessionId.sessions[0].id = '';

  const duplicateSession = baseManifest();
  duplicateSession.sessions.push({ ...baseManifest().sessions[0] });

  const noLabel = baseManifest();
  noLabel.sessions[0].label = '';

  const badMode = baseManifest();
  badMode.sessions[0].mode = 'endless';

  const noPassages = baseManifest();
  noPassages.sessions[0].passages = [];

  const unknownChecklist = baseManifest();
  unknownChecklist.sessions[0].checklist = ['listenedFull', 'notAThing'];

  const noPassageId = baseManifest();
  noPassageId.sessions[0].passages[0].id = '';

  const duplicatePassage = baseManifest();
  duplicatePassage.sessions[0].passages.push({ ...baseManifest().sessions[0].passages[0] });

  const noRecordingId = baseManifest();
  noRecordingId.sessions[0].passages[0].recordingId = '';

  const noFamily = baseManifest();
  noFamily.sessions[0].passages[0].family = '';

  const badSha = baseManifest();
  badSha.sessions[0].passages[0].sha256 = 'not-a-hash';

  const badStart = baseManifest();
  badStart.sessions[0].passages[0].startSeconds = -1;

  const inverted = baseManifest();
  inverted.sessions[0].passages[0].startSeconds = 3;
  inverted.sessions[0].passages[0].endSeconds = 2;

  const badEnd = baseManifest();
  badEnd.sessions[0].passages[0].endSeconds = 'soon';

  const badBars = baseManifest();
  badBars.sessions[0].passages[0].bars = 0;

  const badReferenceState = baseManifest();
  badReferenceState.sessions[0].passages[0].referenceState = 'trusted';

  const noReference = baseManifest();
  noReference.sessions[0].passages[0].reference = '';

  const modeMismatch = baseManifest();
  modeMismatch.sessions[0].passages[0].mode = 'loop';

  const badLoopLength = baseManifest();
  badLoopLength.sessions[0].mode = 'loop';
  badLoopLength.sessions[0].passages[0].endSeconds = 2.5;
  badLoopLength.sessions[0].passages[0].loopSeconds = 0;

  const unexpectedLoopLength = baseManifest();
  unexpectedLoopLength.sessions[0].passages[0].loopSeconds = 2;

  const duplicateRecording = baseManifest();
  duplicateRecording.sessions[0].passages.push({ ...baseManifest().sessions[0].passages[0], id: 'p2' });

  const mixedFamily = baseManifest();
  mixedFamily.sessions.push({
    ...baseManifest().sessions[0],
    id: 's2',
    label: 'Session two',
    passages: [{ ...baseManifest().sessions[0].passages[0], id: 'p3', family: 'think' }],
  });

  const beyondLoop = baseManifest();
  beyondLoop.sessions[0].passages[0].endSeconds = 30;

  const loopMismatch = baseManifest();
  loopMismatch.sessions[0].mode = 'loop';
  loopMismatch.sessions[0].passages[0].startSeconds = 0;
  loopMismatch.sessions[0].passages[0].endSeconds = 2.5;
  loopMismatch.sessions[0].passages[0].loopSeconds = 1.5;

  const durations = new Map([['r1', 4]]);
  const expected = [
    [validateSessionsManifest(null), 'malformed-manifest'],
    [validateSessionsManifest('nope'), 'malformed-manifest'],
    [validateSessionsManifest(invalidVersion), 'unsupported-version'],
    [validateSessionsManifest(wrongKind), 'wrong-kind'],
    [validateSessionsManifest(noSessions), 'missing-sessions'],
    [validateSessionsManifest(noSessionId), 'missing-session-id'],
    [validateSessionsManifest(duplicateSession), 'duplicate-session-id'],
    [validateSessionsManifest(noLabel), 'missing-label'],
    [validateSessionsManifest(badMode), 'invalid-mode'],
    [validateSessionsManifest(noPassages), 'missing-passages'],
    [validateSessionsManifest(unknownChecklist), 'unknown-checklist-item'],
    [validateSessionsManifest(noPassageId), 'missing-id'],
    [validateSessionsManifest(duplicatePassage), 'duplicate-passage-id'],
    [validateSessionsManifest(noRecordingId), 'missing-recording-id'],
    [validateSessionsManifest(noFamily), 'missing-family'],
    [validateSessionsManifest(badSha), 'invalid-sha256'],
    [validateSessionsManifest(badStart), 'invalid-start'],
    [validateSessionsManifest(inverted), 'start-not-before-end'],
    [validateSessionsManifest(badEnd), 'invalid-end'],
    [validateSessionsManifest(badBars), 'invalid-bars'],
    [validateSessionsManifest(badReferenceState), 'invalid-reference-state'],
    [validateSessionsManifest(noReference), 'missing-reference'],
    [validateSessionsManifest(modeMismatch), 'mode-mismatch'],
    [validateSessionsManifest(badLoopLength), 'invalid-loop-length'],
    [validateSessionsManifest(unexpectedLoopLength), 'unexpected-loop-length'],
    [validateSessionsManifest(duplicateRecording), 'duplicate-recording'],
    [validateSessionsManifest(mixedFamily), 'inconsistent-recording-family'],
    [validateSessionsManifest(beyondLoop, { sourceDurations: durations }), 'end-beyond-loop'],
    [validateSessionsManifest(loopMismatch, { sourceDurations: durations }), 'loop-length-mismatch'],
  ];
  for (const [report, code] of expected) {
    assert.ok(report.issues.some(issue => issue.code === code), `expected code ${code}, saw ${report.issues.map(issue => issue.code).join(', ') || '(none)'}`);
    assert.equal(report.ok, false, `${code} must fail validation`);
  }

  const pending = baseManifest();
  pending.sessions[0].passages[0].referenceState = 'pending';
  const warning = validateSessionsManifest(pending);
  assert.equal(warning.ok, true);
  assert.ok(warning.issues.some(issue => issue.code === 'pending-annotation' && issue.severity === 'warning'));
  assert.ok(SESSION_MODES.includes('loop'));
});

test('the committed manifest keeps the eight original two-second passages in place', () => {
  const report = validateSessionsManifest(sessionsManifest);
  assert.equal(report.ok, true, report.issues.map(issue => issue.message).join(' '));
  assert.deepEqual(report.summary.sessions.map(session => [session.id, session.mode, session.passages]), [
    ['baseline', 'fixed', 8],
    ['long-excerpts', 'long', 7],
    ['full-loops', 'loop', 4],
  ]);
  const baseline = baselineSession(sessionsManifest.sessions);
  assert.equal(baseline.id, 'baseline');
  for (const item of verified.cases) {
    const passage = baseline.passages.find(candidate => candidate.recordingId === item.id);
    assert.ok(passage, `baseline keeps ${item.id}`);
    assert.deepEqual([passage.startSeconds, passage.endSeconds], item.regionSeconds);
  }
  assert.deepEqual(baseline.passages.map(passage => passage.id), verified.cases.map(item => item.id));
  assert.equal(report.summary.recordings, 8);
  assert.equal(report.summary.passages, 19);
});

test('session resolution selects a passage, subsets labels to the region and selects a session', async () => {
  const tables = await loadAnnotationTables(sessionsManifest, { root });
  const { sessions, cases } = resolveSessionsManifest(sessionsManifest, { root, annotations: tables });
  assert.equal(sessions.length, 3);
  assert.equal(cases.length, 19);
  const baseline = cases.filter(item => item.sessionId === 'baseline');
  assert.deepEqual(baseline.map(item => item.onsetsSeconds.length), [12, 10, 13, 15, 14, 13, 12, 12]);
  assert.equal(baseline.reduce((sum, item) => sum + item.onsetsSeconds.length, 0), 101);
  assert.deepEqual(baseline[0].regionSeconds, [0, 2]);
  const long = cases.filter(item => item.sessionId === 'long-excerpts');
  assert.ok(long.length > 0);
  assert.ok(long.every(item => item.onsetsSeconds.every(time => time > item.regionSeconds[0] && time < item.regionSeconds[1])));
  assert.ok(long.every(item => item.regionLengthSeconds > 3.5));
  const loop = cases.filter(item => item.sessionId === 'full-loops');
  assert.ok(loop.every(item => item.mode === 'loop' && item.loopSeconds > 0));
  const found = findPassage(sessions, { sessionId: 'long-excerpts', passageId: long[0].passageId });
  assert.equal(found.passage.id, long[0].passageId);
  assert.equal(found.session.id, 'long-excerpts');
  assert.throws(() => findPassage(sessions, { sessionId: 'nope', passageId: 'nope' }), /Unknown review session|Unknown passage/);
  const identity = reviewIdentityHash(cases);
  assert.equal(identity, reviewIdentityHash([...cases].reverse()));
  assert.match(identity, /^[a-f0-9]{64}$/);
});

test('checklist helpers gate long and loop passages only', () => {
  assert.deepEqual(DEFAULT_CHECKLIST, ['listenedFull', 'firstHitChecked', 'lastHitChecked']);
  assert.equal(CHECKLIST_ITEMS.length, 3);
  assert.equal(checklistRequired('long'), true);
  assert.equal(checklistRequired('loop'), true);
  assert.equal(checklistRequired('fixed'), false);
  const session = { checklist: [...DEFAULT_CHECKLIST] };
  assert.deepEqual(requiredChecklistIds(session), DEFAULT_CHECKLIST);
  assert.deepEqual(requiredChecklistIds(null), DEFAULT_CHECKLIST);
  assert.deepEqual(blankChecklist(session), { listenedFull: false, firstHitChecked: false, lastHitChecked: false });
  assert.deepEqual(Object.keys(newChecklist()).sort(), [...DEFAULT_CHECKLIST].sort());
  assert.equal(isChecklistComplete(session, blankChecklist(session)), false);
  assert.equal(isChecklistComplete(session, newChecklist()), false);
  const complete = { listenedFull: true, firstHitChecked: true, lastHitChecked: true };
  assert.equal(isChecklistComplete(session, complete), true);
  assert.deepEqual(deriveChecklist(blankChecklist(session), { firstHitChecked: true }), { listenedFull: false, firstHitChecked: true, lastHitChecked: false });
  assert.deepEqual(deriveChecklist(complete, {}), complete);
  assert.deepEqual(requiredChecklistIds({ checklist: ['lastHitChecked'] }), ['lastHitChecked']);
});

test('region length is classified without a two-second assumption', () => {
  assert.equal(classifyRegionLength(2), 'two-second');
  assert.equal(classifyRegionLength(6), 'long');
  assert.equal(classifyRegionLength(0.5), 'short');
  const rows = [{ id: 'a', regionLengthSeconds: 2 }, { id: 'b', regionLengthSeconds: 6 }, { id: 'c', regionLengthSeconds: 5 }];
  const byLength = groupByRegionLength(rows);
  assert.equal(byLength.get('long').length, 2);
  assert.equal(byLength.get('two-second').length, 1);
  assert.equal(groupByRegionLength([{ id: 'd', regionLengthSeconds: 2.5 }], { atLeast: 2 }).get('long').length, 1);
  const byMode = groupByMode([{ id: 'a', mode: 'fixed' }, { id: 'b' }, { id: 'c', mode: 'loop' }]);
  assert.equal(byMode.get('fixed').length, 2);
  assert.equal(byMode.get('loop').length, 1);
});

test('the fixed-start rule is preserved for regions longer than two seconds', () => {
  const reference = [0, 0.0009, 0.002, 1.1, 3.2, 5.5];
  assert.deepEqual(fixedStartOnsets(reference, 0), [0, 0.0009]);
  assert.deepEqual(passthroughOnsets(reference, 0), [0.002, 1.1, 3.2, 5.5]);
  assert.deepEqual(fixedStartOnsets(reference, 3.2).filter(time => time >= 3.2), [3.2]);
  assert.deepEqual(passthroughOnsets(reference, 3.2), [5.5]);
  assert.equal(fixedStartOnsets(reference, 0).length + passthroughOnsets(reference, 0).length, reference.length);
  const longRegion = interiorOnsets(reference, 0);
  assert.deepEqual(longRegion, [0.002, 1.1, 3.2, 5.5]);
  assert.equal(longRegion.length + fixedStartOnsets(reference, 0).length, reference.length);
  assert.deepEqual(interiorOnsets(reference, 3.2), [5.5]);
  const scored = scoreOnsets([0.003, 1.1, 3.21, 5.5, 9], passthroughOnsets(reference, 0), 20);
  assert.equal(scored.tp, 4);
  assert.equal(scored.falsePositive, 1);
});

test('agreement summaries group by region length and mode at a longer region', () => {
  const sha = 'b'.repeat(64);
  const reviewOf = (reviewer, onsets) => ({
    version: 1,
    reviewComplete: true,
    reviewer,
    cases: [{
      id: 'long-1', passageId: 'long-1', family: 'amen', filename: 'long.wav', sha256: sha,
      regionSeconds: [0, 6], onsetsSeconds: onsets,
    }],
  });
  const meta = new Map([['long-1', {
    sessionId: 'long-excerpts', passageId: 'long-1', mode: 'long', bars: 4,
    regionLengthSeconds: 6, regionLengthClass: 'long',
  }]]);
  const report = compareReviews(reviewOf('primary-listener', [0.5, 3.25, 5.5]), reviewOf('independent-blind-listener', [0.508, 3.25, 5.5]), undefined, { sessions: meta });
  assert.equal(report.reportType, 'inter-reviewer-onset-agreement');
  assert.equal(report.files.length, 1);
  assert.equal(report.summary[10].familyMacroF1, 1);
  assert.equal(report.summary[10].passages, 1);
  assert.equal(report.files[0].regionLengthSeconds, 6);
  assert.equal(report.files[0].regionLengthClass, 'long');
  assert.equal(report.files[0].mode, 'long');
  assert.equal(report.files[0].sessionId, 'long-excerpts');
  assert.equal(report.files[0].bars, 4);
  assert.equal(report.files[0].tolerances[5].matched, 2);
  assert.equal(report.regionLengthSummary.long.passages, 1);
  assert.equal(report.regionLengthSummary.long.summary[20].f1, 1);
  assert.equal(report.modeSummary.long.passages, 1);
  assert.equal(report.modeSummary.long.summary[20].f1, 1);
  const plain = compareReviews(reviewOf('primary-listener', [0.5]), reviewOf('independent-blind-listener', [0.5]));
  assert.equal(plain.regionLengthSummary.long.passages, 1);
  assert.equal(plain.modeSummary.fixed.passages, 1);
  assert.equal(plain.files[0].mode, 'fixed');
  const mismatched = reviewOf('independent-blind-listener', [0.5]);
  mismatched.cases[0].sha256 = '0'.repeat(64);
  assert.throws(() => compareReviews(reviewOf('primary-listener', [0.5]), mismatched), /source mismatch/);
  assert.throws(() => compareReviews(reviewOf('primary-listener', [0.5]), { reviewComplete: true, cases: [] }), /same passages/);
});

test('registration validation covers path-map and manifest failure modes', () => {
  assert.equal(validateSourcePaths('nope').issues[0].code, 'path-map-not-array');
  const pathMap = [
    { id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' },
    { id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' },
    { id: '', family: 'amen', path: 'C:/breaks/x.wav' },
    { id: 'r2', family: '', path: 'C:/breaks/r2.wav' },
    { id: 'r3', family: 'amen', path: '' },
  ];
  const issues = validateSourcePaths(pathMap).issues.map(issue => issue.code);
  for (const code of ['duplicate-source-id', 'missing-source-id', 'missing-source-family', 'missing-source-path']) {
    assert.ok(issues.includes(code), `expected ${code}, saw ${issues.join(', ')}`);
  }
  assert.equal(validateSourcePaths([{ id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' }]).ok, true);

  const manifest = baseManifest();
  const clean = registrationReport({ manifest, pathMap: [{ id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' }] });
  assert.equal(clean.ok, true);
  assert.equal(clean.passages.length, 1);
  assert.deepEqual(clean.passages[0].problems, []);

  const unregistered = registrationReport({ manifest, pathMap: [] });
  assert.equal(unregistered.ok, false);
  assert.ok(unregistered.passages[0].problems.some(problem => problem.field === 'path'));
  assert.ok(unregistered.issues.some(issue => issue.code === 'unregistered-recording'));

  const wrongFamily = registrationReport({ manifest, pathMap: [{ id: 'r1', family: 'think', path: 'C:/breaks/r1.wav' }] });
  assert.ok(wrongFamily.issues.some(issue => issue.code === 'source-family-mismatch'));

  const badHash = baseManifest();
  badHash.sessions[0].passages[0].sha256 = 'nope';
  const hashReport = registrationReport({ manifest: badHash, pathMap: [{ id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' }] });
  assert.equal(hashReport.ok, false);
  assert.ok(hashReport.passages[0].problems.some(problem => problem.field === 'sha256'));
  assert.ok(hashReport.passages[0].supply.find(field => field.field === 'sha256').how.includes('--hash'));

  const beyond = registrationReport({ manifest, pathMap: [{ id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' }], sourceDurations: new Map([['r1', 1]]) });
  assert.ok(beyond.issues.some(issue => issue.code === 'end-beyond-loop'));
});

test('registration helpers print exactly what the owner must supply', () => {
  assert.deepEqual(REGISTRATION_FIELDS.map(field => field.field), ['path', 'sha256', 'family', 'loopSeconds', 'bars']);
  assert.ok(REGISTRATION_STEPS.length >= 5);
  assert.ok(REGISTRATION_STEPS.every(step => typeof step === 'string' && step.length > 0));
  const passage = { id: 'p1', recordingId: 'r1', family: 'amen', sha256: 'a'.repeat(64), startSeconds: 0, endSeconds: 4, bars: 4 };
  const supply = requiredSupplyFor(passage, { entry: { id: 'r1', family: 'amen', path: 'C:/breaks/r1.wav' } });
  assert.deepEqual(supply.map(field => field.field), ['path', 'sha256', 'family', 'loopSeconds', 'bars']);
  assert.equal(supply.find(field => field.field === 'path').value, 'C:/breaks/r1.wav');
  assert.equal(supply.find(field => field.field === 'loopSeconds').value, 4);
  assert.ok(supply.every(field => typeof field.how === 'string' && field.how.length > 0));
  assert.ok(supply.filter(field => field.value !== undefined && field.value !== '<absolute path to the WAV on this machine>').every(field => field.supplied === true));
  const stub = registrationStub('new-break', { family: 'dub' });
  assert.equal(stub.sourcePathEntry.id, 'new-break');
  assert.equal(stub.sourcePathEntry.family, 'dub');
  assert.equal(stub.passage.recordingId, 'new-break');
  assert.equal(stub.passage.family, 'dub');
  assert.equal(stub.passage.referenceState, 'pending');
  assert.equal(registrationStub('x').sourcePathEntry.family, 'new-family');
});

test('parsePcmWavDuration measures a synthetic loop', () => {
  const frames = Math.round(2.5 * 22050);
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF', 0, 'latin1');
  bytes.writeUInt32LE(36 + frames * 2, 4);
  bytes.write('WAVE', 8, 'latin1');
  bytes.write('fmt ', 12, 'latin1');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(22050, 24);
  bytes.writeUInt32LE(44100, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'latin1');
  bytes.writeUInt32LE(frames * 2, 40);
  assert.equal(parsePcmWavDuration(bytes), 2.5);
  assert.equal(parsePcmWavDuration(Buffer.alloc(10)), null);
  assert.equal(parsePcmWavDuration(Buffer.from('not a wav file at all, padding padding padding')), null);
});

const synthWav = (seconds = 2.5, rate = 22050) => {
  const frames = Math.round(seconds * rate);
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF', 0, 'latin1');
  bytes.writeUInt32LE(36 + frames * 2, 4);
  bytes.write('WAVE', 8, 'latin1');
  bytes.write('fmt ', 12, 'latin1');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'latin1');
  bytes.writeUInt32LE(frames * 2, 40);
  for (let frame = 0; frame < frames; frame += 1) bytes.writeInt16LE(Math.round(Math.sin(frame / 12) * 6000), 44 + frame * 2);
  return bytes;
};

const smokeFixtures = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'break-review-sessions-'));
  const wav = synthWav(2.5);
  const sha256 = createHash('sha256').update(wav).digest('hex');
  const wavPath = join(dir, 'smoke-break.wav');
  await writeFile(wavPath, wav);
  const labelsPath = join(dir, 'labels.json');
  await writeFile(labelsPath, JSON.stringify({
    version: 1,
    cases: [{ id: 'smoke-break', family: 'smoke', filename: 'smoke-break.wav', sha256, regionSeconds: [0, 2.5], onsetsSeconds: [0.5, 1.25, 2] }],
  }));
  const pathMap = join(dir, 'sources.json');
  await writeFile(pathMap, JSON.stringify([{ id: 'smoke-break', family: 'smoke', path: wavPath }]));
  const passage = (id, endSeconds) => ({ id, recordingId: 'smoke-break', family: 'smoke', sha256, startSeconds: 0, endSeconds, bars: 1, referenceState: 'verified', reference: labelsPath });
  const manifestPath = join(dir, 'sessions.json');
  await writeFile(manifestPath, JSON.stringify({
    version: 1,
    kind: 'break-review-sessions',
    description: 'synthetic headless smoke',
    sessions: [
      { id: 'smoke-fixed', label: 'Smoke fixed', mode: 'fixed', description: 'two second excerpt', checklist: [...DEFAULT_CHECKLIST], passages: [passage('smoke-break-short', 2)] },
      { id: 'smoke-long', label: 'Smoke long', mode: 'long', description: 'longer excerpt', checklist: [...DEFAULT_CHECKLIST], passages: [passage('smoke-break-long', 2.5)] },
    ],
  }));
  return { dir, wavPath, pathMap, manifestPath, draftFile: join(dir, 'draft.json'), exportFile: join(dir, 'export.json') };
};

const portIsClosed = port => new Promise(done => {
  const socket = connect({ host: '127.0.0.1', port });
  socket.once('connect', () => { socket.destroy(); done(false); });
  socket.once('error', () => done(true));
  socket.setTimeout(2000, () => { socket.destroy(); done(false); });
});

test('review server serves loop and checklist controls and gates long passages', async () => {
  const fixtures = await smokeFixtures();
  let started;
  try {
    for (const port of [4179, 4178, 4177]) {
      try {
        started = await startBreakReviewServer({ port, pathMap: fixtures.pathMap, draftFile: fixtures.draftFile, exportFile: fixtures.exportFile, sessionsFile: fixtures.manifestPath });
        break;
      } catch (error) {
        if (error?.code !== 'EADDRINUSE') throw error;
      }
    }
    assert.ok(started, 'an explicit test port must be available');
    const port = Number(new URL(started.url).port);
    assert.ok([4179, 4178, 4177].includes(port));
    assert.equal(started.sessions.length, 2);
    assert.equal(new URL(started.url).hostname, '127.0.0.1');

    const page = await fetch(started.url);
    assert.equal(page.status, 200);
    const html = await page.text();
    for (const id of ['session-select', 'loop-toggle', 'play-position', 'checklist', 'finish-clip', 'accept-rest', 'export', 'play-full']) {
      assert.ok(html.includes(`id="${id}"`), `index.html exposes #${id}`);
    }
    const script = await fetch(`${started.url}app.js`);
    assert.equal(script.status, 200);
    const app = await script.text();
    assert.ok(app.includes('Looping'));
    assert.ok(app.includes('checklistNeeded'));

    const state = await (await fetch(`${started.url}api/state`)).json();
    assert.equal(state.mode, 'review');
    assert.equal(state.sessionId, 'smoke-fixed');
    assert.equal(state.cases.length, 2);
    assert.equal(state.review.cases.length, 1);
    assert.deepEqual(state.checklist, DEFAULT_CHECKLIST);
    assert.deepEqual(state.sessions.map(session => [session.id, session.mode, session.passages, session.reviewed]), [
      ['smoke-fixed', 'fixed', 1, false],
      ['smoke-long', 'long', 1, false],
    ]);
    assert.ok(state.cases.every(item => item.onsetsSeconds === undefined), 'catalogue never leaks reference onsets');

    const switched = await fetch(`${started.url}api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: 'smoke-long' }) });
    assert.equal(switched.status, 200);
    const { review } = await switched.json();
    assert.equal(review.sessionId, 'smoke-long');
    assert.equal(review.cases.length, 1);
    assert.equal(review.cases[0].mode, 'long');

    const blocked = structuredClone(review);
    blocked.cases[0].reviewed = true;
    blocked.cases[0].listenedFull = true;
    blocked.cases[0].markers = [{ id: 'm1', time: 0.5, status: 'accepted' }];
    const blockedResponse = await fetch(`${started.url}api/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(blocked) });
    assert.equal(blockedResponse.status, 400);
    assert.match((await blockedResponse.json()).error, /Finish the checklist in smoke-break-long/);

    const accepted = structuredClone(review);
    accepted.cases[0].reviewed = true;
    accepted.cases[0].listenedFull = true;
    accepted.cases[0].checklist = { listenedFull: true, firstHitChecked: true, lastHitChecked: true };
    accepted.cases[0].markers = [{ id: 'm1', time: 0.5, status: 'accepted' }];
    const acceptedResponse = await fetch(`${started.url}api/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(accepted) });
    assert.equal(acceptedResponse.status, 200);
    assert.equal((await acceptedResponse.json()).saved, true);
    const saved = JSON.parse(await readFile(join(fixtures.dir, 'smoke-long-review-draft.json'), 'utf8'));
    assert.equal(saved.cases[0].reviewed, true);
    assert.deepEqual(saved.cases[0].checklist, { listenedFull: true, firstHitChecked: true, lastHitChecked: true });

    const unknown = await fetch(`${started.url}api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: 'nope' }) });
    assert.equal(unknown.status, 400);
    assert.match((await unknown.json()).error, /Unknown review session 'nope'/);

    const audio = await fetch(`${started.url}api/audio/smoke-break`);
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get('content-type'), 'audio/wav');
    assert.equal((await audio.arrayBuffer()).byteLength, 44 + Math.round(2.5 * 22050) * 2);

    // A passage id has to resolve to the recording it extends, otherwise the browser cannot load audio for any
    // long or full-loop passage.
    const aliased = await fetch(`${started.url}api/audio/smoke-break-long`);
    assert.equal(aliased.status, 200);
    assert.equal(aliased.headers.get('content-type'), 'audio/wav');
    assert.equal((await aliased.arrayBuffer()).byteLength, 44 + Math.round(2.5 * 22050) * 2);

    const foreignHost = await new Promise(resolveRequest => {
      const request = httpRequest({ host: '127.0.0.1', port, path: '/', headers: { host: 'evil.example' } }, response => {
        response.resume();
        response.once('end', () => resolveRequest(response.statusCode));
      });
      request.end();
    });
    assert.equal(foreignHost, 403);
  } finally {
    if (started) await new Promise(done => started.server.close(done));
    if (started) {
      const port = Number(new URL(started.url).port);
      assert.equal(await portIsClosed(port), true, `port ${port} must be released`);
    }
    await rm(fixtures.dir, { recursive: true, force: true });
  }
});
