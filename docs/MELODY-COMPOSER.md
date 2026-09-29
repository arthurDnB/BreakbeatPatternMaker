# Melody composer tuning guide

The melody engine writes one monophonic Bassline or Lead synth lane at a time. The selected key and scale determine the pitch set. A seeded, genre-specific progression supplies an internal chord root for each bar; chords are guidance and are not rendered as a new track. Both parts use the same progression when generated separately with the same genre, seed, variation, key and scale.

## Composition stages

1. `melody-profiles.ts` selects a shared rhythm family, then a per-genre progression, pitch contour, and optional rhythmic signature. Edit this registry to tune a genre without branching the composer.
2. `melody.ts` selects a progression and a contour from independent deterministic random streams. The first rhythmic motif recurs; an alternate response and optional connecting notes appear as Complexity rises.
3. Functional intervals target roots, thirds, and fifths relative to each bar's root. They snap to the chosen scale, including pentatonic, blues, whole-tone and diminished scales. Octave choice favors smooth movement inside the selected synth register.
4. Spicy adds a phrase-ending pickup and, at high values, occasional octave accents. A four-note stepwise ascent is interrupted with a nearby chord tone. Each note carries an explanation of its phrase and harmonic role.

The 38 styles are distinct starting points, not claims that every artist in a genre uses the same harmony. Sources that informed the rules include [Strudel's tonal functions](https://strudel.cc/learn/tonal/) and [mini-notation](https://strudel.cc/learn/mini-notation/), [Native Instruments on boom bap](https://blog.native-instruments.com/what-is-boom-bap/), [MusicRadar on UK Garage](https://www.musicradar.com/how-to/uk-garage-tutorial), [Adam F on melodic DnB](https://www.musicradar.com/artists/adam-f-repub), and [Stranjah's Jungle production tutorial](https://www.transmissionsamples.com/tutorials/drum-and-bass-production/drum-and-bass-jungle-stranjah-part-1). The [Groovining channel](https://www.youtube.com/@groovining) is a tracker workflow reference; its videos were not used as a scored melody dataset.

## Listening review

Run `npm.cmd run build`, then `node scripts/melody-audition.mjs`. Open `test-results/melody-audition/index.html` for a fixed 76-example set covering every genre and both parts. The source seed and settings are printed in the page. Listen for a memorable motif, convincing placement against drums, a clear phrase ending, useful space, and compatibility between the bass and lead generated from the same settings. Keep subjective notes by genre and seed before changing profiles.

Automated tests cover deterministic output, key and register safety, genre differentiation, scale-run prevention, Complexity/Spicy behavior, and valid composition through the editor. Professional musical quality still needs independent producer listening across several seeds and reference contexts; these tests alone cannot establish an industry-standard quality claim. The current engine does not emit audible chords, multi-part counterpoint, or full-song harmonic development beyond the four-bar pattern.
