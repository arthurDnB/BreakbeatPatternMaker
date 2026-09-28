# Listener-verified break onset benchmark (2026-09-28)

The user listened to and reviewed the first two seconds of eight supplied break recordings. The accepted onset labels are in `benchmarks/verified-real-breaks.json`: 101 retained markers across Amen, Think, three Apache variants and three Funky Drummer variants. The source WAVs remain outside Git. Their SHA-256 hashes and family IDs match the provisional manifest exactly.

The tracker always creates a slice at the selected region's start. Seven verified labels identify a hit within 1 ms of that fixed boundary, so the onset benchmark records them as fixed-start hits and scores the remaining **94 interior onsets**. The provisional labels have no fixed-start hits. This rule applies to the current and previous detector alike. It was added to the benchmark harness, not the production detector.

To reproduce the result with the same eight local WAVs and the ignored `test-results/break-transcription/real-source-paths.json` source map:

```powershell
npm.cmd run build
node scripts/real-break-benchmark.mjs test-results/break-transcription/real-source-paths.json test-results/break-transcription/verified-report.json benchmarks/verified-real-breaks.json
```

The JSON report contains every predicted, missed and extra onset time, metrics at ±5/10/20 ms, and the grouped validation folds. Scores use one-to-one onset matching. Family macro averages give Amen and Think the same weight as the families with three recordings.

| Tolerance | Provisional macro precision | Provisional macro recall | Provisional macro F1 | Verified macro precision | Verified macro recall | Verified macro F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ±5 ms | 0.575 | 0.453 | 0.504 | 0.436 | 0.550 | 0.483 |
| ±10 ms | 0.761 | 0.604 | 0.670 | 0.552 | 0.697 | 0.613 |
| ±20 ms | 0.845 | 0.673 | 0.745 | 0.673 | 0.837 | 0.742 |

The detector itself did not change between runs. The reviewer kept fewer, different onset times, which raised measured recall and lowered precision. At ±10 ms the current detector produces 114 interior markers, matches 65 of 94 verified interior onsets, adds 49 extra markers and misses 29. Its family macro F1 is **0.613**, above the previous energy-rise detector's **0.360** on the same verified references. The larger ±20 ms tolerance raises current F1 to **0.742**; several candidate cuts are close to a reviewed onset but not precise enough for ±10 ms.

| Recording | Verified interior onsets | Current precision | Current recall | Current F1 | Provisional F1 | Current F1 at ±20 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Amen SU700 | 11 | 0.59 | 0.91 | 0.71 | 0.65 | 0.71 |
| Apache mono | 10 | 0.55 | 0.60 | 0.57 | 0.61 | 0.86 |
| Funky Drummer mono | 12 | 0.75 | 0.75 | 0.75 | 0.59 | 0.75 |
| Think all5 | 14 | 0.44 | 0.50 | 0.47 | 0.80 | 0.73 |
| Funky Drummer ver. 1 | 13 | 0.67 | 0.77 | 0.71 | 0.62 | 0.79 |
| Funky Drummer ver. 2 | 12 | 0.63 | 0.83 | 0.71 | 0.72 | 0.79 |
| Apache part 2 | 11 | 0.46 | 0.55 | 0.50 | 0.40 | 0.67 |
| Apache part 1 | 11 | 0.50 | 0.64 | 0.56 | 0.76 | 0.72 |

Think is the most consequential change: the reviewer accepted 15 total onsets rather than 19 provisional ones, and current F1 fell from 0.80 to 0.47 at ±10 ms. Four additional Think predictions match when the tolerance widens to ±20 ms, while three reviewed interior hits remain missed. Apache mono gains three matches at ±20 ms. Apache part 2 still has five extra cuts and three misses even at ±20 ms, so a timing adjustment alone will not solve every break.

The current global settings are sensitivity **0.35** and minimum spacing **35 ms**. A grid search on these same verified labels favors 0.20/50 ms at 0.632 macro F1, but that is an in-sample maximum. Leave-one-break-family-out selection scores **0.625** against the fixed default's **0.613**, a gain of only 0.013; it improves Amen, Apache and Think holdouts but reduces Funky Drummer from 0.726 to 0.701. This is insufficient evidence to change the shipped settings.

**Recommendation:** Keep the production detector and defaults as they are. The next research iteration should inspect the 10–20 ms onset offsets and extra cuts, particularly Think and Apache, then measure any attack-localization or duplicate-suppression change on longer excerpts with a second independent listener. Keep the existing manual marker editor as the user correction path. One listener, four related break families and two-second regions do not establish industry-standard transcription accuracy.

## Independent blind second review

The second reviewer should annotate each passage from scratch without seeing the first review's onset markers. The local tool has a separate blank draft and export for that purpose. The server only binds to loopback and reads the existing local WAV path map; no WAVs or labels are uploaded.

From the repository root, start the tool with:

```powershell
node scripts/break-review-server.mjs --blind
```

It opens at `http://127.0.0.1:4175/`. Give that address to the second listener at the same computer. They should play each full passage, click each audible onset in the waveform, choose **Add hit here**, and mark every passage reviewed. The UI begins with no onset markers and saves separately to the ignored `test-results/break-transcription/second-review-draft.json`. The export downloads as `second-review-labels.json`; it does not replace the first listener's labels.

After receiving that export, compare the two completed JSON files:

```powershell
node scripts/compare-break-reviews.mjs benchmarks/verified-real-breaks.json "$env:USERPROFILE\Downloads\second-review-labels.json" test-results/break-transcription/inter-review-agreement.json
```

The report includes per-recording matched, missed and extra onsets; precision, recall, F1 and absolute timing error at ±5, ±10 and ±20 ms; and event-weighted and family-macro summaries. These are human-to-human agreement measures, not detector-accuracy results. A second listener should work in person at the review computer; this loopback-only tool is not remotely shareable over a network.
