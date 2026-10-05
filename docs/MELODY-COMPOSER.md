# Melody composer tuning guide

The melody engine writes one monophonic Bassline or Lead synth lane at a time. The selected key and scale determine the pitch set. A seeded progression supplies chord guidance; chords are not rendered on the lead track. Bassline retains its established recipe. New Lead generations use a four-bar hook arc, and **Generate Song Melody** develops that arc across the arrangement.

## Composition stages

1. `melody-profiles.ts` selects a shared rhythm family, then a per-genre progression, pitch contour, and optional rhythmic signature. Edit this registry to tune a genre without branching the composer.
2. `melody-arc.ts` develops a recurring hook, a delayed response, an altered return, and a cadence. Section labels make introductions and breaks sparser and drops stronger. Complexity admits connecting notes; Spicy admits a restrained pickup.
3. Strong arrivals prefer scale-safe chord tones; connecting notes can approach them. Pitch stays in the selected register, wide leaps are restrained, and short ascending scale ladders are interrupted. Phrases vary gain and length.
4. `song-melody.ts` plans the same hook in absolute song bars so repeats can differ. It makes editable pattern variants while leaving source patterns, drums, bass, and piano intact. Regeneration reuses variants, protects locked and manually edited lead notes, and takes one arrangement Undo step. Current key, scale, and progression apply across the new lead; the UI warns when existing accompaniment has different harmony settings.

## Use in the app

Choose Key, Scale, and Chord Progression in the generator, then press **Melody** for the active pattern. For a song, first add patterns to the arrangement and optionally name sections Intro, Build, Drop, or Outro. Press **Generate Song Melody** in the song map. Select a resulting pattern variant to edit its lead notes in the tracker. Use **Arrangement Undo** to restore the whole prior song. Saved melodies are unchanged until regenerated; regenerating a lead created by an older app version can yield a different phrase.

