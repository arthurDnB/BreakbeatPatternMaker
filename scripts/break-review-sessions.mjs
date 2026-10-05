import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

// Session/region model for longer excerpts and full loops. The production onset detector is not involved.
export const SESSION_MODES = ['fixed', 'long', 'loop'];
export const REFERENCE_STATES = ['verified', 'provisional', 'pending'];
export const CHECKLIST_ITEMS = [
  { id: 'listenedFull', label: 'Listened to the full loop' },
  { id: 'firstHitChecked', label: 'Checked the first hit' },
  { id: 'lastHitChecked', label: 'Checked the last hit/tail' },
];
export const DEFAULT_CHECKLIST = CHECKLIST_ITEMS.map(item => item.id);
export const DEFAULT_EXPORT_NAME = 'verified-real-breaks.json';
export const LOOP_TOLERANCE_SECONDS = .05;
const SHA256 = /^[a-f0-9]{64}$/;

export function requiredChecklistIds(session) {
  return [...new Set(session?.checklist ?? DEFAULT_CHECKLIST)];
}

export function blankChecklist(session) {
  return Object.fromEntries(requiredChecklistIds(session).map(id => [id, false]));
}

export function newChecklist() {
  return Object.fromEntries(CHECKLIST_ITEMS.map(item => [item.id, false]));
}

export function isChecklistComplete(session, checklist) {
  return requiredChecklistIds(session).every(id => checklist?.[id] === true);
}

export function checklistRequired(mode) {
  return mode === 'long' || mode === 'loop';
}

export function deriveChecklist(checklist, changes = {}) {
  const next = { ...blankChecklist({ checklist: Object.keys(checklist ?? {}) }), ...checklist };
  for (const item of CHECKLIST_ITEMS) if (changes[item.id] === true) next[item.id] = true;
  return next;
}

// The tracker always creates a slice at the selected region's start. That fixed-start boundary is not an
// onset-detector decision, so it is counted and excluded; every other verified label is scored as interior.
export function fixedStartOnsets(reference, regionStartSeconds, boundaryMs = 1) {
  return reference.filter(time => time <= regionStartSeconds + boundaryMs / 1000);
}

export function passthroughOnsets(reference, regionStartSeconds, boundaryMs = 1) {
  return reference.filter(time => time > regionStartSeconds + boundaryMs / 1000);
}

export function regionLengthSeconds(caseItem) {
  if (!Array.isArray(caseItem?.regionSeconds) || caseItem.regionSeconds.length !== 2) throw Error(`Missing region bounds for ${caseItem?.id ?? 'a passage'}.`);
  const [start, end] = caseItem.regionSeconds;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Error(`Invalid region bounds for ${caseItem.id}.`);
  return end - start;
}

export function classifyRegionLength(lengthSeconds) {
  if (lengthSeconds > 3.5) return 'long';
  if (lengthSeconds < 1.5) return 'short';
  return 'two-second';
}

