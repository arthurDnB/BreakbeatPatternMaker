# Loop playback and generation regression checks

## Implementation

- Pattern playback renders a loop buffer before starting, then uses an audio-clock looping source. The UI timer only follows playback. Requested pattern/mixer replacements render while the old source continues, then switch at a future buffer boundary. Sound-panel edits retain their existing stop-before-edit behavior.
- V3 voices retain their original envelope length when a following hit chokes their output length. A short cutoff fade remains; the natural decay is no longer compressed into a fast roll interval.
- Standard Groove never creates cadence notes that could affect Spicy budgets. Cadence insertion rejects same-lane base-tick/onset collisions, preserving existing anchors.
- Explicit rolls respect instrument inclusion, genre repeat ceilings, minimum onset spacing (including humanization), and normalized repeat energy. Complexity controls density; Spicy controls gate/pitch expression. Retained gestures are articulated only after fill/roll replacement boundaries are known.
- Full Build disables unused groove controls. Pattern Structure is disabled for older engines. Existing written events are retained on load; explicit regeneration uses revision `0.3.0-groove.3`. V1/V2 compatibility fixtures remain authoritative.

## Reproduction

1. Run `npm.cmd test` (includes `tests/loop-regression.test.mjs`).
2. With the local app serving on port 4173, run `npm.cmd run test:loop`.
3. Run `npm.cmd run test:loop-audit`. Results and A/B WAVs go to ignored `test-results/loop-audit-current/`; use `AUDIT_DIR` to choose another output directory. The audit exits nonzero on generation violations, Standard Groove fill dependence, or lock/history failure.
4. Run `npm.cmd run test:site` for root and repository-prefix deployment checks.

The browser regression verifies a future initial start, one persistent source over multiple cycles, an exact-boundary queued slot switch, and mode-specific control availability. The generation audit covers 2,630 valid cases: all 38 genres, five structures, fixed seeds, continuous controls and pairwise extremes, resolutions, lengths, phrase positions, breaks, role masks and supported older engines.

The diagnostic audio comparisons include loop and continuous rendering plus effects. Raw waveform deltas at non-integer frame positions are **not** a wrapping failure criterion: account for sub-sample attack placement and warm up long tails. A separate dry control at 200 BPM / 16 kHz with 12 warm-up cycles matched within approximately 2.4e-7 peak sample error before the fixes.

## Audition checklist

- Compare Auto-Fills and Standard Groove at the same seed and kit; Standard Groove must ignore Fill Amount but still respond to Spicy.
- Compare ending Roll and Full Build at low/high Complexity and Spicy, especially 172, 220 and 260 BPM.
- Exclude Snare: roll/build must not introduce snare notes. A full snare build with Snare excluded is silent.
- Listen across four boundaries, then queue another bank pattern. Repeat with Mute/Solo and stop before a queued change.
- Compare saved notes rendered before/after separately from freshly regenerated patterns. Preserving snare body changes loudness; louder alone is not proof of better sound.

Local historical evidence and audition pages are in `test-results/loop-audit/` and `test-results/loop-audit-after/`. These contain local project/sample data and are intentionally excluded from Git and deployment.
