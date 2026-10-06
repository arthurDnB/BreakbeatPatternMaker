#!/usr/bin/env node
/*
 * verify-n0-render.mjs - independent verifier for the native N0 offline render.
 *
 * It does NOT trust the app's own summary: it drives `--render` twice, hashes the
 * two WAVs, parses the RIFF container and the PCM samples with its own reader,
 * re-reads the embedded plan straight out of native/Source/Main.cpp, recomputes
 * peak/rms/frames and checks the kick/snare onset sample positions against
 * llround(tick * 60 / (bpm * ppq) * sampleRate).
 *
 * Usage:
 *   node native/tests/verify-n0-render.mjs [--exe <path>] [--scratch <dir>]
 *
 * Exit code 0 only when every check passed. No third-party dependencies.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const MAIN_CPP = path.join(REPO_ROOT, 'native', 'Source', 'Main.cpp');

// Candidate executable basenames, lowercase. `juce_add_gui_app(... PRODUCT_NAME
// "Breakbeat Pattern Maker")` names the artefact after the product name; the
// CMAKE target name is kept as a fallback in case PRODUCT_NAME is ever dropped.
const EXE_BASENAMES = new Set(['breakbeat pattern maker.exe', 'breakbeatnative.exe']);

// Onset detection for the first kick / first snare.
//
// Measured by replaying Main.cpp's renderPlan in JS (PCM16 values): the global
// peak is ~0.6195, the first kick's first four samples are 0.0136 / 0.0272 /
// 0.0408 / 0.0543, and the loudest sample in the 64 frames before the first
// snare (only the decaying first kick is sounding there) is ~0.0036. A 0.02
// threshold therefore sits between the two: the kick onset is detected at
// frame 0..1 of its schedule and the snare at its exact scheduled frame.
const ONSET_THRESHOLD = 0.02;
const ONSET_TOLERANCE = 2;
const ONSET_WINDOW = 64;

// Every check this script performs, in execution order. Any check that cannot
// run (missing exe, unparsable WAV, ...) is still reported, as a FAIL.
const CHECKS = [
  'exe located',
  'plan parsed from native/Source/Main.cpp',
  'render A exits 0',
  'render B exits 0',
  'two renders are byte-identical (sha256)',
  'wav A: RIFF/WAVE container',
  'wav A: fmt chunk is PCM/float, 2 channels, 16-bit',
  'wav A: sample rate equals the plan sampleRate',
  'wav A: frame count matches the renderPlan length math',
  'wav A: not silent (peak > 0.01)',
  'sidecar A: required keys present',
  'sidecar A: file points at run-a.wav',
  'sidecar A: bytes equals the real WAV size',
  'sidecar A: frames equals the decoded frame count',
  'sidecar A: peak matches recomputed PCM peak',
  'sidecar A: rms matches recomputed PCM rms',
  'event placement: first kick onset',
  'event placement: first snare onset',
  'default --render (no path) writes n0-render.wav in cwd',
  'default render WAV matches run A byte-for-byte',
];

// ----------------------------------------------------------------- ledger ---

const results = [];
const reported = new Set();
let wav = null;
let wavError = null;
let sidecar = null;
let sidecarError = null;
let bytesA = null;
let digestA = null;
let secondsPerTick = NaN;

function report(name, ok, detail) {
  if (reported.has(name)) return;
  reported.add(name);
  results.push({ name, ok });
  const body = String(detail ?? '');
  const lines = body.split('\n');
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} - ${lines[0]}`);
  for (const line of lines.slice(1)) console.log(`        ${line}`);
}

function check(name, fn) {
  try {
    report(name, true, fn());
  } catch (err) {
    report(name, false, err instanceof Error ? err.message : String(err));
  }
}

function abortRemaining(reason) {
  for (const name of CHECKS) if (!reported.has(name)) report(name, false, `not run: ${reason}`);
}

function info(text) {
  console.log(`INFO  ${text}`);
}

// Precondition guards: a check whose input is missing fails with the recorded
// reason instead of being skipped.
function needWav() {
  if (!wav) throw new Error(`WAV A did not parse: ${wavError ?? 'reason not recorded'}`);
  return wav;
}

function needSidecar() {
  if (!sidecar) throw new Error(`sidecar A could not be read: ${sidecarError ?? 'reason not recorded'}`);
  return sidecar;
}

// ------------------------------------------------------------------- utils ---

const num = (x, digits = 6) => (Number.isFinite(x) ? Number(x).toFixed(digits) : 'n/a');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

function quoteStream(text) {
  const t = oneLine(text);
  return t.length === 0 ? '(empty)' : `"${t.length > 400 ? `${t.slice(0, 400)}...` : t}"`;
}

function describeRun(run, label) {
  const bits = [`exit code ${run.status === null ? 'none' : run.status}`];
  if (run.signal) bits.push(`signal ${run.signal}`);
  if (run.error) bits.push(`spawn error: ${run.error}`);
  bits.push(`${label} stdout ${quoteStream(run.stdout)}`, `stderr ${quoteStream(run.stderr)}`);
  return bits.join('; ');
}

function runRender(exe, cwd, args) {
  const res = spawnSync(exe, args, { cwd, encoding: 'utf8', timeout: 60000, windowsHide: true });
  return {
    status: res.status,
    signal: res.signal,
    error: res.error ? String(res.error.message) : null,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    args: [exe, ...args].join(' '),
    cwd,
  };
}

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out;
}

function findExe(explicit) {
  const tried = [];
  if (explicit) {
    const resolved = path.resolve(explicit);
    tried.push(resolved);
    if (existsSync(resolved) && statSync(resolved).isFile()) return { exe: resolved, tried };
    return { exe: null, tried };
  }

  // The CMake target is `BreakbeatNative`, but `juce_add_gui_app(... PRODUCT_NAME
  // "Breakbeat Pattern Maker")` names the executable after the product, so the
  // artefact on disk is "Breakbeat Pattern Maker.exe". Accept either spelling.
  const artefactDir = path.join(REPO_ROOT, 'native', 'build', 'BreakbeatNative_artefacts');
  const preferred = [
    path.join(artefactDir, 'Release', 'Breakbeat Pattern Maker.exe'),
    path.join(artefactDir, 'Breakbeat Pattern Maker.exe'),
    path.join(artefactDir, 'Release', 'BreakbeatNative.exe'),
    path.join(artefactDir, 'BreakbeatNative.exe'),
  ];
  for (const candidate of preferred) {
    tried.push(candidate);
    if (existsSync(candidate)) return { exe: candidate, tried };
  }

  const buildDir = path.join(REPO_ROOT, 'native', 'build');
  const matches = existsSync(buildDir)
    ? walkFiles(buildDir).filter((f) => EXE_BASENAMES.has(path.basename(f).toLowerCase()))
    : [];
  matches.sort((a, b) => {
    const rank = (p) => (p.toLowerCase().includes(`${path.sep}release${path.sep}`) ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  for (const match of matches) tried.push(match);
  return { exe: matches[0] ?? null, tried };
}

// ------------------------------------------------- plan (read from Main.cpp) ---

function readEmbeddedPlan() {
  const source = readFileSync(MAIN_CPP, 'utf8');

  const literal = /R"PLAN\(([\s\S]*?)\)PLAN"/.exec(source);
  if (!literal) throw new Error(`could not find the R"PLAN( ... )PLAN" literal in ${MAIN_CPP}`);
  let parsed;
  try {
    parsed = JSON.parse(literal[1]);
  } catch (err) {
    throw new Error(`the embedded plan JSON in ${MAIN_CPP} did not parse: ${err.message}`);
  }

  const timeline = parsed.timeline;
  if (!timeline || typeof timeline !== 'object') throw new Error('the embedded plan has no timeline object');
  const tempo = Array.isArray(timeline.tempoEvents) ? timeline.tempoEvents[0] : null;
  if (!tempo) throw new Error('the embedded plan has no tempoEvents[0]');

  const tailMatch = /kTailSeconds\s*=\s*([0-9]*\.?[0-9]+)/.exec(source);
  const events = (Array.isArray(parsed.events) ? parsed.events : []).map((e) => ({
    tick: Number(e.tick),
    gain: Number(e.gain),
    note: Number(e.source?.note),
  }));
  if (events.length === 0) throw new Error('the embedded plan has no events');

  // Main.cpp renders note <= 36 as a kick and everything else as a snare.
  const firstOf = (predicate, what) => {
    const found = events.find(predicate);
    if (!found) throw new Error(`the embedded plan has no ${what} event`);
    return found;
  };

  return {
    bpm: Number(tempo.bpm),
    ppq: Number(timeline.ppq),
    sampleRate: Number(timeline.sampleRate),
    tailSeconds: tailMatch ? Number(tailMatch[1]) : null,
    events,
    totalTicks: events.reduce((max, e) => Math.max(max, e.tick), 0),
    firstKick: firstOf((e) => e.note <= 36, 'kick (note <= 36)'),
    firstSnare: firstOf((e) => e.note > 36, 'snare (note > 36)'),
  };
}

// ---------------------------------------------------------------- RIFF reader ---

export function readWav(bytes) {
  const ascii = (off, len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[off + i]);
    return s;
  };
  if (bytes.length < 12) throw new Error(`file is only ${bytes.length} bytes - too short for a RIFF header`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const riff = ascii(0, 4);
  if (riff !== 'RIFF') throw new Error(`expected "RIFF" at offset 0, found "${riff}"`);
  const wave = ascii(8, 4);
  if (wave !== 'WAVE') throw new Error(`expected "WAVE" at offset 8, found "${wave}"`);
  const riffSize = view.getUint32(4, true);

  let fmt = null;
  let data = null;
  const chunkIds = [];
  let off = 12;
  while (off + 8 <= bytes.length) {
    const id = ascii(off, 4);
    const size = view.getUint32(off + 4, true);
    const body = off + 8;
    chunkIds.push(`${JSON.stringify(id)} size ${size}`);
    if (id === 'fmt ') {
      if (size < 16) throw new Error(`"fmt " chunk is only ${size} bytes`);
      fmt = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        byteRate: view.getUint32(body + 8, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      data = { offset: body, size };
      break;
    }
    off = body + size + (size & 1); // chunks are word aligned
  }

  if (!fmt) throw new Error(`no "fmt " chunk (chunks seen: ${chunkIds.join(', ') || 'none'})`);
  if (!data) throw new Error(`no "data" chunk (chunks seen: ${chunkIds.join(', ')})`);
  if (data.offset + data.size > bytes.length) {
    throw new Error(`"data" claims ${data.size} bytes but only ${bytes.length - data.offset} remain (truncated file)`);
  }
  if (!fmt.blockAlign) throw new Error(`fmt blockAlign is 0`);

  const pcm = fmt.audioFormat === 1 && [8, 16, 24, 32].includes(fmt.bitsPerSample);
  const float = fmt.audioFormat === 3 && [32, 64].includes(fmt.bitsPerSample);
  if (!pcm && !float) {
    throw new Error(`unsupported encoding: audioFormat ${fmt.audioFormat} (1 = PCM, 3 = float), ${fmt.bitsPerSample}-bit, ${fmt.channels} channels`);
  }

  const bytesPerSample = fmt.bitsPerSample / 8;
  const frames = Math.floor(data.size / fmt.blockAlign);
  // NB: keep the decoded arrays out of `channels` - that key holds the channel
  // *count* from the fmt chunk.
  const channelData = [];
  for (let c = 0; c < fmt.channels; c++) channelData.push(new Float64Array(frames));

  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < fmt.channels; c++) {
      const o = data.offset + f * fmt.blockAlign + c * bytesPerSample;
      let v;
      if (fmt.audioFormat === 3) v = fmt.bitsPerSample === 32 ? view.getFloat32(o, true) : view.getFloat64(o, true);
      else if (fmt.bitsPerSample === 8) v = (view.getUint8(o) - 128) / 128;
      else if (fmt.bitsPerSample === 16) v = view.getInt16(o, true) / 32768;
      else if (fmt.bitsPerSample === 24) {
        const raw = view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getInt8(o + 2) << 16);
        v = raw / 8388608;
      } else v = view.getInt32(o, true) / 2147483648;
      channelData[c][f] = v;
    }
  }

  let peak = 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(channel[i]));
  // juce::AudioBuffer::getRMSLevel (0, 0, frames) is channel 0.
  let sumSquares = 0;
  const channel0 = channelData[0];
  for (let i = 0; i < frames; i++) sumSquares += channel0[i] * channel0[i];
  const rms = frames > 0 ? Math.sqrt(sumSquares / frames) : 0;

  return { riffSize, chunks: chunkIds, ...fmt, dataOffset: data.offset, dataSize: data.size, frames, channelData, peak, rms };
}

// ------------------------------------------------------------- sidecar reader ---

function readSidecarFile(text) {
  const kv = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s?(.*)$/.exec(rawLine);
    if (match) kv[match[1]] = match[2].trim();
  }
  return kv;
}

function fileSizeOf(file) {
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  return statSync(file).size;
}

function firstOnset(channel, expected, threshold, window) {
  const lo = Math.max(0, expected - window);
  const hi = Math.min(channel.length - 1, expected + window);
  let preMax = NaN;
  if (expected > lo) {
    preMax = 0;
    for (let i = lo; i < Math.min(expected, channel.length); i++) preMax = Math.max(preMax, Math.abs(channel[i]));
  }
  let onset = -1;
  for (let i = lo; i <= hi; i++) {
    if (Math.abs(channel[i]) > threshold) {
      onset = i;
      break;
    }
  }
  return { onset, preMax, lo, hi };
}

// ----------------------------------------------------------------- ceremony ---

function usage() {
  console.log(`Usage: node native/tests/verify-n0-render.mjs [options]

Options:
  --exe <path>      use this BreakbeatNative.exe instead of searching native/build/
  --scratch <dir>   directory for the rendered WAVs (default: test-results/native-n0/)
  -h, --help        show this help

Renders the embedded N0 plan twice, then verifies determinism, the RIFF/WAVE
container, the .txt sidecar and the event onset sample positions. Exit code 0
only when every check passes.`);
}

function parseArgs(argv) {
  const opts = { exe: null, scratch: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--exe' || arg === '--scratch') {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      opts[arg === '--exe' ? 'exe' : 'scratch'] = value;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new Error(`unknown argument "${arg}"`);
    }
  }
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`ERROR  ${err.message}`);
    usage();
    return 2;
  }
  if (opts.help) {
    usage();
    return 0;
  }

  const scratch = path.resolve(opts.scratch ?? path.join(REPO_ROOT, 'test-results', 'native-n0'));
  mkdirSync(scratch, { recursive: true });

  console.log('N0 native render verifier');
  console.log(`  node:      ${process.version}`);
  console.log(`  repo root: ${REPO_ROOT}`);
  console.log(`  scratch:   ${scratch}`);
  console.log('');

  // 1. the executable --------------------------------------------------------
  const { exe, tried } = findExe(opts.exe);
  if (!exe) {
    report('exe located', false, `no BreakbeatNative.exe found. Tried:\n${tried.map((p) => `  ${p}`).join('\n')}`);
    abortRemaining('BreakbeatNative.exe was not found');
    return finish();
  }
  report('exe located', true, exe);

  // 2. the plan, straight out of Main.cpp ------------------------------------
  let plan = null;
  check('plan parsed from native/Source/Main.cpp', () => {
    plan = readEmbeddedPlan();
    secondsPerTick = 60.0 / (plan.bpm * plan.ppq);
    return `${plan.bpm} BPM, ppq ${plan.ppq}, ${plan.sampleRate} Hz, ${plan.events.length} events, ${plan.totalTicks} ticks, `
      + `tail ${plan.tailSeconds ?? 'unreadable'} s, secondsPerTick ${secondsPerTick}; `
      + `first kick tick ${plan.firstKick.tick} (note ${plan.firstKick.note}), first snare tick ${plan.firstSnare.tick} (note ${plan.firstSnare.note})`;
  });
  if (!plan) {
    abortRemaining('the embedded plan could not be read from native/Source/Main.cpp');
    return finish();
  }

  // 3. two renders -----------------------------------------------------------
  const wavA = path.join(scratch, 'run-a.wav');
  const wavB = path.join(scratch, 'run-b.wav');
  const sidecarA = path.join(scratch, 'run-a.txt');
  const defaultWav = path.join(scratch, 'n0-render.wav');
  for (const stale of [wavA, wavB, sidecarA, path.join(scratch, 'run-b.txt'), defaultWav, path.join(scratch, 'n0-render.txt')]) {
    rmSync(stale, { force: true });
  }

  const runA = runRender(exe, scratch, ['--render', 'run-a.wav']);
  check('render A exits 0', () => {
    if (runA.status !== 0) throw new Error(describeRun(runA, 'run-a.wav'));
    return `${describeRun(runA, 'run-a.wav')}; wrote ${existsSync(wavA) ? `${fileSizeOf(wavA)} bytes to ${wavA}` : `nothing to ${wavA}`}`;
  });

  const runB = runRender(exe, scratch, ['--render', 'run-b.wav']);
  check('render B exits 0', () => {
    if (runB.status !== 0) throw new Error(describeRun(runB, 'run-b.wav'));
    return `${describeRun(runB, 'run-b.wav')}; wrote ${existsSync(wavB) ? `${fileSizeOf(wavB)} bytes` : `nothing at ${wavB}`}`;
  });

  info(`render A stdout ${quoteStream(runA.stdout)}`);
  info(`render B stdout ${quoteStream(runB.stdout)}`);
  info('note: printf output may be missing above - Main.cpp calls AttachConsole(ATTACH_PARENT_PROCESS) and freopens CONOUT$, '
    + 'which sends a GUI app\'s stdout to the parent console instead of our pipe. The .txt sidecar is the authoritative summary.');

  try {
    bytesA = readFileSync(wavA);
  } catch {
    bytesA = null;
  }
  let bytesB = null;
  try {
    bytesB = readFileSync(wavB);
  } catch {
    bytesB = null;
  }
  digestA = bytesA ? sha256(bytesA) : null;
  const digestB = bytesB ? sha256(bytesB) : null;

  check('two renders are byte-identical (sha256)', () => {
    if (!bytesA || !bytesB) throw new Error(`missing render output (run-a.wav: ${bytesA ? 'ok' : 'missing'}, run-b.wav: ${bytesB ? 'ok' : 'missing'})`);
    if (digestA !== digestB) throw new Error(`sha256 differs: run-a.wav ${digestA}, run-b.wav ${digestB}`);
    return `run-a.wav ${digestA}\nrun-b.wav ${digestB}\nidentical: yes`;
  });
  if (digestA) info(`sha256 run-a.wav ${digestA}`);
  if (digestB) info(`sha256 run-b.wav ${digestB}`);

  // 4. the container, decoded by us ------------------------------------------
  check('wav A: RIFF/WAVE container', () => {
    if (!bytesA) throw new Error(`${wavA} was not written`);
    try {
      wav = readWav(bytesA);
    } catch (err) {
      wavError = err instanceof Error ? err.message : String(err);
      throw new Error(wavError);
    }
    return `${bytesA.length} bytes, RIFF size ${wav.riffSize}, chunks: ${wav.chunks.join(', ')}, data at ${wav.dataOffset} (${wav.dataSize} bytes)`;
  });

  check('wav A: fmt chunk is PCM/float, 2 channels, 16-bit', () => {
    needWav();
    const formatName = wav.audioFormat === 1 ? 'PCM (1)' : wav.audioFormat === 3 ? 'IEEE float (3)' : `${wav.audioFormat} (not PCM/float)`;
    if (wav.audioFormat !== 1 && wav.audioFormat !== 3) throw new Error(`audioFormat is ${wav.audioFormat}, expected 1 (PCM) or 3 (float)`);
    if (wav.channels !== 2) throw new Error(`channels is ${wav.channels}, expected 2`);
    if (wav.bitsPerSample !== 16) throw new Error(`bitsPerSample is ${wav.bitsPerSample}, expected 16`);
    return `audioFormat ${formatName}, ${wav.channels} channels, ${wav.bitsPerSample}-bit, blockAlign ${wav.blockAlign}, byteRate ${wav.byteRate}`;
  });

  check('wav A: sample rate equals the plan sampleRate', () => {
    needWav();
    if (wav.sampleRate !== plan.sampleRate) throw new Error(`wav ${wav.sampleRate} Hz != plan ${plan.sampleRate} Hz`);
    return `${wav.sampleRate} Hz == plan timeline.sampleRate ${plan.sampleRate} Hz`;
  });

  check('wav A: frame count matches the renderPlan length math', () => {
    needWav();
    if (plan.tailSeconds === null) throw new Error(`could not read kTailSeconds from ${MAIN_CPP}`);
    const expected = Math.ceil((plan.totalTicks * secondsPerTick + plan.tailSeconds) * plan.sampleRate) + 1;
    if (wav.frames !== expected) throw new Error(`decoded ${wav.frames} frames != ceil((${plan.totalTicks} ticks * ${secondsPerTick} s + ${plan.tailSeconds} s tail) * ${plan.sampleRate} Hz) + 1 = ${expected}`);
    return `${wav.frames} frames == ceil((${plan.totalTicks} * ${num(secondsPerTick, 12)} + ${plan.tailSeconds}) * ${plan.sampleRate}) + 1`;
  });

  check('wav A: not silent (peak > 0.01)', () => {
    needWav();
    if (!(wav.peak > 0.01)) throw new Error(`recomputed peak is ${num(wav.peak, 8)}, which is not > 0.01`);
    return `recomputed peak ${num(wav.peak, 8)} > 0.01 (rms ${num(wav.rms, 8)})`;
  });

  // 5. the app's own sidecar -------------------------------------------------
  check('sidecar A: required keys present', () => {
    if (!existsSync(sidecarA)) {
      sidecarError = `${sidecarA} was not written`;
      throw new Error(sidecarError);
    }
    try {
      sidecar = readSidecarFile(readFileSync(sidecarA, 'utf8'));
    } catch (err) {
      sidecarError = `could not read ${sidecarA}: ${err instanceof Error ? err.message : String(err)}`;
      throw new Error(sidecarError);
    }
    const missing = ['frames', 'peak', 'rms', 'file', 'bytes'].filter((key) => !(key in sidecar));
    if (missing.length > 0) throw new Error(`missing key(s) ${missing.join(', ')}; keys present: ${Object.keys(sidecar).join(', ')}`);
    return `keys ${Object.keys(sidecar).join(', ')}; frames=${sidecar.frames} peak=${sidecar.peak} rms=${sidecar.rms} bytes=${sidecar.bytes}`;
  });

  check('sidecar A: file points at run-a.wav', () => {
    if (!sidecar) throw new Error(needSidecar());
    const same = path.resolve(sidecar.file).toLowerCase() === path.resolve(wavA).toLowerCase();
    if (!same) throw new Error(`sidecar file "${sidecar.file}" != ${wavA}`);
    return sidecar.file;
  });

  check('sidecar A: bytes equals the real WAV size', () => {
    if (!sidecar) throw new Error(needSidecar());
    const real = fileSizeOf(wavA);
    const claimed = Number(sidecar.bytes);
    if (claimed !== real) throw new Error(`sidecar bytes ${sidecar.bytes} != actual file size ${real}`);
    return `sidecar bytes ${claimed} == ${real} on disk`;
  });

  check('sidecar A: frames equals the decoded frame count', () => {
    if (!sidecar) throw new Error(needSidecar());
    needWav();
    const claimed = Number(sidecar.frames);
    if (claimed !== wav.frames) throw new Error(`sidecar frames ${sidecar.frames} != decoded ${wav.frames}`);
    return `sidecar frames ${claimed} == decoded ${wav.frames} (data ${wav.dataSize} bytes / blockAlign ${wav.blockAlign})`;
  });

  check('sidecar A: peak matches recomputed PCM peak', () => {
    if (!sidecar) throw new Error(needSidecar());
    needWav();
    const claimed = Number(sidecar.peak);
    if (!Number.isFinite(claimed)) throw new Error(`sidecar peak "${sidecar.peak}" is not a number`);
    const delta = Math.abs(claimed - wav.peak);
    if (delta > 1e-3) throw new Error(`sidecar peak ${claimed} vs recomputed ${num(wav.peak, 8)}: delta ${num(delta, 8)} > 1e-3`);
    return `sidecar ${num(claimed, 8)} vs recomputed ${num(wav.peak, 8)}: delta ${num(delta, 9)} <= 1e-3`;
  });

  check('sidecar A: rms matches recomputed PCM rms', () => {
    if (!sidecar) throw new Error(needSidecar());
    needWav();
    const claimed = Number(sidecar.rms);
    if (!Number.isFinite(claimed)) throw new Error(`sidecar rms "${sidecar.rms}" is not a number`);
    const delta = Math.abs(claimed - wav.rms);
    if (delta > 1e-3) throw new Error(`sidecar rms ${claimed} vs recomputed ${num(wav.rms, 8)}: delta ${num(delta, 8)} > 1e-3`);
    return `sidecar ${num(claimed, 8)} vs recomputed ${num(wav.rms, 8)}: delta ${num(delta, 9)} <= 1e-3`;
  });

  // 6. event placement -------------------------------------------------------
  for (const [label, event] of [['kick', plan.firstKick], ['snare', plan.firstSnare]]) {
    check(`event placement: first ${label} onset`, () => {
      needWav();
      const expected = Math.round(event.tick * secondsPerTick * plan.sampleRate);
      const found = firstOnset(wav.channelData[0], expected, ONSET_THRESHOLD, ONSET_WINDOW);
      const preMax = Number.isNaN(found.preMax) ? 'n/a (window starts at frame 0)' : num(found.preMax, 8);
      if (found.onset < 0) {
        throw new Error(`no sample in [${found.lo}, ${found.hi}] exceeded ${ONSET_THRESHOLD} (expected onset frame ${expected}); pre-onset max |v| ${preMax}`);
      }
      const delta = found.onset - expected;
      if (Math.abs(delta) > ONSET_TOLERANCE) {
        throw new Error(`detected frame ${found.onset}, expected ${expected} (delta ${delta}, tolerance +/-${ONSET_TOLERANCE}); threshold ${ONSET_THRESHOLD}, pre-onset max |v| ${preMax}`);
      }
      return `note ${event.note}, tick ${event.tick} -> llround(${event.tick} * ${num(secondsPerTick, 12)} s/tick * ${plan.sampleRate} Hz) = frame ${expected}, `
        + `detected ${found.onset} (delta ${delta}, tolerance +/-${ONSET_TOLERANCE}; threshold ${ONSET_THRESHOLD}, pre-onset max |v| ${preMax})`;
    });
  }

  // 7. the no-argument default ----------------------------------------------
  const runDefault = runRender(exe, scratch, ['--render']);
  check('default --render (no path) writes n0-render.wav in cwd', () => {
    if (runDefault.status !== 0) throw new Error(describeRun(runDefault, 'n0-render.wav'));
    if (!existsSync(defaultWav)) throw new Error(`exit code 0 but ${defaultWav} was not created (cwd was ${scratch}); ${describeRun(runDefault, 'n0-render.wav')}`);
    const size = fileSizeOf(defaultWav);
    if (size === 0) throw new Error(`${defaultWav} is empty`);
    readWav(readFileSync(defaultWav)); // throws if it is not a valid WAV
    return `cwd ${scratch}, created n0-render.wav (${size} bytes, parses as RIFF/WAVE); ${describeRun(runDefault, 'n0-render.wav')}`;
  });

  check('default render WAV matches run A byte-for-byte', () => {
    if (!digestA) throw new Error('run-a.wav was not readable');
    if (!existsSync(defaultWav)) throw new Error(`${defaultWav} was not created`);
    const digestDefault = sha256(readFileSync(defaultWav));
    if (digestDefault !== digestA) throw new Error(`n0-render.wav ${digestDefault} != run-a.wav ${digestA}`);
    return `n0-render.wav ${digestDefault} == run-a.wav ${digestA}`;
  });

  return finish();
}

function finish() {
  for (const name of CHECKS) if (!reported.has(name)) report(name, false, 'not run: the verifier returned early');
  const failed = results.filter((r) => !r.ok).length;
  const passed = results.length - failed;
  console.log('');
  console.log(`SUMMARY: ${passed}/${results.length} checks passed, ${failed} failed`);
  console.log(`RESULT: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  return failed === 0 ? 0 : 1;
}

const isMain = process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(`FAIL  verifier crashed - ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    process.exitCode = 1;
  }
}
