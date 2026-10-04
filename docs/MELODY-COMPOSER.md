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

For a controlled old/new comparison, run `node scripts/melody-arc-audition.mjs` and open `test-results/melody-arc-audition/index.html`. It renders four representative genres with identical drums, lead instrument, harmony, seed, and length. Rate hook recall, phrasing, harmonic fit, and unwanted repetition by ear; the page does not collect ratings.

Automated tests cover deterministic output, key and register safety, genre differentiation, scale-run prevention, Complexity/Spicy behavior, song variants, lock/manual-note preservation, project roundtrip, and shared rendering. Professional musical quality still needs independent producer listening across several seeds and reference contexts; these tests alone cannot establish an industry-standard quality claim. The lead planner does not write piano chords or multi-part counterpoint.
