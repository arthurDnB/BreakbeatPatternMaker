# Modular synth aliasing and low-rate stability audit

Deterministic offline measurement of alias behaviour for the shared modular synth renderer. It answers one narrow question: when a factory patch is rendered at 8 kHz, 22.05 kHz, 44.1 kHz, 48 kHz, 96 kHz or 192 kHz, how much *inharmonic* spectral energy does each render contain relative to everything else in the band, and how much does a 192 kHz render change when it is band-limited down to each lower rate?

Artefacts:

| Artefact | Purpose |
|---|---|
| [`scripts/modular-synth-aliasing-audit.mjs`](../scripts/modular-synth-aliasing-audit.mjs) | The measurement. No PCM of its own: every sample comes from `renderModularSynthNote` in [`src/audio/modular-synth.ts`](../src/audio/modular-synth.ts) through the same `starterPatch` factory default the preview/song/export path uses. |
| `test-results/modular-synth-aliasing/report.json` | Machine-readable report (gitignored build artefact, written by `npm run audit:aliasing`). |
| [`tests/fixtures/modular-synth-aliasing.json`](../tests/fixtures/modular-synth-aliasing.json) | Frozen, tracked gate record: the report's `sha256` and byte length plus every scalar the regression gates assert. |
| [`tests/modular-synth-aliasing.test.mjs`](../tests/modular-synth-aliasing.test.mjs) | Cheap regression gates over the frozen record (and over the on-disk report when one is present). |

Evidence this audit exists to satisfy: `modular_synth_realism_plan.md:75` (measure aliasing at C5/192 kHz and low-rate stability at 8 kHz for the phase-modulation / multistage-envelope tranche) and `modular_synth_realism_plan.md:41` ("simple FM and ring modulation alias readily").

## 1. What is rendered

Every render is the same call with a different note, rate and velocity:

```js
renderModularSynthNote(note, 1.5, rate, starterPatch(presetId), undefined, 60, 0, velocity)
```

`1.5 s` gate, root note 60, channel 0.

| Matrix axis | Values |
|---|---|
| Notes | `C1` = MIDI 24, `C3` = MIDI 48, `C5` = MIDI 72 (ideal f0 32.703, 130.813, 523.251 Hz) |
| Sample rates | 8000, 22050, 44100, 48000, 96000, 192000 |
| Velocities | `soft` 0.25, `hard` 0.95 |

| Subject | Preset id | Velocity mode | Role |
|---|---|---|---|
| Factory Rhodes | `rhodes-keys` | soft + hard | "Electric Piano (Tine)" — the required matrix |
| Rhodes FM draft | `rhodes-model-v2` | soft + hard | `fm-operator` + `multi-envelope` tranche patch |
| Metallic patch | `bell-pluck` | hard only | "FM Bells" |

`48000` is not in the plan's list; it is added because it is the project's preview rate and the 192 kHz → 48 kHz projection needs a native 48 kHz render to compare against. `bell-pluck` renders hard velocity only: it is the metallic patch under test, not the velocity matrix.

`rhodes-model-v2` has no entry in `SYNTH_PRESET_CATALOG` (the report records `presetLabel: null`); it is reachable only through `starterPatch`.

That is 90 product renders (36 + 36 + 18), 45 projections (3 subjects × 3 notes × 5 lower rates), 9 metric floors, 6 velocity-invariance checks and 6 control renders.

### Why the controls exist

A "no aliasing measured" result means nothing unless the same metric can be shown to detect aliasing when it is deliberately present. Two alias-positive controls are therefore rendered through the *same* shared renderer from mutated copies of the factory patch objects (`structuredClone` of `starterPatch`, then `mutate`). Nothing in `src/` is touched and neither control is a product patch.

| Control | Source patch | Notes / rates | Mutation |
|---|---|---|---|
| `control-saw-foldback` | `rhodes-keys` | C7 (2093 Hz), C8 (4186 Hz) at 8000 and 192000 | `source-a` sine → sawtooth, `source-b` muted, filter `lowpass` at 7000 Hz, chorus wet 0 |
| `control-fm-index-8` | `rhodes-model-v2` | C5 at 8000 and 192000 | carrier FM index 8, modulator level 1, both envelopes held open, chorus wet 0 |

