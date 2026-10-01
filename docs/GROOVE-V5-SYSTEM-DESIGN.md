# Groove V5 system design and agent contract

Groove V5 is an opt-in drum/break generator. Groove V4 remains the default; saved V1–V4 patterns keep their engine and notes. The first profile pass covers Jungle, Liquid DnB, Boom Bap, Trap, Two Step Garage, Dubstep, Breakcore and AmenScience. The core can accept any of the current 38 genres, but inherited baseline profiles are engineering fixtures until their music is reviewed. V5 makes no claim of industry-standard authenticity without listening comparisons.

## Typed boundary

`src/core/groove-v5-contract.ts` is the handoff to profile authors. A `V5Profile` contains one- or two-bar kick/snare anchor motifs, complexity-gated supporting layers, ending cadences, role-specific pocket settings, and an allowed gesture vocabulary. Steps are sixteenth-note units from 0 to less than 16, in quarter-step increments; bar positions are 0 or 1 inside a motif. Profile data is declarative and contains no random functions or audio references. The core validates it before generating. A separate `V5PhrasePlan` states each bar's opening, continuation, response or turnaround function and whether it ends the requested phrase.

DeepSeek owns the eight pilot profile overrides, not this contract or the planner. Overrides live in `src/core/groove-v5-profiles.ts`; they must satisfy `V5Profile` and have distinct musical anchor, layer, cadence and gesture behavior. An inherited V3/V4 baseline is available for unreviewed genres and as a regression fixture. It is not the musical target for the eight pilots.

## Pipeline and invariants

1. **Plan:** Choose a seed-stable anchor motif without consulting `variation`; map `phraseLength` and `phraseOffset` to bar functions. Variation may redraw supporting material, not the motif.
2. **Protected spine:** Place the chosen kick/snare anchors on each bar. They survive Complexity, Spicy, fills and roll/build structures. Disabled roles are omitted explicitly.
3. **Complexity:** Admit named supporting layers once their minimum level is met. Each candidate has its own named deterministic random stream. Increasing Complexity cannot remove an earlier layer's note when other settings are fixed. Ghost Amount, Syncopation and per-lane Density gate only optional notes.
4. **Cadence:** Add profile-defined ending notes only at phrase endings or in explicit Fill mode. Groove mode has no automatic fill. Roll/build modes replace late optional notes with a bounded resolving roll, retaining anchors.
5. **Spice:** Select at most the profile's per-bar budget from non-anchor hits. Permitted rolls, chops, reverses, pitch moves and microtiming pushes depend on the profile. Repeat spacing and note duration are bounded by the next same-role hit and the pattern edge. The input slider never changes anchor inventory.
6. **Finalize:** Apply pocket timing, keep every audible onset inside the pattern, deduplicate role/tick slots, and return ordinary `Pattern`/`Hit` data. The existing kit routing, Think break layer, editor history, sample/synth tracks and Preview/WAV renderer remain downstream.

Random streams are keyed by seed, genre, stage, layer and candidate, with the variation number only where variation is intended. No call-order-dependent global RNG is allowed. Generated note IDs must be stable, and no input settings or profile object may be mutated.

## Integration gates

- Codex owns this contract, the deterministic core and focused unit tests. Core tests cover deterministic output, phrase placement, monotone Complexity admission, protected anchors, bounded Spicy gestures and high-tempo articulation.
- DeepSeek adds and tests the eight pilot profiles after the contract lands. Distinctness must be demonstrated at matched tempo and settings, then auditioned against multiple references.
- Antigravity wires the opt-in selector, draft/project persistence, browser A/B tests and UI guidance after the profile registry exists. Qwen only makes a pre-agreed single HTML change under review.
- Before V5 is offered in the UI, integration tests must cover locks/manual notes, Exact Hits, Think slice layering, Undo/Redo, pattern and song Preview/WAV parity, and old-project loading. Any V5 candidate reservoir used for Exact Hits must come from V5's profile rather than silently inserting V4 vocabulary.

Every agent follows `AGENTS.md`. Shared-checkout edits are serialized; unrelated local files are preserved. The release gate requires `npm.cmd test`, `npm.cmd run test:site`, a listening A/B pass and a reversible V4 fallback.

## Repeatable listening comparison

Run `npm.cmd run build` and then `node scripts/groove-v5-audition.mjs`. The script writes an ignored local page at `test-results/groove-v5-audition/index.html`, 40 WAVs and a machine-readable `report.json`. Use `--smoke` for one genre, or `--seed=your-seed` to test a second phrase. Each pilot gets the same licensed kit and tempo for five variants: V4 baseline, V5 baseline, V5 with more Complexity, V5 with more Spicy, and V5 with both raised. The page provides genre-fit and groove scores, notes and a JSON export of the listener's responses.

The report's hit counts, articulation counts and peak levels are diagnostics, not music-quality scores. In the first fixed-seed comparison, V5 had substantially more hat/percussion notes than V4 in Jungle, Trap, Breakcore and AmenScience; whether that improves the groove requires blind listening and reference comparison. Profile comments and automated tests must not be described as independent listening validation.
