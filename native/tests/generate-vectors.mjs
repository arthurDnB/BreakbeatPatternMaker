#!/usr/bin/env node
// Generates the plain-text reference vectors for the native (JUCE-free) core.
//
//   node native/tests/generate-vectors.mjs [--skip-build]
//
// The vectors are produced from the COMPILED JavaScript (dist/core/*.js), not
// from a re-implementation, so they are the behaviour of the shipped TS engine.
// The file is deliberately plain text: the C++ self test parses it with nothing
// but std::ifstream (no JSON parser on the C++ side).
//
// Format
//   '#' lines are section headers.
//   Every other non-empty line is:  name<TAB>value
//   name is a ';'-separated list of k=v pairs; the first field is the kind.
//   Both fields are ASCII: bytes outside 0x20..0x7E, '%' and TAB become %XX.
//
// Only Node builtins are used. The output contains no timestamps or absolute
// paths, so the bytes (and therefore the sha256) are reproducible.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(scriptPath);
const nativeDir = path.resolve(testsDir, "..");
const repoRoot = path.resolve(nativeDir, "..");
const outPath = path.join(testsDir, "vectors", "random-model.txt");
const distDir = path.join(repoRoot, "dist");
const skipBuild = process.argv.includes("--skip-build");

function fail(message) {
  console.error(`generate-vectors: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Build the TypeScript so dist/ is fresh
// ---------------------------------------------------------------------------

function runBuild() {
  if (skipBuild) {
    console.log("generate-vectors: --skip-build given, using existing dist/");
    return;
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(`${npm} run build`, { cwd: repoRoot, stdio: "inherit", shell: true });
  if (result.error) fail(`could not run "${npm} run build": ${result.error.message}`);
  if (result.status !== 0) fail(`"npm run build" exited with status ${result.status}`);
}

function requireDistFresh() {
  const required = ["core/random.js", "core/model.js"];
  for (const rel of required) {
    const file = path.join(distDir, rel);
    if (!existsSync(file)) fail(`missing ${path.relative(repoRoot, file)} - run "npm run build" first`);
  }
  const sources = ["src/core/random.ts", "src/core/model.ts"];
  for (const rel of sources) {
    const src = path.join(repoRoot, rel);
    const js = path.join(distDir, rel.replace(/^src/, "").replace(/\.ts$/, ".js"));
    if (existsSync(src) && statSync(src).mtimeMs > statSync(js).mtimeMs + 1000) {
      fail(`dist/${path.relative(distDir, js)} is older than ${rel} - rebuild before generating vectors`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Parsing the TypeScript sources for the wire tables
// ---------------------------------------------------------------------------

const modelSource = readFileSync(path.join(repoRoot, "src/core/model.ts"), "utf8");

function parseNamedUnion(typeName) {
  const match = modelSource.match(new RegExp(`export type ${typeName}\\s*=\\s*([\\s\\S]*?);`));
  if (!match) fail(`src/core/model.ts: could not find "export type ${typeName} ="`);
  const body = match[1];
  const items = [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const residue = body.replace(/'[^']*'/g, "").replace(/[\s|]/g, "");
  if (residue.length > 0) fail(`src/core/model.ts: export type ${typeName} has non-literal members (${residue})`);
  if (items.length === 0) fail(`src/core/model.ts: export type ${typeName} has no members`);
  return items;
}

function interfaceBody(interfaceName) {
  const start = modelSource.indexOf(`interface ${interfaceName}`);
  if (start < 0) fail(`src/core/model.ts: could not find interface ${interfaceName}`);
  const open = modelSource.indexOf("{", start);
  if (open < 0) fail(`src/core/model.ts: interface ${interfaceName} has no body`);
  let depth = 0;
  for (let i = open; i < modelSource.length; i += 1) {
    const c = modelSource[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return modelSource.slice(open + 1, i);
    }
  }
  return fail(`src/core/model.ts: interface ${interfaceName} is unterminated`);
}

function memberUnion(interfaceName, key) {
  const body = interfaceBody(interfaceName);
  const match = body.match(new RegExp(`(?:^|[;{\\s])${key}\\??\\s*:\\s*([^;]*)`, "m"));
  if (!match) fail(`src/core/model.ts: interface ${interfaceName} has no member ${key}`);
  const clause = match[1];
  const strings = [...clause.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  if (strings.length > 0) return strings;
  const numbers = [...clause.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (numbers.length > 0) return numbers;
  return fail(`src/core/model.ts: interface ${interfaceName}.${key} has no literal members`);
}

const ROLES = [...modelSource.match(/export const ROLES\s*=\s*\[([^\]]*)\]/)[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
const ENGINE_VERSION = modelSource.match(/export const ENGINE_VERSION\s*=\s*'([^']*)'/)[1];
const PPQ = Number(modelSource.match(/export const PPQ\s*=\s*(\d+)/)[1]);

const STRING_TABLES = [
  ["roles", ROLES],
  ["genres", parseNamedUnion("Genre")],
  ["breakStyles", parseNamedUnion("BreakStyle")],
  ["breakLayers", parseNamedUnion("BreakLayer")],
  ["generationModes", parseNamedUnion("GenerationMode")],
  ["melodyParts", parseNamedUnion("MelodyPart")],
  ["melodyScales", parseNamedUnion("MelodyScale")],
  ["harmonyStyles", parseNamedUnion("HarmonyStyle")],
  ["algorithms", memberUnion("Settings", "algorithm")],
  ["patternStructures", memberUnion("Settings", "patternStructure")],
  ["chordProgressions", memberUnion("Settings", "chordProgression")],
  ["articulationModes", memberUnion("Articulation", "mode")],
  ["effectCommands", memberUnion("EffectCommand", "command")],
  ["hitSourceKinds", memberUnion("Hit", "sourceKind")],
  ["hitSpeedModes", memberUnion("Hit", "speedMode")],
  ["trackKinds", [memberUnion("SampleTrack", "kind")[0], memberUnion("SynthTrack", "kind")[0]]],
  ["synthWaveforms", parseNamedUnion("SynthWaveform")],
  ["synthCategories", parseNamedUnion("SynthCategory")],
  ["synthPresets", parseNamedUnion("SynthPreset")],
  ["synthModuleTypes", parseNamedUnion("SynthModuleType")],
  ["sampleBanks", memberUnion("SynthInstrument", "sampleBank")],
];

const INT_TABLES = [
  ["phraseLengths", memberUnion("Settings", "phraseLength")],
  ["resolutions", memberUnion("Settings", "resolution")],
  ["lpbs", memberUnion("Settings", "lpb")],
];

const EXPECTED_SIZES = {
  roles: 4, genres: 38, breakStyles: 6, breakLayers: 2, generationModes: 3, melodyParts: 3,
  melodyScales: 16, harmonyStyles: 4, algorithms: 6, patternStructures: 5, chordProgressions: 8,
  articulationModes: 3, effectCommands: 9, hitSourceKinds: 2, hitSpeedModes: 2, trackKinds: 2,
  synthWaveforms: 4, synthCategories: 5, synthPresets: 25, synthModuleTypes: 17, sampleBanks: 1,
  phraseLengths: 3, resolutions: 4, lpbs: 10,
};

for (const [name, items] of [...STRING_TABLES, ...INT_TABLES]) {
  const want = EXPECTED_SIZES[name];
  if (want === undefined) fail(`no expected size recorded for table ${name}`);
  if (items.length !== want) fail(`table ${name}: parsed ${items.length} members, expected ${want}`);
}

// Cross-check the genre list against the frozen export schema.
function findByKey(node, key) {
  if (node === null || typeof node !== "object") return undefined;
  if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, key)) return node[key];
  for (const child of Array.isArray(node) ? node : Object.values(node)) {
    const found = findByKey(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

const genreTable = STRING_TABLES.find(([name]) => name === "genres")[1];
const patternSchema = JSON.parse(readFileSync(path.join(repoRoot, "schemas/bbpattern-v1.schema.json"), "utf8"));
const schemaGenres = findByKey(patternSchema, "genre");
if (JSON.stringify(schemaGenres.enum) !== JSON.stringify(genreTable)) {
  fail("src/core/model.ts Genre order does not match schemas/bbpattern-v1.schema.json genre enum");
}
const planSchema = JSON.parse(readFileSync(path.join(repoRoot, "schemas/render-plan-v1.schema.json"), "utf8"));
const schemaPpq = findByKey(planSchema, "ppq");
if (!schemaPpq || schemaPpq.const !== PPQ) fail("PPQ does not match schemas/render-plan-v1.schema.json");

// ---------------------------------------------------------------------------
// 3. Encoders and line builders
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

const lines = [];
function header(text) {
  lines.push(`# ${text}`);
}
function blank() {
  lines.push("");
}
function entry(kind, parts, value) {
  let name = kind;
  for (const [key, part] of Object.entries(parts)) name += `;${key}=${encodeField(String(part))}`;
  lines.push(`${name}\t${encodeField(String(value))}`);
}

function probe(fn) {
  try {
    const value = fn();
    return value === undefined ? "ok" : `ok:${String(value)}`;
  } catch (error) {
    return `throw:${error.message}`;
  }
}

// src/core/random.ts does not export the initial state, so the FNV-1a seed hash
// is reproduced here from the same six lines (Math.imul / >>> 0). It is an
// oracle for Random.h's randomSeedHash(): if it were wrong, draw.0 - which the
// compiled engine does produce - would disagree with the port as well.
function fnvSeedHash(seed, stream) {
  let state = 2166136261;
  for (const c of `${seed}\0${stream}`) {
    state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  return state;
}

// ---------------------------------------------------------------------------
// 4. The engine
// ---------------------------------------------------------------------------

runBuild();
requireDistFresh();

const randomModule = await import(pathToFileURL(path.join(distDir, "core/random.js")).href);
const modelModule = await import(pathToFileURL(path.join(distDir, "core/model.js")).href);

const generatorEntryPoints = Object.keys(randomModule).filter((key) => typeof randomModule[key] === "function");
if (JSON.stringify([...generatorEntryPoints].sort()) !== JSON.stringify(["random"])) {
  fail(`dist/core/random.js exposes unexpected generator entry points: ${generatorEntryPoints.join(", ")}`);
}
if (modelModule.ENGINE_VERSION !== ENGINE_VERSION) fail("dist ENGINE_VERSION disagrees with src/core/model.ts");
if (modelModule.PPQ !== PPQ) fail("dist PPQ disagrees with src/core/model.ts");
if (JSON.stringify([...modelModule.ROLES]) !== JSON.stringify(ROLES)) fail("dist ROLES disagrees with src/core/model.ts");
if (!Array.isArray(modelModule.DEFAULT_SOURCES) || modelModule.DEFAULT_SOURCES.length !== ROLES.length) {
  fail("dist DEFAULT_SOURCES is not one entry per role");
}

const SEEDS = ["a", "break-042", "pre-v3-compatibility", "sééd-ünicode", "🎵-astral"];
const STREAMS = ["", "groove-v5:jungle:skeleton:0:kick"];
const RAW_DRAWS = 32;
const FLOAT_DRAWS = 16;

const doubleBuffer = new ArrayBuffer(8);
const doubleView = new Float64Array(doubleBuffer);
const bitsView = new BigUint64Array(doubleBuffer);
function doubleBits(value) {
  doubleView[0] = value;
  return bitsView[0].toString(16).padStart(16, "0");
}

header("bbpm native core reference vectors");
header("generated by native/tests/generate-vectors.mjs from the compiled dist/core/*.js");
header("plain text: '#' starts a section; every other non-empty line is name<TAB>value");
header("name is ';'-separated k=v pairs, kind first; %XX escapes cover TAB, '%' and non-ASCII bytes");
header("table sizes are written as 'string;table=<name>;size=count' or 'int;table=<name>;size=count',");
header("where the value field holds the member count and the members follow as index=0,1,2,...");
blank();

header("section: const - frozen contract constants");
entry("const", { k: "engineVersion" }, ENGINE_VERSION);
entry("const", { k: "ppq" }, PPQ);
entry("const", { k: "transferFormat" }, "breakbeat-pattern");
entry("const", { k: "transferVersion" }, 1);
entry("const", { k: "roleCount" }, ROLES.length);
blank();

header("section: string tables - wire enum members, addressed by table name and index");
for (const [name, items] of STRING_TABLES) {
  entry("string", { table: name, size: "count" }, items.length);
  items.forEach((item, index) => entry("string", { table: name, index }, item));
}
blank();

header("section: int tables - numeric wire enums (resolution / lpb / phraseLength)");
for (const [name, items] of INT_TABLES) {
  entry("int", { table: name, size: "count" }, items.length);
  items.forEach((item, index) => entry("int", { table: name, index }, item));
}
blank();

header("section: default sources - model.ts DEFAULT_SOURCES, one per role");
modelModule.DEFAULT_SOURCES.forEach((source, index) => {
  entry("source", { index, field: "id" }, source.id);
  entry("source", { index, field: "role" }, source.role);
  entry("source", { index, field: "kind" }, source.kind);
  entry("source", { index, field: "label" }, source.label);
  entry("source", { index, field: "note" }, source.note);
  entry("source", { index, field: "instrument" }, source.instrument);
});
blank();

header("section: seed hashes - FNV-1a hash of `${seed}\\0${stream}` (the generator's initial state)");
header("src/core/random.ts keeps that state private, so it is reproduced by generate-vectors.mjs");
header("from the same six lines; draw.i below is the compiled engine's own output for the same stream");
for (const seed of SEEDS) {
  for (const stream of STREAMS) {
    entry("seed", { seed, stream }, fnvSeedHash(seed, stream));
  }
}
blank();

header("section: generator draws - the only public entry point is random(seed, stream)");
header(`seeds: ${SEEDS.join(" ")}`);
header(`streams: (empty) and ${STREAMS[1]}`);
header(`raw draws per stream: ${RAW_DRAWS}; float draws per stream: ${FLOAT_DRAWS}`);
header("draw.i is the raw uint32 (the value the generator returns x 2^32)");
header("float.i is that draw / 2^32 as a double; floatbits is its IEEE-754 bit pattern");
for (const seed of SEEDS) {
  for (const stream of STREAMS) {
    const generator = randomModule.random(seed, stream);
    const floats = [];
    for (let i = 0; i < RAW_DRAWS; i += 1) floats.push(generator());
    floats.forEach((float, i) => {
      const scaled = float * 4294967296;
      if (!Number.isInteger(scaled)) {
        fail(`draw ${i} of seed "${seed}" stream "${stream}" is not an exact multiple of 2^-32`);
      }
      entry("draw", { seed, stream, i }, scaled);
    });
    floats.slice(0, FLOAT_DRAWS).forEach((float, i) => {
      entry("float", { seed, stream, i }, String(float));
      entry("floatbits", { seed, stream, i }, doubleBits(float));
    });
  }
}
blank();

header("section: jsnum - ECMAScript String(number), the formatter used in error messages");
for (const literal of [
  "0", "-0", "0.1", "0.5", "0.67", "2.5", "1e-7", "1e-6", "0.000099", "1e16", "1e20", "1e21",
  "4294967295", "123456789012345678901234567890", "1.7976931348623157e308", "5e-324",
  "0.3333333333333333", "100", "999", "120", "1000000", "-16.5",
]) {
  entry("jsnum", { in: literal }, String(Number(literal)));
}
blank();

header("section: noteName - model.ts noteName(note) and its out-of-range throw");
for (const note of [0, 11, 12, 60, 61, 71, 119]) entry("noteName", { in: note }, modelModule.noteName(note));
for (const note of [-1, 120, 1000]) {
  entry("noteNameFail", { in: note }, probe(() => modelModule.noteName(note)).replace(/^throw:/, ""));
}
blank();

header("section: hex - model.ts hex(n)");
for (const n of [0, 1, 7, 10, 15, 16, 255, 4096, 65535, -1, -16, -2147483648]) {
  entry("hex", { in: n }, modelModule.hex(n));
}
blank();

header("section: bounded - model.ts bounded(value, min, max, name, integer)");
for (const [value, min, max, name, integer] of [
  [0, 0, 1, "complexity", 0], [1, 0, 1, "complexity", 0], [0.5, 0, 1, "spicy", 0],
  [1.5, 0, 1, "complexity", 0], [-0.1, 0, 1, "complexity", 0], [3.5, 0, 1, "variation", 1],
  [3, 0, 1, "variation", 1], [174, 32, 999, "BPM", 0], [31, 32, 999, "BPM", 0],
  [0.6, 0.5, 0.67, "swing", 0], [0.67, 0.5, 0.67, "swing", 0], [0.7, 0.5, 0.67, "swing", 0],
  [0.5, 0.5, 0.67, "swing", 0], [1e-8, 1e-7, 1, "tiny", 0], [1.5e21, 0, 1e21, "huge", 0],
  [119, 0, 119, "note", 1], [119.5, 0, 119, "note", 1],
]) {
  entry("bounded", { in: value, min, max, integer, name }, probe(() => modelModule.bounded(value, min, max, name, Boolean(integer))));
}
for (const [label, value] of [["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY], ["-Infinity", Number.NEGATIVE_INFINITY]]) {
  entry("bounded", { in: label, min: 0, max: 1, integer: 0, name: "complexity" }, probe(() => modelModule.bounded(value, 0, 1, "complexity")));
}
blank();

header("section: identifier - model.ts identifier(value, name)");
for (const [label, value] of [
  ["ok-dotted", "kit.kick"], ["ok-single", "a"], ["ok-mixed", "UPPER_lower-1.2"],
  ["ok-80", "a".repeat(80)], ["empty", ""], ["81", "a".repeat(81)],
  ["space", "bad id"], ["unicode", "sééd"], ["slash", "a/b"], ["newline", "abc\n"], ["colon", "a:b"],
]) {
  entry("identifier", { in: label, value, name: "id" }, probe(() => modelModule.identifier(value, "id")));
}
blank();

header("section: text - model.ts text(value, name, max) with the UTF-8 byte budget");
for (const [label, value, max, name] of [
  ["plain", "hello", 120, "seed"], ["empty", "", 120, "seed"], ["seed-unicode", "sééd-ünicode", 120, "seed"],
  ["seed-unicode-exact", "sééd-ünicode", 14, "seed"], ["seed-unicode-over", "sééd-ünicode", 13, "seed"],
  ["cjk", "日本語", 9, "seed"], ["cjk-over", "日本語", 8, "seed"],
  ["emoji", "🎵", 4, "seed"], ["emoji-over", "🎵", 3, "seed"],
  ["newline", "a\nb", 120, "seed"], ["tab", "a\tb", 120, "seed"], ["del", "a\x7fb", 120, "seed"],
  ["nul", "a\x00b", 120, "seed"], ["at-limit", "a".repeat(120), 120, "seed"], ["over-limit", "a".repeat(121), 120, "seed"],
  ["custom-max", "abcdef", 6, "name"], ["custom-max-over", "abcdef", 5, "name"],
]) {
  entry("text", { in: label, value, max, name }, probe(() => modelModule.text(value, name, max)));
}
blank();

header("section: isSynthTrack - model.ts isSynthTrack() kind test");
for (const [label, value] of [["undefined", undefined], ["synth", "synth"], ["sample", "sample"], ["upper", "SYNTH"]]) {
  entry("isSynth", { in: label }, String(modelModule.isSynthTrack(value === undefined ? undefined : { kind: value }) === true));
}
blank();

const text = `${lines.join("\n")}\n`;
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, text, "utf8");

const bytes = Buffer.byteLength(text, "utf8");
const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
console.log(`generate-vectors: wrote ${path.relative(repoRoot, outPath)}`);
console.log(`generate-vectors: bytes=${bytes} lines=${text.split("\n").length - 1} sha256=${sha256}`);
