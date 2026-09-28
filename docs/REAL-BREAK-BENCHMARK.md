# Real-break onset benchmark (2026-09-28)

Eight locally supplied WAVs were measured: one Amen, one Think, three Apache variants, and three Funky Drummer variants. The original audio stays outside the repository. `benchmarks/real-breaks.json` contains source hashes, break families, and 152 onset references across the **first two seconds of each recording**. References came from a separate log-spectral-flux pass followed by Codex visual review of the waveforms; ambiguous decay peaks were removed. They have **not** been independently checked by listening, and the remaining duration of each recording has not been annotated. A near-start hit within 30 ms of the mandatory region-start slice boundary is excluded from scoring.

To rerun locally, create `test-results/break-transcription/real-source-paths.json` with one `{ "id", "family", "path" }` object for each of the eight IDs in `benchmarks/real-breaks.json`. Paths may be absolute; the file is Git-ignored. The benchmark validates each source's SHA-256 against the annotations and accepts PCM16 or PCM24 mono/stereo WAVs.

```powershell
npm.cmd run build
node scripts/real-break-benchmark.mjs test-results/break-transcription/real-source-paths.json
npm.cmd run audit:breaks
```

The real-break script writes `test-results/break-transcription/real-report.json`. It reports per-file precision, recall, F1, one-to-one match counts, timing error, missed times and false-marker times at ±5, ±10 and ±20 ms. Four leave-one-break-family-out folds choose sensitivity from 0.20/0.35/0.50/0.65 and minimum spacing from 20/35/50 ms using only the other families. Apache variants stay together; Funky Drummer variants stay together. Family macro averaging prevents the multi-variant families from dominating. The previous energy-rise detector is scored on the same audio as a reference baseline.

For an independent listening pass, run `node scripts/break-review-server.mjs` and open the printed local URL. **Hit only** plays from just before the selected onset and stops before the next non-rejected marker (up to a 350 ms tail); **Hit + context** adds a short lead-in and tail so you can hear the hit in the surrounding groove. The waveform zooms with the mouse wheel or `+`/`−` buttons; use **Fit** to reset and the navigator slider to move across a zoomed passage. Selecting an onset in the marker list also brings it into view. The review screen plays each full two-second passage too. Keep, reject, nudge, or add markers; progress autosaves under ignored `test-results/`. Listen through each full passage and decide every marker before marking it reviewed. When all eight are done, **Download verified labels** also writes `test-results/break-transcription/verified-real-breaks.json`. Rerun the benchmark against that file with:

```powershell
node scripts/real-break-benchmark.mjs test-results/break-transcription/real-source-paths.json test-results/break-transcription/verified-report.json test-results/break-transcription/verified-real-breaks.json
```

The verified file is kept separate from the provisional tracked references until a reviewer has completed the listening pass and the benchmark can be assessed again.

| Recording, first 2 s | Reference onsets | Current precision | Current recall | Current F1 | Previous F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Amen SU700 | 20 | 0.71 | 0.60 | 0.65 | 0.48 |
| Apache mono | 12 | 0.64 | 0.58 | 0.61 | 0.55 |
| Funky Drummer mono | 22 | 0.83 | 0.45 | 0.59 | 0.48 |
| Think all5 | 19 | 0.88 | 0.74 | 0.80 | 0.33 |
| Funky Drummer ver. 1 | 24 | 0.80 | 0.50 | 0.62 | 0.50 |
| Funky Drummer ver. 2 | 23 | 0.88 | 0.61 | 0.72 | 0.54 |
| Apache part 2 | 17 | 0.46 | 0.35 | 0.40 | 0.38 |
| Apache part 1 | 15 | 0.79 | 0.73 | 0.76 | 0.48 |

Scores in the table use ±10 ms. Across four break families, the current defaults (sensitivity 0.35, spacing 35 ms) score **0.670 macro F1**, versus **0.446** for the previous detector. The current detector scores 0.504 at ±5 ms and 0.745 at ±20 ms. The separate assembled one-shot benchmark still scores 0.933 at ±10 ms; that number should not be pooled with these continuous recordings.

The best overall grid setting on these labels is already the app's current default. Fold-selected settings score **0.650** on held-out families, below the fixed default's **0.670**. The Amen holdout fell from 0.649 to 0.571 when other families selected sensitivity 0.50. This is evidence against changing the global controls based on this small set; the detector and shipped defaults were left unchanged.

Failure review: Funky Drummer variants lose many quiet hats/ghosts while retaining relatively high precision. Apache part 2 has the largest combined miss/false-marker problem, with overlapping bongo attacks and resonant tails. Some matched attacks shift from a miss at ±10 ms to a hit at ±20 ms, especially in Amen and Apache, so reference timing and the detector's attack backtracking need closer listening review. The report lists exact times for each case so revisions can be checked without guessing.

**Quality limit:** These are short, waveform-assisted reference excerpts from only four source-break families. They are useful for regression and detecting gross overfitting, but do not establish performance over full loops, independent recordings, or perceptual slice quality. Before changing the detector or claiming production-grade accuracy, have at least two listeners verify the reference onsets, annotate longer and more varied regions, and repeat the grouped evaluation. The repo's existing manual marker editor remains the correction path for difficult breaks.
