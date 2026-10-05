import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  DEFAULT_EXPORT_NAME, baselineSession, exportTargetFor, exportTargets, loadAnnotationTables,
  loadSourceDurations, resolveSessionsManifest, validateSessionsManifest,
} from './break-review-sessions.mjs';
import { initialReview, normalizeReviewRequest, validateReview, verifiedAnnotations } from './break-review-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultPaths = resolve(root, 'test-results/break-transcription/real-source-paths.json');
const defaultDraft = resolve(root, 'test-results/break-transcription/review-draft.json');
const defaultExport = resolve(root, 'test-results/break-transcription/verified-real-breaks.json');
const blindDraft = resolve(root, 'test-results/break-transcription/second-review-draft.json');
const blindExport = resolve(root, 'test-results/break-transcription/second-review-labels.json');
const defaultSessions = resolve(root, 'benchmarks/break-review-sessions.json');
const ui = new Map([['/', 'index.html'], ['/app.js', 'app.js'], ['/style.css', 'style.css']]);
const localFile = path => (isAbsolute(path) ? path : resolve(root, path));

function respond(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'" });
  response.end(body);
}

async function readJsonRequest(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw Error('Expected JSON request.');
  const chunks = []; let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 256 * 1024) throw Error('Review draft exceeds 256 KB.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Session drafts live side by side so switching sessions never overwrites another session's progress.
function draftPaths(sessions, { blind, firstFile, baselineDraft }) {
  const baseline = baselineSession(sessions);
  const paths = new Map();
  for (const session of sessions) {
    const name = blind ? session.blindDraftName : session.draftName;
    // A blind reviewer must never write into the primary reviewer's draft, so the fallback name is separate too.
    const fallback = blind ? `${session.id}-second-review-draft.json` : `${session.id}-review-draft.json`;
    // Session drafts live side by side with the primary draft, next to the annotations they describe.
    paths.set(session.id, resolve(dirname(firstFile), name ?? fallback));
  }
  if (baseline) paths.set(baseline.id, baselineDraft);
  return paths;
}

// A passage is served against the session it belongs to. With no manifest the eight baseline cases are served
// from the legacy annotations file, which keeps the original draft and export files valid.
async function loadContext({ pathMap, draftFile, exportFile, sessionsFile, blind = false }) {
  if (!sessionsFile) {
    const annotations = JSON.parse(await readFile(resolve(root, 'benchmarks/real-breaks.json'), 'utf8'));
    const cases = annotations.cases.map(item => ({
      id: item.id, sessionId: 'baseline', passageId: item.id, mode: 'fixed', family: item.family,
      recordingId: item.id, label: item.id, filename: item.filename, sha256: item.sha256,
      regionSeconds: item.regionSeconds, regionLengthSeconds: item.regionSeconds[1] - item.regionSeconds[0],
      bars: null, onsetsSeconds: item.onsetsSeconds, checklist: [], referenceState: 'provisional',
    }));
    const sessions = [{ id: 'baseline', label: 'Fixed two-second beats', mode: 'fixed', description: 'The existing eight two-second passages.', exportName: DEFAULT_EXPORT_NAME, checklist: [], passages: cases }];
    return {
      sessions, cases, annotations, source: 'annotations',
      audioIds: () => cases.map(item => item.recordingId),
      drafts: new Map([['baseline', draftFile]]),
      exports: new Map([['baseline', exportFile]]),
      blindExports: new Map([['baseline', exportFile]]),
    };
  }
  const manifest = JSON.parse(await readFile(localFile(sessionsFile), 'utf8'));
  const localSources = JSON.parse(await readFile(pathMap, 'utf8'));
  const sourceById = new Map((Array.isArray(localSources) ? localSources : []).map(source => [source.id, source]));
  const durations = await loadSourceDurations([...sourceById.values()]);
  const report = validateSessionsManifest(manifest, { sourceDurations: durations });
  if (!report.ok) throw Error(`Invalid sessions manifest: ${report.issues.filter(issue => issue.severity === 'error').map(issue => issue.message).join(' ')}`);
  const tables = await loadAnnotationTables(manifest);
  const { sessions, cases } = resolveSessionsManifest(manifest, { annotations: tables });
  const annotations = {
    dataset: 'Session-driven break review passages',
    annotationMethod: `Reviewed onset references declared by benchmarks/break-review-sessions.json (${report.summary.passages} passages).`,
    cases: (manifest.sessions ?? []).flatMap(session => (session.passages ?? []).map(passage => ({
      id: passage.id, family: passage.family, sha256: passage.sha256, regionSeconds: [passage.startSeconds, passage.endSeconds],
    }))),
  };
  const baseline = baselineSession(sessions);
  const baselines = exportTargets(sessions, { blind: false, baselineFile: exportFile });
  const blindBaselines = exportTargets(sessions, { blind: true, baselineFile: blindExport });
  return {
    sessions, cases, annotations, source: 'sessions',
    audioIds: () => [...new Set(cases.map(item => item.recordingId))],
    drafts: draftPaths(sessions, { blind, firstFile: draftFile, baselineDraft: draftFile }),
    exports: new Map(baselines.map(target => [target.sessionId, localFile(target.file)])),
    blindExports: new Map(blindBaselines.map(target => [target.sessionId, localFile(target.file)])),
    baseline,
  };
}

export async function startBreakReviewServer({ port = 4174, pathMap = defaultPaths, draftFile, exportFile, blindReview = false, sessionsFile } = {}) {
  draftFile ??= blindReview ? blindDraft : defaultDraft;
  exportFile ??= blindReview ? blindExport : defaultExport;
  sessionsFile ??= defaultSessions;
  const context = await loadContext({ pathMap, draftFile, exportFile, sessionsFile, blind: blindReview });
  const localSources = JSON.parse(await readFile(pathMap, 'utf8'));
  const sourceById = new Map((Array.isArray(localSources) ? localSources : []).map(source => [source.id, source]));
  const audio = new Map();
  // Long and loop passages have their own passage id but share the recording of the passage they extend, so the
  // audio route accepts either the recording id or a passage id.
  const audioAlias = new Map();
  for (const item of context.cases) {
    audioAlias.set(item.id, item.recordingId);
    if (audio.has(item.recordingId)) continue;
    const source = sourceById.get(item.recordingId);
    if (!source || source.family !== item.family) throw Error(`Missing local WAV path for ${item.recordingId}.`);
    const bytes = await readFile(source.path);
    if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error(`Source WAV differs from the benchmark reference: ${item.recordingId}.`);
    audio.set(item.recordingId, bytes);
  }
  const readDraft = (sessionId, fallback) => readFile(context.drafts.get(sessionId) ?? draftFile, 'utf8').then(text => ({ text, file: context.drafts.get(sessionId) ?? draftFile })).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return { text: null, file: fallback };
  });
  // A draft is reusable only if it still validates. A stale draft (references changed) is replaced rather than
  // crashing the server, and it is never silently exported.
  const loadReview = async sessionId => {
    const stored = await readDraft(sessionId, draftFile);
    if (stored.text !== null) {
      try { return validateReview(JSON.parse(stored.text), context.annotations, { blind: blindReview, sessions: context.sessions, source: context.source, sessionId }); }
      catch { /* stale draft: start fresh for this session */ }
    }
    const fresh = initialReview(context.annotations, { blind: blindReview, sessions: context.sessions, source: context.source, sessionId });
    fresh.sessionId = sessionId;
    return fresh;
  };
  const startSessionId = baselineSession(context.sessions).id;
  let review = await loadReview(startSessionId);
  const stateFor = activeId => {
    const targets = blindReview ? context.blindExports : context.exports;
    const active = context.sessions.find(session => session.id === activeId) ?? baselineSession(context.sessions);
    const exportTarget = exportTargetFor(context.sessions, { sessionId: active.id, blind: blindReview, baselineFile: exportFile });
    const activeIds = new Set(active.passages.map(passage => passage.id));
    const activeCases = review.cases.filter(item => activeIds.has(item.id));
    const listed = (candidate, cases) => ({
      id: candidate.id, label: candidate.label, mode: candidate.mode, description: candidate.description,
      passages: candidate.passages.length, checklist: [...(candidate.checklist ?? [])],
      exportName: exportTargetFor(context.sessions, { sessionId: candidate.id, blind: blindReview, baselineFile: exportFile }).file,
      reviewed: cases.length > 0 && cases.every(item => item.reviewed),
    });
    return {
      mode: blindReview ? 'blind-second-review' : 'review',
      source: context.source,
      sessionId: active.id,
      exportName: exportTarget.file,
      exportFile: targets.get(active.id) ?? localFile(exportTarget.file),
      checklist: [...(active.checklist ?? [])],
      sessions: context.sessions.map(session => {
        const ids = new Set(session.passages.map(passage => passage.id));
        return listed(session, review.cases.filter(item => ids.has(item.id)));
      }),
      cases: cataloguePayload(),
      review: {
        ...review,
        sessionId: active.id,
        passageId: review.passageId && activeCases.some(item => (item.passageId ?? item.id) === review.passageId) ? review.passageId : (activeCases[0]?.passageId ?? activeCases[0]?.id),
        cases: activeCases,
      },
    };
  };
  const cataloguePayload = () => context.cases.map(({ id, sessionId, passageId, mode, family, label, filename, regionSeconds, regionLengthSeconds, bars, loopSeconds, recordingId, checklist, referenceState }) => ({
    id, sessionId, passageId, mode, family, label: label ?? id, filename, recordingId, regionSeconds,
    regionLengthSeconds, bars, loopSeconds, checklist, referenceState,
  }));
  // A session-scoped draft or export must be validated against that session's passages, not the
  // whole catalogue. The legacy path (source !== 'sessions') keeps its original call shape.
  const sessionScope = sessionId => (context.source === 'sessions' && sessionId !== undefined ? { sessionId } : {});
  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? '';
      if (!/^127\.0\.0\.1:\d+$/.test(host)) return respond(response, 403, JSON.stringify({ error: 'Local access only.' }));
      if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${host}`) return respond(response, 403, JSON.stringify({ error: 'Cross-origin edits are disabled.' }));
      const url = new URL(request.url ?? '/', `http://${host}`);
      const pathname = url.pathname;
      if (request.method === 'GET' && ui.has(pathname)) {
        const file = ui.get(pathname);
        const type = file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
        return respond(response, 200, await readFile(resolve(root, 'tools/break-review', file)), type);
      }
      if (request.method === 'GET' && pathname === '/api/state') {
        return respond(response, 200, JSON.stringify(stateFor(review.sessionId ?? startSessionId)));
      }
      if (request.method === 'GET' && pathname.startsWith('/api/audio/')) {
        const id = decodeURIComponent(pathname.slice('/api/audio/'.length));
        const key = audio.has(id) ? id : audioAlias.get(id);
        if (!key || !audio.has(key)) return respond(response, 404, JSON.stringify({ error: 'Unknown recording.' }));
        return respond(response, 200, audio.get(key), 'audio/wav');
      }
      if (request.method === 'POST' && pathname === '/api/draft') {
        const body = normalizeReviewRequest(await readJsonRequest(request), context.annotations, { sessions: context.sessions, source: context.source });
        const next = validateReview(body, context.annotations, { blind: blindReview, sessions: context.sessions, source: context.source, ...sessionScope(body.sessionId ?? review.sessionId) });
        const target = context.drafts.get(body.sessionId ?? next.sessionId) ?? draftFile;
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify(next, null, 2) + '\n');
        review = next;
        return respond(response, 200, JSON.stringify({ saved: true, sessionId: body.sessionId ?? next.sessionId, draftFile: target }));
      }
      if (request.method === 'POST' && pathname === '/api/export') {
        const session = context.sessions.find(candidate => candidate.id === review.sessionId) ?? baselineSession(context.sessions);
        const verified = verifiedAnnotations(review, context.annotations, { reviewer: blindReview ? 'independent-blind-listener' : 'primary-listener', sessions: context.sessions, source: context.source, ...sessionScope(session.id) });
        const target = (blindReview ? context.blindExports : context.exports).get(session.id) ?? exportFile;
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify(verified, null, 2) + '\n');
        const filename = exportTargetFor(context.sessions, { sessionId: session.id, blind: blindReview, baselineFile: blindReview ? 'second-review-labels.json' : 'verified-real-breaks.json' }).file;
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return response.end(JSON.stringify(verified, null, 2) + '\n');
      }
      if (request.method === 'POST' && pathname === '/api/session') {
        const body = await readJsonRequest(request);
        const session = context.sessions.find(candidate => candidate.id === body?.sessionId);
        if (!session) return respond(response, 400, JSON.stringify({ error: `Unknown review session '${body?.sessionId}'.` }));
        review = await loadReview(session.id);
        return respond(response, 200, JSON.stringify({ sessionId: session.id, review }));
      }
      return respond(response, 404, JSON.stringify({ error: 'Not found.' }));
    } catch (error) { return respond(response, 400, JSON.stringify({ error: error.message })); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  const activeDraft = context.drafts.get(startSessionId) ?? draftFile;
  return { server, url: `http://127.0.0.1:${server.address().port}/`, draftFile: activeDraft, exportFile, sessions: context.sessions };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const blindReview = args.includes('--blind');
    const port = Number(args.find(arg => /^\d+$/.test(arg)) ?? (blindReview ? 4175 : 4174));
    const sessionsFile = args.find(arg => arg.endsWith('.json'));
    const result = await startBreakReviewServer({ port, blindReview, ...(sessionsFile ? { sessionsFile } : {}) });
    console.log(`${blindReview ? 'Blind second review' : 'Break review'} ready: ${result.url}`);
    console.log('Draft saves to: ' + result.draftFile);
    for (const session of result.sessions ?? []) console.log(`  session ${session.id} (${session.mode}): ${session.passages.length} passages -> ${(blindReview ? session.blindExportName : session.exportName) ?? '(default)'}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
