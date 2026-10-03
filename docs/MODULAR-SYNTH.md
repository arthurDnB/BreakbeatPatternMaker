# Modular synth and piano shaping

Generate a piano part from the Beat Generator using **Piano**. The Key, Scale and Chord Progression Style controls choose its harmony. The three piano controls refine the result:

- **Lushness** opens the voicing and favors smaller movements between successive chords.
- **Tension** moves from diatonic guide tones toward altered jazz extensions.
- **Density** changes the number of chord voices and the amount of lighter comping between statements.

The controls affect the next generation. Existing tracker notes remain where they are until Piano is generated again. Two-bar patterns use two chord changes; four-bar patterns use four. Locks and manual notes retain their existing behavior.

To edit a synth sound, open **Synth / Tone** above its tracker column, then choose **Open modular synth**. Drag from an output port to a matching input port; blue ports carry audio and amber ports carry control signals. You can also select the output and input using the keyboard. Drag a module header to move it. The Cables list provides exact depth values and removal controls. Preview auditions the current draft; **Use this patch** applies it to the track. Further edits become normal Undo steps. The patch is saved with the project.

Start from Bass, Pluck, Pad or Piano in the Factory menu, or add modules from the module selector. The first set includes two oscillator voices, a sample source for piano recordings, mixer, multimode filter, amplifier, ADSR envelope, LFO, note velocity, CV attenuverter, chorus, delay, reverb and output. Control cables can change oscillator pitch or gain, filter cutoff or resonance, and amplifier gain. Their depth accepts positive or negative values. Save a named preset in this browser to recall it in another project; a project file carries its active patch even when opened elsewhere.

An older synth track keeps its saved sound until **Use this patch** is selected. The editor copies its waveform, envelope and filter settings into a starting patch. Sampled piano tracks keep their stereo source when routed through the Sample module. Audio preview, song playback and WAV export use the same modular renderer. Patches are limited to 32 modules, 64 cables and an acyclic signal graph to keep rendering bounded; the tracker provides note pitch, gate and velocity.
