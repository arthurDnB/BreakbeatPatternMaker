import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { analyzeBreak } from '../dist/audio/break-analysis.js';
import { transientMarkers } from '../dist/audio/chop.js';
import { scoreOnsets, familyMacroF1, chooseSettings, interiorOnsets } from './real-break-metrics.mjs';
import { decodePcmWav } from './real-break-wav.mjs';
import { classifyRegionLength, groupByMode, groupByRegionLength, loadAnnotationTables, resolveSessionsManifest } from './break-review-sessions.mjs';

// The audio files stay outside Git. Pass the ignored local ID/path mapping as argv[2].
const annotationPath = resolve(process.argv[4] ?? 'benchmarks/real-breaks.json');
const pathsFile = resolve(process.argv[2] ?? 'test-results/break-transcription/real-source-paths.json');
const outputFile = resolve(process.argv[3] ?? 'test-results/break-transcription/real-report.json');
// Optional argv[5]: a sessions manifest, to score one manifest-driven session instead of the eight fixed
// two-second cases of the annotation file. argv[6] names the session (default: the fixed baseline session).
const sessionsPath = process.argv[5] ? resolve(process.argv[5]) : undefined;
const requestedSessionId = process.argv[6];
const annotations = JSON.parse(await readFile(annotationPath, 'utf8'));
const sources = JSON.parse(await readFile(pathsFile, 'utf8'));
const byId = new Map(sources.map(source => [source.id, source]));
const tolerancesMs = [5, 10, 20];
const defaults = { sensitivity: .35, minGapMs: 35 };
const settings = [ .2, .35, .5, .65 ].flatMap(sensitivity => [20, 35, 50].map(minGapMs => ({ sensitivity, minGapMs })));

let sessionId;
const caseList = [];
if (sessionsPath) {
  const manifest = JSON.parse(await readFile(sessionsPath, 'utf8'));
  const resolved = resolveSessionsManifest(manifest, { annotations: await loadAnnotationTables(manifest) });
  const session = requestedSessionId
    ? resolved.sessions.find(candidate => candidate.id === requestedSessionId)
    : (resolved.sessions.find(candidate => candidate.mode === 'fixed') ?? resolved.sessions[0]);
  if (!session) throw Error(`Unknown review session '${requestedSessionId}'.`);
  sessionId = session.id;
  caseList.push(...session.passages);
} else {
  for (const item of annotations.cases) caseList.push({ ...item, recordingId: item.id, mode: 'fixed' });
}

const clips = [];
for (const item of caseList) {
  const sourceId = item.recordingId ?? item.id;
  const source = byId.get(sourceId);
  if (!source || source.family !== item.family) throw Error(`Missing or mismatched local path for ${sourceId}`);
  const bytes = await readFile(source.path);
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error(`Recording hash differs from annotations: ${sourceId}`);
  const audio = decodePcmWav(bytes);
  const [start, end] = item.regionSeconds;
  if (!(start >= 0 && end > start && end <= audio.length / audio.rate) || !item.onsetsSeconds.every((time, index) => time > start && time < end && (index === 0 || time > item.onsetsSeconds[index - 1]))) throw Error(`Invalid annotation region or onset order for ${item.id}`);
  clips.push({ ...item, ...audio, startFrame: Math.round(start * audio.rate), endFrame: Math.round(end * audio.rate),
    scoredOnsetsSeconds: interiorOnsets(item.onsetsSeconds, start) });
}
if (!clips.length || new Set(clips.map(clip => clip.id)).size !== clips.length) throw Error('Expected at least one distinct source recording.');

const scoreCache = new Map();
const key = setting => `${setting.sensitivity}/${setting.minGapMs}`;
function scoreClip(clip, setting) {
  const cacheKey = `${clip.id}/${key(setting)}`;
  if (scoreCache.has(cacheKey)) return scoreCache.get(cacheKey);
  const start = performance.now();
  const analysis = analyzeBreak(clip.channels, clip.rate, { ...setting, startFrame: clip.startFrame, endFrame: clip.endFrame });
  const detected = analysis.markers.filter(frame => frame > clip.startFrame && frame < clip.endFrame).map(frame => frame / clip.rate);
  const scores = Object.fromEntries(tolerancesMs.map(tolerance => [tolerance, scoreOnsets(detected, clip.scoredOnsetsSeconds, tolerance)]));
  const result = { detectedSeconds: detected, scores, overflow: analysis.overflow, elapsedMs: performance.now() - start };
  scoreCache.set(cacheKey, result);
  return result;
}
function rowsFor(setting) { return clips.map(clip => ({ family: clip.family, f1: scoreClip(clip, setting).scores[10].f1 })); }
const families = [...new Set(clips.map(clip => clip.family))].sort();
const folds = families.map(heldOutFamily => {
  const trainingFamilies = families.filter(family => family !== heldOutFamily);
  const chosen = chooseSettings(settings, rowsFor, trainingFamilies, defaults);
  return { heldOutFamily, trainingFamilies, selected: chosen.setting, trainingMacroF1: chosen.score,
    defaultHeldOutF1: familyMacroF1(rowsFor(defaults), [heldOutFamily]),
    selectedHeldOutF1: familyMacroF1(rowsFor(chosen.setting), [heldOutFamily]) };
});