The two controls cover the two failure modes the plan names: harmonic-rich foldback (saw) and sideband foldback (FM at index 8).

## 2. How the inharmonic ratio is measured

Constants are exported as `ANALYSIS` and repeated verbatim in the report (`report.analysis`), so every number below is checkable against a report rather than against this prose.

| Constant | Value | Meaning |
|---|---|---|
| `windowName` / `windowCoefficients` | `blackman-harris-4-term` / `0.35875, 0.48829, 0.14128, 0.01168` | Analysis window |
| `startOffsetSeconds` | 0.05 | First 50 ms skipped: the attack transient is broadband and would be counted as inharmonic energy at low f0 |
| `analysisSeconds` | 0.75 | Fixed-duration window, 0.75 s at *every* rate |
| `maxFftSize` | 262144 | Hard transform ceiling (192 kHz × 0.75 s = 144000 samples, next power of two 262144) |
| `harmonicToleranceCents` | 25 | Peak-picking tolerance |
| `windowMainLobeHalfWidthUnits` | 4 | 4-term Blackman-Harris main lobe is ±4/T, T = window duration |
| `f0TrackingRatio` | 1.6 | Autocorrelation lag search guided to ±1.6× the ideal period |
| `analysisLowHz` | 20 | Analysis band floor |
| `excludeHarmonicsAboveNyquist` | true | Partials at/above Nyquist are not part of the legitimate grid |
| `projectionHalfTapsOut` / `decimationTaps` / `projectionCutoffRatio` | 16 / 161 / 0.45 | Projection resampler |

Per render, the procedure is:

1. **Skip the attack.** Analysis starts at sample `round(rate × 0.05)`.
2. **Window.** Take a *fixed duration* of 0.75 s (clamped to what is available), not a fixed sample count. Resolution in Hz, and therefore the harmonic tolerance, is then the same at 8 kHz and at 192 kHz — which is what makes the ratio comparable across rates. Zero-pad up to the next power of two, capped at `maxFftSize`.

   | rate | analysis samples | FFT size | bin width | main-lobe half-width |
   |---|---|---|---|---|
   | 8000 | 6000 | 8192 | 0.9766 Hz | 5.3333 Hz |
   | 22050 | 16538 | 32768 | 0.6729 Hz | 5.3332 Hz |
   | 44100 | 33075 | 65536 | 0.6729 Hz | 5.3333 Hz |
   | 48000 | 36000 | 65536 | 0.7324 Hz | 5.3333 Hz |
   | 96000 | 72000 | 131072 | 0.7324 Hz | 5.3333 Hz |
   | 192000 | 144000 | 262144 | 0.7324 Hz | 5.3333 Hz |

3. **Track f0.** Normalised autocorrelation (Wiener-Khinchin through the same FFT, Hann-windowed copy of the segment), peak-picked over lags inside `[idealPeriod / 1.6, idealPeriod × 1.6]`, refined by parabolic interpolation, and discarded unless the normalised ACF peak exceeds 0.1. The ±1.6× window exists because several factory patches stack a partial an exact 3rd-harmonic interval above the fundamental (`bell-pluck` tunes `source-b` +19 semitones = 12·log2(3)); an unguided search locks onto that partial's period instead of the fundamental's. ±1.6× is ±814 cents — wider than any real pitch-tracking error, still narrow enough to reject harmonic multiples. The estimate is reported as `estimatedF0` with `centsError` against the ideal equal-tempered f0.
4. **Bin the band.** Analysis bins run from `max(1, ceil(max(20 Hz, f0/2) / binHz))` to `min(bins−1, floor(nyquist / binHz))`. A bin is *harmonic* when its frequency lies within `max(4/T Hz, 25 cents of the harmonic frequency)` of an integer multiple of the estimated f0 that is strictly below Nyquist. Every other bin is *inharmonic*.
5. **Report the ratio.** `inharmonicToTotal = inharmonic energy / (harmonic + inharmonic energy)` over that band, plus `inharmonicToHarmonicDb = 10·log10(inharmonic/harmonic)`.

