# M1 render plan contract

The contract between the JavaScript engine and the future native renderer, plus the two
fixture-hashing decisions settled in precondition 4 and the fixture comparison policy and
determinism matrix adopted in precondition 5 (the §3.6 tolerance table, the §3.7 two master-bus
paths, and the §3.8 F-DET fixtures).

## What is frozen

`schemas/render-plan-v1.schema.json` — JSON Schema draft-07, `$id`
`https://breakbeat-pattern-maker.local/schemas/render-plan-v1.schema.json`, revision **r2**,
LF-normalised SHA-256 `e1ddcea1de60e77697e35251eeaed9a25edc9064c78d169c61bb4fa1314cd243`.

The schema was authored during M0 (§2.4 of the audit report). That report lives in the
gitignored `test-results/m0/`, so this tracked file — not the report — is the record of the
contract. Verify the freeze with:

```
node --test tests/render-plan-v1.test.mjs
```

That test pins the digest and then derives every other assertion from the schema document
itself: a 37-entry rejection matrix, boundary acceptance, agreement with
`schemas/bbpattern-v1.schema.json` and with the engine (`PPQ`, tempo bounds,
`parseTimeSignature`'s meter domain, the 192 kHz rate ceiling, the role vocabulary), and the open
questions below.

## How to change the contract

1. Edit the schema.
2. Update `FROZEN_DIGEST` in `tests/render-plan-v1.test.mjs`.
3. Add a revision entry below saying who asked for the change and what it breaks.
4. Run `npm test`.

Never regenerate the file from the M0 report, and never reorder members — see hashing, below.

### Revision history

- **r1** (precondition 4) — frozen from the M0 §2.4 draft without edits.
- **r2** (precondition 4, post-review) — requested by Arthur (m01319), settling two of the three
  r1 disagreements by narrowing the schema to what the engine already enforces:
  - `timeline.sampleRate` maximum 384 000 → **192 000**, for strict parity with the reference
    renderer (`src/audio/performance.ts:29` rejects anything above 192 000) and with the transfer
    schema's own sample-rate bound (`src/core/compile.ts:38`), and to avoid Web Audio/CoreAudio
    buffer and rate incompatibilities on M1 hardware.
  - `generationRole` `["string","null"]` → `enum ["kick","snare","hat","percussion",null]`,
    because `src/core/compile.ts:25`, `src/core/compile.ts:38` and `src/core/editor.ts:79` already
    reject any other string at runtime.
  Breaks: an r1 plan carrying a sample rate above 192 000, or a `generationRole` outside the role
  vocabulary, now fails validation. No such plan can exist today — the engine never emits one — so
  the narrowing is compatible with every recorded fixture. `FROZEN_DIGEST` updated in the same
  change, and both narrowings are now asserted against the live engine rather than merely
  documented.

## Hashing decisions (precondition 4)

Settled by Arthur (m00516–m00530) and encoded in `tests/fixture-hash-contract.test.mjs`, which
binds them to the real hash used by the compatibility fixtures.

1. **JSON member order is pinned.** `scripts/engine-compatibility-fixture.mjs:9` is
   `hash=value=>createHash('sha256').update(value).digest('hex')`, and `captureCompatibility`
   hashes `JSON.stringify(pattern)` — the text, not the object. Two objects with identical
   members in different insertion order therefore hash differently.
   Consequence, and the price of this choice: **number formatting is part of the contract**.
   A native renderer must emit JavaScript's shortest round-trip form byte for byte —
   `1` and not `1.0`, `0.5` and not `0.50`, `0.3333333333333333`, `1e+21` in exponent form,
   and `-0` collapsing to `0`. The choice was taken as written: the F-DET matrix in
   `tests/fixtures/determinism-matrix.json` freezes 44 whole-pattern digests of that exact text,
   so narrowing the hash to a canonical projection now would invalidate every recorded fixture.
2. **`reason` is inside the hash.** It is user-visible provenance: a build that places the same
   hits for different stated reasons is a different fixture, not a numerically equal one.
   The deliberate exception is `scripts/loop-generation-audit.mjs`'s `signature`, which strips
   `reason` because that audit compares generated *designs* across settings; its generate-twice
   determinism check still compares the whole pattern text, `reason` included.
3. **`layerOf` is render-only.** `src/core/model.ts:116` declares it ephemeral, so fixtures
   assert it is `undefined` after rendering rather than serializing it.

## Rules the schema cannot express

Copied from M0 §2.4 because they are contract terms that no JSON Schema can carry, and the
report that holds them is gitignored.

- `assetKey` is an opaque handle resolved under the approved cache and project roots. A plan
  never carries PCM, and `startFrame` / `endFrame` / `velocityLayer` are **source-rate**, not
  device-rate.
- Prepared-cache key = `sourceHash + preparationAlgorithmVersion + sourceSampleRate +
  shapingParams`. An asset that is not yet prepared keeps the previous voice in a Pending
  state — never a silent gap.
- Time arithmetic: `seconds = ticks × 60 / (bpm × 960)`; a meter of `N/D` is
  `N × 960 × 4 / D` ticks per bar; absolute sample positions come from the cumulative
  timeline, with no per-bar rounding (fixture family F-PPQ).
- The tracker row rule (`src/core/meter.ts:16`: a whole number of rows per bar, at most 512
  rows) constrains the LPB/bars combination and belongs to the transfer schema — see note rows
  bounded at 511 in `schemas/bbpattern-v1.schema.json` — not to the render plan.

## Open contract questions

Each is pinned by the test `the two r1 disagreements are settled at r2 and the last one stays
recorded`, so resolving one is a deliberate, visible change rather than a quiet drift. r1's items
1 (sample rate) and 2 (`generationRole`) were settled by the r2 narrowing above; four remain.

1. **Tick fraction granularity.** The plan excludes only exactly `1`; the engine caps the same
   concept, `fineOffset`, at `0.9999999999` (`src/core/compile.ts:81`). Pick one and align, or
   record the difference as intentional.
2. **Frame-conversion rounding.** JavaScript `Math.round` is half-up; C++ `std::round` is
   half-away-from-zero. They disagree at `.5` ties. Specify the native behaviour.
3. **Float association.** FMA contraction and fast-math must be forbidden in the native mixer so
   that sums associate exactly as the JS renderer does.
4. **Seed arithmetic.** `Math.imul` / `>>>0` 32-bit wraparound must be reproduced exactly in the
   native generator.

## Fixture tolerance policy (M0 §3.6)

Copied verbatim from `test-results/m0/M0-AUDIT-REPORT.md:594-614`, because it is the comparison
contract every F-DET and F-DSP fixture depends on and that report is gitignored. This is step 1 of
precondition 5: the tolerance table is now tracked, so it survives the report directory.

**Adopted.** The table is executable as `scripts/fixture-tolerance.mjs` — `TOLERANCES`,
`onsetTolerance(rate)`, `maximumSampleError`, `maximumWindowRmsError`, `onsetFrames`,
`spectralDifference` and the entry point
`compareRender(reference,candidate,{rate,expectSilence})` — and exercised by the 12 tests in
`tests/fixture-tolerance.test.mjs`. The two policies above are enforced rather than described: the
module exports no gain-normalising helper at all, and two silent renders fail the comparison unless
the caller explicitly passes `expectSilence: true`.

| Quantity | Tolerance | Rationale / source |
| --- | --- | --- |
| Max normalized sample error (float/linear fixtures) | **1e-5** | Byte-identical PCM16 preferred wherever the TS path is bit-reproducible |
| PCM16 golden | byte-identical, else float sidecar | PCM16 LSB = `Math.round(s*(s<0?32768:32767))` (`src/audio/wav.ts:13`) = **3.0518e-5**, which *cannot express* 1e-5 — hence `.f32le` sidecars |
| Onset position | ±1 frame (≥44.1 kHz), ±2 frames (8 kHz) | Frame-quantisation limit |
| Peak | 1e-4 | Reuses `samplePeak`/`estimatedTruePeak` (`src/audio/audio-quality.ts:3-11`) |
| RMS | relative 1e-3 **with** 1e-4 absolute floor | Guard against "both near zero" passing |
| Per-100 ms window | 2e-3 | Catches localised divergence hidden by whole-render RMS |
| DC offset | 1e-5 | `dcOffset` metric, `src/audio/audio-quality.ts:18-39` |
| Stereo correlation | 1e-3 | `stereoCorrelation` metric |
| Spectral (4096-pt Hann) | 1e-2 per bin, 0.25 dB aggregate | `monoRms`/`clippedSamples` metrics supplement |
| True peak | 1e-3 | — |
| Clipped sample count | identical | `clippedSamples` metric |

Two explicit policies accompany the table: **gain errors must never be normalized away** before
comparison, and **non-silence is not evidence of parity**. The repo's only existing PCM comparator,
`delta(a,b,offset)` in `scripts/loop-generation-audit.mjs:45`, returns whole-render `{rms,peak}` and
is insufficient on its own.

## The master bus is two code paths (M0 §3.7)

Copied verbatim from `test-results/m0/M0-AUDIT-REPORT.md:616-625` — the highest-value finding in
that section, and the second thing precondition 5 must not lose.

**The master bus is two different code paths, not one.** Legacy/v1–v3
(`src/audio/performance.ts:203-215`) applies a tanh soft-clip above 0.7 that is **skipped
entirely** when every event is `mapped` (`:206`, `transparent`), then applies attenuation only
above peak 1.0 (`:212`), returning `quality:undefined`. v4/v5/v5.1 (`:216-217`) instead calls
`protectMaster` (ceiling 0.96) and returns a quality object. Any port fixture set **must cover
`transparent=true` and `false`** for the legacy algorithms; without that, the port can pass every
existing golden and still change already-published v1–v3 PCM.

**Adopted.** This requirement is now a mandatory fixture pair rather than a warning.
`scripts/master-bus-fixture.mjs` builds, for each legacy algorithm (`legacy-v1`, `groove-v2`,
`groove-v3`), a `transparent` pattern (every event carries `mapped`) and a `clipped` pattern (the
same hits with only `slice`), at 8 kHz and 44.1 kHz, with and without looping, and captures
`tests/fixtures/master-bus-paths.json` — 24 bit-exact PCM16 goldens — which
`tests/master-bus-paths.test.mjs` asserts.

The signature that proves the two branches really were exercised: on the `transparent` path the
master stage measures a raw peak above 1.0 and reports `attenuation` below 1 (0.62–0.90) while the
exported peak is trimmed to exactly 0.98 — only possible when the tanh clip at `:207-210` was
skipped. On the `clipped` path the clip caps the peak at 0.948–0.979 and `attenuation` stays
exactly 1, because the clip runs *before* the peak measurement (`:211-213`), so a post-clip peak
above 1.0 cannot occur. Both paths return `quality: undefined`. Caveat recorded in the test:
`mapped` also selects different voice planning (`src/audio/performance.ts:135-145`) and skips the
drum-kit velocity layers (`src/audio/drum-kit.ts:83`, `:90`), so the pair is coverage evidence for
the two master paths, not an isolation of them.

## Carried forward to precondition 5

- **Done: F-DET fixtures.** `scripts/engine-determinism-fixture.mjs` declares `F_DET_ENGINES` (the
  six engines against their literal `engineVersion` strings), `F_DET_SEEDS` (`'pre-v3-compatibility'`,
  `'a'`, `'break-042'`, `'sééd-ünicode'`), the nine `F_DET_KNOBS` axes, `fdetSettings(item)`,
  `fdetFieldDigests`/`locateDrift` (drift against a captured case: the moved fields, the event count,
  and the first hit whose own digest no longer matches) and `firstDivergence(a,b)` (the same report
  for two patterns generated in one process). `tests/fixtures/determinism-matrix.json` (144 273
  bytes) captures 44 cases — 6 engines × 4 seeds plus two-or-more cases per knob — each with its
  `sha256`, per-hit digests (`hitDigests`, 16 hex chars, a locator only) and one digest per event
  field (`fieldDigests`). `tests/determinism-matrix.test.mjs` (7 tests) pins the coverage, the
  literal stamps, bit-exact regeneration, `reason` inside the digest, member order inside the digest,
  and `layerOf` absent before and after a render attempt.
- The generate-twice check in `scripts/loop-generation-audit.mjs` was **extended, never replaced**:
  its failure now names the first divergence (`:22`), and the same matrix runs as an added sweep
  (`:60-65`) reported as `determinism` and included in the non-zero exit (`:69`).
  Verify with `node --test tests/determinism-matrix.test.mjs` (7 tests) and `npm run test:loop-audit`.
- **Done:** the two artefacts that had to leave the gitignored report — the §3.6 tolerance table and
  the §3.7 master-bus requirement — were adopted during precondition 5 as mandatory fixtures:
  `scripts/fixture-tolerance.mjs` with `tests/fixture-tolerance.test.mjs` (12 tests), and
  `scripts/master-bus-fixture.mjs` with `tests/master-bus-paths.test.mjs` plus
  `tests/fixtures/master-bus-paths.json` (24 entries). Verify both with
  `node --test tests/fixture-tolerance.test.mjs tests/master-bus-paths.test.mjs` (19 tests).
