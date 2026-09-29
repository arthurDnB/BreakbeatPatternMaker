# Configurable drum lanes

Open **Configure drum lanes** above the tracker. Each of the four built-in sample lanes has three independent choices:

- **Name** changes the tracker header without changing the sound or generator rules.
- **Show** hides or reveals the lane in the tracker. Existing hidden notes still play; use the lane's mute control to silence them. Hidden lanes do not receive newly generated hits.
- **Generate** chooses the beat part placed in that lane on the next Beat or Variation generation. **No generation** leaves it out of new beats. Multiple visible lanes may choose the same part to layer a rhythm with different samples.

For example, set the Kick lane's sample to a Think snare, name it “Think Snare,” choose **Snare** under Generate, then set the original Snare lane to **No generation** or hide it. The next generated beat places snare timing in the renamed lane and plays its selected sample. The original lane sound, mixer and effects remain attached to the lane, not to its chosen beat part.

Uploaded sample tracks also have a **Beat part** menu above their tracker column. Choose Kick, Snare, Hi-hat or Percussion to place that rhythm on the uploaded sound at the next **Generate Beat** or **Variation**. Choose **Manual only** to leave the track for hand-entered notes. Any number of sample tracks can receive the same beat part; synth tracks remain dedicated to their pitched notes. You can set the four built-in lanes to **No generation** and use only uploaded sample tracks for the beat.

Generated notes on uploaded tracks are replaced on the next beat generation. Hand-entered notes, notes edited in the tracker, and individually locked notes stay in place. A locked generated hit stays even after assigning **Manual only**; unlock it if you want to clear it. Track assignments and generated notes survive Undo/Redo and project save/reopen. Both Preview and WAV export play the uploaded track's sample, with its own track level and pan. Older projects without assignments keep the original four visible lanes and matching beat parts.

Open **Shape** above an uploaded sample track for two more controls:

- **Optional hits (density)** keeps a stable proportion of that track's generated detail. Lower values remove softer and ghost notes first. At 0%, the main anchor hits still play.
- **Variation chance** gives each remaining optional note a chance to appear in a specific generation. Generate with the same seed and variation for the same result; **Variation** can choose a different subset. At 100%, every note admitted by density is kept. At 0%, only anchors remain.

These settings act on each uploaded track independently, after the genre engine makes the beat. They never remove locked or manually edited hits. The four built-in lanes continue to use the Groove V4 per-role density controls in the generator. The new track settings are stored with the pattern and project; older projects default both to 100%.

The tracker editing bar also works with generated notes on uploaded sample tracks. **Mutate** adjusts a small share of their optional hits within the selected cells or rows (or the full pattern when nothing is selected). **Simplify** removes quieter optional hits. **Increase complexity** adds genre-aware notes across eligible tracks; it uses a richer generated candidate without changing the generator's Complexity slider. **Generate Fill** adds ending hits to every track assigned the relevant beat part. Select the ending rows first. Main anchors, individually locked hits, and manually entered or edited sample-track notes are protected, and each action is one Undo/Redo step.
