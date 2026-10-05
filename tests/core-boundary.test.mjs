import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative as relativePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The portable-core boundary. src/core is the part that must be able to run
// headlessly (CLI, tests, a desktop host) and is compiled into the browser
// bundle, so it may only depend on itself: no imports from ../audio or ../ui,
// no Node builtins, and no browser, DOM or Web Audio globals.
//
// These assertions exist because the boundary is invisible to the type checker.
// It was crossed twice before (src/core/compile.ts and src/core/editor.ts both
// imported ../audio/synth-instrument.js) and nothing failed until the split was
// done by hand. This test is the thing that fails next time.

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(root, 'src');

// Deliberately excluded, each for a reason:
//   * platform-neutral in both Node and the browser — fetch, crypto,
//     performance, URL, Blob, structuredClone, TextEncoder, TextDecoder;
//   * collides with ordinary identifiers already used in src/core — `history`
//     (pattern history, arrangement history, undo history) and `location` (a
//     local tick variable at src/core/think-break.ts:62). Listing either one
//     produces nothing but false alarms, measured before writing this test.
const BROWSER_GLOBALS = [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'AudioContext', 'OfflineAudioContext', 'webkitAudioContext',
  'AudioWorkletNode', 'AudioBufferSourceNode', 'MediaRecorder', 'MediaStream',
  'HTMLElement', 'HTMLCanvasElement', 'HTMLInputElement', 'HTMLTextAreaElement',
  'HTMLSelectElement', 'HTMLButtonElement', 'HTMLDivElement', 'HTMLAudioElement',
  'HTMLImageElement', 'HTMLMediaElement',
  'CanvasRenderingContext2D', 'ImageData', 'Path2D', 'DOMParser', 'XMLSerializer',
  'XMLHttpRequest', 'WebSocket', 'EventSource', 'FileReader',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia',
  'createObjectURL', 'revokeObjectURL', 'DataTransfer',
  'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'TouchEvent',
  'DragEvent', 'ClipboardEvent', 'NodeFilter',
];

// The only sideways imports allowed anywhere in src/core, src/audio and src/ui.
// Adding an edge is a deliberate act that must be recorded here; every layer may
// always depend on src/core, and a file may always depend on its own layer.
//
// The drum-kit entry is the last remaining inversion (audio reaching into ui).
// It is the second half of M0 precondition 1 and should disappear with it.
const REVIEWED_LAYER_EDGES = [
  'src/audio/drum-kit.ts -> ../ui/rotary-knob.js',
  'src/ui/synth-patch-editor.ts -> ../audio/modular-synth.js',
  'src/ui/synth-patch-editor.ts -> ../audio/synth-instrument.js',
];

const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^[ \t]*import\s+['"]([^'"]+)['"]/gm,
];

const GLOBAL_PATTERN = new RegExp(`\\b(?:${BROWSER_GLOBALS.join('|')})\\b`, 'g');

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

function specifiersOf(source) {
  const found = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

/** Blank out comments and quoted strings without moving any offset, so that a
 *  match index still maps to the original line number. Newlines are preserved. */
function maskNonCode(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    if (c === '/' && d === '/') {
      let j = i;
      while (j < source.length && source[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && d === '*') {
      let j = i + 2;
      while (j < source.length && !(source[j] === '*' && source[j + 1] === '/')) j++;
      const end = Math.min(source.length, j + 2);
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === c) { j++; break; }
        if (source[j] === '\n') break;
        j++;
      }
      blank(i, j);
      i = j;
      continue;
    }
    i++;
  }
  return out.join('');
}

const files = walk(sourceRoot).map((file) => relativePath(root, file).split(sep).join('/'));
const sources = new Map(files.map((file) => [file, readFileSync(join(root, file), 'utf8')]));
const layerFiles = (layer) => files.filter((file) => file.startsWith(`src/${layer}/`));

function scan(scope, inspect) {
  const violations = [];
  for (const file of scope) {
    for (const hit of inspect(sources.get(file), file)) violations.push(hit);
  }
  return violations;
}

test('the boundary scan really walked the three layers', () => {
  assert.ok(layerFiles('core').length >= 35, `scanned only ${layerFiles('core').length} core files`);
  assert.ok(layerFiles('audio').length >= 20, `scanned only ${layerFiles('audio').length} audio files`);
  assert.ok(layerFiles('ui').length >= 5, `scanned only ${layerFiles('ui').length} ui files`);
  assert.ok(files.includes('src/core/model.ts') && files.includes('src/core/synth-modules.ts'));
});

test('every src/core module is free of the audio and ui layers', () => {
  const violations = scan(layerFiles('core'), (source, file) =>
    specifiersOf(source)
      .filter((specifier) => /^\.\.\/(audio|ui)\//.test(specifier))
      .map((specifier) => `${file} -> ${specifier}`));
  assert.deepEqual(violations, [], `src/core must not reach into another layer:\n${violations.join('\n')}`);
});

test('src/core imports no Node builtins', () => {
  const violations = scan(layerFiles('core'), (source, file) =>
    specifiersOf(source)
      .filter((specifier) => specifier.startsWith('node:'))
      .map((specifier) => `${file} -> ${specifier}`));
  assert.deepEqual(violations, [], `src/core must stay host-neutral:\n${violations.join('\n')}`);
});

test('src/core declares no browser, DOM or Web Audio globals', () => {
  const violations = scan(layerFiles('core'), (source, file) => {
    const masked = maskNonCode(source);
    return [...masked.matchAll(GLOBAL_PATTERN)].map((match) => {
      const line = masked.slice(0, match.index).split('\n').length;
      return `${file}:${line} uses ${match[0]}`;
    });
  });
  assert.deepEqual(violations, [], `src/core must not touch the browser:\n${violations.join('\n')}`);
});

test('cross-layer imports match the reviewed allowlist exactly', () => {
  const edges = [];
  for (const file of [...layerFiles('core'), ...layerFiles('audio'), ...layerFiles('ui')]) {
    for (const specifier of specifiersOf(sources.get(file))) {
      const target = /^\.\.\/([a-z]+)\//.exec(specifier)?.[1];
      if (!target || target === file.split('/')[1]) continue;
      if (target === 'core') continue;
      edges.push(`${file} -> ${specifier}`);
    }
  }
  assert.deepEqual([...edges].sort(), REVIEWED_LAYER_EDGES);
});
