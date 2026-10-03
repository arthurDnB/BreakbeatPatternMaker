# Groove V5.1: meters and DnB family recipes

V5.1 is a separate, opt-in engine. Groove V5 stays the default, and its registry,
seed streams and authored 4/4 output remain unchanged. No recordings were copied
or used to train a model. These are deterministic, editable composition recipes.

## Using it

1. Open Beat Generator and choose **Groove v5.1 · custom meters**.
2. Choose a **Time signature**, or select Custom and enter a fraction such as 11/8.
3. Choose **Tracker LPB** if the current grid cannot represent whole bars. The
   inline error explains the incompatibility; nothing silently changes the LPB.
4. Generate Beat, Bass, Melody or Piano. Each uses the same phrase duration.
   Generation remains one Undo operation. Saved patterns retain their meter.

BPM and LPB always count quarter notes. Therefore a 7/8 bar contains 3.5 quarter
notes, and at LPB 4 it occupies 14 rows. The tracker labels its seven eighth-note
beats and separates bars at row 14. A 6/8 groove groups its eighths as 3+3;
5/4 uses 3+2 and 7/4 or 7/8 uses 3+2+2. Other meters use deterministic groups of
three and two, with explicit handling of one-, two-, three- and four-beat bars.

The numerator is 1–32; supported denominators are 1, 2, 4, 8, 16 and 32. The
existing 512-row and 170-second audio-render limits still apply. Long bars thin
optional vocabulary evenly before Complexity admission to stay within the event
budget. Tiny bars suppress piano answers in an already occupied row. These are
practical tracker limits, not claims about traditional performance practice.

## Research and the resulting design

- [Future Music: six jungle and DnB grooves](https://www.musicradar.com/how-to/program-6-different-jungle-6-dnb-grooves)
  is an original programming tutorial. It demonstrates two-step backbeats,
  displaced second kicks, and halftime's single beat-three snare. Those inform
  the DnB and halftime anchors. Its neuro example moves the second kick **before**
  beat three; the requested V5.1 recipe instead uses step nine as a deliberate
  alternative, not a transcription of that example.
- [Ableton interview with Paradox](https://www.ableton.com/en/blog/paradox-breakbeat-mastery/)
  is a primary artist account of break-derived drumfunk and detailed programming.
  It supports a shifting two-bar phrase and expressive ghost-note policy. The
  exact ghost positions, gains and millisecond offsets here are authored choices.
- [UKF interview with Sota](https://ukf.com/read/jump-up-is-the-punk-of-db-in-conversation-with-sota/)
  supplies artist context for jump-up's direct, high-energy character. Strong
  upbeats and sparse ghost clutter are our interpretation, not measurements from
  the interview or a universal jump-up rule.
- [Ableton: scene tempo and time signature](https://help.ableton.com/hc/en-us/articles/5595081962524-Scene-Tempo-and-Time-Signature)
  supports keeping tempo and meter independent. Our arrangement retains each
  pattern's meter while song BPM remains a shared quarter-note tempo.

| Profile | Protected 4/4 anchor / optional expression |
| --- | --- |
| DnB | Kick 0 + 10 or 11; snare 4 + 12; eighths then sixteenths, 3 ms snare drag |
| Halftime DnB | Kick 0; snare 8; sparse hats and kick pickup, no extra snare cadence |
| Neurofunk | Kick 0 + 9; snare 4 + 12; precise hats and short ending chops |
| Drumfunk | Two-bar kick response; snare 4 + 12; soft ghosts and shuffled pickups |
| Jump-up | Kick 0 + 10 + 14; snare 4 + 12; strong offbeats, restrained ornament budget |

Positions above are zero-based sixteenths. Sound choice remains the kit's job;
an accented hat does not automatically become an open-hat sample. Odd-meter
anchors use additive grouping, while the selected profile still controls the
optional vocabulary, velocity, pocket and gestures. Named break recipes are
fitted to the active bar instead of spilling into its neighbour.

## Verification and limits

Tests cover parsing, per-bar row arithmetic, small and large meters, all existing
genres' melodic paths, determinism, old V5 fingerprints, exact-hit budgets,
locks/manual notes, project roundtrip, mixed-meter songs and PCM/WAV timing.
Browser coverage checks controls, errors, bar highlights, Undo, persistence and
audio export. Research and these tests do not replace listening review: the new
recipes are ready for audition, not a claim of definitive genre authenticity.

Core timing lives in `src/core/meter.ts`; optional profile data lives in
`src/core/groove-v51-profiles.ts`; adaptation lives in `groove-v51-meter.ts`.
The original V5 profile files are intentionally unchanged.
