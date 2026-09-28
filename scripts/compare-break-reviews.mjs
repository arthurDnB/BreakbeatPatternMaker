import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compareReviews } from './break-review-agreement.mjs';

const [, , firstPath, secondPath, outputPath] = process.argv;
if (!firstPath || !secondPath) {
  console.error('Usage: node scripts/compare-break-reviews.mjs <first-review.json> <second-review-labels.json> [report.json]');
  process.exitCode = 2;
} else {
  try {
    const first = JSON.parse(await readFile(resolve(firstPath), 'utf8'));
    const second = JSON.parse(await readFile(resolve(secondPath), 'utf8'));
    const report = compareReviews(first, second);
    const serialized = JSON.stringify(report, null, 2) + '\n';
    if (outputPath) { const target = resolve(outputPath); await mkdir(dirname(target), { recursive: true }); await writeFile(target, serialized); }
    process.stdout.write(serialized);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
