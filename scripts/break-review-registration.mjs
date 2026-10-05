// Registration protocol for adding another unrelated break to the Break Transcription Production Gate.
// Audio files never enter Git: the repository keeps only the manifest entry (id, family, sha256, regions, bars)
// while test-results/break-transcription/real-source-paths.json maps each recording id to the local WAV.
// Everything here is a pure function so the protocol is testable without any audio; the CLI is a thin wrapper.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOOP_TOLERANCE_SECONDS, SESSION_MODES, parsePcmWavDuration, validateSessionsManifest } from './break-review-sessions.mjs';

export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const SOURCE_PATHS_FILE = 'test-results/break-transcription/real-source-paths.json';
export const SESSIONS_FILE = 'benchmarks/break-review-sessions.json';

// Exactly what the project owner must supply for one new passage, in plain language.
export const REGISTRATION_FIELDS = Object.freeze([
  Object.freeze({ field: 'path', label: 'File path', question: 'Where is the break WAV on this machine?',
    how: `Copy the absolute path of the WAV into ${SOURCE_PATHS_FILE} as the "path" of an entry whose "id" is the passage recordingId. In Explorer: Shift+right-click the file > "Copy as path", then remove the surrounding quotes. Never copy the WAV itself into the repository.` }),
  Object.freeze({ field: 'sha256', label: 'sha256', question: 'What is the SHA-256 of that WAV?',
    how: 'Run: node scripts/break-review-registration.mjs --hash "<path to the WAV>" and copy the printed 64-character lowercase hash into the passage "sha256". The review server refuses to start if the file on disk does not match it.' }),
  Object.freeze({ field: 'family', label: 'Break family', question: 'Which family does this break belong to?',
    how: 'Use the same short lowercase id for related breaks (the same recording or the same drummer), for example "amen". A brand new family is fine: it folds into the family macro average automatically.' }),
  Object.freeze({ field: 'loopSeconds', label: 'Loop length (seconds)', question: 'How long is one full audible pass of the loop?',
    how: 'Run: node scripts/break-review-registration.mjs --duration "<path to the WAV>" to read the file length, then state the audible loop length in seconds. Loop-mode passages only; it must match endSeconds - startSeconds within 0.05 s.' }),
  Object.freeze({ field: 'bars', label: 'Bar grid', question: 'How many bars long is the reviewed region?',
    how: 'Fractional values are allowed (for example 0.5 for a half-bar break). This is your annotation of the audio; the tool never guesses it.' }),
]);

export const REGISTRATION_STEPS = Object.freeze([
  '1. Keep the WAV outside Git (for example beside your other breaks). Never copy it into the repository.',
  '2. Read the file length:  node scripts/break-review-registration.mjs --duration "<path to the WAV>"',
  '3. Read the SHA-256:     node scripts/break-review-registration.mjs --hash "<path to the WAV>"',
  `4. Add { "id": "<recording-id>", "family": "<family>", "path": "<absolute WAV path>" } to ${SOURCE_PATHS_FILE}.`,
  `5. Add a passage for it to ${SESSIONS_FILE} under the session you are extending (recordingId, family, sha256, startSeconds, endSeconds, bars, referenceState, reference); copy the shape of an existing passage of the same mode.`,
  '6. Re-run the validator until it prints ok:  node scripts/break-review-registration.mjs',
  `7. Review it:  node scripts/break-review-server.mjs   then pick the session, loop the passage, tick every checklist item, mark it reviewed and export the labels.`,
  `8. Score it:  node scripts/real-break-benchmark.mjs ${SOURCE_PATHS_FILE} test-results/break-transcription/real-report.json benchmarks/real-breaks.json ${SESSIONS_FILE} <session-id>`,
]);

