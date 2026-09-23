# Active scope — single-shot beat workspace

Implemented: hidden/reversible chopper UI; four single-shot lanes; 18 genre engines; five break-inspired rhythm presets; instrument inclusion independent of mute; generated variations; direct tracker and keyboard entry; locking and history; 12 CC0 acoustic/TR-808 samples; library/upload/synth selection; audition, level and tuning; WAV export; portable project save/open with embedded PCM; IndexedDB autosave and restore.

Excluded instrument conflicts with locked hits must be resolved explicitly. Ghost snares and fills follow Snare inclusion. Manual entry remains possible on any lane. Existing slice-backed projects remain readable but no new slice operations are exposed.

Authentic commercial-break one-shots were not bundled because redistribution permission was not established. All shipped library files have pinned source URLs, hashes and CC0 notices.

Next candidates: MP3 export; arrangement; velocity-layered kits; stronger sample-browser filtering. Renoise integration is retired. Original long project documents are historical and superseded by this scope and README.md.

Implemented polish: simplified generator toolbar and advanced disclosure; Preview naming; per-lane high/low-pass, drive and delay with bypass; lane/per-hit reverse; shared DSP for preview and WAV; backward-compatible project persistence.

## Implemented: pattern bank and arrangement
- Four named slots (A, B, C, Fill), copy into empty slots, automatic edit retention, and per-slot in-memory undo history.
- Queued pattern switching at full-pattern boundaries; stop cancels pending switches.
- Collapsible arrangement with append, repeats, reorder, remove, playback progress and one-pass playback.
- Full-arrangement WAV export with continuous lane effects and release tails.
- Shared kit/effects; arrangement tempo comes from the active pattern. Maximum 64 steps, 16 repeats per step, 170 seconds before final tails.
- Bank and sequence saved in local autosave and portable projects; older projects start in A.

## Implemented: per-hit ratchets and gate
Collapsed tracker articulation controls provide 1–8 repeats per row and a gate fraction for each repeat. A selected-hit Preview uses the common performance renderer. Tracker badges identify repeats and gate length. Gated attacks have short edge fades; repeats stay inside pattern boundaries while lane effects retain their tails. Locks, undo/redo, pattern banks, projects, autosave and full-note JSON preserve articulation. Existing hits default to natural decay and one attack.
