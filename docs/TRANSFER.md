# Breakbeat pattern transfer version 1

This is a deliberately narrow, compiled trigger format for the Lua file importer. It is separate from the richer in-memory Pattern and from Renoise's undocumented native clipboard representation.

`format` must be `breakbeat-pattern`, `version` must be `1`. The exporter writes stable UTF-8 JSON with a final newline, no timestamps or random export identifiers. Engine version, genre and seed travel with the pattern. Events themselves are authoritative; seed metadata does not regenerate a file in the importer.

All fields in the schema are required. Unknown fields, duplicate JSON keys, missing references, fractional indices, nonfinite numbers, unsupported versions and more than 1 MiB of input are rejected. The Lua decoder also limits nesting to 16 and nodes to 100,000. Arrays and objects are distinct even when empty; JSON null is not silently converted to absent fields.

`timing.lines = bars × 4 × lpb`; bars are 1–4 and meter is 4/4. Import is capped at 512 rows (and the host's own maximum). BPM is 32–999, LPB 1–32, TPL 1–16. Version 1 has no tick-based effects, so retaining a different host TPL does not change exported trigger timing. Apply-file-timing sets all three timing values explicitly and turns off host groove.

Sources are logical IDs with drum roles, display labels, suggested instrument slots and note numbers. `kind: slice` is metadata indicating an already prepared slice key. It does not instruct the tool to alter the instrument. IDs are ASCII letters, digits, dots, underscores and hyphens. Display strings are bounded in UTF-8 bytes.

Rows, columns and instrument fields are zero based in the file. The importer converts row and column to one based Lua indices. `instrument: 0` selects `song.instruments[1]`. Notes are 0–119 (C-4 = 48). Volume and pan are 0–128 (pan center 64), delay 0–255. The tool writes volume and pan as two-digit tracker strings to avoid mixing them with effect-encoded numeric values.

Each lane becomes a dedicated new sequencer track. Each row/column cell may contain only one hit; the compiler allocates additional columns for collisions, including hits in the same row with different delays. Up to 12 columns are allowed. No native pattern effect is emitted. A silence, gate or note-off event cannot be represented in version 1.

Preflight checks the current host, pattern length, mappings, sample data, key/velocity ranges and timing policy. It requires stopped playback and LPB timing, and rejects active phrase playback on mapped instruments. The dialog may remain open while the song changes, so it rechecks the song and rebuilds the plan immediately before applying.

The import operation creates fresh tracks and a fresh sequenced pattern, writes notes, verifies every cell, then applies timing when requested. It uses `describe_undo` and makes no asynchronous yields during mutation. On an error it attempts to remove its sequence/tracks and restore timing/selection. The mock-host test exercises that path; native Undo grouping and all OS/version-specific behavior still require the live-host checklist.