// Validates the shape of the local id -> WAV path map. Pure: it never touches the filesystem.
export function validateSourcePaths(pathMap) {
  const issues = [];
  if (!Array.isArray(pathMap)) {
    return { ok: false, entries: new Map(), issues: [{ severity: 'error', path: 'pathMap', code: 'path-map-not-array',
      message: `The local source path map must be a JSON array of { "id", "family", "path" } entries (${SOURCE_PATHS_FILE}).` }] };
  }
  const entries = new Map();
  pathMap.forEach((entry, index) => {
    const at = `pathMap[${index}]`;
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    const family = typeof entry?.family === 'string' ? entry.family.trim() : '';
    const file = typeof entry?.path === 'string' ? entry.path.trim() : '';
    if (!id) issues.push({ severity: 'error', path: `${at}.id`, code: 'missing-source-id', message: 'Every source path entry needs a non-empty id matching a passage recordingId.' });
    else if (entries.has(id)) issues.push({ severity: 'error', path: `${at}.id`, code: 'duplicate-source-id', message: `Source path entry '${id}' is declared more than once.` });
    if (!family) issues.push({ severity: 'error', path: `${at}.family`, code: 'missing-source-family', message: `Every source path entry needs a non-empty family id.` });
    if (!file) issues.push({ severity: 'error', path: `${at}.path`, code: 'missing-source-path', message: `Source path entry '${id || index}' needs the absolute path to the local WAV.` });
    if (id && !entries.has(id)) entries.set(id, { id, family, path: file });
  });
  return { ok: !issues.some(issue => issue.severity === 'error'), entries, issues };
}

// The five things the owner must supply for one passage, each with its current value (null when missing).
export function requiredSupplyFor(passage, { entry } = {}) {
  const start = passage?.startSeconds, end = passage?.endSeconds;
  const regionLength = Number.isFinite(start) && Number.isFinite(end) ? Number((end - start).toFixed(3)) : null;
  const current = field => {
    if (field === 'path') return entry?.path ?? null;
    if (field === 'family') return passage?.family ?? null;
    if (field === 'sha256') return passage?.sha256 ?? null;
    if (field === 'bars') return passage?.bars ?? null;
    if (field === 'loopSeconds') return passage?.loopSeconds ?? regionLength;
    return null;
  };
  return REGISTRATION_FIELDS.map(item => ({ ...item, value: current(item.field), supplied: current(item.field) !== null && current(item.field) !== undefined }));
}

// A paste-ready pair of stubs so the owner never has to invent the JSON shape.
export function registrationStub(recordingId, { family = 'new-family', bars = 4, startSeconds = 0, endSeconds = 4, reference = 'benchmarks/verified-real-breaks.json' } = {}) {
  return {
    sourcePathEntry: { id: recordingId, family, path: '<absolute path to the WAV on this machine>' },
    passage: { id: `${recordingId}-long`, recordingId, family, sha256: '<64 lowercase hex characters>',
      startSeconds, endSeconds, bars, referenceState: 'pending', reference },
  };
}

