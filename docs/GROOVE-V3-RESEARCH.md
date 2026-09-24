# Groove v3: genre phrasing refinement

Research and implementation: 2026-09-25, Codex. Generator revision `0.3.0-groove.2`.

## Evidence and limits

These are original, editable production recipes, not transcriptions or definitions of entire genres. Timbre, bass interaction, arrangement and source performances also establish genre identity. A fixed swing percentage, ghost-note gain or Euclidean ratio cannot authenticate a genre by itself. The numeric timing, gain and density values below are engineering choices to audition, not measured values attributed to artists.

| Reference | Evidence used | TypeScript consequence |
| --- | --- | --- |
| [Strudel time modifiers](https://strudel.cc/learn/time-modifiers/) | Euclidean pulse distribution/rotation, early/late, event repetition and selective swing are separate transformations. | Keep pulse/anchors separate from supporting layers; preserve rational burst durations; apply swing only to eligible offbeat sixteenths. |
| [Strudel random modifiers](https://strudel.cc/learn/random-modifiers/) | Degradation removes events; it is distinct from speeding a pattern up. | Admit a supporting phrase as a unit. Never randomly delete anchor hits to increase complexity. |
| [DOA: Making mid-break shuffles](https://www.dogsonacid.com/threads/making-mid-break-shuffles.813890/) | First-person production discussion distinguishes softer snare articulations and hat/ghost interplay from a repeated snare roll. | Jungle/drumfunk support alternates hats and softer snares. Complexity and Spicy have different jobs. |
| [Ableton / cnstruct: Freshly Chopped](https://www.ableton.com/en/blog/freshly-chopped-program-modern-uk-beats-in-live/) | Original producer demonstration addresses swung modern UK garage, techno and breaks. | UKG keeps a stable backbeat while supporting hats/percussion carry shuffle; two-step kick motifs remain broken rather than four-floor. |
| [Ableton / STRANJAH](https://www.ableton.com/en/blog/made-in-ableton-live-stranjah/) and [STRANJAH subgenre tutorial](https://www.youtube.com/watch?v=sNgF8SPRYps) | Producer material treats drum patterns and sample choices together; tutorial description distinguishes Liquid, Rollers, Dancefloor, Techstep and Crossbreed. | Separate liquid restraint, repeated jump-up kick motifs and neurofunk supporting syncopation. The video description was accessible; its full audiovisual content/transcript was not analyzed. |
| [EDMProd: UK/140 dubstep tutorial](https://www.edmprod.com/how-to-make-dubstep/) | Author's worked production example places the main clap on beat 3. | Preserve a half-time spine while using sparse supporting gestures; distinguish it from brostep's stronger turnaround density. |
| [Drumeo: reggae hi-hat lessons](https://www.drumeo.com/beat/beats-and-fills/drum-beats/) | Drummer demonstrations distinguish one-drop, rockers and steppers foundations with hat variations. | Keep this application's Dub recipe explicitly one-drop; do not turn it into a generic backbeat by adding complexity. |
| [Ableton forum: 2-step/garage grooves](https://forum.ableton.com/viewtopic.php?p=1170953) | First-person discussion separates main accents from swung intervening notes. | Straight main accents, per-role swing weighting. This is practitioner guidance, not a universal numerical timing specification. |

Additional targeted searches covered Gearspace, r/edmproduction, drill/trap tutorials, Ned Rush and RP Boo interviews. Search-only snippets and inaccessible videos were not used to claim exact note transcriptions. Gearspace results did not establish a specific reliable genre template. Strudel's Euclidean examples are rhythmic tools, not evidence that techno has one mandatory Euclidean pattern. This change does not add a Techno genre.

## Musical rules

| Styles covered | Foundation and development |
| --- | --- |
| Jungle, Ragga Jungle, Atmospheric Jungle | Seed selects an ordinary or displaced second backbeat, then locks that motif. Alternating hat/ghost support connects accents. Atmospheric material retains quieter call bars and lower ornament budgets. |
| Drumfunk, AmenScience | Wider seed-selected snare vocabulary; Drumfunk keeps linear support constraints. AmenScience permits more phrase-ending edits and deliberate micro-chops. |
| DnB, Liquid DnB, Jump Up, Neurofunk, Half-time DnB | Distinct recurring kick/pulse profiles. Liquid uses fewer, longer-spaced gestures; Jump Up repeats a compact kick idea; Neurofunk adds tighter support; Half-time retains beat-3 snare. |
| Hip-Hop, Boom Bap, Rap, Lo-fi Hip-Hop, Downtempo, Mellow Beats, Trip-Hop | Stable backbeats, per-role pocket and quiet answer motifs. Rap/Mellow/Downtempo cap ornaments especially tightly. No six-hit chaos override at maximum Spicy. |
| Garage, Speed Garage, Two-step Garage | Four-floor versus broken kick foundations; two-step hats now use offbeat eighths plus selectively swung details rather than inheriting the Drill-style pulse. Hat/percussion/ghost answers remain secondary. |
| Trap, Drill, Footwork Jungle | Hat-focused gestures, rather than rolling every instrument. Drill retains its skipped hat pulse; Footwork Jungle retains its hybrid backbeat and distinct 3-in-8 support. Tresillo and equal triplets are not treated as identical. |
| Dub, PsyDub, Dubstep, Brostep, Post-Dubstep | One-drop, sparse half-time, syncopated and forceful turnaround approaches remain distinct. PsyDub permits more supporting movement; Post-Dubstep uses skip-style ornaments. |
| Breaks, Big Beat, Nu-skool Breaks, Electro Breaks, Breakbeat Hardcore, Hardcore | Existing distinct kick foundations retained. Big Beat has fewer larger accents; Electro retains straight timing; rave styles allow stronger answer/final rolls without replacing the kick foundation. |
| IDM, Experimental, Breakcore, Atmospheric Breakcore | Cross-rhythms, larger budgets and explicit chopping. Atmospheric Breakcore protects its pitched percussion line and leaves the call bars more open. |

`groove-v3-profiles.ts` contains core placement/pocket rules. `groove-v3-development.ts` contains gesture families, supporting phrases, minimum repeat spacing and phrase-stage budgets.

Complexity admits increasingly detailed *phrases*: pulse -> supporting hats/ghosts -> call/answer interactions -> optional Euclidean layers. Existing rhythm positions remain as depth increases. Euclidean support is admitted as a unit, with collisions around protected accents omitted deliberately. Spicy changes articulation within the resulting material: bounded doubles/triplets/rolls, shaped velocity, discrete pitch intervals, occasional end-of-phrase reverses and genre-permitted chops. It never bypasses a genre's repeat cap.

Bursts choose exact 120/240/480/960-tick spans at PPQ 960 rather than stretching to an arbitrary collision gap. Minimum onset spacing accounts for BPM. Per-repeat gains are energy-normalized so increasing the number of repeats does not automatically multiply the source energy. This is a gain-control heuristic, not a perceptual loudness guarantee.

## 4/8/16-bar phrase context

In Advanced generation, choose Groove v3, then **Phrase** and **Starting bar**. Leave Phrase at **This pattern** for the ordinary loop workflow. For a 16-bar sequence made from four four-bar patterns, use Phrase = 16 and Starting bar = 1, 5, 9, 13 for those four patterns. Smaller turnarounds occur at four-bar boundaries; full cadences occur at the actual phrase ending. A section may cross a phrase boundary; positions wrap.

These settings describe the section being generated. Arranging the same stored pattern four times does not automatically rewrite its fourth repetition. Generate and save the four sections separately. Anchors remain seed-stable across sections; supporting material develops. Drafts, project save/open and autosave retain the context. Legacy and v2 reject explicit v3 phrase metadata, and their normal seed/audio output remains unchanged. Opening an existing v3 project preserves its stored events; a new Generate uses revision 2.

## Verification and listening workflow

- `npm.cmd test`: all styles, resolutions and seeds; anchor preservation; monotonic rhythm depth; strict genre ceilings, onset spacing, energy bounds, phrase endings, projects and existing locks/history/audio compatibility.
- `node scripts/groove-v3-browser-smoke.mjs` with the local server: phrase controls, generation, locks, variation, inspector, Preview/WAV, project import and autosave.
- `npm.cmd run test:site`: deployed relative paths and all 233 samples at root and repository subpath.
- For listening, keep the seed, BPM, kit and master effects fixed. Compare Complexity at 0/50/100% with Spicy off, then Spicy at 15/60/100% at fixed Complexity. Compare opening and closing sections of a 16-bar phrase. Listen for stable accents, intentional empty space, ghost/hat conversation and a clear return after rolls. Repeat with uploaded acoustic hits, not only synth drums.

Unit tests establish structural and playback safety, not subjective genre authenticity. Producer listening and reference-track comparisons remain part of refinement. The existing v3 kick choke fix is preserved unchanged.
