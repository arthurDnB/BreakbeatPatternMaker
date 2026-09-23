Breakbeat Pattern Importer 0.1

Install: drag the packaged .xrnx file onto Renoise.
Tools > Breakbeat Pattern Maker > Load Original Demo Kit
Tools > Breakbeat Pattern Maker > Import Pattern File...

Import .bbpattern JSON from Breakbeat Pattern Maker. A new pattern is appended
and dedicated regular tracks are prepended. Original pattern notes remain intact.
Map each logical source to an existing sample instrument and trigger note.
Instrument slots in the dialog are hexadecimal and zero based; C-4 is note 48.
Demo mappings detect instruments named BPM kick, BPM snare, BPM hat, BPM percussion.

Default: retain song timing, requiring matching BPM/LPB and disabled host groove.
Optional: Apply file timing changes BPM, LPB, TPL and groove for the ENTIRE song.
Stop transport first. Use Renoise Undo after import to revert it.

Only notes, instrument mappings, volume, pan and delay are imported in version 1.
Slice sources are mapped trigger notes in an already prepared sample instrument.
Audio, slice markers, reverse, pitch effects, envelopes and note cuts are not
transferred. Configure source sample tails, mappings and choke behavior in Renoise.

Native Renoise clipboard compatibility is unverified and NOT implemented.
Use the file importer. No clipboard reading, external commands or networking.

Compatibility: written against the locally installed Renoise 3.2.1 API 6 docs.
Automated tests use a simulated host. Live host import, audible parity and native
undo grouping must still be confirmed in Renoise before production use.

The four demo WAVs are original procedural synthesis, not copyrighted break samples.
They are generated from public/synth.js included in the source project.
