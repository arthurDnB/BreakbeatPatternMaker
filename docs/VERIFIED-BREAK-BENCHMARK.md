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

Pass the session manifest as a fourth argument to group those numbers by region length and by session mode as well:

```powershell
node scripts/compare-break-reviews.mjs benchmarks/verified-real-breaks.json "$env:USERPROFILE\Downloads\second-review-labels.json" test-results/break-transcription/inter-review-agreement.json benchmarks/break-review-sessions.json
```

The extra `regionLengthSummary` and `modeSummary` keys are additive; every key quoted above keeps its name and shape.

## Longer excerpts and full-loop listening

`benchmarks/break-review-sessions.json` describes the passages a listener reviews. It is data only: the production detector and its defaults are untouched by it. Three sessions are defined.

| Session | Mode | Passages | Passage ids | Region |
| --- | --- | ---: | --- | --- |
| `baseline` | `fixed` | 8 | the original eight ids, unchanged | the same two seconds, `[0, 2]` |
| `long-excerpts` | `long` | 7 | `<recordingId>-long8` | four bars, 6.9–8.4 s from the recording start |
| `full-loops` | `loop` | 4 | `<recordingId>-loop` | the whole two-bar loop, 2.3–2.8 s, `loopSeconds` stated per passage |

The `baseline` session is byte-for-byte the existing eight passages in the existing order, so the documented flow above, the existing draft file, the existing export filename and the existing benchmark numbers are unchanged. Its checklist answers are stored but do not block completion, because the earlier tool had no checklist and the documented flow must keep working.

Open a session in the tool:

```powershell
node scripts/break-review-server.mjs benchmarks/break-review-sessions.json
node scripts/break-review-server.mjs --blind benchmarks/break-review-sessions.json
```

Choose the session in **Session** and the passage in the passage list. **Loop passage** plays the whole region repeatedly: the position readout shows the current playback time, and one complete pass sets the "listened to the full loop" answer. In `long` and `loop` sessions all three checklist items — *Listened to the full loop*, *Checked the first hit*, *Checked the last hit/tail* — must be answered before the passage can be marked reviewed, and the answers are stored with the passage record in the draft. Each session writes its own ignored draft and exports under its own filename:

| Session | Draft | Export | Blind draft | Blind export |
| --- | --- | --- | --- | --- |
| `baseline` | `review-draft.json` | `verified-real-breaks.json` | `second-review-draft.json` | `second-review-labels.json` |
| `long-excerpts` | `long-review-draft.json` | `verified-long-breaks.json` | `long-review-draft.json` | `second-review-long-labels.json` |
| `full-loops` | `loop-review-draft.json` | `verified-loop-breaks.json` | `loop-review-draft.json` | `second-review-loop-labels.json` |

Score one session by passing the manifest as the fifth argument and the session id as the sixth:

```powershell
node scripts/real-break-benchmark.mjs test-results/break-transcription/real-source-paths.json test-results/break-transcription/long-report.json benchmarks/verified-real-breaks.json benchmarks/break-review-sessions.json long-excerpts
```

The report adds `regionLengthSeconds`, `regionLengthClass`, `bars`, `mode`, `sessionId` and `passageId` per passage plus `regionLengthSummary` and `modeSummary`; the original keys are unchanged. Scoring a longer region uses the same fixed-start rule as the two-second benchmark — the tracker always creates a slice at the region start, labels within 1 ms of that start are fixed-start hits and the interior onsets are scored — and the same one-to-one matching with family macro averages.

Be precise about what this measures today. The reviewed labels cover only the first two seconds of each recording, so a `long` or `loop` region is scored against the subset of labels that falls inside it; it does not yet have ground truth past two seconds. The longer and loop sessions make the *listening* requirement executable — the reviewer must hear the whole region and answer the checklist — but a claim about onset accuracy on longer excerpts still needs reviewed labels past two seconds, added through the same draft. For the same reason, the `long-excerpts` region-length summary scores **0.228** macro F1 at ±10 ms: that number measures the missing ground truth, not detector behaviour, and must never be quoted as a regression against the two-second **0.613** above.

