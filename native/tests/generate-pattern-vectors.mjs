#!/usr/bin/env node
// Generates the wave-3 whole-pattern acceptance fixture for the native (C++/JUCE)
// port: native/tests/vectors/patterns.txt
//
//   node native/tests/generate-pattern-vectors.mjs [--dist-root <path>] [--out <path>]
//                                                  [--no-copy] [--check] [--help]
//
// Why this file exists
// --------------------
// docs/NATIVE-PORT-PLAN.md:221-259 makes determinism the acceptance test for every
// ported wave, and docs/M1-RENDER-PLAN-CONTRACT.md:60-69 pins the contract to the
// TEXT of JSON.stringify(pattern) - JSON member order and ECMAScript number
// formatting included. The frozen F-DET matrix (scripts/engine-determinism-fixture.mjs
// -> tests/fixtures/determinism-matrix.json) only stores sha256 digests, which cannot
// tell a C++ port WHICH byte diverged. This script records the 44 frozen cases as
// whole JSON texts instead, so a ported engine can be diffed byte for byte. No case is
// re-derived here: F_DET_CASES / fdetSettings come from the frozen script itself.
//
// Where the engine comes from
// ---------------------------
// Never from a live dist/ that another process may be rewriting. By default this
// script (1) re-copies dist/ to the gitignored test-results/dist-snapshot/ and
// (2) installs an ESM resolve hook that aliases <repo>/dist/ to that snapshot, so the
// frozen fixture and the generator are both loaded from the snapshot bytes. Module
// identity is asserted afterwards (the aliased import and a direct snapshot import must
// be the same module), so a silently ignored hook is a hard failure, never a quiet
// fallback to the live dist/.
//
// Format (identical conventions to native/tests/generate-vectors.mjs)
// ------------------------------------------------------------------
//   '#' lines are section headers, blank lines are separators.
//   Every other non-empty line is:  name<TAB>value
//   name is a ';'-separated list of k=v pairs; the first field is the kind.
//   Both fields are ASCII: bytes outside 0x20..0x7E, '%' (0x25) and TAB (0x09)
//   become %XX with UPPERCASE hex. Decoding is the exact inverse: %XX -> raw byte,
//   anything else copied verbatim; the raw bytes are UTF-8.
//
// Record vocabulary (one 3-part record per case, blank-line separated)
// -------------------------------------------------------------------
//   case;id=<id>;source=matrix|synthetic;axes=<a+b>;genre=..;algorithm=..;seed=..
//        ;engineVersion=..;ppq=..;eventCount=..
//       value = sha256 of the JSON text (hex)
//   settings;case=<id>;knobs=<n>;sha256=<hex of the JSON>
//       value = compact JSON.stringify(settings), member order preserved
//   setting;case=<id>;key=<knob>;type=<string|number|boolean|null|undefined>[;integer=..]
//       value = ECMAScript String(value)
//   setting;case=<id>;key=<knob>;type=array|object;size=count
//       value = member count (the existing size=count convention)
//   setting;case=<id>;key=<knob>;type=element;index=<i>;etype=<type>[;einteger=..]
//   setting;case=<id>;key=<knob>;type=member;member=<m>;mtype=<type>[;minteger=..]
//       value = the element / member value; etype|mtype=json means the value is
//       compact JSON (no shipped case needs it)
//   pattern;case=<id>;sha256=<hex>;bytes=<n>
//       value = the exact JSON.stringify(pattern) text, %XX-escaped
//
// sha256 is always taken over the RAW UTF-8 bytes of the JSON text, never over the
// escaped form. The output contains no timestamps, no absolute paths and no
// environment-dependent ordering, so the file bytes are reproducible.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(scriptPath);
const nativeDir = path.resolve(testsDir, "..");
const repoRoot = path.resolve(nativeDir, "..");

const defaultOutPath = path.join(testsDir, "vectors", "patterns.txt");
const scratchRoot = path.join(repoRoot, "test-results");
const snapshotDir = path.join(scratchRoot, "dist-snapshot");
const viewDistDir = path.join(repoRoot, "dist"); // what the fixture asks for
const fixturePath = path.join(repoRoot, "scripts", "engine-determinism-fixture.mjs");
const compatFixturePath = path.join(repoRoot, "scripts", "engine-compatibility-fixture.mjs");
const matrixPath = path.join(repoRoot, "tests", "fixtures", "determinism-matrix.json");

