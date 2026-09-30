# Think “uh” source and shaping study

This is a local evaluation of the user's `thinkbreak_uh.mp3`, `think--all5.wav`, and `Ciel.mp3` around 0:23. It is **not** a claim that the reference track's source or production settings have been identified. Source recordings and rendered candidates remain ignored under `test-results/think-uh-ab/`; none are bundled with the public site.

## Confirmed source relationship

The decoded 0.758-second MP3 aligns to the mono 44.1 kHz WAV starting at **0.68875 s**. Native-sample-rate normalized waveform correlation is **0.9950** after averaging the MP3 stereo channels. This is strong evidence that the user's MP3 is a compressed/encoded copy of that particular WAV passage. The WAV is a better starting point for new edits because it avoids another generation of encoding loss; its own earlier provenance is unknown.

The local listening sheet is `test-results/think-uh-ab/source-study.html`. It contains an A/B of the MP3 and exact WAV passage, five approximately 2.23-second source passages, identical beat-position windows, shorter cuts, repitch tests, mild coloration, and two intentionally grainy overlap/add tests. **The passage boundaries and matching beat positions are provisional**; they were chosen from repeated waveform events and have not been independently verified by ear. Every player was browser-tested for decodable audio.

## Reference search: useful but inconclusive

The `Ciel.mp3` excerpt is a finished mix. A diagnostic full-mix search compared the same approximate 20–440 ms cut from each of the first five source passages at several repitch speeds. The strongest peaks were passage 2 at 1.42× and 27.595 s (**0.339** correlation) and passage 3 at 1.42× and 27.594 s (**0.324**). These are only listening priorities: similar percussion, other layers, MP3 encoding, alignment, or processing can create or suppress peaks. A waveform correlation is neither a perceptual similarity score nor proof of the source. The analysis lives locally in `source-match.json` and `target-match.json`.

## Listening and editing sequence

1. Compare `N0` and `N1` to decide whether the WAV extraction improves the raw sound. Audition `P1`–`P5` in full and note where the wanted vocal syllable actually occurs; compare the matching `P1`–`P5` windows, but do not assume the vocal repeats at the same relative time.
2. Identify the strongest source syllable **before** adding DSP. In the app's Hit inspector, cut just before its attack and test an endpoint before the following drum transient, plus a slightly longer natural tail. Use a short fade or a nearby zero crossing to avoid clicks. Keep a copy of the untrimmed passage for context.
3. With the same source and cut, compare repitch at 1.12×, 1.42×, and 1.60×. Repitch changes pitch and duration together. Then compare the earlier K/L pitch-preserving stretch and local G1/G2 fixed-grain prototypes. The latter are exploratory offline renders, **not** production audio processors or app controls.
4. Only after source, cut and timing are settled, test restrained high-pass/low-pass filtering, saturation, envelope or a short pitch bend. A high-pass does not truly separate an overlapping drum. Audition finalists in a repeated two-bar phrase at the target BPM and compare to Ciel in context.
5. Have the user identify the best source and two nearest treatments by listening. If none has the correct syllable, search another source passage or later-generation Think sample; do not add speculative controls to compensate for the wrong recording.

The current app already supports per-hit trims, independent speed and pitch, repitch/stretch, Preview and WAV through one renderer; see [SAMPLE-SHAPER.md](SAMPLE-SHAPER.md). If listening establishes that a specific grain or formant behavior matters, prototype it against the winning cut, then integrate it as a versioned, undoable per-hit setting through that same renderer. Validate consistent Preview/WAV audio and save/reopen. Rubber Band is a possible formant-aware reference, but its GPL/commercial licensing requires resolution before bundling it.

## Research used

- [Renoise waveform and slice-marker manual](https://tutorials.renoise.com/wiki/Waveform) — transient/manual slicing, zero crossings, slice mapping.
- [Renoise sampler manual](https://tutorials.renoise.com/wiki/Sampler) — repitch and the percussion/texture time-stretch modes.
- [Splice: Lyn Collins' “Think (About It)”](https://splice.com/blog/one-shots-lyn-collins/) — vocal interjections embedded in the original break.
- [Think “uh” variant discussion](https://www.reddit.com/r/jungle/comments/1dz49qk/) — community account of multiple break passages with different vocal fragments; useful lead, not authoritative source identification.
- [Dogs On Acid Think-break production discussion](https://www.dogsonacid.com/threads/think-break.216526/) — practitioner advice on repitch, manual slices and preserving loose original timing; contributors disagree on the exact tambourine subdivision.
- [Stranjah break-chopping tutorial](https://www.youtube.com/watch?v=8kreWKsu0tg) — description lists a dedicated Think chapter at 16:07.
- [Groovin in G Renoise chopping breakdown](https://www.youtube.com/watch?v=WLSddo24Tic) — description lists a chopping/tuning chapter.
- [NITELIFE jungle vocal time-stretch techniques](https://nitelifeaudio.com/classic-techniques-timestretched-jungle-vocal/) — historical intentional grain artifacts; not a recipe for this Ciel recording.
- [Rubber Band integration guide](https://breakfastquay.com/rubberband/integration.html) and [license](https://breakfastquay.com/rubberband/license.html) — formant-preserving options and integration constraints.

Video descriptions were checked for relevant chapters; their complete demonstrations were not treated as independently verified settings for this recording.
