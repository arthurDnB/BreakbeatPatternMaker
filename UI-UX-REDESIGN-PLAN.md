# UI/UX assessment and redesign plan

Assessment date: 2026-09-23
Scope: current local application, source inspection and a fresh browser session at 1440×900 and 390×844. This is a heuristic assessment, not a user study. No application behavior changed during this review.

## Product direction
Make the tracker the center of a music workspace. A user should be able to hear a pattern, select a hit, change its sound, and export without navigating a long settings page. Preserve the current engine, single-shot workflow, project compatibility, effects, pattern bank, locks and undo/redo.

## Evidence and findings

In a fresh default session, the page measured 3,544px high at 1440×900. Generation began at y=1,045, Play at y=1,268, and the tracker at y=2,636. At 390×844 the page measured 6,931px high and the tracker began at y=5,959. These measurements describe this test session, not every saved layout.

1. Critical — the central activity is below several screens of setup. Instrument cards, generation, bank and the entire hit-entry form precede the tracker.
2. High — playback is separated from the grid; pattern, slot and arrangement playback controls compete. Users must track which thing is playing.
3. High — the full hit editor is present with no hit selected. Position, source mapping and keyboard settings receive the same prominence as pitch and volume.
4. High — draft controls and applied state are hard to distinguish. Generation settings require Generate; hit settings require Apply; instrument settings take effect immediately. A generic status line is too far away to explain all three.
5. High — Variation currently regenerates with a different seed, while Mutate makes a related edit. The labels do not communicate the difference in how much changes.
6. Medium — four tall instrument forms dominate the first screen. Sound selection, upload, tuning, effects and generation participation can be shown on demand.
7. Medium — the bank uses large cards and duplicated edit/play/preview actions. Arrangement is hidden but still expands into the same long page.
8. Medium — raw pan/volume/delay values and hexadecimal hit text raise the learning barrier. Technical views should remain available, with musical values as the default.
9. Medium — small helper text, similar button emphasis, repeated bordered panels, native file inputs and inconsistent control heights create an unfinished appearance. Dashed borders imply drop targets even on the bank panel.
10. Medium — phone layout stacks the desktop forms rather than prioritizing tasks. Lack of horizontal overflow alone does not establish good mobile usability.

Keep: consistent drum colors plus names, dark theme, deterministic generation, responsive grid, local autosave, project/sample portability, established audio behavior and useful locks/history.

## Proposed desktop structure

Persistent top bar: project name / File | Play–Stop / Pattern–Song / BPM / position | Undo–Redo | Export.

Compact generation strip: Genre | Complexity | Bars | Generate new | More settings. Instrument participation uses small labeled chips here.

Pattern tabs above the grid: A | B | C | Fill | duplicate action. Distinguish Editing, Playing and Queued states using labels, not color alone.

Main work area: tracker occupies most of the width; a roughly 300px contextual inspector occupies the right side. The grid has sticky lane headers, clear bar divisions and an optional follow-playhead toggle.

Inspector tabs: Hit, Instrument, Learn. Selecting a hit opens Hit; clicking a lane header opens Instrument. With nothing selected, display one short action hint instead of a form.

Pattern / Song workspace tabs: Song shows the arrangement in the central work area. Sequence blocks show slot name, bar count and repeats; move/add/remove controls remain keyboard accessible. Keep buttons initially; drag reordering can follow later.

## Interaction decisions

- Hit inspector basics: pitch, volume, pan, reverse and Preview. Ratchets/gate are a second group. Microtiming, exact position, sample mapping and keyboard-entry settings go under Advanced.
- Show pitch in semitones, volume as percent, pan as center/left/right, microtiming with a readable unit. Retain exact tracker values in the technical view. Avoid suggesting volume is MIDI velocity unless the engine models it that way.
- Stage 1 retains Apply but displays a clear pending-edits state beside it and provides Revert. Preview must state whether it plays saved or pending values. Do not silently discard pending changes when selecting another hit.
- Stage 2 introduces direct editing: changing a selected hit updates it immediately, one slider gesture equals one undo action, typing commits on Enter/blur, Escape cancels. Preview uses current values. Locked hits expose their state and a clear Unlock action instead of accepting a change that later fails.
- Separate Generate new (fresh rhythm) from Make variation (existing mutation behavior). Fill uses a selected range; without a range, offer a clearly labeled last-beat default.
- Generator drafts display Settings changed — Generate to apply next to the controls. Applied pattern metadata stays visible. Do not silently change current tempo while showing an unapplied generator value.
- Instrument inspector shows sound chooser, Preview, Upload/Replace, level, tuning, reverse and collapsed effects. Label kit changes as applying to all patterns. Generate-with toggles remain separate from playback mute.
- One main transport with an explicit Pattern/Song target. Isolated hit/instrument Preview remains available, with visible playback state. Queued pattern switches show their target and boundary behavior.
- One Export dialog: Pattern or Song, WAV, tail behavior and filename. Existing JSON actions live under Advanced. Only show implemented formats; stem and MP3 export are outside this redesign.
- Use a clearly defined song tempo rather than implicitly changing arrangement tempo whenever a different slot is selected. Treat this as a separate data-model change with migration: older projects initialize song tempo from their saved active pattern.
- Distinguish Saved locally from Download project backup. Surface failures near the relevant action; errors remain until addressed rather than disappearing as a brief notification.

## Visual system

Use shared tokens for spacing (4/8/12/16/24), surface colors, borders, typography, corner radius and control heights. Use a readable UI font for controls and monospace only for grid/timing data. Prefer 13–14px body/control text over 10px instructions. Use one accent for primary actions, subdued secondary actions, and clear destructive styling.