**The ratio is not a pure alias measurement.** It counts *everything* off the harmonic grid: genuine foldback, Blackman-Harris leakage, the block-transform's time resolution, and the patch's own intentional modulation — the factory Rhodes carries a chorus whose ±1.6 % delay sweep spreads each partial by roughly ±27 cents. That is why the audit also measures every product note on its 192 kHz render and stores it as a per-note floor (`report.floors`) instead of assuming a 0 % ideal. Where there is no foldback possible (C1–C5 at 192 kHz, whose partials all sit far below 96 kHz) the floor *is* the patch's modulation-plus-leakage baseline, and a low-rate value at or below that floor is not evidence of rate-induced aliasing.

**Resolution caveat at the top of the range.** The estimator's lag resolution degrades as the period shortens. At 8 kHz, C7 (2093 Hz) is only 3.8 samples per period, so the parabolic refinement lands ~27 cents off and the ±30 cent tolerance is barely wider than the error; the fundamental itself starts falling outside the harmonic grid. This is a property of the measurement, not of the renderer: the unmutated `rhodes-keys` patch measures 0.952 at C7/8000 and 0.99998 at C8/8000 (§4), and at C8 the fundamental (4186 Hz) is above the 4000 Hz Nyquist so *no* legitimate harmonic grid exists below Nyquist. C7/C8 at 8 kHz are therefore boundary cases, not graduated alias measurements. The trustworthy graduated comparison is C5/8000, where 523 Hz is 15 samples per period.

## 3. 192 kHz → low-rate projections

Each subject/note's *hard-velocity* 192 kHz render is band-limited down to 8000, 22050, 44100, 48000 and 96000 Hz and compared against the native render at that rate.

| Target | Method (string as stored in the report) |
|---|---|
| 48000 | 161-tap windowed-sinc low-pass at `0.45 × 48000` Hz designed at 192 kHz, then decimate by 4 → `fir-lowpass+decimate-by-4` |
| 44100 | the same 161-tap low-pass at `0.45 × 48000` Hz, decimate by 4 to 48 kHz, then zero-delay band-limited resample 48 kHz → 44.1 kHz with cutoff `0.45 × 44100` → `fir-lowpass+decimate-by-4+bandlimited-resample-48k-to-44k1` |
| 8000, 22050, 96000 | zero-delay band-limited resample straight from 192 kHz with cutoff `0.45 × rate`, 16 output half-taps → `bandlimited-resample-192k-to-<rate>` |

The 44100 path goes through 48 kHz because 192000 → 44100 is the non-integer ratio 640/147, which the integer decimator cannot express. The resampler's cutoff is applied at the source rate, so the same call both anti-alias filters and retimes; its group delay is compensated by construction (`out[n]` is aligned with the source position `n / step`).

Comparison metrics over the overlapping sample count:

- `correlation` — Pearson correlation of native vs projection.
- `residualDb` — `10·log10(Σ(native − projection)² / Σ projection²)`. This is **not delay-aligned**, so a fractional-sample offset between the two paths inflates it even when the correlation is near 1; treat `correlation` as the alignment-tolerant metric and `residualDb` as a floor on the difference energy.