// Small, human-readable cases. The engine flavour (bars/resolution/complexity/...) is
// the frozen F_DET_FLAVOR, so these differ from the matrix cases only in the knobs
// named in axes. They are pinned by this file alone - they are NOT matrix cases.
const SMALL_CASES = [
  { id: "small-1bar-1lane-legacy-v1", genre: "jungle", algorithm: "legacy-v1", seed: "a", overrides: { bars: 1, enabledRoles: ["kick"] }, axes: ["bars", "enabledRoles"] },
  { id: "small-1bar-1lane-groove-v5", genre: "jungle", algorithm: "groove-v5", seed: "a", overrides: { bars: 1, enabledRoles: ["kick"] }, axes: ["bars", "enabledRoles"] },
  { id: "small-1bar-2lane-groove-v5", genre: "jungle", algorithm: "groove-v5", seed: "a", overrides: { bars: 1, enabledRoles: ["kick", "snare"] }, axes: ["bars", "enabledRoles"] },
];

const NUMBER_FORMAT_EXAMPLES = [
  "1", "1.0", "0.5", "0.50", "0.3333333333333333", "1e21", "-0", "1e-7", "0", "120", "165", "0.7300000000000001",
];

const TOLERANCES = [
  ["maxNormalizedSampleError", "max absolute error 1e-5 (float/linear)"],
  ["pcm16Golden", "byte-identical, else float sidecar; PCM16 LSB 3.0518e-5 cannot express 1e-5"],
  ["onsetPosition", "+/-1 frame at >= 44100 Hz, +/-2 frames at 8000 Hz"],
  ["peak", "absolute error 1e-4"],
  ["rms", "relative 1e-3 with 1e-4 absolute floor"],
  ["per100msWindow", "absolute error 2e-3"],
  ["dcOffset", "absolute error 1e-5"],
  ["stereoCorrelation", "absolute error 1e-3"],
  ["spectral", "4096-pt Hann: 1e-2 per bin, 0.25 dB aggregate"],
  ["truePeak", "absolute error 1e-3"],
  ["clippedSampleCount", "identical"],
];

const POLICIES = [
  ["gainErrors", "gain errors must never be normalized away"],
  ["nonSilence", "non-silence is not evidence of parity"],
];

function fail(message) {
  console.error(`generate-pattern-vectors: ${message}`);
  process.exit(1);
}

