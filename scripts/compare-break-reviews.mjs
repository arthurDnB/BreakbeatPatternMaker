import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compareReviews } from './break-review-agreement.mjs';
import { classifyRegionLength } from './break-review-sessions.mjs';

const usage = 'Usage: node scripts/compare-break-reviews.mjs <first-review.json> <second-review-labels.json> [report.json] [break-review-sessions.json]';

// The optional session manifest only supplies reporting context (session, mode, bar grid, region length) so the
// agreement report can be grouped by region length and by review mode.
async function loadSessionMeta(path) {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const meta = new Map();
  for (const session of manifest?.sessions ?? []) {
    for (const passage of session?.passages ?? []) {
      const start = passage.startSeconds, end = passage.endSeconds;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      meta.set(passage.id, { sessionId: session.id, passageId: passage.id, mode: session.mode, bars: passage.bars,
        regionLengthSeconds: end - start, regionLengthClass: classifyRegionLength(end - start) });
    }
  }
  return meta;
}

const [, , firstPath, secondPath, outputPath, sessionsPath] = process.argv;
if (!firstPath || !secondPath) {
  console.error(usage);
  process.exitCode = 2;
} else {
  try {
    const first = JSON.parse(await readFile(resolve(firstPath), 'utf8'));
    const second = JSON.parse(await readFile(resolve(secondPath), 'utf8'));
    const sessions = sessionsPath ? await loadSessionMeta(resolve(sessionsPath)) : undefined;
    const report = compareReviews(first, second, undefined, { sessions });
    const serialized = JSON.stringify(report, null, 2) + '\n';
    if (outputPath) { const target = resolve(outputPath); await mkdir(dirname(target), { recursive: true }); await writeFile(target, serialized); }
    process.stdout.write(serialized);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