The 38 styles are distinct starting points, not claims that every artist in a genre uses the same harmony. Sources that informed the rules include [Strudel's tonal functions](https://strudel.cc/learn/tonal/) and [mini-notation](https://strudel.cc/learn/mini-notation/), [Native Instruments on boom bap](https://blog.native-instruments.com/what-is-boom-bap/), [MusicRadar on UK Garage](https://www.musicradar.com/how-to/uk-garage-tutorial), [Adam F on melodic DnB](https://www.musicradar.com/artists/adam-f-repub), and [Stranjah's Jungle production tutorial](https://www.transmissionsamples.com/tutorials/drum-and-bass-production/drum-and-bass-jungle-stranjah-part-1). The [Groovining channel](https://www.youtube.com/@groovining) is a tracker workflow reference; its videos were not used as a scored melody dataset.

## Listening review

Run `npm.cmd run build`, then `node scripts/melody-audition.mjs`. Open `test-results/melody-audition/index.html` for a fixed 76-example set covering every genre and both parts. The source seed and settings are printed in the page. Listen for a memorable motif, convincing placement against drums, a clear phrase ending, useful space, and compatibility between the bass and lead generated from the same settings. Keep subjective notes by genre and seed before changing profiles.

For a controlled old/new comparison, run `node scripts/melody-arc-audition.mjs` and open `test-results/melody-arc-audition/index.html`. It renders four representative genres with identical drums, lead instrument, harmony, seed, and four-bar pattern length. `--smoke` renders only the first genre (jungle) as a fast check; `--genres=jungle,boombap` renders an explicit subset. **Side A is the previous lead generator, side B is the song arc lead.** Both sides of a pair are rendered to the identical duration (the longer natural note tail; the shorter side is padded with trailing silence), because the two generators end 21-146 ms apart and a shorter ending would otherwise read as "tighter" while rating. The measured natural tails are printed by the script and shown on the page for each case.

### A/B rating protocol

1. Listen to both sides of a case (same seed `melody-arc-audition`, same drums, harmony and length), then rate **each side separately on all four axes on a 1-5 scale**:
   - **Hook recall** (higher is better): 1 = no memorable hook, 5 = instantly recallable hook.
   - **Phrasing** (higher is better): 1 = shapeless run-on, 5 = clear, well-placed phrases.
   - **Harmonic fit** (higher is better): 1 = clashes with the progression, 5 = locked to the harmony.
   - **Unwanted repetition** (lower is better): 1 = no tiresome repeats, 5 = gratingly repetitive.
2. Enter a listener name/id and optionally keep free-text notes per case. Everything stays in the browser: no network, no upload, no dependencies.
3. The **Download melody-arc-ratings.json** button stays disabled until every case is rated on all four axes *and* a listener name is entered. The page also mirrors the JSON in a text box so it can be copied by hand.

### Exported ratings schema (`melody-arc-ratings.json`, schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-05T12:00:00.000Z",
  "listener": "name or id",
  "seed": "melody-arc-audition",
  "cases": [
    {
      "caseId": "jungle-lead",
      "genre": "jungle",
      "part": "lead",
      "axisRatings": {
        "A": {"hookRecall": 3, "phrasing": 3, "harmonicFit": 3, "unwantedRepetition": 3},
        "B": {"hookRecall": 4, "phrasing": 3, "harmonicFit": 4, "unwantedRepetition": 2}
      },
      "notes": "free text, may be empty",
      "metrics": {"A": {"noteCount": 21, "distinctPitchClasses": 7, "motifRepeatRate": 0, "contourRepeatRate": 0.611, "restRatio": 0.672, "gridTicks": 240, "totalTicks": 15360}, "B": {"...": "same keys"}}
    }
  ]
}
```

### Report command (`scripts/melody-arc-report.mjs`)

```
node scripts/melody-arc-report.mjs [ratings.json ...] [--out=<verdict.json>] [--print]
```

With no argument it reads `test-results/melody-arc-audition/melody-arc-ratings.json`; several files are merged by `caseId` so more than one listener can sign off the same cases. It prints a per-case summary and writes `test-results/melody-arc-audition/verdict.json` containing, per case and aggregated per genre and overall: the paired ratings, the objective metrics and their deltas, the verdict, the reasons, plus `signOff: "complete" | "pending"`. The decision rule is pure and exported (`decideVerdict`, `aggregateVerdict`, `melodyMetrics`) so `tests/melody-arc-report.test.mjs` can score it without rendering audio.

### Decision rule (implemented, exact)

Signed deltas are normalised so **positive always means "side B is better"**: `hookRecall`, `phrasing` and `harmonicFit` use `B - A`; `unwantedRepetition` uses `A - B`. A case is then:

- **TIE** when no axis changes at all;
- **REGRESSION** when any axis regresses by more than one step, or when more axes regress than improve (with at least one regression);
- **WIN** when no axis regresses by more than one step, at least one axis improves, and B is not worse than A on `hookRecall`, `harmonicFit` or `unwantedRepetition` (a one-step phrasing loss alone does not block a win);
- **NO-CLEAR-WIN** for any other mixed result;
- **PENDING** when an axis is missing, out of the 1-5 range, or unrecognised: the case cannot be scored.

Per genre and overall, case verdicts aggregate as: **PENDING** if any case is pending; **REGRESSION** if regressions outnumber wins; **WIN** if there is at least one win and no regression; **TIE** if no case wins, no case regresses and none is unclear; otherwise **NO-CLEAR-WIN**.

### Objective metrics (deterministic, seed `melody-arc-audition`)

Computed from the generated lead pattern itself, so the same seed and settings always produce identical numbers (a unit test pins a hand-computed melody):

- **noteCount** - pitched lead events in the pattern. Activity, not quality.
- **distinctPitchClasses** - distinct `note mod 12` values. 1-3 is narrow or chant-like, 4-7 matches most scale-based hooks, 8+ is chromatic or scale-wandering.
- **motifRepeatRate** - literal self-similarity: overlapping trigrams of semitone intervals between consecutive pitched events; the fraction of trigram occurrences whose interval pattern is heard more than once. Fewer than three intervals scores 0, and rests do not contribute.
- **contourRepeatRate** - direction-only self-similarity using the sign of each interval (+1 up, -1 down, 0 repeated pitch), same repeated-trigram fraction. High contour repeat with low motif repeat usually means a transposed or displaced hook, which is often desirable.
- **restRatio** - `1 - (occupied grid slots / total grid slots)` over the pattern length, with the grid step recorded as `gridTicks` (240 = one sixteenth at 960 PPQ) and the length as `totalTicks`.

**Limits:** a high repetition rate is not automatically bad. Anthemic jungle and liquid DnB hooks are expected to repeat more literally than an IDM or atmospheric breakcore line, and these metrics say nothing about register, groove or mix. Treat each metric as one signal next to the ear, never as a verdict on its own.

### Sign-off status

The subjective producer sign-off is **still PENDING**, as recorded in `DEVELOPMENT-LOG.md:162`: the A/B files exist, but no named listener has rated every case. `signOff` becomes `"complete"` only when every case in the ratings document is rated on all four axes (`hookRecall`, `phrasing`, `harmonicFit`, `unwantedRepetition`) by at least one named listener, and at least one case exists. Until then `verdict.json` reports `signOff: "pending"` with the exact missing axes. Neither the ratings JSON nor `verdict.json` is tracked today: the audition page exports the ratings as a file the listener saves, and the report command writes its verdict, both under the gitignored `test-results/melody-arc-audition/`. Completing the sign-off means one named producer listening to all four pairs, rating every case on the four axes in the page, running the report command above, and committing the exported ratings JSON and its `verdict.json` as the audit trail, for example beside the other evidence in `benchmarks/`.


Automated tests cover deterministic output, key and register safety, genre differentiation, scale-run prevention, Complexity/Spicy behavior, song variants, lock/manual-note preservation, project roundtrip, and shared rendering. Professional musical quality still needs independent producer listening across several seeds and reference contexts; these tests alone cannot establish an industry-standard quality claim. The lead planner does not write piano chords or multi-part counterpoint.
