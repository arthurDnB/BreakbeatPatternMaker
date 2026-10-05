# M1 render plan contract

The contract between the JavaScript engine and the future native renderer, plus the two
fixture-hashing decisions settled in precondition 4.

## What is frozen

`schemas/render-plan-v1.schema.json` — JSON Schema draft-07, `$id`
`https://breakbeat-pattern-maker.local/schemas/render-plan-v1.schema.json`, revision **r1**,
LF-normalised SHA-256 `7fe3c8c47c5790bfc0f9084ba0cb09485e3f947ce4ce47095746603768d30950`.

The schema was authored during M0 (§2.4 of the audit report). That report lives in the
gitignored `test-results/m0/`, so this tracked file — not the report — is the record of the
contract. Verify the freeze with:

```
node --test tests/render-plan-v1.test.mjs
```

That test pins the digest and then derives every other assertion from the schema document
itself: a 33-entry rejection matrix, boundary acceptance, agreement with
`schemas/bbpattern-v1.schema.json` and with the engine (`PPQ`, tempo bounds,
`parseTimeSignature`'s meter domain), and the open questions below.

## How to change the contract

1. Edit the schema.
2. Update `FROZEN_DIGEST` in `tests/render-plan-v1.test.mjs`.
3. Add a revision entry below saying who asked for the change and what it breaks.
4. Run `npm test`.

Never regenerate the file from the M0 report, and never reorder members — see hashing, below.

### Revision history

- **r1** (precondition 4) — frozen from the M0 §2.4 draft without edits.

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
   and `-0` collapsing to `0`. If that is not acceptable, narrow the hash to a canonical
   projection (sorted keys, fixed decimal format) *before* any F-DET hash is frozen — after
   freezing, changing it invalidates every recorded fixture.
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

Each is pinned by the test `open contract questions are recorded here, not silently resolved`,
so resolving one is a deliberate, visible change rather than a quiet drift.

1. **Sample rate.** The plan admits 8 000–384 000 Hz; `renderPerformance` rejects anything above
   192 000 with `Render sample rate must be 8–192 kHz.` Decide whether `timeline.sampleRate` is a
   device rate M1 will support, or whether the schema narrows to 192 000.
2. **`generationRole` is an open string** (`["string","null"]`) while the engine only ever writes
   the four `ROLES` from `src/core/model.ts` and `src/core/compile.ts:38` validates membership.
   Narrow it to the role enum, or state why it stays open.
3. **Tick fraction granularity.** The plan excludes only exactly `1`; the engine caps the same
   concept, `fineOffset`, at `0.9999999999` (`src/core/compile.ts:81`). Pick one and align, or
   record the difference as intentional.
4. **Frame-conversion rounding.** JavaScript `Math.round` is half-up; C++ `std::round` is
   half-away-from-zero. They disagree at `.5` ties. Specify the native behaviour.
5. **Float association.** FMA contraction and fast-math must be forbidden in the native mixer so
   that sums associate exactly as the JS renderer does.
6. **Seed arithmetic.** `Math.imul` / `>>>0` 32-bit wraparound must be reproduced exactly in the
   native generator.

## Carried forward to precondition 5

- F-DET fixtures should extend, never replace, the generate-twice equality check in
  `scripts/loop-generation-audit.mjs`: all six engines with their literal `engineVersion`; seeds
  including `'pre-v3-compatibility'`, `'a'`, `'break-042'`, `'sééd-ünicode'`; and the settings
  `variation`, `phraseLength`/`phraseOffset`, `breakStyle`, `enabledRoles`, `laneDensity`,
  `hitTarget`, `breakLayer` (`'off'` or `'think-passage2'`, the only two the engine accepts),
  and `lpb`. Per-hit digests should report the first divergent hit index and field name.
- **Before precondition 5 starts, copy two things out of the gitignored M0 report into tracked
  docs**: the §3.6 tolerance table (`test-results/m0/M0-AUDIT-REPORT.md:594`) and the §3.7
  master-bus requirement that both `transparent` paths are mandatory legacy fixtures
  (`:616`, `:627`). The schema is now safe from that directory's deletion; those two are not.
