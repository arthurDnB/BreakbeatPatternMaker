# Configurable drum lanes

Open **Configure drum lanes** above the tracker. Each of the four built-in sample lanes has three independent choices:

- **Name** changes the tracker header without changing the sound or generator rules.
- **Show** hides or reveals the lane in the tracker. Existing hidden notes still play; use the lane's mute control to silence them. Hidden lanes do not receive newly generated hits.
- **Generate** chooses the beat part placed in that lane on the next Beat or Variation generation. **No generation** leaves it out of new beats. Multiple visible lanes may choose the same part to layer a rhythm with different samples.

For example, set the Kick lane's sample to a Think snare, name it “Think Snare,” choose **Snare** under Generate, then set the original Snare lane to **No generation** or hide it. The next generated beat places snare timing in the renamed lane and plays its selected sample. The original lane sound, mixer and effects remain attached to the lane, not to its chosen beat part.

Lane settings live in the pattern and survive Undo/Redo, project save/reopen, and pattern generation. Older projects without lane settings use their original four visible lanes and matching beat parts. Additional sample and synth tracks remain editable and can be renamed, reordered or removed; assigning the beat generator to arbitrary added sample tracks is a later extension.