Retain kick red, snare blue, hat yellow and percussion green; distinguish ghost hits with an additional symbol/shape or outline. Active selection, playback, lock and queued states need separate visual treatment. Verify contrast rather than assuming the current colors pass. Provide focus-visible states, accessible names, keyboard navigation and touch targets; use approximately 44px touch controls where needed.

Short contextual hints replace repeated paragraphs. Put detailed instructions in a Help/Learn panel. Custom Upload/Open buttons should still trigger accessible native file pickers.

## Responsive behavior

Desktop: central tracker and docked inspector, with the first rows visible on first load.
Tablet: tracker plus an inspector drawer; transport stays visible.
Phone: switch between Pattern, Sounds and Song. Open hit editing in a dismissible sheet with its target named. Preserve horizontal tracker navigation as necessary. Do not stack all four instrument forms above the pattern. Keep playback reachable and ensure drawers do not cover focused controls.

## Delivery phases

1. Workspace layout — persistent transport, generator strip, compact pattern tabs, grid-first layout, collapsible instrument area and inspector. Initially preserve edit semantics and existing IDs. Deliver a working layout with first rows visible at 1366×768 and 1440×900.
2. Hit editing — contextual inspector, pending-state clarity, accessible selection/lock states, then transactional direct editing. Add editor APIs for preview/commit/cancel so one drag does not create dozens of undo entries. Verify exact undo and save/load behavior.
3. Sound selection — compact instrument controls, clearer include/mute distinction, consistent Preview and upload buttons, effects indicators and shared-kit messaging.
4. Song and export — central arrangement view, persistent target-aware transport, explicit song tempo with migration, unified export dialog. Keep audio rendering unchanged except where a separately tested tempo model requires it.
5. Professional finish — component/tokens cleanup, typography, contrast, keyboard behavior, responsive drawers, contextual guidance and usability testing.

Build phase 1 first. Do not combine a framework rewrite, audio-engine changes and the layout redesign. Separate transport, generator, bank, grid, hit inspector, instrument inspector and export presentation modules within the existing TypeScript application. Keep project and pattern data independent from transient UI selection, inspector tabs and pending gestures.

## Validation and completion criteria

- At 1366×768 and 1440×900, users see the transport, generation basics, active slot and first tracker rows without page scrolling.
- From opening a project, Play is one action. A selected hit can be edited and previewed without scrolling away from the grid.
- One pitch drag creates one undo entry. Undo restores identical pattern data and rendered WAV; locks remain enforced.
- Current target, playing slot and queued slot are unambiguous. Generator draft values cannot be mistaken for applied values.
- Existing projects, samples, banks and effects round-trip unchanged. Run existing audio, editor, persistence and browser regressions.
- Keyboard-only users can generate, select a hit, edit, undo, switch slots and export. Focus survives updates and returns after dialogs close.
- At 390px width, playback is reachable, the selected hit remains identifiable, and controls are not hidden behind drawers.
- Conduct task-based sessions with 3–5 producers if available: generate and hear a beat, change a snare sound, pitch one hat, add a ratchet, lock the backbeat, create a variation, arrange A–A–B–Fill and export. Record completion, wrong actions, hesitation and assistance. Targets are acceptance goals, not measured user results.

## Out of scope for this pass
New effects, more samples/genres, stems, MP3, piano roll, waveform chopper restoration and a new application framework. The priority is making existing capabilities easier to discover and use.

## Phase 1 completion
Implemented the sticky transport, compact generator and bank, central tracker, contextual hit editor, collapsed instruments/learning inspector, range disclosure, lane-to-instrument navigation, and mobile return-to-pattern control. Existing Apply, Preview, generation and audio semantics remain intact.

Validation: first tracker rows begin at about 585px at both 1366×768 and 1440×900 in a fresh session (previously about 2,636px at 1440×900). Existing six browser suites passed; a dedicated layout suite checks first-load visibility, sticky transport, duplicate IDs, inspector/kit navigation, bank renaming and mobile editing.

Next: Phase 2, editing clarity. First expose pending changes and Revert beside Apply, make saved-vs-pending Preview explicit and prevent silent draft loss on changing selection. Then implement transactional direct editing, with one drag per undo entry and Escape cancellation. Song tempo migration, unified export, and deeper visual polish remain later phases.

## Phase 2 completion
Implemented visible pending state, Apply/Revert, a pending-hit navigator across slots, inspector-value Preview, Enter-to-apply, Escape cancellation, undoable unlocking and direct selected-hit pitch commit on gesture release. Each pitch gesture creates one undo entry and preserves other draft fields. Drafts remain session-only and are distinguished from saved/exported patterns. Other numeric/select fields retain explicit Apply, rather than introducing implicit blur commits.

Next: phase 3 sound selection. Simplify the instrument inspector into a compact sound chooser with consistent Preview and Upload/Replace actions; make generation participation versus mute clearer; expose effects-active indicators and shared-kit scope.

## Phase 3 completion
Implemented grouped sound choices, accessible Upload/Replace buttons, consistent Preview placement, filename display, compact level/routing controls, collapsed pitch/reverse controls, effects/bypass/mute indicators, loading feedback and shared-kit guidance. Existing audio processing, generation rules and project format remain unchanged. Nine browser suites passed, including file-picker upload, badge states, old project roundtrip and mobile layout.

Next: phase 4, unified song and export workflow. Put Pattern/Song targets into the transport, unify export options, and introduce explicit song tempo with backward-compatible project migration.