const results = clips.map(clip => {
  const tuned = folds.find(fold => fold.heldOutFamily === clip.family).selected;
  const start = clip.startFrame, end = clip.endFrame;
  const legacy = transientMarkers(clip.channels.map(channel => channel.slice(start, end)), clip.rate, .5, 25)
    .filter(frame => frame > 0 && frame < end - start).map(frame => (start + frame) / clip.rate);
  const priorScores = Object.fromEntries(tolerancesMs.map(tolerance => [tolerance, scoreOnsets(legacy, clip.scoredOnsetsSeconds, tolerance)]));
  const regionLength = clip.regionSeconds[1] - clip.regionSeconds[0];
  return { id: clip.id, sessionId: clip.sessionId ?? null, passageId: clip.passageId ?? null, mode: clip.mode ?? 'fixed',
    family: clip.family, sourceDurationSeconds: clip.length / clip.rate,
    annotatedRegionSeconds: clip.regionSeconds, regionLengthSeconds: regionLength, regionLengthClass: classifyRegionLength(regionLength),
    bars: clip.bars ?? null, referenceOnsets: clip.onsetsSeconds.length,
    scoredReferenceOnsets: clip.scoredOnsetsSeconds.length, fixedStartOnsets: clip.onsetsSeconds.length - clip.scoredOnsetsSeconds.length,
    default: scoreClip(clip, defaults), tuned: { settings: tuned, ...scoreClip(clip, tuned) },
    previous: { detectedSeconds: legacy, scores: priorScores } };
});
const macro = method => familyMacroF1(results.map(row => ({ family: row.family, f1: row[method].scores[10].f1 })), families);
const gridResults = settings.map(setting => ({ ...setting, macroF1At10Ms: familyMacroF1(rowsFor(setting), families),
  familyF1At10Ms: Object.fromEntries(families.map(family => [family, familyMacroF1(rowsFor(setting), [family])])) }));

// Region length and review mode are read from each case's own region, so a report works for two-second
// excerpts, longer excerpts and full loops without assuming a fixed 2 s window.
function macroOver(rows) {
  const rowFamilies = [...new Set(rows.map(row => row.family))].sort();
  const pick = method => familyMacroF1(rows.map(row => ({ family: row.family, f1: row[method].scores[10].f1 })), rowFamilies);
  return { default: pick('default'), crossValidated: pick('tuned'), previous: pick('previous') };
}
function groupReport(groups) {
  return Object.fromEntries([...groups.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([name, rows]) => [name, {
    passages: rows.length, families: [...new Set(rows.map(row => row.family))].sort(),
    regionLengthSeconds: [...new Set(rows.map(row => Number(row.regionLengthSeconds.toFixed(3))))].sort((a, b) => a - b),
    referenceOnsets: rows.reduce((sum, row) => sum + row.referenceOnsets, 0),
    scoredReferenceOnsets: rows.reduce((sum, row) => sum + row.scoredReferenceOnsets, 0),
    fixedStartOnsets: rows.reduce((sum, row) => sum + row.fixedStartOnsets, 0),
    macroF1At10Ms: macroOver(rows) }]));
}

const report = { dataset: annotations.reviewComplete
    ? 'Eight user-supplied continuous break recordings; listener-reviewed onsets in selected two-second regions'
    : 'Eight user-supplied continuous break recordings; independent waveform-assisted annotations of selected two-second regions; listening verification pending',
  annotationMethod: annotations.annotationMethod,
  scoringPolicy: 'Interior onsets only; an annotation within 1 ms of the region start is a fixed slice boundary, not an onset-detector decision.',
  toleranceMs: tolerancesMs, defaults, settingsGrid: gridResults, folds,
  macroF1At10Ms: { default: macro('default'), crossValidated: macro('tuned'), previous: macro('previous') },
  regionLengthSummary: groupReport(groupByRegionLength(results, { id: 'regionLengthSeconds' })),
  modeSummary: groupReport(groupByMode(results)),
  ...(sessionsPath ? { sessionsFile: relative(process.cwd(), sessionsPath ) || sessionsPath, sessionId } : {}),
  results };
await mkdir(resolve(outputFile, '..'), { recursive: true });
await writeFile(outputFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputFile, sessionId: sessionId ?? null, macroF1At10Ms: report.macroF1At10Ms,
  regionLengthSummary: Object.fromEntries(Object.entries(report.regionLengthSummary).map(([name, group]) => [name, group.macroF1At10Ms])),
  folds, perFile: results.map(row => ({ id: row.id, n: row.referenceOnsets,
    default: row.default.scores[10].f1, crossValidated: row.tuned.scores[10].f1, previous: row.previous.scores[10].f1 })) }, null, 2));