function usage() {
  return [
    "usage: node native/tests/generate-pattern-vectors.mjs [options]",
    "",
    "  --dist-root <path>  load the engine from this root instead of refreshing",
    "                      test-results/dist-snapshot/ from dist/ (no copy is made;",
    "                      relative paths resolve against the repository root)",
    "  --no-copy           reuse the existing test-results/dist-snapshot/ as-is",
    "  --out <path>        write the fixture somewhere else (default:",
    "                      native/tests/vectors/patterns.txt)",
    "  --check             do not write; fail if the file on disk differs byte for byte",
    "  --help              print this text",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { distRoot: null, out: defaultOutPath, copy: true, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const equals = arg.indexOf("=");
    const name = equals < 0 ? arg : arg.slice(0, equals);
    const inlineValue = equals < 0 ? null : arg.slice(equals + 1);
    const take = (label) => {
      if (inlineValue !== null && inlineValue !== "") return inlineValue;
      i += 1;
      if (i >= argv.length) fail(`${label} needs a value`);
      return argv[i];
    };
    switch (name) {
      case "--dist-root":
        options.distRoot = path.resolve(repoRoot, take(name));
        break;
      case "--out":
        options.out = path.resolve(repoRoot, take(name));
        break;
      case "--no-copy":
        options.copy = false;
        break;
      case "--check":
        options.check = true;
        break;
      case "--help":
        console.log(usage());
        process.exit(0);
        break;
      default:
        fail(`unknown option "${arg}"\n${usage()}`);
    }
  }
  if (options.distRoot !== null && !options.copy) fail("--dist-root and --no-copy are mutually exclusive");
  return options;
}

// ---------------------------------------------------------------------------
// 1. Freeze the engine bytes for this run
// ---------------------------------------------------------------------------

function refreshSnapshot() {
  const liveGenerate = path.join(viewDistDir, "core", "generate.js");
  if (!existsSync(liveGenerate)) fail(`missing ${path.relative(repoRoot, liveGenerate)} - build first, or pass --dist-root / --no-copy`);
  const resolved = path.resolve(snapshotDir);
  if (!resolved.startsWith(path.resolve(scratchRoot) + path.sep)) {
    fail(`refusing to delete ${resolved}: it is outside ${path.relative(repoRoot, scratchRoot)}/`);
  }
  rmSync(resolved, { recursive: true, force: true });
  cpSync(path.join(viewDistDir), resolved, { recursive: true });
  return resolved;
}

function resolveDistRoot(options) {
  if (options.distRoot !== null) return { root: options.distRoot, how: "--dist-root" };
  if (options.copy) return { root: refreshSnapshot(), how: "copied from dist/" };
  if (!existsSync(path.join(snapshotDir, "core", "generate.js"))) fail(`--no-copy but ${path.relative(repoRoot, snapshotDir)} has no core/generate.js`);
  return { root: path.resolve(snapshotDir), how: "reused snapshot (--no-copy)" };
}

// ---------------------------------------------------------------------------
// 2. Alias <repo>/dist/ to the frozen root
// ---------------------------------------------------------------------------

async function installDistAlias(realRoot) {
  const real = pathToFileURL(realRoot + path.sep).href;
  const view = pathToFileURL(viewDistDir + path.sep).href;
  if (real === view) return "identity (dist-root is dist/)";

  const moduleApi = await import("node:module");
  if (typeof moduleApi.registerHooks === "function") {
    moduleApi.registerHooks({
      resolve(specifier, context, nextResolve) {
        const parentURL = context.parentURL && context.parentURL.startsWith(real)
          ? view + context.parentURL.slice(real.length)
          : context.parentURL;
        const result = nextResolve(specifier, parentURL === context.parentURL ? context : { ...context, parentURL });
        return result.url && result.url.startsWith(view)
          ? { ...result, url: real + result.url.slice(view.length), shortCircuit: true }
          : result;
      },
    });
    return `registerHooks (${path.relative(repoRoot, realRoot) || "."} <-> dist/)`;
  }
  if (typeof moduleApi.register === "function") {
    const source =
      `const REAL=${JSON.stringify(real)},VIEW=${JSON.stringify(view)};\n` +
      "export async function resolve(specifier,context,nextResolve){\n" +
      "  const parentURL=context.parentURL&&context.parentURL.startsWith(REAL)?VIEW+context.parentURL.slice(REAL.length):context.parentURL;\n" +
      "  const result=await nextResolve(specifier,parentURL===context.parentURL?context:{...context,parentURL});\n" +
      "  return result.url&&result.url.startsWith(VIEW)?{...result,url:REAL+result.url.slice(VIEW.length),shortCircuit:true}:result;\n" +
      "}\n";
    moduleApi.register("data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64"));
    return `register (${path.relative(repoRoot, realRoot) || "."} <-> dist/)`;
  }
  return fail("this Node has neither module.registerHooks nor module.register, so dist/ cannot be aliased to the snapshot");
}

// ---------------------------------------------------------------------------
// 3. Encoders
// ---------------------------------------------------------------------------