The projections are not expected to be bit-identical to the native renders: they exercise a *different* code path (an offline FIR/sinc chain, not the renderer's own per-rate decisions and delay-line interpolation). Their purpose is to show that a 192 kHz render band-limited to a low rate keeps the same harmonic content and the same order of inharmonic energy as a native low-rate render.

## 4. Measured results

`inharmonicToTotal`, hard velocity (0.95). Full data in `test-results/modular-synth-aliasing/report.json`; the table above documents the window/FFT parameters each column used.

| Subject | Note | 8000 | 22050 | 44100 | 48000 | 96000 | 192000 |
|---|---|---|---|---|---|---|---|
| `rhodes-keys` | C1 | 0.000007 | 0.000008 | 0.000008 | 0.000007 | 0.000007 | 0.000007 |
| `rhodes-keys` | C3 | 0.001421 | 0.001544 | 0.001548 | 0.001791 | 0.001792 | 0.001793 |
| `rhodes-keys` | C5 | 0.012228 | 0.010270 | 0.010288 | 0.017912 | 0.017921 | 0.017924 |
| `rhodes-model-v2` | C1 | 0.000002 | 0.000002 | 0.000002 | 0.000002 | 0.000002 | 0.000002 |
| `rhodes-model-v2` | C3 | 0.000000 | 0.000000 | 0.000000 | 0.000001 | 0.000001 | 0.000001 |
| `rhodes-model-v2` | C5 | 0.000021 | 0.000004 | 0.000004 | 0.000014 | 0.000014 | 0.000014 |
| `bell-pluck` | C1 | 0.002108 | 0.002200 | 0.002192 | 0.002290 | 0.002293 | 0.002289 |
| `bell-pluck` | C3 | 0.006530 | 0.006167 | 0.006475 | 0.007151 | 0.007327 | 0.007454 |
| `bell-pluck` | C5 | 0.006628 | 0.007867 | 0.007464 | 0.007693 | 0.007634 | 0.007728 |

Soft velocity (0.25) is bit-identical to hard for `rhodes-keys` (`velocityInvariance`, all three notes: the factory `rhodes-keys` graph does not wire velocity). For `rhodes-model-v2` the soft/hard ratios differ by at most 3.04 × 10⁻⁶ (C5/8000: 0.00001792 soft vs 0.00002096 hard).

Product-matrix bounds, over all 90 renders:

- Non-finite samples: **0**. Silent renders (`rms < 1e-6`): **0** (minimum rms 0.0543). Clip flags (`peak ≥ 0.999`): **0** (maximum peak 0.6069).
- f0 estimates: **90/90 present**; maximum |`centsError`| **5.944 cents** (`bell-pluck` C1 at 8000); no render exceeds the 50-cent `F0-OFF` flag.
- Maximum `inharmonicToTotal`: **0.017924** (`rhodes-keys` C5 at 192000).
- DC flags (`|dcOffset| > 1e-4`): fire on **72/90** renders (max |dcOffset| 1.483 × 10⁻³ on `rhodes-keys`). The flag is reported, not asserted; the renders are not DC-blocked.

Metric floors (`report.floors`, each subject/note at 192 kHz hard):

| Subject | C1 | C3 | C5 |
|---|---|---|---|
| `rhodes-keys` | 0.000007 | 0.001793 | 0.017924 |
| `rhodes-model-v2` | 0.000002 | 0.000001 | 0.000014 |
| `bell-pluck` | 0.002289 | 0.007454 | 0.007728 |

Every low-rate value for `bell-pluck` (all three notes) and for `rhodes-keys` C3/C5 is **at or below that note's 192 kHz floor** — the 8 kHz figure is not larger than the chorus-plus-leakage baseline the same patch produces when foldback is impossible. The two exceptions are `rhodes-model-v2` C5 (0.000021 at 8000 vs a 0.000014 floor, an absolute excess of 7 × 10⁻⁶) and `rhodes-keys` C1 (0.000007 at 8000 vs 0.000007 at 192000, i.e. equal at the reported precision).

Projections (192 kHz → lower rate, hard velocity): all 45 report `correlation` between **0.988676** (`bell-pluck` C5 → 22050) and 1.000000; `residualDb` between −110.04 and −16.37 dB. The largest native-vs-projection disagreement in `inharmonicToTotal` is 0.001182 (`bell-pluck` C5 at 8000: 0.006628 native vs 0.007810 projected) — the same order as the metric floors above.

Positive controls:

| Control | Note | Rate | inh/tot | inh/harm (dB) | tracked f0 | cents |
|---|---|---|---|---|---|---|
| `control-saw-foldback` | C7 | 8000 | 0.033696 | −14.58 | 2067.69 | −21.07 |
| `control-saw-foldback` | C7 | 192000 | 0.00000012 | −69.12 | 2092.92 | −0.07 |
| `control-saw-foldback` | C8 | 8000 | 0.99999929 | +61.52 | 3828.30 | −154.65 (`F0-OFF`) |
| `control-saw-foldback` | C8 | 192000 | 0.00000026 | −65.88 | 4185.78 | −0.10 |
| `control-fm-index-8` | C5 | 8000 | 0.842454 | +7.28 | 499.78 | −79.46 (`F0-OFF`) |
| `control-fm-index-8` | C5 | 192000 | 0.00000000 | −95.21 | 523.25 | −0.01 |

The contrast is the point:

- `control-fm-index-8` at C5/8000 measures **0.842454** against **0.000021** for the unmutated `rhodes-model-v2` at the identical note and rate — same patch object, same renderer, same analyser, ~40 000× the inharmonic energy, and it is 69× the largest product value anywhere in the C5/8000 column. At 192 kHz the same control measures 0.000000, so the excess is caused by rendering at 8 kHz and not by intrinsic inharmonic content. (Part of the 8 kHz figure is f0 mis-tracking — the estimator reports −79.46 cents — which is itself a symptom of the folded spectrum, but it means 0.84 should not be read as "84 % of the energy is a discrete alias image".)
- `control-saw-foldback` at C7/8000 measures **0.033696** against **0.00000012** for the same control at 192 kHz (~2.8 × 10⁵×) with f0 tracked inside the tolerance (−21 cents): a graduated foldback reading. At C8/8000 the ratio saturates at **0.99999929** because 4186 Hz is above the 4000 Hz Nyquist — there is no legitimate harmonic grid below Nyquist at all, so the metric reports essentially all energy as inharmonic by construction. That is a bookkeeping boundary case, not a measurement of 99.99 % aliasing.

## 5. What this establishes, and what it does not

**Reproducible and established:**

- The metric is *discerning*: two deliberately alias-prone edits of the same factory patches, rendered through the same renderer, produce inharmonic-to-total ratios 69× and 2.8 × 10⁵× larger than the product matrix and than their own 192 kHz renders.
- For the three subjects as currently patched, over C1–C5 and 8000–192000 Hz, **no render at a low rate measures more inharmonic energy than the same patch produces at 192 kHz**, apart from a 7 × 10⁻⁶ absolute excess for `rhodes-model-v2` C5. The low-rate renders are finite, audible, unclipped, and on pitch within 5.94 cents.
- The 192 kHz → low-rate projections track the native low-rate renders at ≥ 0.9887 correlation, so band-limiting a 192 kHz render does not change the harmonic content of the note.
- The objective measurement is now reproducible: two consecutive runs write byte-identical reports (101467 bytes, `sha256 17f64b679851b8b41b0b6c110b929ae5452a0c2e8916da4383fafde2b4c39dab` at `HEAD 325abca`), `npm run audit:aliasing` re-witnesses that on demand, and the frozen record [`tests/fixtures/modular-synth-aliasing.json`](../tests/fixtures/modular-synth-aliasing.json) plus [`tests/modular-synth-aliasing.test.mjs`](../tests/modular-synth-aliasing.test.mjs) gate the result inside `npm test`.

**Not established:**

- **No claim of inaudibility.** The ratio is an energy proportion, not an audibility threshold; it cannot say whether any residue is audible. There is no masking model, no equal-loudness weighting and no listening test behind these numbers.
- **No industry-standard claim.** The tolerance, band, window and floor are this audit's own definitions, chosen for cross-rate comparability. They are not an ITU/EBU/AES measurement standard and should not be quoted as one.
- **Low values do not prove absence of aliasing.** The band is `max(20 Hz, f0/2)` … Nyquist and the "harmonic" bucket is defined by the *estimated* f0; a small folded image that lands within ±25 cents (or ±5.333 Hz) of a real harmonic is counted as harmonic, and leakage/chorus energy is counted as inharmonic. A low number says "no large off-grid excess relative to this patch's own 192 kHz floor", nothing stronger.
- **C7/C8 at 8 kHz are not measurable with this method.** As shown in §2, the estimator's lag resolution breaks down there and the unmutated product patch reads 0.952–0.99998. Do not use this audit's numbers above C5 at low rates.
- **`rhodes-keys` does not respond to velocity at all** (soft 0.25 and hard 0.95 render bit-identical PCM at C1/C3/C5). The audit reports this (`report.velocityInvariance`) but does not assert it, because it is a patch-design gap rather than a renderer property.
- **`rhodes-model-v2` is absent from `SYNTH_PRESET_CATALOG`** (`presetLabel: null` in the report), so it has no factory label or category and is only reachable through `starterPatch`.
- **Human listening / producer sign-off remains OPEN.** `modular_synth_realism_plan.md:81` states that passing tests establish function and compatibility, while musical plausibility requires listening review. This audit is the automated half of that; the listening half — matched-level audition of these patches against references across the registers — has not been performed and is not claimed here.

### The listening half of the sign-off

The automated half cannot judge musical plausibility; that part is still a person listening. The material is generated locally and stays gitignored:

```cmd
npm run build
node scripts/modular-rhodes-audition.mjs
```

That writes five A/B pairs plus an audition page at `test-results/modular-rhodes-audition/index.html`: the shipped `rhodes` factory patch against the `rhodes-model-v2` draft, at MIDI 36 and 60 and velocities 25 and 95, plus MIDI 72 at velocity 95. Listen at equal subjective loudness, judge the attack, tine character, sustain, note-off and C2–C5 consistency the page asks about, and record the listener's name, the date and a per-pair verdict. Per `modular_synth_realism_plan.md:77` a patch family is promoted only when it consistently wins; if it does not, the honest outcome is to leave this section OPEN and name the register that failed.

**Read the matching method before judging level.** Each WAV is normalised so that its first 0.5 s RMS reaches a common target, with a 0.9 peak ceiling (`scripts/modular-rhodes-audition.mjs`, `AUDITION_TARGET_RMS` / `AUDITION_PEAK_CEILING` and `measureAuditionWindow`). Measured from the generated files: the two sides of every pair are identical to 0.000 dB in that window (each at −18.417 dBFS), while their sample peaks differ by **2.04–4.18 dB** — the draft is the lower-peak side in all five pairs — and the crest factor is **6.58–7.97 dB** for the current Rhodes versus **3.79–4.54 dB** for the draft. The match is a windowed RMS match, not a peak or LUFS match, and the draft is the denser signal, so a "softer or thinner attack" impression is partly the matching method. These numbers are re-derived in memory by [`tests/modular-rhodes-audition.test.mjs`](../tests/modular-rhodes-audition.test.mjs), which pins the table inside `npm test`, so they cannot rot silently.

## 6. Reproduce

The audit is deliberately kept out of `npm test`. One `runAudit()` call is ~3.3 minutes, and the repository already keeps heavy audits out of the default run as separate opt-in scripts (`test:loop-audit`, `audit:breaks`), so the work is split in two:

```cmd
npm run build
npm run audit:aliasing
npm test
```

- `npm run audit:aliasing` runs `node scripts/modular-synth-aliasing-audit.mjs --verify-twice`: it renders the matrix **twice** in-process, prints the render, projection and control tables plus both `sha256` digests, writes `test-results/modular-synth-aliasing/report.json` (101467 bytes, `sha256 17f64b679851b8b41b0b6c110b929ae5452a0c2e8916da4383fafde2b4c39dab`), and exits non-zero unless the two serialisations are byte-identical. One render alone measures ~200 s here; the two-run gate measured ~1104 s (18.4 min) with other audits running concurrently on the same host, so treat it as a several-minute opt-in job — it is the full reproducibility gate and the way to regenerate the report.
- `npm test` runs [`tests/modular-synth-aliasing.test.mjs`](../tests/modular-synth-aliasing.test.mjs), which never calls `runAudit()`. Measured 1.8 s of test time / 5.7 s wall on an idle host, and 8.2 s / 14.4 s wall immediately after a long audit on a loaded one; the ten gates themselves total well under a second, the rest is Node start plus importing the audit module (0.58 s on its own). It gates the frozen record `tests/fixtures/modular-synth-aliasing.json`, and when `test-results/modular-synth-aliasing/report.json` exists it additionally re-checks that file's byte length, `sha256` and every gate scalar against the record.
- `npm run build` must precede both: the script and the test import `dist/`.
- Because the report is a gitignored build artefact under `test-results/`, the tracked half of the gate is `tests/fixtures/modular-synth-aliasing.json` — it carries the digest and every scalar the cheap gates assert.

If you only want to time one render:

```cmd
node -e "import('./scripts/modular-synth-aliasing-audit.mjs').then(M=>console.log(M.runAudit().renders.length))"
```

**Deliberate update rule.** When a change moves the report digest, do not regenerate the fixture blindly. Run `npm run audit:aliasing`, read the gate table to see *what* moved (a single inharmonic ratio, a new silence, a projection that no longer tracks, a control that stopped discriminating), satisfy yourself that the new numbers are the ones you intend, and only then update the digest and affected scalars in `tests/fixtures/modular-synth-aliasing.json` **in the same commit** as the change that moved them. If the report is absent, the comparison test reports itself skipped and names `npm run audit:aliasing`; the frozen-record gates always run, so a stale fixture is never silently accepted.

Determinism is by construction: no timestamps, no host or environment data, no `Math.random`, no `Map` iteration-order dependence. Same inputs → byte-identical `report.json`.

## 7. Regression gates

[`tests/modular-synth-aliasing.test.mjs`](../tests/modular-synth-aliasing.test.mjs) is cheap — it imports the audit's exports (`ANALYSIS`, `MATRIX`, `SUBJECTS`, `CONTROLS`, `REPORT_PATH`, `REPORT_SCHEMA`, `formatTable`) and never calls `runAudit()`. It gates the frozen record `tests/fixtures/modular-synth-aliasing.json`, and re-checks the on-disk report against it when that file is present. It asserts:

- schema and protocol — the fixture's `schema` and `auditSchema`, the `REPORT_PATH` it names, exact JSON round-trips of `ANALYSIS`, `MATRIX`, `SUBJECTS` and `CONTROLS`, and the analysis constants (0.75 s window, 0.05 s offset, 262144 max FFT, 25 cents, 1.6× f0 tracking, 20 Hz floor, above-Nyquist harmonics excluded, 161 decimation taps, 0.45 cutoff);
- full matrix coverage — every subject × note × rate × velocity the script intends appears exactly once, plus the projection, floor, velocity-invariance and control counts, the projection methods, and the floor and velocity cell sets;
- product-render sanity — no non-finite samples, no silent render, no clip flag, an f0 within ±25 cents wherever the analyser produced one, and every inharmonic ratio at or below a 0.05 ceiling against a measured maximum of 0.017924;
- frozen bounds — the recorded extremes (max |cents error| 5.9439, max inh/tot 0.017924 `rhodes-keys C5 -> 192000`, min rms 0.05426 `bell-pluck C5 -> 22050`, max peak 0.606932, and zero non-finite / silent / clipped / f0-missing) are recomputed from the frozen rows and must match;
- floors — each recorded 192 kHz floor must equal that subject's own 192 kHz hard render row, so a floor can never drift away from the render it describes;
- the discriminating contrast — `control-fm-index-8` at C5/8000 ≥ 0.5, ≥ 100× its unmutated source at the identical cell and ≥ 10× the loudest product value in that column; `control-saw-foldback` at C7/8000 ≥ 0.01 and ≥ 100× its own 192 kHz render; C8/8000 ≥ 0.9 (above the 4 kHz Nyquist, so the metric saturates by construction); both controls ≤ 0.001 at 192 kHz;
- projection stability — every 192 kHz → low-rate projection correlates ≥ 0.95 (measured minimum 0.9886762) and moves the inharmonic ratio by ≤ 0.02 (measured maximum 0.0011817);
- velocity — exactly the three `rhodes-keys` rows are bit-identical between soft and hard, so a future change that either fixes or extends that behaviour fails the gate deliberately;
- the on-disk report — when `test-results/modular-synth-aliasing/report.json` exists, its byte length, `sha256` and every row, count and summary must match the frozen record; when it is absent only this comparison skips, with a message naming `npm run audit:aliasing`. The frozen-record gates always run.

Every threshold is pinned with the measured value quoted in the assertion message, so a failure reports the number that moved.