Two reproducible checks that the manifest path changed nothing: scoring the `baseline` session through the manifest gives macro F1 **0.613** at ±10 ms, cross-validated **0.625** and previous-detector **0.360**, identical to the table above, and every per-recording default F1 matches the legacy run.

## Registering an additional unrelated break

A new break is registered from three pieces of local information and never from committed audio. The WAV stays outside Git, exactly like the existing eight.

Everything the owner must supply, and how to obtain it:

| What | Question | How |
| --- | --- | --- |
| File path | Where is the break WAV on this machine? | Shift+right-click the file in Explorer, **Copy as path**, remove the surrounding quotes. It goes in the ignored local path map, never into the repository. |
| sha256 | What is the SHA-256 of that WAV? | `node scripts/break-review-registration.mjs --hash "<path to the WAV>"` prints the 64-character lowercase hash and the file length. |
| Family | Which family does this break belong to? | A short lowercase id shared with related breaks, for example `amen`. A brand new family is fine and folds into the family macro average automatically. |
| Loop length (seconds) | How long is one full audible pass? | `--duration "<path to the WAV>"` reads the file length; state the audible loop length. Loop-mode passages only; it must agree with `endSeconds - startSeconds` within 0.05 s. |
| Bar grid | How many bars long is the reviewed region? | Fractional values are allowed (0.5 for a half-bar break). This is the owner's annotation; the tool never guesses it. |

Step by step:

1. Keep the WAV outside the repository, beside the other breaks.
2. `node scripts/break-review-registration.mjs --hash "<path to the WAV>"` for the hash and length.
3. `node scripts/break-review-registration.mjs --stub <recording-id> [family]` prints paste-ready JSON for both the path map and a manifest passage.
4. Add `{ "id": "<recording-id>", "family": "<family>", "path": "<absolute WAV path>" }` to the ignored `test-results/break-transcription/real-source-paths.json`.
5. Add the passage to `benchmarks/break-review-sessions.json` under the session being extended, copying the shape of an existing passage of the same mode.
6. `node scripts/break-review-registration.mjs` re-validates the whole registration. It checks unique ids, non-empty family ids, SHA-256 shape, `startSeconds < endSeconds`, the region ending within the stated loop length, the path map entry, the family agreeing between manifest and path map, and for `loop` passages that `loopSeconds` matches the region. It prints `ok` or `NOT READY` and, for each problem, exactly which of the five items above is missing.
7. Review it in the tool, then score it with the session command above.

`node scripts/break-review-registration.mjs --help` prints the same protocol. The validator is also exported as pure functions (`validateSessionsManifest`, `validateSourcePaths`, `registrationReport`, `registrationStub`) so the checks can run in tests without audio.

## Production gate status

The open gate item (`DEVELOPMENT-LOG.md:72`) lists four items. Tooling is now ready for all four; three of them still need a human at the review computer.

| Gate item | Tooling | Awaiting |
| --- | --- | --- |
| Longer excerpts | Ready: the `long-excerpts` session (four-bar, 6.9–8.4 s), loop playback, position readout and required checklist; region-length scoring and per-length reporting in both the benchmark and the agreement report | A listener to review the excerpts and add reviewed labels past two seconds. The 0.613 macro F1 above is still a two-second result |
| Second independent annotator | Already ready: `--blind` mode, separate blank draft and separate export filename, session-aware comparison | The second annotator. This one is irreducibly human; no tooling change can substitute for it |
| Additional unrelated breaks | Ready: the registration protocol above, the `--hash`/`--duration`/`--stub` helpers, the validator with per-field guidance, and automatic family-macro folding for a new family | The owner to supply a WAV, its hash, a family id, the loop length and the bar grid for at least one break outside the current four related families |
| Full-loop listening | Ready: the `full-loops` session plays the whole loop on repeat, counts passes, records the position and requires the "listened to the full loop" answer together with the first-hit and last-hit/tail checks | A listener to complete loops and export labels |

The evidence behind the numbers in this document is still one listener, four related break families and two-second regions. None of the tooling above establishes industry-standard transcription accuracy on its own, and none of it changed the production detector or its sensitivity 0.35 / 35 ms defaults.
