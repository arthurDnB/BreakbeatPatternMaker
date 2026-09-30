# Per-hit sample shaping

Select a sample hit in the tracker and open **Hit inspector → Sample cut, speed & tone**. Enable **Use a precise sample cut**, then drag the two waveform markers or enter start/end times in milliseconds. **Preview pending hit** auditions the draft; **Apply to selected hit** saves it as one undoable edit. The sample file is unchanged.

**Hit speed** sets a rate from 0.5× to 2×. **Speed mode** can inherit the instrument setting, repitch (speed and pitch move together), or stretch (duration changes while the source pitch is approximately retained). The regular hit pitch control remains available. Stretch mode compensates the duration change caused by later pitch resampling when the required stretch ratio is in the current 0.5×–2× processing range. Extreme combined pitch and speed settings clamp that internal ratio, so their duration can differ from the requested speed. The existing waveform-similarity stretcher is useful for auditioning but can add grain or transient artifacts to very short vocal chops.

The trim is stored on the hit relative to its resolved source slice. It is validated during editing and project loading, applied before stretching, and faded for 2 ms at both new cut edges. Preview, song playback, and WAV export all use the same renderer. The per-hit speed mode and trim survive Undo/Redo and project save/reopen. A trim belongs to the main hit and is not copied to a separate drum layer.

The local Think vocal comparison is in `test-results/think-uh-ab/index.html` when those source files are available on the developer's computer. H/J compare repitch; I is a 20–440 ms source cut; K/L use that cut with independent stretch speed; M adds +5 semitones while retaining the intended 1.12× duration. These are listening candidates, not verified reconstructions of the reference song.

## Further DSP work

Formant control and a vintage granular stretch mode need a dedicated audio prototype and listening evaluation before becoming app controls. The current stretcher does not provide independent formant shifting. Rubber Band supports formant-aware pitch/time processing, but its GPL/commercial dual license must be resolved before bundling it in this app. Preserve the shared renderer contract: any future processor must produce identical Preview and WAV results, and saved projects must retain its settings. See the [Rubber Band licensing terms](https://breakfastquay.com/rubberband/license.html).
