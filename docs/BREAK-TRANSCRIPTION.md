# Break transcription — preview release

## Use it

1. Click **Import break** in the project toolbar and choose an isolated drum WAV (mono/stereo, up to 50 MB and two minutes).
2. Select the region with Start/End and **Apply region**. Confirm how many bars it contains (1–4, in 4/4). Source BPM is calculated from that duration and bar count; it is not an automatic tempo estimate.
3. Click **Detect slices**. Defaults are sensitivity 0.35 and minimum spacing 35 ms. Lower spacing for fast rolls; raise sensitivity for quiet details. Closely spaced hits and heavily processed tails may need manual correction.
4. Compare **Original** and **Reconstructed**. Both loop the region dry. Zoom/scroll the waveform, double-click to add markers, drag to move them, or enter an exact marker time. Gold markers are manual/reviewed and survive detection. Reset markers explicitly clears them, with Undo available. Detection exceeding 120 slices keeps the previous markers and explains how to reduce the count.
5. Click **Create instrument & pattern**. A new bank slot contains the break on the percussion lane, named after the recording. Your previous pattern and the song tempo are preserved. Original recorded timing is retained, including off-grid offsets and quiet dynamics.
6. Notes C-0 upward select consecutive slices. **Slice octave** chooses the keyboard range; Z–M enters its first octave and Q–U the next. Pitch in the hit editor transposes the selected slice independently. Clicking a specific hit can select it even when several hits share a row; clicking an empty area selects the cell. Arrow keys/Tab navigate tracker values.
7. **Edit slices** (or a mapped hit's BRK instrument field) reopens that pattern's mapping. Apply commits one pattern Undo/Redo step. Removing a slice still referenced by notes is rejected; remove its notes first. Locked notes protect their slice boundaries. Editing boundaries changes the instrument; it does not move already-arranged tracker notes.
8. Save the project to retain PCM, mappings, bank slots and history, or export WAV through the existing pattern/song export controls. Pattern playback uses the lane mixer and effects; the review A/B is dry. Song playback uses the song tempo, which may differ from the imported break.

Waveform keyboard controls: Left/Right select slices, Space previews, Delete removes a marker, +/- zoom. Escape closes the dialog and returns focus. Analysis runs in a cancellable worker; no audio is uploaded.

The original recording stays intact. A kick and hat sounding together remain together in their slice. This release does not classify drum types, separate stems, estimate velocity, time-stretch, or automatically compose genre patterns from unlabeled slices. Changing the pattern tempo moves event times; sample speed and pitch remain explicit controls.

## Architecture and extension points

- `src/audio/break-analysis.ts` is a deterministic, UI-independent analysis function. It accepts source PCM, sample rate, region, sensitivity, minimum spacing and pinned markers. It returns frame boundaries and relative candidate strengths. It combines three energy bands, stereo-safe positive spectral flux (Hann-windowed FFT), adaptive peak thresholds, and limited attack backtracking. Strength is not a calibrated confidence probability. The worker is a thin adapter with progress/error reporting; cancellation terminates it.
- `SliceInstrument` lives in a pattern snapshot, references one immutable audio asset, and stores stable slice IDs and explicit note assignments. `Hit.mapped` holds an instrument ID and note; `Hit.pitch` remains separate. The resolver is shared by compilation, kit preparation and audio rendering. A future analysis model can replace detection without changing this contract.
- Source frame coordinates remain authoritative. Import decodes at the source sample rate. No quantization, normalization or inferred velocity is applied to reconstruction. Dry, unchanged adjacent slices have no boundary fades. Discontinuous edits receive short fades; optional 0–10 ms loop smoothing is stored per instrument. Mapped-only rendering bypasses the existing automatic master saturation, preserving loud source transients; ordinary generated-kit rendering keeps its established behavior.
- Drum-specific auto-chokes do not apply to mapped break slices. User articulation, pitch, reverse, effects, lane mixing and exact-bar export still use the shared renderer. Copies of a pattern can have independent slice edits and loop smoothing settings, including in a song.
- Project version 4 carries mapped instruments in every saved pattern/history snapshot and includes their PCM even if all notes were deleted. Older project versions remain readable. Copy/paste carries instrument definitions; conflicting versions of the same instrument are rejected rather than silently changing existing notes.
- The static-site builder explicitly packages the analysis worker and its dependencies. No server or runtime package is required on GitHub Pages.

## Verification and quality gate

Run:

```powershell
npm.cmd test
npm.cmd run test:site
npm.cmd run audit:breaks
```

The audit writes WAV fixtures, trigger/detection frame lists and `report.json` under `test-results/break-transcription/`. Source one-shots are the existing licensed acoustic and 808 recordings in the catalog. Four assembled fixtures were used for development; two additional fixtures use separate one-shots and tempos. The baseline is the previous energy-rise detector at sensitivity 0.5 and 25 ms spacing. The new defaults are 0.35 and 35 ms; the report compares the complete default configurations, not identical sensitivity scales.

Measured on 2026-09-28, at a ±10 ms onset tolerance:

| Assembled fixture | New F1 | Previous F1 |
| --- | ---: | ---: |
| Acoustic straight | 0.882 | 0.467 |
| Acoustic swung ghosts | 0.905 | 0.258 |
| Electronic fast | 0.914 | 0.439 |
| Electronic noisy swing | 1.000 | 0.333 |
| Held-out acoustic | 0.895 | 0.486 |
| Held-out electronic | 1.000 | 0.333 |

Macro-average F1 is 0.933 overall and 0.947 on the two held-out assembled fixtures. These are known trigger annotations in programmatically assembled breaks, **not independent human annotations of continuous recorded drum performances**. The small held-out set does not establish generalization to commercial breaks. Misses and false markers remain, especially soft overlapping hits and long acoustic attacks.

Unit tests verify maximum reconstruction error <= `1e-5` against the selected source at 22.05, 44.1 and 48 kHz, stereo phase safety, mapped note/pitch independence, collision preservation, locks/history, clipboard, missing audio, project persistence and per-pattern song rendering. Browser smoke tests cover worker delivery, cancellation, marker editing, A/B controls, new-slot import, same-row individual edits, Undo/Redo, project reload, WAV download and small screens at root and repository-subpath URLs.

**Production-quality gate remains open:** obtain a redistribution-cleared set of continuous isolated drum performances, annotate transient starts independently (including quiet ghosts and rolls), hold out recordings before tuning, measure per-recording precision/recall/F1, and perform listening review of reconstruction and edited loop seams. Target held-out F1 >= 0.90 within ±10 ms, with difficult cases reported separately. Do not describe this preview as perfect transcription or industry-standard accuracy until that gate has evidence.

A first continuous-recording audit now covers eight user-supplied WAVs with listener-reviewed first two-second passages and break-family grouped validation. See [the verified real-break benchmark](VERIFIED-BREAK-BENCHMARK.md). Longer annotations, a second independent listener, and more unrelated source families remain necessary; the current defaults were retained because the verified-label tuning gain was small and uneven across families.

### Production gate status

The gate is split into two roadmap items in `DEVELOPMENT-LOG.md`: the one-listener benchmark is complete, and independent verification is open. Every step below runs with committed tooling; the listening and annotation judgements themselves still need a human reviewer. The review sessions are declared in `benchmarks/break-review-sessions.json` (baseline `fixed`, `long-excerpts`, `full-loops`), and each recording is pinned there by SHA-256 and family.

1. **One-listener benchmark (complete).** Eight two-second passages, 101 accepted onset labels. Reproduce with `npm.cmd run build`, then `node scripts/real-break-benchmark.mjs test-results/break-transcription/real-source-paths.json test-results/break-transcription/verified-report.json benchmarks/verified-real-breaks.json`. Verified macro F1 at +/-10 ms is 0.613. This is a reproducibility milestone, not industry-standard accuracy.
2. **Longer excerpts.** `node scripts/break-review-server.mjs` serves the `long-excerpts` session (seven 6.9-8.4 s excerpts over the same eight recordings) next to the baseline; switch sessions in the page. Score the detector over a longer window with `node scripts/real-break-benchmark.mjs test-results/break-transcription/real-source-paths.json test-results/break-transcription/long-report.json benchmarks/verified-real-breaks.json benchmarks/break-review-sessions.json long-excerpts`, which measures every verified label that falls inside the stated region plus any extra markers the longer window exposes. Review export: `verified-long-breaks.json`.
3. **Full-loop listening.** The same server serves the `full-loops` session (four two-bar loops, 2.3-2.8 s, played on repeat) and requires a complete pass plus the per-session checklist (`listenedFull`, `firstHitChecked`, `lastHitChecked`) before a passage can be marked reviewed. Review export: `verified-loop-breaks.json`.
4. **A second independent annotator.** `node scripts/break-review-server.mjs --blind` hides the first listener's labels and exports `second-review-labels.json` (`second-review-long-labels.json` and `second-review-loop-labels.json` for the other sessions). Compare with `node scripts/compare-break-reviews.mjs benchmarks/verified-real-breaks.json <exported labels> test-results/break-transcription/inter-review-agreement.json`, which reports per-recording matched/missed/extra counts and precision/recall/F1 plus absolute timing error at +/-5, 10 and 20 ms, event-weighted and family-macro. This measures human-to-human agreement, not detector accuracy. The server binds to loopback only, so the second listener must use this computer.
5. **Additional unrelated break families.** Add passages for recordings outside Amen, Think, Apache and Funky Drummer to the sessions manifest with their SHA-256 hashes and family IDs, then review them as a new session. Acceptance: at least one unrelated family is reviewed by both listeners.
6. **Held-out detection quality.** Acceptance: per-recording precision/recall/F1 on recordings that were never used for tuning, with held-out F1 >= 0.90 within +/-10 ms and difficult cases reported separately. The current verified value is 0.613.

Steps 2-5 need a person at the keyboard; step 6 depends on their annotations. Until step 6 passes, the preview must not be described as perfect transcription or industry-standard accuracy.

Workflow reference: [Renoise sampler slice markers and Render Slices to Phrase](https://tutorials.renoise.com/wiki/Waveform#Slice_Markers).
