import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { baselineHash, initialReview, validateReview, verifiedAnnotations } from './break-review-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultPaths = resolve(root, 'test-results/break-transcription/real-source-paths.json');
const defaultDraft = resolve(root, 'test-results/break-transcription/review-draft.json');
const defaultExport = resolve(root, 'test-results/break-transcription/verified-real-breaks.json');
const blindDraft = resolve(root, 'test-results/break-transcription/second-review-draft.json');
const blindExport = resolve(root, 'test-results/break-transcription/second-review-labels.json');
const ui = new Map([['/', 'index.html'], ['/app.js', 'app.js'], ['/style.css', 'style.css']]);

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

export async function startBreakReviewServer({ port = 4174, pathMap = defaultPaths, draftFile, exportFile, blindReview = false } = {}) {
  draftFile ??= blindReview ? blindDraft : defaultDraft;
  exportFile ??= blindReview ? blindExport : defaultExport;
  const annotations = JSON.parse(await readFile(resolve(root, 'benchmarks/real-breaks.json'), 'utf8'));
  const localSources = JSON.parse(await readFile(pathMap, 'utf8'));
  const sourceById = new Map(localSources.map(source => [source.id, source]));
  const audio = new Map();
  for (const item of annotations.cases) {
    const source = sourceById.get(item.id);
    if (!source || source.family !== item.family) throw Error(`Missing local WAV path for ${item.id}.`);
    const bytes = await readFile(source.path);
    if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error(`Source WAV differs from the benchmark reference: ${item.id}.`);
    audio.set(item.id, bytes);
  }
  let review;
  try { review = validateReview(JSON.parse(await readFile(draftFile, 'utf8')), annotations, { blind: blindReview }); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    review = initialReview(annotations, { blind: blindReview });
  }
  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? '';
      if (!/^127\.0\.0\.1:\d+$/.test(host)) return respond(response, 403, JSON.stringify({ error: 'Local access only.' }));
      if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${host}`) return respond(response, 403, JSON.stringify({ error: 'Cross-origin edits are disabled.' }));
      const pathname = new URL(request.url ?? '/', `http://${host}`).pathname;
      if (request.method === 'GET' && ui.has(pathname)) {
        const file = ui.get(pathname);
        const type = file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
        return respond(response, 200, await readFile(resolve(root, 'tools/break-review', file)), type);
      }
      if (request.method === 'GET' && pathname === '/api/state') {
        return respond(response, 200, JSON.stringify({ mode: blindReview ? 'blind-second-review' : 'review', baselineHash: baselineHash(annotations), cases: annotations.cases.map(({ id, family, filename, regionSeconds }) => ({ id, family, filename, regionSeconds })), review }));
      }
      if (request.method === 'GET' && pathname.startsWith('/api/audio/')) {
        const id = decodeURIComponent(pathname.slice('/api/audio/'.length));
        if (!audio.has(id)) return respond(response, 404, JSON.stringify({ error: 'Unknown recording.' }));
        return respond(response, 200, audio.get(id), 'audio/wav');
      }
      if (request.method === 'POST' && pathname === '/api/draft') {
        const next = validateReview(await readJsonRequest(request), annotations, { blind: blindReview });
        await mkdir(dirname(draftFile), { recursive: true });
        await writeFile(draftFile, JSON.stringify(next, null, 2) + '\n');
        review = next;
        return respond(response, 200, JSON.stringify({ saved: true }));
      }
      if (request.method === 'POST' && pathname === '/api/export') {
        const verified = verifiedAnnotations(review, annotations, { reviewer: blindReview ? 'independent-blind-listener' : 'primary-listener' });
        await mkdir(dirname(exportFile), { recursive: true });
        await writeFile(exportFile, JSON.stringify(verified, null, 2) + '\n');
        const filename = blindReview ? 'second-review-labels.json' : 'verified-real-breaks.json';
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return response.end(JSON.stringify(verified, null, 2) + '\n');
      }
      return respond(response, 404, JSON.stringify({ error: 'Not found.' }));
    } catch (error) { return respond(response, 400, JSON.stringify({ error: error.message })); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  return { server, url: `http://127.0.0.1:${server.address().port}/`, draftFile, exportFile };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const blindReview = args.includes('--blind');
    const port = Number(args.find(arg => /^\d+$/.test(arg)) ?? (blindReview ? 4175 : 4174));
    const result = await startBreakReviewServer({ port, blindReview });
    console.log(`${blindReview ? 'Blind second review' : 'Break review'} ready: ${result.url}`);
    console.log('Draft saves to: ' + result.draftFile);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