function encodeField(text) {
  const bytes = Buffer.from(text, "utf8");
  let out = "";
  for (const byte of bytes) {
    if (byte >= 0x20 && byte <= 0x7e && byte !== 0x25 && byte !== 0x09) out += String.fromCharCode(byte);
    else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

function createBuilder() {
  const lines = [];
  const header = (text) => lines.push(`# ${text}`);
  const blank = () => lines.push("");
  function entry(kind, parts, value) {
    let name = kind;
    for (const [key, part] of Object.entries(parts)) name += `;${key}=${encodeField(String(part))}`;
    lines.push(`${name}\t${encodeField(String(value))}`);
  }
  return { lines, header, blank, entry };
}

// ---------------------------------------------------------------------------
// 4. Recording one case
// ---------------------------------------------------------------------------

function scalarType(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return typeof value;
}

function isScalar(value) {
  return value === null || value === undefined || typeof value !== "object";
}

function scalarParts(value, prefix) {
  if (typeof value !== "number") return {};
  return { [`${prefix}integer`]: Number.isInteger(value) };
}

function emitSetting(entry, caseId, key, value) {
  if (Array.isArray(value)) {
    entry("setting", { case: caseId, key, type: "array", size: "count" }, value.length);
    value.forEach((element, index) => {
      if (isScalar(element)) {
        entry("setting", { case: caseId, key, type: "element", index, etype: scalarType(element), ...scalarParts(element, "e") }, element === undefined ? "" : element);
      } else {
        entry("setting", { case: caseId, key, type: "element", index, etype: "json" }, JSON.stringify(element));
      }
    });
    return;
  }
  if (value !== null && typeof value === "object") {
    // Member order is preserved: it is deterministic for a given engine and it is the
    // order the same object has in the matrix's `settings` member.
    const members = Object.keys(value);
    entry("setting", { case: caseId, key, type: "object", size: "count" }, members.length);
    for (const member of members) {
      const item = value[member];
      if (isScalar(item)) {
        entry("setting", { case: caseId, key, type: "member", member, mtype: scalarType(item), ...scalarParts(item, "m") }, item === undefined ? "" : item);
      } else {
        entry("setting", { case: caseId, key, type: "member", member, mtype: "json" }, JSON.stringify(item));
      }
    }
    return;
  }
  entry("setting", { case: caseId, key, type: scalarType(value), ...scalarParts(value, "") }, value === undefined ? "" : value);
}

function recordCase(entry, item, source, pattern, settings, hash, frozen) {
  const json = JSON.stringify(pattern);
  const digest = hash(json);
  const knobs = Object.keys(settings).sort();
  entry(
    "case",
    {
      id: item.id,
      source,
      frozen: frozen ? "yes" : "no",
      axes: item.axes.join("+"),
      genre: settings.genre,
      algorithm: settings.algorithm,
      seed: settings.seed,
      engineVersion: pattern.engineVersion,
      ppq: pattern.ppq,
      eventCount: pattern.events.length,
    },
    digest,
  );
  entry("settings", { case: item.id, knobs: knobs.length, sha256: hash(JSON.stringify(settings)) }, JSON.stringify(settings));
  for (const key of knobs) emitSetting(entry, item.id, key, settings[key]);
  entry("pattern", { case: item.id, sha256: digest, bytes: Buffer.byteLength(json, "utf8") }, json);
  return { id: item.id, digest, json, pattern, settings };
}

// ---------------------------------------------------------------------------
// 5. The document
// ---------------------------------------------------------------------------

function buildDocument(fixture, generate, hash, matrixById, report) {
  const { lines, header, blank, entry } = createBuilder();

  header("bbpm native pattern vectors - wave 3 whole-pattern acceptance fixture");
  header("generated by native/tests/generate-pattern-vectors.mjs from the compiled dist ESM snapshot");
  header("plain text: '#' starts a section; every other non-empty line is name<TAB>value");
  header("name is ';'-separated k=v pairs, kind first; %XX escapes cover TAB, '%' and non-ASCII bytes");
  header("sha256 is always over the RAW UTF-8 bytes of a JSON text, never over its %XX-escaped form");
  header(`records: ${SMALL_CASES.length} small examples then ${fixture.F_DET_CASES.length} frozen matrix cases, in that order`);
  blank();

  header("section: contract - the pinned whole-pattern text contract");
  header("docs/M1-RENDER-PLAN-CONTRACT.md:60-69 and docs/NATIVE-PORT-PLAN.md:229-236 define it");
  entry("contract", { key: "hashScope" }, "sha256 is over the exact JSON.stringify(pattern) text (UTF-8 bytes), never over the object");
  entry("contract", { key: "memberOrder" }, "JSON member insertion order is part of the contract; do not sort or rebuild the pattern object");
  entry("contract", { key: "numberFormat" }, "ECMAScript shortest round-trip decimal: 1 not 1.0, 0.5 not 0.50, 1e21 prints as 1e+21, -0 prints as 0");
  entry("contract", { key: "reasonField" }, "reason stays inside the hashed text on purpose; it is user-visible provenance");
  entry("contract", { key: "layerOf" }, "src/core/model.ts:116 marks layerOf render-only: undefined after rendering, never serialized");
  entry("contract", { key: "engineVersionLiteral" }, "tests/fixtures/determinism-matrix.json pins engine version strings as literals, so an engine bump must fail the fixture");
  entry("contract", { key: "comparison" }, "compare the decoded pattern value byte for byte, or its sha256; there is no tolerance for this text");
  entry("contract", { key: "toleranceScope" }, "the tolerance table below applies to audio comparison only, never to this file's pattern text");
  blank();

  header("section: contract.numberFormat - ECMAScript String(Number(in)), computed by the engine, not copied by hand");
  for (const literal of NUMBER_FORMAT_EXAMPLES) entry("jsnum", { in: literal }, String(Number(literal)));
  blank();

  header("section: tolerance - pinned audio-comparison tolerances");
  header("docs/NATIVE-PORT-PLAN.md:249-261, table and policies from docs/M1-RENDER-PLAN-CONTRACT.md:126-141");
  header("these are recorded here so both sides read them from one place; they do not apply to the text records below");
  for (const [quantity, rule] of TOLERANCES) entry("tolerance", { quantity }, rule);
  for (const [key, rule] of POLICIES) entry("policy", { key }, rule);
  blank();

  header(`section: small - ${SMALL_CASES.length} one-bar human-readable examples, pinned by this file only`);
  header("these are NOT in tests/fixtures/determinism-matrix.json; the matrix section below is the authoritative set");
  blank();
  const small = SMALL_CASES.map((item) => {
    const settings = fixture.fdetSettings(item);
    const pattern = generate(settings);
    const record = recordCase(entry, item, "synthetic", pattern, settings, hash, false);
    blank();
    return record;
  });
  report.small = small;

  header(`section: matrix - ${fixture.F_DET_CASES.length} frozen F-DET cases, every digest re-derived and cross-checked`);
  header("against tests/fixtures/determinism-matrix.json; source=matrix and frozen=yes on every record here");
  blank();
  const matrix = fixture.F_DET_CASES.map((item) => {
    const settings = fixture.fdetSettings(item);
    const pattern = generate(settings);
    const record = recordCase(entry, item, "matrix", pattern, settings, hash, true);
    blank();

    const expected = matrixById.get(item.id);
    const problems = [];
    if (!expected) problems.push("case is missing from tests/fixtures/determinism-matrix.json");
    else {
      if (expected.sha256 !== record.digest) problems.push(`sha256: engine=${record.digest} matrix=${expected.sha256}`);
      if (expected.eventCount !== pattern.events.length) problems.push(`eventCount: engine=${pattern.events.length} matrix=${expected.eventCount}`);
      if (expected.engineVersion !== pattern.engineVersion) problems.push(`engineVersion: engine=${pattern.engineVersion} matrix=${expected.engineVersion}`);
      if (expected.ppq !== pattern.ppq) problems.push(`ppq: engine=${pattern.ppq} matrix=${expected.ppq}`);
      if (expected.axes.join("+") !== item.axes.join("+")) problems.push(`axes: fixture=${item.axes.join("+")} matrix=${expected.axes.join("+")}`);
      if (expected.algorithm !== item.algorithm) problems.push(`algorithm: fixture=${item.algorithm} matrix=${expected.algorithm}`);
      if (expected.genre !== settings.genre) problems.push(`genre: engine=${settings.genre} matrix=${expected.genre}`);
      if (expected.seed !== settings.seed) problems.push(`seed: engine=${settings.seed} matrix=${expected.seed}`);
      if (JSON.stringify(expected.settings) !== JSON.stringify(settings)) problems.push("settings: the recorded knobs differ from the matrix's settings member");
    }
    return { ...record, problems };
  });
  report.matrix = matrix;

  return { text: `${lines.join("\n")}\n`, lineCount: lines.length };
}

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------

const options = parseArgs(process.argv.slice(2));
const { root: distRoot, how } = resolveDistRoot(options);
const aliasMode = await installDistAlias(distRoot);

// Provenance proof: the aliased import of <repo>/dist/core/generate.js and a direct
// import of the snapshot file must be the SAME module. If the alias were ignored, the
// aliased import would load the live dist/ and this identity would fail.
const aliasedGenerate = await import(pathToFileURL(path.join(viewDistDir, "core", "generate.js")).href);
const directGenerate = await import(pathToFileURL(path.join(distRoot, "core", "generate.js")).href);
if (aliasedGenerate !== directGenerate) {
  fail(`dist alias did not take effect: <repo>/dist/core/generate.js is not ${path.relative(repoRoot, distRoot)}/core/generate.js`);
}
const generate = aliasedGenerate.generate;
if (typeof generate !== "function") fail("the dist root has no generate() export in core/generate.js");

const fixtureUrl = pathToFileURL(fixturePath).href;
const fixture = await import(fixtureUrl);
const fixtureSecondRun = await import(`${fixtureUrl}?run=2`);
const { hash } = await import(pathToFileURL(compatFixturePath).href);

const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
if (!Array.isArray(matrix.cases)) fail(`${path.relative(repoRoot, matrixPath)} has no cases array`);
const matrixById = new Map(matrix.cases.map((item) => [item.id, item]));
const fixtureIds = fixture.F_DET_CASES.map((item) => item.id).join("\n");
const matrixIds = matrix.cases.map((item) => item.id).join("\n");
if (fixtureIds !== matrixIds) fail("F_DET_CASES and tests/fixtures/determinism-matrix.json disagree about the case list or its order");

const firstReport = { small: [], matrix: [] };
const secondReport = { small: [], matrix: [] };
const first = buildDocument(fixture, generate, hash, matrixById, firstReport);
const second = buildDocument(fixtureSecondRun, generate, hash, matrixById, secondReport);

for (const record of firstReport.matrix) {
  if (record.problems.length > 0) fail(`case ${record.id} disagrees with the frozen matrix:\n  ${record.problems.join("\n  ")}`);
}
const matched = firstReport.matrix.length;
const mismatched = matrix.cases.length - matched;
if (mismatched !== 0) fail(`${mismatched} frozen matrix cases were not reproduced`);

const firstSha = hash(first.text);
const secondSha = hash(second.text);
if (firstSha !== secondSha) {
  const left = first.text.split("\n");
  const right = second.text.split("\n");
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
  fail(`two in-process generations produced different bytes (line ${index + 1})\n  run1: ${left[index]}\n  run2: ${right[index]}`);
}

// The fixture always contains LF only, but a CRLF checkout (core.autocrlf=true) must
// not look like a content change: compare with line endings normalized and say so.
const existingRaw = existsSync(options.out) ? readFileSync(options.out, "utf8") : null;
const existingHadCrlf = existingRaw !== null && existingRaw.includes("\r\n");
const existing = existingRaw !== null && existingHadCrlf ? existingRaw.replace(/\r\n/g, "\n") : existingRaw;
const existingSha = existing === null ? null : hash(existing);
const crlfNote = existingHadCrlf ? " (on-disk file uses CRLF; compared with LF normalization)" : "";

if (options.check) {
  if (existing === null) fail(`--check: ${path.relative(repoRoot, options.out)} does not exist`);
  if (existingSha !== firstSha) {
    const left = existing.split("\n");
    const right = first.text.split("\n");
    let index = 0;
    while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
    fail(`--check: ${path.relative(repoRoot, options.out)} differs from the regenerated bytes (line ${index + 1})\n  disk:        ${left[index]}\n  regenerated: ${right[index]}`);
  }
} else {
  mkdirSync(path.dirname(options.out), { recursive: true });
  writeFileSync(options.out, first.text, "utf8");
}

const distGenerate = path.join(distRoot, "core", "generate.js");
const relativeOut = path.relative(repoRoot, options.out);
const prefix = "generate-pattern-vectors:";
console.log(`${prefix} dist root: ${path.relative(repoRoot, distRoot) || "."} (${how})`);
console.log(`${prefix} dist alias: ${aliasMode}; provenance: aliased and direct imports are the same module`);
console.log(`${prefix} dist engine: ${path.relative(repoRoot, distGenerate)} sha256=${hash(readFileSync(distGenerate, "utf8"))} bytes=${statSync(distGenerate).size}`);
console.log(`${prefix} frozen matrix: ${matrix.cases.length} cases, matched ${matched}/${matrix.cases.length}, mismatched ${mismatched}`);
console.log(`${prefix} small cases: ${firstReport.small.length} (${SMALL_CASES.map((item) => item.id).join(", ")})`);
console.log(`${prefix} reproducibility: run1 sha256=${firstSha} run2 sha256=${secondSha} identical`);
for (const record of firstReport.small) console.log(`${prefix} small ${record.id}: events=${record.pattern.events.length} jsonBytes=${Buffer.byteLength(record.json, "utf8")} sha256=${record.digest}`);
if (options.check) console.log(`${prefix} check: ${relativeOut} matches the regenerated bytes (sha256=${existingSha})${crlfNote}`);
else if (existing === null) console.log(`${prefix} wrote ${relativeOut} (new file)`);
else if (existingSha === firstSha) console.log(`${prefix} rewrote ${relativeOut} with identical bytes (sha256=${existingSha})${crlfNote}`);
else console.log(`${prefix} rewrote ${relativeOut}; the previous contents differed (was sha256=${existingSha})`);
console.log(`${prefix} bytes=${Buffer.byteLength(first.text, "utf8")} lines=${first.lineCount} sha256=${firstSha}`);
