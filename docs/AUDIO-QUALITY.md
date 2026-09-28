# Audio-quality controls and checks

The instrument accordion now has two independent speed modes. **Repitch** is the established default: a faster sample also rises in pitch. **Preserve pitch (stretch)** changes its duration through deterministic waveform-similarity overlap/add while leaving the source pitch approximately intact. Set the speed slider or original BPM/follow BPM as before, then choose the mode. Preview and WAV export use the same renderer. Pitch transpose remains available separately.

Stretch is designed for short chops and one-shots, not full-song mastering. Percussive transients can smear or repeat at extreme 0.5×/2× settings; audition the result and use Repitch when its character is preferable. The implementation searches one channel for matching grain boundaries and applies the same shifts to all channels, preserving their relative alignment. It does not overwrite imported PCM. The approach is informed by the [original WSOLA paper](https://www.isca-archive.org/eurospeech_1993/roelands93_eurospeech.html), but this implementation has not been perceptually benchmarked against commercial time-stretch processors.

Each instrument accordion also has **Layer a second sound**. Choose another sound from that lane's catalog or the lane's uploaded sample, then set its relative level, timing offset (−10 to +10 ms), and optional polarity inversion. Both voices inherit the tracker note's timing, pitch, gate, ratchets, and effects; the offset and level apply to the second voice. A layered kick/snare/hat is treated as one trigger for choke purposes, so it cannot silence its own primary hit. Mapped break-slice instruments are excluded from automatic layering to preserve exact reconstruction.

The **Mono check** compares the first 100 ms of the two source sounds at the selected offset and level. A warning means the mono sum is more than about 2 dB quieter than the stronger individual sound in that window. This is a practical cancellation hint, not a full phase-alignment or stereo-mastering analysis. Listen in mono, try polarity inversion and small offset changes, then decide by ear. User uploads remain local; layer choices and PCM are saved in the project.

For Groove V4, the master bus uses a linked linear gain trim only when the summed render exceeds a 0.96 ceiling based on a four-times interpolated peak estimate. This avoids changing stereo balance or adding saturation to an already clean render. A WAV export reports any trim in dB. Saved V1–V3 patterns retain their prior PCM/master behavior. The estimate is not a certified true-peak meter or loudness normalizer; leave additional mastering headroom for release.

## Regression checks

- `npm.cmd test`: duration/pitch and stereo-alignment fixtures, master headroom and mono metrics, layer offset and choke behavior, project roundtrip, deterministic Preview/WAV render data, and legacy PCM fingerprints.
- `npm.cmd run test:site`: packaged app smoke tests at the root and GitHub Pages subpath.
- `node scripts/audio-quality-browser-smoke.mjs`: browser controls, sound layer loading, project save/reopen, and WAV download against a built `site/`.

For a listening pass, compare a 1–2 second vocal chop at 0.75×, 1×, 1.25× and 1.75× in both speed modes; check initial consonants, tails, loop join, and stereo image. Compare a layered kick and snare in stereo and mono at offsets −3, 0, and +3 ms with polarity normal/inverted. Record examples that reveal double attacks or tonal flutter before tuning the algorithm further.