// The full protocol check: manifest schema + local path map + the binding between them.
export function registrationReport({ manifest, pathMap, sourceDurations = new Map() } = {}) {
  const manifestResult = validateSessionsManifest(manifest, { sourceDurations });
  const pathResult = validateSourcePaths(pathMap);
  const issues = [...manifestResult.issues, ...pathResult.issues];
  const passages = [];
  for (const session of Array.isArray(manifest?.sessions) ? manifest.sessions : []) {
    for (const passage of Array.isArray(session?.passages) ? session.passages : []) {
      const entry = passage?.recordingId ? pathResult.entries.get(passage.recordingId) : undefined;
      const problems = [];
      if (passage?.recordingId && !entry) problems.push({ code: 'unregistered-recording', field: 'path',
        message: `No local source path is registered for recording '${passage.recordingId}'. Add { "id": "${passage.recordingId}", "family": "${passage?.family ?? ''}", "path": "<absolute path to the WAV>" } to ${SOURCE_PATHS_FILE}.` });
      if (entry && passage?.family && entry.family !== passage.family) problems.push({ code: 'source-family-mismatch', field: 'family',
        message: `Recording '${passage.recordingId}' is family '${passage.family}' in the manifest but '${entry.family}' in ${SOURCE_PATHS_FILE}.` });
      if (typeof passage?.sha256 !== 'string' || !SHA256_PATTERN.test(passage.sha256)) problems.push({ code: 'invalid-sha256', field: 'sha256',
        message: `Run "node scripts/break-review-registration.mjs --hash \\"${entry?.path ?? '<path to the WAV>'}\\"" and copy the 64-character lowercase hash into passage '${passage?.id ?? '?'}'.` });
      const duration = sourceDurations.get(passage?.recordingId);
      if (typeof duration === 'number' && Number.isFinite(duration)) {
        const end = passage?.endSeconds ?? duration;
        if (Number.isFinite(end) && end > duration + LOOP_TOLERANCE_SECONDS) problems.push({ code: 'end-beyond-loop', field: 'loopSeconds',
          message: `The reviewed region ends at ${end} s but the file is only ${duration.toFixed(3)} s long.` });
      }
      const start = passage?.startSeconds, end = passage?.endSeconds;
      // Hoist every passage-level error into the flat issue list too, so the CLI can print one
      // complete list of what blocks registration while `passages` keeps the per-passage detail.
      for (const problem of problems) issues.push({ severity: 'error', path: passage?.id ?? null, ...problem });
      passages.push({ passageId: passage?.id ?? null, recordingId: passage?.recordingId ?? null, sessionId: session?.id ?? null,
        mode: SESSION_MODES.includes(session?.mode) ? session.mode : null, family: passage?.family ?? null,
        sha256: passage?.sha256 ?? null, bars: passage?.bars ?? null, loopSeconds: passage?.loopSeconds ?? null,
        regionSeconds: Number.isFinite(start) && Number.isFinite(end) ? [start, end] : null,
        sourcePath: entry?.path ?? null, problems, supply: requiredSupplyFor(passage, { entry }) });
    }
  }
  return { ok: !issues.some(issue => issue.severity === 'error') && !passages.some(passage => passage.problems.length),
    issues, passages, summary: manifestResult.summary, pathMapEntries: pathResult.entries.size };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const args = process.argv.slice(2);
  const valueOf = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
  const usage = [
    'Usage:',
    '  node scripts/break-review-registration.mjs [manifest.json] [path-map.json]   validate the registration',
    '  node scripts/break-review-registration.mjs --hash "<wav>"                     print sha256 + file length',
    '  node scripts/break-review-registration.mjs --duration "<wav>"                 print the file length',
    '  node scripts/break-review-registration.mjs --stub <recording-id> [family]     print paste-ready JSON',
    '',
    'What the owner must supply for each new break:',
    ...REGISTRATION_FIELDS.map(item => `  ${item.label} — ${item.question}\n    ${item.how}`),
    '',
    'Full protocol:',
    ...REGISTRATION_STEPS,
  ].join('\n');

  const file = valueOf('--hash') ?? valueOf('--duration');
  if (args.includes('--help') || args.includes('-h')) console.log(usage);
  else if (file) {
    try {
      const bytes = await readFile(resolve(file));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const durationSeconds = parsePcmWavDuration(bytes);
      if (args.includes('--duration')) console.log(JSON.stringify({ file: resolve(file), durationSeconds }, null, 2));
      else console.log(JSON.stringify({ file: resolve(file), sha256, durationSeconds }, null, 2));
      if (durationSeconds === null) { console.error('Not a readable PCM WAV file; the length could not be measured.'); process.exitCode = 1; }
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  } else if (args.includes('--stub')) {
    const stubIndex = args.indexOf('--stub');
    const recordingId = args[stubIndex + 1];
    const family = args[stubIndex + 2];
    console.log(JSON.stringify(registrationStub(recordingId, family ? { family } : {}), null, 2));
  } else {
    const manifestPath = resolve(args.find(arg => !arg.startsWith('-')) ?? SESSIONS_FILE);
    const pathMapPath = resolve(args.filter(arg => !arg.startsWith('-'))[1] ?? SOURCE_PATHS_FILE);
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      let pathMap = [];
      try { pathMap = JSON.parse(await readFile(pathMapPath, 'utf8')); }
      catch { console.error(`No readable local source path map at ${pathMapPath}. Every recording needs an entry there (see step 4).`); process.exitCode = 1; }
      const { loadSourceDurations } = await import('./break-review-sessions.mjs');
      const report = registrationReport({ manifest, pathMap, sourceDurations: await loadSourceDurations(pathMap) });
      for (const item of report.passages) {
        const where = `${item.sessionId ?? '?'}/${item.passageId ?? '?'}`;
        if (!item.problems.length) { console.log(`ok       ${where}  ${item.family ?? '?'}  ${item.regionSeconds ? `${item.regionSeconds[0]}-${item.regionSeconds[1]}s` : 'no region'}`); continue; }
        console.log(`PROBLEM  ${where}`);
        for (const problem of item.problems) console.log(`         ${problem.field}: ${problem.message}`);
        for (const supply of item.supply.filter(entry => !entry.supplied)) console.log(`         supply ${supply.label}: ${supply.how}`);
      }
      for (const issue of report.issues) console.log(`${issue.severity === 'warning' ? 'warn    ' : 'PROBLEM '} ${issue.path}: ${issue.message}`);
      console.log(`${report.ok ? 'ok' : 'NOT READY'} — ${report.passages.length} passages, ${report.summary?.recordings ?? 0} recordings, ${report.pathMapEntries} local source paths`);
      if (!report.ok) { console.log('\n' + usage); process.exitCode = 1; }
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