export function groupByRegionLength(items, { id = 'regionLengthSeconds', atLeast = 3.5 } = {}) {
  const groups = new Map();
  for (const item of items) {
    const key = item[id] > atLeast ? 'long' : classifyRegionLength(item[id]);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

export function groupByMode(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.mode ?? 'fixed';
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

// Draft compatibility hash: identity only. It deliberately ignores added fields (session, mode, bar counts,
// onsets) so a draft saved before the session model keeps validating against the same passages.
export function reviewIdentityHash(cases) {
  const identity = [...cases]
    .map(({ id, family, sha256, regionSeconds }) => ({ id, family, sha256, regionSeconds }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

// One case of a sessions manifest may not state an end time; loop mode derives it from the recording length.
export function resolvePassageRange(passage, durationSeconds) {
  const start = passage.startSeconds;
  const end = passage.endSeconds ?? durationSeconds;
  return { start, end, derivedEnd: passage.endSeconds === undefined };
}

function requirePositive(value, label, path, issues) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    issues.push({ severity: 'error', path, code: 'invalid-loop-length', message: `${label} must be a positive number of seconds.` });
    return false;
  }
  return true;
}

export function validateSessionsManifest(manifest, { sourceDurations = new Map(), expectedModes = SESSION_MODES } = {}) {
  const issues = [];
  const sessions = [];
  const check = (predicate, issue) => { if (!predicate) issues.push({ severity: 'error', ...issue }); };
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, issues: [{ severity: 'error', path: 'manifest', code: 'malformed-manifest', message: 'The sessions manifest must be a JSON object.' }], summary: { sessions: [], recordings: 0, passages: 0 } };
  }
  check(manifest.version === 1, { path: 'manifest.version', code: 'unsupported-version', message: 'The sessions manifest must declare version 1.' });
  check(manifest.kind === 'break-review-sessions', { path: 'manifest.kind', code: 'wrong-kind', message: "The sessions manifest must declare kind 'break-review-sessions'." });
  check(Array.isArray(manifest.sessions) && manifest.sessions.length > 0, { path: 'manifest.sessions', code: 'missing-sessions', message: 'The manifest needs at least one session.' });
  const sessionIds = new Set();
  const passageIds = new Set();
  const recordings = new Map();
  for (const [sessionIndex, session] of (Array.isArray(manifest.sessions) ? manifest.sessions : []).entries()) {
    const at = `manifest.sessions[${sessionIndex}]`;
    const hasSessionId = typeof session?.id === 'string' && session.id.trim();
    check(hasSessionId, { path: `${at}.id`, code: 'missing-session-id', message: 'Every session needs a non-empty id.' });
    if (hasSessionId) check(!sessionIds.has(session.id), { path: `${at}.id`, code: 'duplicate-session-id', message: `Session id '${session.id}' is already used.` });
    if (hasSessionId) sessionIds.add(session.id);
    check(typeof session?.label === 'string' && session.label.trim(), { path: `${at}.label`, code: 'missing-label', message: 'Every session needs a human-readable label.' });
    check(expectedModes.includes(session?.mode), { path: `${at}.mode`, code: 'invalid-mode', message: `Session mode must be one of ${expectedModes.join(', ')}.` });
    check(Array.isArray(session?.passages) && session.passages.length > 0, { path: `${at}.passages`, code: 'missing-passages', message: 'Every session needs at least one passage.' });
    if (Array.isArray(session?.checklist)) {
      for (const [itemIndex, item] of session.checklist.entries()) {
        check(CHECKLIST_ITEMS.some(known => known.id === item), { path: `${at}.checklist[${itemIndex}]`, code: 'unknown-checklist-item', message: `Checklist items must be ${DEFAULT_CHECKLIST.join(', ')}.` });
      }
    }
    const sessionRecordingIds = new Set();
    for (const [passageIndex, passage] of (Array.isArray(session?.passages) ? session.passages : []).entries()) {
      const path = `${at}.passages[${passageIndex}]`;
      check(typeof passage?.id === 'string' && passage.id.trim(), { path: `${path}.id`, code: 'missing-id', message: 'Every passage needs a non-empty id.' });
      check(!passageIds.has(passage?.id), { path: `${path}.id`, code: 'duplicate-passage-id', message: `Passage id '${passage?.id}' is already used.` });
      if (passage?.id) passageIds.add(passage.id);
      check(typeof passage?.recordingId === 'string' && passage.recordingId.trim(), { path: `${path}.recordingId`, code: 'missing-recording-id', message: 'Every passage needs a recordingId.' });
      check(!sessionRecordingIds.has(passage?.recordingId), { path: `${path}.recordingId`, code: 'duplicate-recording', message: `Recording '${passage?.recordingId}' is used twice in this session.` });
      if (passage?.recordingId) sessionRecordingIds.add(passage.recordingId);
      check(typeof passage?.family === 'string' && passage.family.trim(), { path: `${path}.family`, code: 'missing-family', message: 'Every passage needs a non-empty family id.' });
      const hasSha = typeof passage?.sha256 === 'string' && SHA256.test(passage.sha256 ?? '');
      check(hasSha, { path: `${path}.sha256`, code: 'invalid-sha256', message: 'sha256 must be 64 lowercase hexadecimal characters.' });
      check(typeof passage?.startSeconds === 'number' && Number.isFinite(passage.startSeconds) && passage.startSeconds >= 0, { path: `${path}.startSeconds`, code: 'invalid-start', message: 'startSeconds must be a finite number of seconds, zero or greater.' });
      if (passage?.endSeconds !== undefined) {
        check(typeof passage.endSeconds === 'number' && Number.isFinite(passage.endSeconds), { path: `${path}.endSeconds`, code: 'invalid-end', message: 'endSeconds must be a finite number of seconds.' });
        check(!(Number.isFinite(passage.startSeconds) && Number.isFinite(passage.endSeconds)) || passage.startSeconds < passage.endSeconds, { path: `${path}.endSeconds`, code: 'start-not-before-end', message: 'startSeconds must be less than endSeconds.' });
      }
      check(typeof passage?.bars === 'number' && Number.isFinite(passage.bars) && passage.bars > 0, { path: `${path}.bars`, code: 'invalid-bars', message: 'bars must be a positive number (may be fractional).' });
      check(REFERENCE_STATES.includes(passage?.referenceState), { path: `${path}.referenceState`, code: 'invalid-reference-state', message: `referenceState must be one of ${REFERENCE_STATES.join(', ')}.` });
      check(typeof passage?.reference === 'string' && passage.reference.trim(), { path: `${path}.reference`, code: 'missing-reference', message: 'Every passage needs a reference file for its reviewed onset labels.' });
      if (passage?.mode !== undefined) check(passage.mode === session?.mode, { path: `${path}.mode`, code: 'mode-mismatch', message: 'A passage mode must match its session mode.' });
      if (session?.mode === 'loop' && passage?.loopSeconds !== undefined) requirePositive(passage.loopSeconds, 'loopSeconds', `${path}.loopSeconds`, issues);
      if (session?.mode !== 'loop' && passage?.loopSeconds !== undefined) issues.push({ severity: 'error', path: `${path}.loopSeconds`, code: 'unexpected-loop-length', message: 'loopSeconds only applies to loop-mode passages.' });
      // The same recording may legitimately appear in a fixed, a long and a loop session: the mode describes
      // how the excerpt is reviewed, not the recording. Only the id/family binding is tracked here.
      if (passage?.recordingId && passage.family) {
        const previous = recordings.get(passage.recordingId);
        if (previous && previous.family !== passage.family) issues.push({ severity: 'error', path: `${path}.family`, code: 'inconsistent-recording-family', message: `Recording '${passage.recordingId}' is declared with both family '${previous.family}' and '${passage.family}'.` });
        else if (!previous) recordings.set(passage.recordingId, { mode: passage.mode ?? session?.mode, family: passage.family });
      }
    }
  }
  // Audio-length checks run only when the caller can measure the local WAVs.
  for (const [sessionIndex, session] of (Array.isArray(manifest.sessions) ? manifest.sessions : []).entries()) {
    for (const [passageIndex, passage] of (Array.isArray(session?.passages) ? session.passages : []).entries()) {
      const at = `manifest.sessions[${sessionIndex}].passages[${passageIndex}]`;
      // A pending reference state is a property of the manifest itself, so warn about it whether or
      // not the caller could measure the local WAV lengths.
      if (passage?.referenceState === 'pending') issues.push({ severity: 'warning', path: `${at}.referenceState`, code: 'pending-annotation', message: `Passage '${passage?.id}' has no reviewed onset labels yet; it is excluded from scoring until a listener annotates it.` });
      const duration = sourceDurations.get(passage?.recordingId);
      if (typeof duration !== 'number' || !Number.isFinite(duration)) continue;
      if (Number.isFinite(passage?.endSeconds)) {
        check(passage.endSeconds <= duration + LOOP_TOLERANCE_SECONDS, { path: `${at}.endSeconds`, code: 'end-beyond-loop', message: `endSeconds ${passage.endSeconds} is beyond the stated loop length ${duration}.` });
      }
      if (session?.mode === 'loop' && Number.isFinite(passage?.loopSeconds) && Number.isFinite(passage?.endSeconds)) {
        // loopSeconds states the audible loop length, so it must agree with the passage's own region. The recording
        // may be much longer than the loop; only the end-within-recording check above compares against the file.
        const region = passage.endSeconds - (passage.startSeconds ?? 0);
        check(Math.abs(passage.loopSeconds - region) <= LOOP_TOLERANCE_SECONDS, { path: `${at}.loopSeconds`, code: 'loop-length-mismatch', message: `loopSeconds ${passage.loopSeconds} disagrees with the passage region length ${region.toFixed(3)}. Make loopSeconds match the reviewed region.` });
      }
    }
  }
  const summary = {
    sessions: (Array.isArray(manifest.sessions) ? manifest.sessions : []).map(session => ({ id: session?.id, mode: session?.mode, passages: Array.isArray(session?.passages) ? session.passages.length : 0 })),
    recordings: recordings.size,
    passages: passageIds.size,
    families: [...new Set([...recordings.values()].map(entry => entry.family))].sort(),
  };
  return { ok: !issues.some(issue => issue.severity === 'error'), issues, summary };
}

export function parsePcmWavDuration(bytes) {
  if (!bytes || bytes.length < 44 || bytes.toString('latin1', 0, 4) !== 'RIFF' || bytes.toString('latin1', 8, 12) !== 'WAVE') return null;
  let channelCount = 0, sampleRate = 0, bitsPerSample = 0, dataLength = 0, offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('latin1', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'fmt ' && offset + 8 + 16 <= bytes.length) {
      channelCount = bytes.readUInt16LE(offset + 10);
      sampleRate = bytes.readUInt32LE(offset + 12);
      bitsPerSample = bytes.readUInt16LE(offset + 22);
    } else if (id === 'data') {
      dataLength = Math.min(size, bytes.length - offset - 8);
    }
    offset += 8 + size + (size % 2);
  }
  const bytesPerFrame = channelCount * bitsPerSample / 8;
  if (!sampleRate || !bytesPerFrame || !dataLength) return null;
  return dataLength / bytesPerFrame / sampleRate;
}

export async function loadSourceDurations(localSources, { readBytes = readFile } = {}) {
  const durations = new Map();
  for (const source of Array.isArray(localSources) ? localSources : []) {
    if (!source?.id || typeof source.path !== 'string') continue;
    try {
      const duration = parsePcmWavDuration(await readBytes(source.path));
      if (duration) durations.set(source.id, duration);
    } catch { /* unreadable local WAVs are reported by the caller, not here */ }
  }
  return durations;
}

export class SessionResolutionError extends Error {}

export function resolveSessionsManifest(manifest, { root = process.cwd(), annotations = new Map() } = {}) {
  const sourceFor = reference => (isAbsolute(reference) ? reference : resolve(root, reference));
  const sessions = [];
  const cases = [];
  for (const session of manifest?.sessions ?? []) {
    const checklists = requiredChecklistIds(session);
    const passages = [];
    for (const passage of session?.passages ?? []) {
      const table = passage.referenceState === 'pending' ? null : annotations.get(passage.reference);
      if (passage.referenceState !== 'pending' && !(table instanceof Map)) throw new SessionResolutionError(`No reviewed onset labels for '${passage.recordingId}' in ${passage.reference}.`);
      const recording = table?.get(passage.recordingId);
      if (passage.referenceState !== 'pending' && !Array.isArray(recording?.onsetsSeconds)) throw new SessionResolutionError(`No reviewed onset labels for '${passage.recordingId}' in ${passage.reference}.`);
      const [start, end] = [passage.startSeconds, passage.endSeconds];
      // A longer region reviews labels that already exist inside it. Labels outside the stated region belong to a
      // different passage and are dropped rather than silently scored against the wrong excerpt length.
      const reference = Array.isArray(recording?.onsetsSeconds)
        ? recording.onsetsSeconds.filter(time => time > start && time < end)
        : (passage.referenceState === 'pending' ? [] : undefined);
      if (passage.referenceState === 'pending' && Array.isArray(recording?.onsetsSeconds) && recording.onsetsSeconds.some(time => time > start && time < end)) {
        throw new SessionResolutionError(`Passage '${passage.id}' is marked pending but its reference already labels onsets inside ${start}-${end} seconds.`);
      }
      const entry = {
        id: passage.id,
        sessionId: session.id,
        passageId: passage.id,
        mode: session.mode,
        family: passage.family,
        recordingId: passage.recordingId,
        filename: passage.filename ?? annotations.get(passage.reference)?.get(passage.recordingId)?.filename ?? passage.recordingId,
        sha256: passage.sha256,
        regionSeconds: [start, end],
        regionLengthSeconds: end - start,
        bars: passage.bars,
        loopSeconds: passage.loopSeconds,
        referenceState: passage.referenceState,
        reference: passage.reference,
        checklist: [...checklists],
        onsetsSeconds: reference ? [...reference] : [],
      };
      passages.push(entry);
      cases.push(entry);
    }
    sessions.push({
      id: session.id, label: session.label, mode: session.mode, description: session.description,
      exportName: session.exportName, blindExportName: session.blindExportName,
      draftName: session.draftName, blindDraftName: session.blindDraftName,
      checklist: [...checklists], passages,
    });
  }
  return { sessions, cases };
}

export async function loadAnnotationTables(manifest, { root = process.cwd(), readJson = async path => JSON.parse(await readFile(path, 'utf8')) } = {}) {
  const tables = new Map();
  for (const session of manifest?.sessions ?? []) {
    for (const passage of session?.passages ?? []) {
      if (passage.referenceState === 'pending' || tables.has(passage.reference)) continue;
      const path = isAbsolute(passage.reference) ? passage.reference : resolve(root, passage.reference);
      const data = await readJson(path);
      const byRecording = new Map((data.cases ?? []).map(item => [item.id, item]));
      tables.set(passage.reference, byRecording);
    }
  }
  return tables;
}

export function findPassage(sessions, { sessionId, passageId }) {
  const session = sessions.find(candidate => candidate.id === sessionId);
  if (!session) throw new SessionResolutionError(`Unknown review session '${sessionId}'.`);
  const passage = session.passages.find(candidate => candidate.id === passageId);
  if (!passage) throw new SessionResolutionError(`Unknown passage '${passageId}' in session '${sessionId}'.`);
  return { session, passage };
}

export function baselineSession(sessions) {
  return sessions.find(session => session.mode === 'fixed') ?? sessions[0];
}

// Export targets never overwrite one session's labels with another's.
export function exportTargets(sessions, { blind = false, baselineFile, primaryDefault = 'verified-<sessionId>-breaks.json', blindDefault = 'second-review-<sessionId>-labels.json' } = {}) {
  const baseline = baselineSession(sessions);
  return sessions.map(session => {
    if (baseline && session.id === baseline.id && baselineFile) return { sessionId: session.id, mode: session.mode, file: baselineFile };
    const fallback = blind ? blindDefault : primaryDefault;
    const template = session.exportName ?? fallback;
    return { sessionId: session.id, mode: session.mode, file: template.includes('<sessionId>') ? template.replaceAll('<sessionId>', session.id) : template };
  });
}

export function exportTargetFor(sessions, { sessionId, blind = false, baselineFile, ...rest } = {}) {
  const targets = exportTargets(sessions, { blind, baselineFile, ...rest });
  return targets.find(target => target.sessionId === sessionId) ?? targets[0];
}
