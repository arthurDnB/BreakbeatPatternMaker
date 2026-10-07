#!/usr/bin/env node
/**
 * Generates native/tests/vectors/wave2.txt, the wave-2 core fixture.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The native port (native/Source/core/) re-implements five pure TypeScript
 * modules - src/core/meter.ts, articulation.ts, drum-lanes.ts,
 * slice-instrument.ts and reverse-probability.ts - in C++. The only honest way
 * to claim parity is to run the *same* questions through the TypeScript engine
 * and through the C++ port and compare the answers. This generator asks the
 * TypeScript questions and records the answers; bbpm_wave2_selftest.exe
 * replays them through the C++ port (native/Source/core/Wave2SelfTest.cpp).
 *
 * The engine is read from dist/, which is build output of src/. Run
 * `npm run build` first. To make one fixture a snapshot of one engine, dist/
 * is copied to the gitignored test-results/dist-snapshot/ and imported from
 * there (--no-copy imports dist/ directly).
 *
 * FORMAT
 * ------
 * One record per line:  <kind>\t<key>=<value>[\t<key>=<value>...]
 * Lines that are empty or start with '#' are ignored by the reader.
 * A byte is written raw iff 0x20 <= b <= 0x7E and b is neither '%' (0x25) nor
 * TAB (0x09); every other byte becomes '%' + two UPPERCASE hex digits. That is
 * the exact inverse of decodeVectorField() in
 * native/Source/core/Wave2SelfTest.cpp, and the escaping runs over the UTF-8
 * encoding of the value (so the en dash in a thrown message survives as %E2%80%93).
 *
 * The record vocabulary, the input keys and the compared output keys are
 * documented in native/tests/vectors/README.md. This generator never
 * hand-writes an expected value: every expected value is read off the
 * TypeScript engine, so a fixture that disagrees with the port means the port
 * is wrong, not the fixture.
 *
 * REGENERATION IS DELIBERATE
 * --------------------------
 * The fixture is tracked. Regenerating it after a core change is a reviewed
 * act: diff the file, confirm every changed line is explained by the change,
 * and never regenerate just to make a red self test go green.
 */

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function parseArgs(argv) {
  const options = {
    distRoot: join(REPO_ROOT, 'dist'),
    snapshot: join(REPO_ROOT, 'test-results', 'dist-snapshot'),
    out: join(HERE, 'vectors', 'wave2.txt'),
    copy: true,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dist-root') options.distRoot = resolve(argv[++index]);
    else if (arg === '--out') options.out = resolve(argv[++index]);
    else if (arg === '--snapshot') options.snapshot = resolve(argv[++index]);
    else if (arg === '--no-copy') options.copy = false;
    else if (arg === '--check') options.check = true;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'usage: node native/tests/generate-wave2-vectors.mjs [--dist-root DIR] [--out FILE]\n' +
        '                                                 [--snapshot DIR] [--no-copy] [--check]\n',
      );
      process.exit(0);
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const CORE_MODULES = ['meter', 'articulation', 'drum-lanes', 'slice-instrument', 'reverse-probability', 'model'];

for (const name of CORE_MODULES) {
  const file = join(options.distRoot, 'core', `${name}.js`);
  if (!existsSync(file)) {
    process.stderr.write(`Missing ${file}. Run "npm run build" first.\n`);
    process.exit(2);
  }
}

let engineRoot = options.distRoot;
if (options.copy) {
  rmSync(options.snapshot, { recursive: true, force: true });
  mkdirSync(dirname(options.snapshot), { recursive: true });
  cpSync(options.distRoot, options.snapshot, { recursive: true });
  engineRoot = options.snapshot;
}

const load = (name) => import(pathToFileURL(join(engineRoot, 'core', `${name}.js`)).href);
const meterModule = await load('meter');
const articulationModule = await load('articulation');
const drumLanesModule = await load('drum-lanes');
const sliceInstrumentModule = await load('slice-instrument');
const reverseProbabilityModule = await load('reverse-probability');
const modelModule = await load('model');

const {
  parseTimeSignature,
  barTicks,
  patternTicks,
  patternSeconds,
  trackerTiming,
  meterPosition,
  meterGroups,
} = meterModule;
const { validateArticulation, setRatchets, articulationLabel } = articulationModule;
const { drumLane, routeGeneratedDrums } = drumLanesModule;
const { validateSliceInstruments, mappedInstrument, resolveSlice, resolvePatternSlices } = sliceInstrumentModule;
const { applyReverseProbability } = reverseProbabilityModule;
const { ENGINE_VERSION, PPQ, ROLES } = modelModule;

// ---------------------------------------------------------------- serialising

const isRawByte = (byte) => byte >= 0x20 && byte <= 0x7e && byte !== 0x25 && byte !== 0x09;

function encodeValue(value) {
  const bytes = Buffer.from(String(value), 'utf8');
  let out = '';
  for (const byte of bytes) {
    out += isRawByte(byte) ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

const records = [];

function emit(kind, fields, outputs = {}) {
  const parts = [kind];
  for (const [key, value] of [...Object.entries(fields), ...Object.entries(outputs)]) {
    if (value === undefined) continue;
    parts.push(`${key}=${encodeValue(value)}`);
  }
  records.push(parts.join('\t'));
}

const n = (value) => String(value);

/** Encodes a value the C++ reader holds as a JsValue (it branches on typeof). */
function jsField(value) {
  if (value === undefined) return 'u';
  if (value === null) return 'z';
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  if (typeof value === 'number') return `n${String(value)}`;
  return `s${String(value)}`;
}

/** Mirrors jsValueText() in native/Source/core/Wave2Support.cpp. */
function jsText(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '<object>';
}

const SETTINGS_STRINGS = ['seed', 'algorithm', 'timeSignature'];
const SETTINGS_NUMBERS = ['variation', 'resolution', 'lpb', 'bpm', 'bars', 'reverseProbability'];

function settingsFields(settings, prefix = 'settings.') {
  const out = {};
  if (!settings) return out;
  for (const key of SETTINGS_STRINGS) {
    if (settings[key] !== undefined) out[prefix + key] = String(settings[key]);
  }
  for (const key of SETTINGS_NUMBERS) {
    if (settings[key] !== undefined) out[prefix + key] = String(settings[key]);
  }
  return out;
}

function articulationFields(value, prefix) {
  const out = {};
  if (value === undefined) return out;
  if (value === null || typeof value !== 'object') {
    out[`${prefix}a.raw`] = '1';
    return out;
  }
  if (value.mode !== undefined) out[`${prefix}a.mode`] = String(value.mode);
  if (value.durationTicks !== undefined) out[`${prefix}a.duration`] = String(value.durationTicks);
  if (value.chokeGroup !== undefined) out[`${prefix}a.choke`] = jsField(value.chokeGroup);
  if (Array.isArray(value.repeats)) {
    out[`${prefix}a.repeats`] = '1';
    value.repeats.forEach((repeat, index) => {
      const p = `${prefix}a.r${index}.`;
      if (repeat === null || repeat === undefined) {
        out[p + 'kind'] = 'nullish';
        return;
      }
      if (typeof repeat !== 'object') {
        out[p + 'kind'] = 'scalar';
        return;
      }
      out[p + 'kind'] = 'object';
      if (repeat.gain !== undefined) out[p + 'gain'] = String(repeat.gain);
      if (repeat.pitch !== undefined) out[p + 'pitch'] = String(repeat.pitch);
      if (repeat.glide !== undefined) out[p + 'glide'] = String(repeat.glide);
      if (repeat.sourceOffset !== undefined) out[p + 'offset'] = String(repeat.sourceOffset);
      if (repeat.reverse !== undefined) out[p + 'reverse'] = jsField(repeat.reverse);
    });
  } else if (value.repeats !== undefined) {
    out[`${prefix}a.repeatsRaw`] = '1';
  }
  // A present object with none of the fields above (`{}`) must stay
  // distinguishable from an absent articulation, or the C++ reader would skip
  // the mode check that throws "Invalid articulation mode.".
  if (Object.keys(out).length === 0) out[`${prefix}a.empty`] = '1';
  return out;
}

function hitFields(hit, prefix = 'e0.') {
  const out = {};
  if (hit.id !== undefined) out[prefix + 'id'] = String(hit.id);
  if (hit.role !== undefined) out[prefix + 'role'] = String(hit.role);
  if (hit.trackId !== undefined) out[prefix + 'trackId'] = String(hit.trackId);
  if (hit.sourceId !== undefined) out[prefix + 'sourceId'] = String(hit.sourceId);
  if (hit.baseTick !== undefined) out[prefix + 'baseTick'] = String(hit.baseTick);
  if (hit.offsetTick !== undefined) out[prefix + 'offsetTick'] = String(hit.offsetTick);
  if (hit.gain !== undefined) out[prefix + 'gain'] = String(hit.gain);
  if (hit.pan !== undefined) out[prefix + 'pan'] = String(hit.pan);
  if (hit.anchor !== undefined) out[prefix + 'anchor'] = hit.anchor ? '1' : '0';
  if (hit.ghost !== undefined) out[prefix + 'ghost'] = hit.ghost ? '1' : '0';
  if (hit.reason !== undefined) out[prefix + 'reason'] = String(hit.reason);
  if (hit.ratchets !== undefined) out[prefix + 'ratchets'] = String(hit.ratchets);
  if (hit.sourceKind !== undefined) out[prefix + 'sourceKind'] = String(hit.sourceKind);
  Object.assign(out, articulationFields(hit.articulation, prefix));
  if (hit.slice !== undefined && hit.slice !== null && typeof hit.slice === 'object') {
    if (hit.slice.assetId !== undefined) out[prefix + 's.assetId'] = String(hit.slice.assetId);
    if (hit.slice.startFrame !== undefined) out[prefix + 's.start'] = String(hit.slice.startFrame);
    if (hit.slice.endFrame !== undefined) out[prefix + 's.end'] = String(hit.slice.endFrame);
    if (hit.slice.sampleRate !== undefined) out[prefix + 's.rate'] = String(hit.slice.sampleRate);
    if (hit.slice.label !== undefined) out[prefix + 's.label'] = String(hit.slice.label);
  }
  if (hit.mapped !== undefined) {
    if (hit.mapped && typeof hit.mapped === 'object') {
      if (hit.mapped.instrumentId !== undefined) out[prefix + 'm.id'] = String(hit.mapped.instrumentId);
      if (hit.mapped.note !== undefined) out[prefix + 'm.note'] = String(hit.mapped.note);
    } else {
      out[prefix + 'm.raw'] = '1';
    }
  }
  if (hit.synthNote !== undefined) out[prefix + 'synthNote'] = jsField(hit.synthNote);
  if (hit.generatedDrumRole !== undefined) out[prefix + 'genRole'] = jsField(hit.generatedDrumRole);
  if (hit.reverse !== undefined) out[prefix + 'reverse'] = jsField(hit.reverse);
  if (hit.gate !== undefined) out[prefix + 'gate'] = jsField(hit.gate);
  return out;
}

function patternFields(pattern, base = '') {
  const out = {};
  out[base + 'engineVersion'] = String(pattern.engineVersion ?? ENGINE_VERSION);
  Object.assign(out, settingsFields(pattern.settings, base + 'settings.'));
  out[base + 'ppq'] = String(pattern.ppq ?? PPQ);
  (pattern.events ?? []).forEach((hit, index) => Object.assign(out, hitFields(hit, `${base}e${index}.`)));
  if (pattern.drumLanes !== undefined && pattern.drumLanes !== null) {
    out[base + 'hasLanes'] = '1';
    for (const role of ROLES) {
      const lane = pattern.drumLanes[role];
      if (!lane) continue;
      const p = `${base}l${role}.`;
      out[p + 'name'] = String(lane.name ?? '');
      out[p + 'visible'] = lane.visible === false ? '0' : '1';
      out[p + 'genRole'] = jsField(lane.generationRole);
    }
  }
  (pattern.userTracks ?? []).forEach((track, index) => {
    const p = `${base}t${index}.`;
    if (track.id !== undefined) out[p + 'id'] = String(track.id);
    if (track.name !== undefined) out[p + 'name'] = String(track.name);
    if (track.role !== undefined) out[p + 'role'] = String(track.role);
    if (track.kind !== undefined) out[p + 'kind'] = String(track.kind);
    out[p + 'genRole'] = jsField(track.generationRole);
    if (track.generationDensity !== undefined) out[p + 'density'] = String(track.generationDensity);
    if (track.generationProbability !== undefined) out[p + 'probability'] = String(track.generationProbability);
  });
  if (pattern.sliceInstruments !== undefined) {
    if (!Array.isArray(pattern.sliceInstruments)) {
      out[base + 'siRaw'] = '1';
    } else {
      out[base + 'si'] = '1';
      pattern.sliceInstruments.forEach((instrument, index) => {
        const p = `${base}si${index}.`;
        if (instrument.id !== undefined) out[p + 'id'] = String(instrument.id);
        if (instrument.name !== undefined) out[p + 'name'] = String(instrument.name);
        if (instrument.assetId !== undefined) out[p + 'assetId'] = String(instrument.assetId);
        if (instrument.sampleRate !== undefined) out[p + 'rate'] = String(instrument.sampleRate);
        if (instrument.startFrame !== undefined) out[p + 'start'] = String(instrument.startFrame);
        if (instrument.endFrame !== undefined) out[p + 'end'] = String(instrument.endFrame);
        if (instrument.loopFadeMs !== undefined) out[p + 'loopFade'] = String(instrument.loopFadeMs);
        if (Array.isArray(instrument.slices)) {
          out[p + 'slices'] = '1';
          instrument.slices.forEach((slice, sliceIndex) => {
            const q = `${p}s${sliceIndex}.`;
            if (slice.id !== undefined) out[q + 'id'] = String(slice.id);
            if (slice.note !== undefined) out[q + 'note'] = String(slice.note);
            if (slice.startFrame !== undefined) out[q + 'start'] = String(slice.startFrame);
            if (slice.endFrame !== undefined) out[q + 'end'] = String(slice.endFrame);
          });
        } else if (instrument.slices !== undefined) {
          out[p + 'slicesRaw'] = '1';
        }
      });
    }
  }
  return out;
}

// --------------------------------------------------- TypeScript-side summaries

function summaryOfEvent(hit) {
  return [
    hit.id,
    hit.role,
    hit.sourceId ?? '',
    hit.trackId === undefined || hit.trackId === null ? '-' : hit.trackId,
    hit.reason ?? '',
    hit.sourceKind === undefined || hit.sourceKind === null ? '-' : hit.sourceKind,
    hit.slice
      ? `${hit.slice.assetId}:${String(hit.slice.startFrame)}-${String(hit.slice.endFrame)}`
      : '-',
  ].join('|');
}

const eventSummary = (pattern) => (pattern.events ?? []).map(summaryOfEvent).join('~');
const eventReverseSummary = (pattern) =>
  (pattern.events ?? []).map((hit) => `${hit.id}=${jsText(hit.reverse)}`).join(',');

// -------------------------------------------------------------- shared builders

const baseSettings = (over = {}) => ({
  seed: 'wave2',
  algorithm: 'legacy-v1',
  timeSignature: '4/4',
  variation: 0,
  resolution: 4,
  lpb: 4,
  bpm: 174,
  bars: 2,
  ...over,
});

function baseHit(over = {}) {
  return {
    id: 'h1',
    role: 'kick',
    sourceId: 'kit.kick',
    baseTick: 0,
    offsetTick: 0,
    gain: 0.9,
    pan: 0,
    anchor: true,
    ghost: false,
    reason: 'Test hit.',
    ...over,
  };
}

function emitHitCase(kind, hit, extra, call, extract) {
  const fields = { ...hitFields(hit, 'e0.'), ...(extra ?? {}) };
  const outputs = {};
  try {
    const value = call(hit);
    fields.ok = '1';
    if (extract) Object.assign(outputs, extract(value));
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit(kind, fields, outputs);
}

function emitPatternCase(kind, pattern, extra, call, extract) {
  const fields = { ...patternFields(pattern), ...(extra ?? {}) };
  const outputs = {};
  try {
    const value = call(pattern);
    fields.ok = '1';
    if (extract) Object.assign(outputs, extract(value));
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit(kind, fields, outputs);
}

// ------------------------------------------------------------------- parse

// `in` is omitted for one record so the default path ("4/4") is covered too.
for (const signature of [
  undefined, '4/4', '7/8', '3/4', '5 / 16', ' 9/32 ', '1/1', '32/32', '12/8', '6/8',
  '', '0/4', '4/3', '4/4/4', '7/08', '33/4', ' 7/8', 'four/four',
]) {
  const fields = {};
  if (signature !== undefined) fields.in = signature;
  const outputs = {};
  try {
    const parsed = parseTimeSignature(signature);
    fields.ok = '1';
    outputs.n = n(parsed.numerator);
    outputs.d = n(parsed.denominator);
    outputs.beat = n(parsed.beatTicks);
    outputs.bar = n(parsed.barTicks);
    outputs.steps = n(parsed.stepsPerBar);
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('parse', fields, outputs);
}

// ------------------------------------------------------------------ groups

for (const signature of [
  undefined, '4/4', '1/4', '2/4', '3/4', '5/4', '6/4', '7/4', '3/8', '6/8', '9/8', '12/8', '13/16', '24/8', '2/2',
]) {
  const fields = {};
  if (signature !== undefined) fields.in = signature;
  const outputs = {};
  try {
    fields.ok = '1';
    outputs.groups = meterGroups(signature).join(',');
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('groups', fields, outputs);
}

// ---------------------------------------------------------------- position

for (const timeSignature of ['4/4', '7/8', '3/4']) {
  for (const quarterBeats of [0, 0.5, 1, 1.5, 3.5, 4, 7.999999, -0.25, 100.25]) {
    const settings = baseSettings({ timeSignature, bars: 2 });
    const fields = { ...settingsFields(settings), q: n(quarterBeats) };
    const outputs = {};
    try {
      const position = meterPosition(settings, quarterBeats);
      fields.ok = '1';
      outputs.bar = n(position.bar);
      outputs.beat = n(position.beat);
      outputs.fraction = n(position.fraction);
    } catch (error) {
      fields.ok = '0';
      fields.err = error.message;
    }
    emit('position', fields, outputs);
  }
}

// ------------------------------------------------------------------ timing

const timingCases = [
  { timeSignature: '4/4', bars: 2, lpb: 4 },
  { timeSignature: '7/8', bars: 2, lpb: 4 },
  { timeSignature: '7/8', bars: 3, lpb: 6 },
  { timeSignature: '12/8', bars: 4, lpb: 12 },
  { timeSignature: '3/4', bars: 1, lpb: 48 },
  { timeSignature: '2/2', bars: 2 },
  { timeSignature: '4/4', bars: 200, lpb: 96 },
  { timeSignature: '7/8', bars: 2, lpb: 3 },
  { timeSignature: '4/4', bars: 2, lpb: 0 },
];

for (const timingCase of timingCases) {
  const settings = baseSettings({ ...timingCase, lpb: timingCase.lpb ?? 4 });
  const extra = {};
  if (timingCase.lpb === undefined) extra.lpbArg = '1';
  if (timingCase.bars === 2 && timingCase.timeSignature === '4/4') extra.bpmArg = '120';
  const fields = { ...settingsFields(settings), ...extra };
  const outputs = {};
  try {
    const timing = trackerTiming(settings, extra.lpbArg === undefined ? undefined : Number(extra.lpbArg));
    fields.ok = '1';
    outputs.barTicks = n(barTicks(settings));
    outputs.ticks = n(patternTicks(settings));
    outputs.seconds = n(patternSeconds(settings, extra.bpmArg === undefined ? undefined : Number(extra.bpmArg)));
    outputs.rows = n(timing.rowsPerBar);
    outputs.lines = n(timing.lines);
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('timing', fields, outputs);
}

// ---------------------------------------------------- articulation validation

const validationCases = [
  {},
  { sourceKind: 'oneShot' },
  { sourceKind: 'slice' },
  { sourceKind: 'sample' },
  { sourceKind: 'bogus' },
  { articulation: { mode: 'natural' } },
  { articulation: { mode: 'gate' } },
  { articulation: { mode: 'chop' } },
  { articulation: { mode: 'bogus' } },
  { articulation: null },
  { articulation: 'natural' },
  { articulation: {} },
  { articulation: { mode: 'natural', durationTicks: 0 } },
  { articulation: { mode: 'gate', durationTicks: 3840 } },
  { articulation: { mode: 'gate', durationTicks: 3841 } },
  { articulation: { mode: 'gate', durationTicks: 12.5 } },
  { articulation: { mode: 'gate', chokeGroup: 'hat' } },
  { articulation: { mode: 'gate', chokeGroup: 'snare' } },
  { articulation: { mode: 'gate', chokeGroup: null } },
  { articulation: { mode: 'chop', repeats: [{}] }, ratchets: 2 },
  { articulation: { mode: 'chop', repeats: [{ gain: 1 }, { gain: 1 }] }, ratchets: 2 },
  { articulation: { mode: 'chop', repeats: Array.from({ length: 9 }, () => ({ gain: 1 })) }, ratchets: 9 },
  { articulation: { mode: 'chop', repeats: ['x'] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [null] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: 'nope' }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [] }, ratchets: 0 },
  { articulation: { mode: 'chop', repeats: [{ gain: 1.5 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ gain: 0 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ pitch: -25 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ pitch: 24 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ glide: 25 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ sourceOffset: 0.96 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ sourceOffset: 0.95 }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ reverse: 'yes' }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ reverse: true }] }, ratchets: 1 },
  { articulation: { mode: 'chop', repeats: [{ reverse: false, gain: 1 }] }, ratchets: 1 },
];

for (const overrides of validationCases) {
  hPa: {
    emitHitCase('avalid', baseHit(overrides), null, (hit) => validateArticulation(hit), null);
  }
}

// ------------------------------------------------------------ setRatchets

const setRatchetsCases = [
  { hit: {}, count: 3, rowTicks: 960 },
  { hit: {}, count: 1, rowTicks: 960 },
  { hit: { articulation: { mode: 'gate', durationTicks: 1920, chokeGroup: 'hat' } }, count: 3, rowTicks: 960 },
  { hit: { articulation: { mode: 'natural' } }, count: 3, rowTicks: 960 },
  { hit: { articulation: { mode: 'natural', durationTicks: 0 } }, count: 1, rowTicks: 480 },
  {
    hit: { articulation: { mode: 'chop', durationTicks: 1920, repeats: [{ gain: 1 }, { gain: 1 }] }, ratchets: 2 },
    count: 2,
    rowTicks: 960,
  },
  {
    hit: { articulation: { mode: 'chop', durationTicks: 1920, repeats: [{ gain: 1 }] }, ratchets: 1 },
    count: 1,
    rowTicks: 960,
  },
  { hit: { articulation: { mode: 'natural', durationTicks: 960 }, gate: 1 }, count: 1, rowTicks: 960 },
  { hit: { articulation: { mode: 'natural', durationTicks: 960 } }, count: 0, rowTicks: 960 },
  { hit: { articulation: { mode: 'chop', repeats: [{ gain: 0.5 }] } }, count: 4, rowTicks: 240 },
];

for (const item of setRatchetsCases) {
  emitHitCase(
    'asetic',
    baseHit(item.hit),
    { count: n(item.count), rowTicks: n(item.rowTicks) },
    (hit) => setRatchets(hit, item.count, item.rowTicks),
    (next) => {
      const out = { ratchets: next.ratchets === undefined ? 'undefined' : n(next.ratchets) };
      if (next.articulation) {
        out.mode = next.articulation.mode === undefined ? 'undefined' : String(next.articulation.mode);
        out.duration =
          next.articulation.durationTicks === undefined ? 'undefined' : n(next.articulation.durationTicks);
        out.repeats = next.articulation.repeats ? '1' : '0';
        out.choke = jsText(next.articulation.chokeGroup);
      }
      return out;
    },
  );
}

// ------------------------------------------------------- articulationLabel

const labelCases = [
  {},
  { articulation: { mode: 'natural' } },
  { articulation: { mode: 'chop' } },
  { articulation: { mode: 'gate' } },
  { articulation: { mode: 'gate', durationTicks: 1920 }, ratchets: 4 },
  { articulation: { mode: 'gate', durationTicks: 960 }, ratchets: 4 },
  { articulation: { mode: 'gate', durationTicks: 480 }, ratchets: 2 },
  { articulation: { mode: 'gate', durationTicks: 1440 }, ratchets: 3 },
  { articulation: { mode: 'gate', durationTicks: 3840 }, ratchets: 8 },
  { articulation: { mode: 'gate', durationTicks: 120 }, ratchets: 1 },
  { articulation: { mode: 'natural', repeats: [{ gain: 1 }, { gain: 0.5 }] }, ratchets: 2 },
  { articulation: { mode: 'natural', repeats: [{}] }, ratchets: 1 },
  { articulation: { mode: 'natural', repeats: [{ gain: 1, pitch: 2 }] }, ratchets: 1 },
  { articulation: { mode: 'natural', repeats: [{ gain: 1, glide: -2 }] }, ratchets: 1 },
  { articulation: { mode: 'natural', repeats: [{ gain: 1, reverse: true }] }, ratchets: 1 },
  { articulation: { mode: 'natural', chokeGroup: 'hat' } },
  {
    articulation: { mode: 'gate', durationTicks: 1920, repeats: [{ gain: 1, pitch: 1, reverse: true }], chokeGroup: 'hat' },
    ratchets: 2,
  },
];

for (const overrides of labelCases) {
  emitHitCase('alabel', baseHit(overrides), null, (hit) => articulationLabel(hit), (label) => ({ label }));
}

// ------------------------------------------------------------------- lanes

const lanePatterns = [
  { settings: baseSettings(), events: [] },
  {
    settings: baseSettings(),
    events: [],
    drumLanes: { kick: { name: 'Kick', visible: true, generationRole: 'kick' } },
  },
  {
    settings: baseSettings(),
    events: [],
    drumLanes: {
      kick: { name: 'Kick', visible: false, generationRole: 'kick' },
      snare: { name: 'Snare', visible: true, generationRole: 'snare' },
      hat: { name: 'Hats', visible: true },
      percussion: { name: 'Perc', visible: true, generationRole: 'hat' },
    },
  },
];

for (const pattern of lanePatterns) {
  for (const role of ROLES) {
    const fields = { ...patternFields(pattern), role };
    const outputs = {};
    try {
      const lane = drumLane(pattern, role);
      fields.ok = '1';
      outputs.name = String(lane.name ?? 'undefined');
      outputs.visible = lane.visible === false ? '0' : '1';
      outputs.genRole = jsText(lane.generationRole);
    } catch (error) {
      fields.ok = '0';
      fields.err = error.message;
    }
    emit('lane', fields, outputs);
  }
}

// ------------------------------------------------------------------- routing

const drumEvents = [
  { id: 'k1', role: 'kick', sourceId: 'kit.kick', baseTick: 0, offsetTick: 0, gain: 1, pan: 0, anchor: true, ghost: false, reason: 'Downbeat kick.' },
  { id: 'k2', role: 'kick', sourceId: 'kit.kick', baseTick: 480, offsetTick: 0, gain: 0.8, pan: 0, anchor: false, ghost: true, reason: 'Ghost kick.' },
  { id: 'k3', role: 'kick', sourceId: 'kit.kick', baseTick: 960, offsetTick: 0, gain: 0.9, pan: 0, anchor: false, ghost: false, reason: 'Off beat kick.' },
  { id: 'k4', role: 'kick', sourceId: 'kit.kick', baseTick: 1440, offsetTick: 0, gain: 0.7, pan: 0, anchor: false, ghost: true, reason: 'Late kick.' },
  { id: 's1', role: 'snare', sourceId: 'kit.snare', baseTick: 480, offsetTick: 0, gain: 1, pan: 0, anchor: true, ghost: false, reason: 'Backbeat snare.' },
  { id: 'h1', role: 'hat', sourceId: 'kit.hat', baseTick: 0, offsetTick: 0, gain: 0.7, pan: -0.2, anchor: true, ghost: false, reason: 'Closed hat.' },
];

const generatedPattern = (over = {}) => ({
  engineVersion: ENGINE_VERSION,
  ppq: PPQ,
  settings: baseSettings({ seed: 'wave2-route' }),
  events: drumEvents.map((event) => ({ ...event })),
  ...over,
});

const layoutCases = [
  { note: 'empty layout returns the generated pattern untouched', layout: {} },
  {
    note: 'one visible kick lane leaves snare and hat unroutable',
    layout: { drumLanes: { kick: { name: 'Kick', visible: true, generationRole: 'kick' } } },
  },
  {
    note: 'all four visible lanes route every hit',
    layout: {
      drumLanes: {
        kick: { name: 'Kick', visible: true, generationRole: 'kick' },
        snare: { name: 'Snare', visible: true, generationRole: 'snare' },
        hat: { name: 'Hat', visible: true, generationRole: 'hat' },
      },
    },
  },
  {
    note: 'invisible lanes are not targets',
    layout: {
      drumLanes: {
        kick: { name: 'Kick', visible: false, generationRole: 'kick' },
        snare: { name: 'Snare', visible: true, generationRole: 'snare' },
        hat: { name: 'Hat', visible: true, generationRole: 'hat' },
      },
    },
  },
  {
    note: 'a lane generation role can point at another role',
    layout: {
      drumLanes: {
        kick: { name: 'Kick', visible: true, generationRole: 'kick' },
        snare: { name: 'Snare', visible: true, generationRole: 'kick' },
        hat: { name: 'Hat', visible: true, generationRole: 'hat' },
      },
    },
  },
  {
    note: 'a custom sample track routes through routedId and admittedHits',
    layout: {
      userTracks: [
        { id: 'track-kick', name: 'Kick Bus', role: 'kick', kind: 'sample', generationRole: 'kick' },
      ],
    },
  },
  {
    note: 'a custom lane with half density keeps a deterministic subset',
    layout: {
      userTracks: [
        {
          id: 'track-kick',
          name: 'Kick Bus',
          role: 'kick',
          kind: 'sample',
          generationRole: 'kick',
          generationDensity: 0.5,
        },
      ],
    },
  },
  {
    note: 'a custom lane with zero probability drops the ranked hits',
    layout: {
      userTracks: [
        {
          id: 'track-kick',
          name: 'Kick Bus',
          role: 'kick',
          kind: 'sample',
          generationRole: 'kick',
          generationProbability: 0,
        },
      ],
    },
  },
  {
    note: 'a custom lane with half probability keeps anchors and some ranked hits',
    layout: {
      userTracks: [
        {
          id: 'track-kick',
          name: 'Kick Bus',
          role: 'kick',
          kind: 'sample',
          generationRole: 'kick',
          generationProbability: 0.5,
        },
      ],
    },
  },
  {
    note: 'custom lanes for two roles plus one built-in lane',
    layout: {
      drumLanes: { hat: { name: 'Hat', visible: true, generationRole: 'hat' } },
      userTracks: [
        { id: 'track-kick', name: 'Kick Bus', role: 'kick', kind: 'sample', generationRole: 'kick' },
        { id: 'track-snare', name: 'Snare Bus', role: 'snare', kind: 'sample', generationRole: 'snare', generationDensity: 0.75 },
      ],
    },
  },
  {
    note: 'a synth track is never a routing target',
    layout: {
      userTracks: [
        { id: 'track-synth', name: 'Bass', role: 'kick', kind: 'synth', generationRole: 'kick' },
      ],
    },
  },
  {
    note: 'a user track without a generation role is ignored',
    layout: {
      userTracks: [{ id: 'track-other', name: 'Other', role: 'kick', kind: 'sample' }],
    },
  },
];

generatedLoop: for (const layoutCase of layoutCases) {
  const generated = generatedPattern();
  const layout = layoutCase.layout;
  const fields = { ...patternFields(generated, 'g.'), ...patternFields(layout, 'y.') };
  const outputs = {};
  try {
    fields.ok = '1';
    outputs.events = eventSummary(routeGeneratedDrums(generated, layout));
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('route', fields, outputs);
}

// an event that already carries a trackId is never re-routed
{
  const generated = generatedPattern({
    events: [
      ...drumEvents.map((event) => ({ ...event })),
      {
        id: 'pre-1',
        role: 'kick',
        trackId: 'track-kick',
        sourceId: 'kit.kick',
        baseTick: 1920,
        offsetTick: 0,
        gain: 1,
        pan: 0,
        anchor: true,
        ghost: false,
        reason: 'Pre-routed hit.',
      },
    ],
  });
  const layout = {
    userTracks: [{ id: 'track-kick', name: 'Kick Bus', role: 'kick', kind: 'sample', generationRole: 'kick' }],
  };
  const fields = { ...patternFields(generated, 'g.'), ...patternFields(layout, 'y.') };
  const outputs = {};
  try {
    fields.ok = '1';
    outputs.events = eventSummary(routeGeneratedDrums(generated, layout));
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('route', fields, outputs);
}

// ------------------------------------------------------- slice instruments

const sliceInstrumentBase = {
  id: 'inst-1',
  name: 'Break A',
  assetId: 'asset-break-a',
  sampleRate: 44100,
  startFrame: 0,
  endFrame: 4410,
  slices: [
    { id: 'sl-1', note: 36, startFrame: 0, endFrame: 2205 },
    { id: 'sl-2', note: 38, startFrame: 2205, endFrame: 4410 },
  ],
};

const sliceInstrument = (over = {}) => ({
  ...sliceInstrumentBase,
  ...over,
  slices: over.slices === undefined ? sliceInstrumentBase.slices.map((slice) => ({ ...slice })) : over.slices,
});

const slicePattern = (instruments, over = {}) => ({
  engineVersion: ENGINE_VERSION,
  ppq: PPQ,
  settings: baseSettings(),
  events: [],
  sliceInstruments: instruments,
  ...over,
});

const instrumentVariants = [
  {},
  { loopFadeMs: 0 },
  { loopFadeMs: 10 },
  { loopFadeMs: 10.5 },
  { loopFadeMs: -1 },
  { name: '' },
  { name: 'x'.repeat(121) },
  { id: '' },
  { id: 'bad id' },
  { assetId: '' },
  { assetId: 'asset:break' },
  { sampleRate: 7999 },
  { sampleRate: 192001 },
  { sampleRate: 44100.5 },
  { startFrame: -1 },
  { endFrame: 0 },
  { endFrame: 4411 },
  { slices: [] },
  { slices: undefined },
  { slices: 5 },
  { slices: 'nope' },
  { slices: Array.from({ length: 121 }, (_, index) => ({ id: `sl-${index}`, note: 36, startFrame: index, endFrame: index + 1 })) },
  { slices: [{ id: '', note: 36, startFrame: 0, endFrame: 4410 }] },
  { slices: [{ id: 'sl-1', note: 120, startFrame: 0, endFrame: 4410 }] },
  { slices: [{ id: 'sl-1', note: 35.5, startFrame: 0, endFrame: 4410 }] },
  { slices: [{ id: 'bad id', note: 36, startFrame: 0, endFrame: 4410 }] },
  {
    slices: [
      { id: 'sl-1', note: 36, startFrame: 0, endFrame: 2205 },
      { id: 'sl-1', note: 38, startFrame: 2205, endFrame: 4410 },
    ],
  },
  {
    slices: [
      { id: 'sl-1', note: 36, startFrame: 0, endFrame: 2205 },
      { id: 'sl-2', note: 36, startFrame: 2205, endFrame: 4410 },
    ],
  },
  {
    slices: [
      { id: 'sl-1', note: 36, startFrame: 0, endFrame: 2205 },
      { id: 'sl-2', note: 38, startFrame: 2206, endFrame: 4410 },
    ],
  },
  { slices: [{ id: 'sl-1', note: 36, startFrame: 0, endFrame: 2205 }] },
  { slices: [{ id: 'sl-1', note: 36, startFrame: 0, endFrame: 0 }] },
  { slices: [{ id: 'sl-1', note: 36, startFrame: 0, endFrame: 4411 }] },
];

for (const over of instrumentVariants) {
  emitPatternCase('svalid', slicePattern([sliceInstrument(over)]), null, (pattern) => validateSliceInstruments(pattern), null);
}

emitPatternCase('svalid', slicePattern([]), null, (pattern) => validateSliceInstruments(pattern), null);
emitPatternCase('svalid', slicePattern(undefined), null, (pattern) => validateSliceInstruments(pattern), null);
emitPatternCase('svalid', slicePattern('nope'), null, (pattern) => validateSliceInstruments(pattern), null);
emitPatternCase(
  'svalid',
  slicePattern(Array.from({ length: 33 }, (_, index) => sliceInstrument({ id: `inst-${index}` }))),
  null,
  (pattern) => validateSliceInstruments(pattern),
  null,
);
emitPatternCase(
  'svalid',
  slicePattern([sliceInstrument(), sliceInstrument({ assetId: 'asset-break-b' })]),
  null,
  (pattern) => validateSliceInstruments(pattern),
  null,
);

// ------------------------------------------------------------------- mapping

const mappedHit = (over = {}) => ({
  id: 'h1',
  role: 'kick',
  sourceId: 'kit.kick',
  baseTick: 0,
  offsetTick: 0,
  gain: 1,
  pan: 0,
  anchor: true,
  ghost: false,
  reason: 'Mapped hit.',
  ...over,
});

const mapPattern = (hit) => slicePattern([sliceInstrument()], { events: [hit] });

const mapCases = [
  { note: 'mapped instrument is found', hit: mappedHit({ mapped: { instrumentId: 'inst-1', note: 38 } }) },
  { note: 'unknown instrument id', hit: mappedHit({ mapped: { instrumentId: 'inst-9', note: 38 } }) },
  { note: 'missing instrument id', hit: mappedHit({ mapped: { note: 38 } }) },
  { note: 'out of range mapped note', hit: mappedHit({ mapped: { instrumentId: 'inst-1', note: 120 } }) },
  { note: 'non integer mapped note', hit: mappedHit({ mapped: { instrumentId: 'inst-1', note: 37.5 } }) },
  { note: 'no mapped block at all', hit: mappedHit() },
  { note: 'mapped block is not an object', hit: mappedHit({ mapped: 'nope' }) },
];

for (const mapCase of mapCases) {
  const pattern = mapPattern(mapCase.hit);
  emitPatternCase('smap', pattern, null, (value) => mappedInstrument(value, value.events[0]), (found) => ({
    id: found ? found.id : 'undefined',
  }));
}

// ----------------------------------------------------------------- resolution

const sliceRef = { assetId: 'asset-break-a', sampleRate: 44100, startFrame: 2205, endFrame: 4410, label: 'Break A / Slice 2' };

const resolveCases = [
  { note: 'no mapped block returns the hit slice untouched', hit: mappedHit({ slice: sliceRef }) },
  { note: 'no mapped block and no slice', hit: mappedHit() },
  { note: 'mapped note resolves through the instrument', hit: mappedHit({ mapped: { instrumentId: 'inst-1', note: 36 } }) },
  { note: 'mapped note without a slice', hit: mappedHit({ mapped: { instrumentId: 'inst-1', note: 40 } }) },
];

for (const resolveCase of resolveCases) {
  const pattern = mapPattern(resolveCase.hit);
  const fields = patternFields(pattern);
  const outputs = {};
  try {
    const resolved = resolveSlice(pattern, pattern.events[0]);
    fields.ok = '1';
    outputs.ref = resolved
      ? `${resolved.assetId}|${n(resolved.startFrame)}|${n(resolved.endFrame)}|${n(resolved.sampleRate)}|${resolved.label}`
      : 'undefined';
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('sresolve', fields, outputs);
}

{
  const pattern = slicePattern([sliceInstrument()], {
    events: [
      mappedHit({ id: 'h1', mapped: { instrumentId: 'inst-1', note: 38 } }),
      mappedHit({ id: 'h2', role: 'snare', sourceId: 'kit.snare', reason: 'Plain hit.' }),
      mappedHit({ id: 'h3', slice: sliceRef, reason: 'Already sliced.' }),
    ],
  });
  emitPatternCase('sresolveall', pattern, null, (value) => resolvePatternSlices(value), (resolved) => ({
    events: eventSummary(resolved),
  }));
}

// ------------------------------------------------------------------- reverse

const reverseEvents = [
  { id: 'r1', role: 'kick', sourceId: 'kit.kick', baseTick: 0, offsetTick: 0, gain: 1, pan: 0, anchor: true, ghost: false, reason: 'Downbeat.' },
  { id: 'r2', role: 'snare', sourceId: 'kit.snare', baseTick: 480, offsetTick: 0, gain: 1, pan: 0, anchor: true, ghost: false, reason: 'Backbeat.' },
  { id: 'r3', role: 'hat', sourceId: 'kit.hat', baseTick: 240, offsetTick: 0, gain: 0.6, pan: 0, anchor: false, ghost: false, reason: 'Ghost note.', synthNote: 60 },
  { id: 'r4', role: 'percussion', sourceId: 'kit.percussion', baseTick: 720, offsetTick: 0, gain: 0.6, pan: 0.3, anchor: false, ghost: false, reason: 'Perc.', reverse: false },
];

const reverseCases = [
  { seed: 'wave2-reverse', reverseProbability: 0.5 },
  { seed: 'wave2-reverse', reverseProbability: 1 },
  { seed: 'wave2-reverse', reverseProbability: 0 },
  { seed: 'wave2-reverse' },
  { seed: 'other-seed', reverseProbability: 0.75, algorithm: 'groove-v5', variation: 3 },
  { seed: 'wave2-reverse', reverseProbability: 0.25, algorithm: undefined, variation: undefined },
  { seed: 'wave2-reverse', reverseProbability: Number.NaN },
];

for (const settingsOverride of reverseCases) {
  const settings = baseSettings(settingsOverride);
  const pattern = {
    engineVersion: ENGINE_VERSION,
    ppq: PPQ,
    settings,
    events: reverseEvents.map((event) => ({ ...event })),
  };
  const fields = patternFields(pattern);
  const outputs = {};
  try {
    applyReverseProbability(pattern.events, settings);
    fields.ok = '1';
    outputs.out = eventReverseSummary(pattern);
  } catch (error) {
    fields.ok = '0';
    fields.err = error.message;
  }
  emit('reverse', fields, outputs);
}

// -------------------------------------------------------------------- writing

const digests = CORE_MODULES.map((name) => {
  const bytes = readFileSync(join(options.distRoot, 'core', `${name}.js`));
  return `# dist/core/${name}.js ${createHash('sha256').update(bytes).digest('hex').toUpperCase()}`;
});

const header = [
  '# Breakbeat Pattern Maker - native wave-2 core fixture.',
  '# Generated by native/tests/generate-wave2-vectors.mjs - never hand-edit.',
  '# Regenerate deliberately after a core change: node native/tests/generate-wave2-vectors.mjs',
  '# Grammar: <kind>\\t<key>=<value>... ; a byte is raw iff 0x20..0x7E except "%" and TAB, else %XX (uppercase).',
  '# Expected values are read off the TypeScript engine, so a mismatch means the C++ port is wrong.',
  ...digests,
  `# records: ${records.length}`,
  '',
];

const body = `${header.concat(records).join('\n')}\n`;

if (options.check) {
  if (!existsSync(options.out)) {
    process.stderr.write(`Missing ${options.out}; run the generator without --check.\n`);
    process.exit(1);
  }
  const existing = readFileSync(options.out, 'utf8');
  if (existing === body) {
    process.stdout.write(`wave2 fixture up to date: ${records.length} records\n`);
    process.exit(0);
  }
  const existingLines = existing.split('\n');
  const bodyLines = body.split('\n');
  const mismatch = bodyLines.findIndex((line, index) => line !== existingLines[index]);
  process.stderr.write(
    `wave2 fixture is stale at line ${mismatch + 1}:\n` +
    `  tracked:   ${existingLines[mismatch] ?? '<end of file>'}\n` +
    `  generated: ${bodyLines[mismatch] ?? '<end of file>'}\n`,
  );
  process.exit(1);
}

mkdirSync(dirname(options.out), { recursive: true });
writeFileSync(options.out, body, 'utf8');

const counts = new Map();
for (const record of records) {
  const kind = record.slice(0, record.indexOf('\t'));
  counts.set(kind, (counts.get(kind) ?? 0) + 1);
}

process.stdout.write(`wrote ${options.out}\n`);
process.stdout.write(`records: ${records.length}\n`);
for (const [kind, count] of [...counts.entries()].sort()) {
  process.stdout.write(`  ${kind.padEnd(12)} ${count}\n`);
}
