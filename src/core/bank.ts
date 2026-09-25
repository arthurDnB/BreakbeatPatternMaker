import {compile} from './compile.js';
import {Editor,type EditorState} from './editor.js';
import type {Pattern} from './model.js';

export const SLOT_IDS = ['A', 'B', 'C', 'Fill'] as const;

export function slotLabel(i: number): string {
  if (i < SLOT_IDS.length) return SLOT_IDS[i]!;
  return 'P' + (i + 1);
}

export interface PatternSlot {
  name: string;
  editor: EditorState | null;
}

export interface Bank {
  songBpm: number;
  active: number;
  slots: PatternSlot[];
  sequence: { slot: number; repeats: number; section?: string }[];
}

export function newBank(pattern: Pattern): Bank {
  return {
    songBpm: pattern.settings.bpm,
    active: 0,
    slots: SLOT_IDS.map((name, i) => ({
      name,
      editor: i === 0 ? new Editor(pattern).state : null,
    })),
    sequence: [{ slot: 0, repeats: 2 }],
  };
}

export function addPatternSlot(bank: Bank, name?: string, editorState?: EditorState | null): number {
  const newIndex = bank.slots.length;
  const label = name?.trim() || slotLabel(newIndex);
  bank.slots.push({
    name: label,
    editor: editorState ? structuredClone(editorState) : null,
  });
  return newIndex;
}

export function duplicatePatternSlot(bank: Bank, sourceIndex: number, newName?: string): number {
  if (sourceIndex < 0 || sourceIndex >= bank.slots.length) throw Error('Invalid source slot.');
  const source = bank.slots[sourceIndex]!;
  if (!source.editor) throw Error('Source slot is empty.');
  const newIndex = bank.slots.length;
  const name = newName?.trim() || `${source.name} (Copy)`;
  bank.slots.push({
    name,
    editor: structuredClone(source.editor),
  });
  return newIndex;
}

export function deletePatternSlot(bank: Bank, indexToDelete: number): void {
  if (bank.slots.length <= 1) throw Error('Cannot delete the last pattern.');
  if (indexToDelete < 0 || indexToDelete >= bank.slots.length) throw Error('Invalid slot index.');

  bank.slots.splice(indexToDelete, 1);

  if (bank.active === indexToDelete) {
    bank.active = Math.max(0, indexToDelete - 1);
  } else if (bank.active > indexToDelete) {
    bank.active--;
  }

  bank.sequence = bank.sequence
    .filter(step => step.slot !== indexToDelete)
    .map(step => ({
      ...step,
      slot: step.slot > indexToDelete ? step.slot - 1 : step.slot,
    }));
}

export function validateBank(bank: Bank) {
  if (!bank || !Number.isInteger(bank.active) || bank.active < 0 || !Array.isArray(bank.slots) || bank.active >= bank.slots.length || bank.slots.length < 1 || bank.slots.length > 256 || !Array.isArray(bank.sequence) || bank.sequence.length > 64) {
    throw Error('Invalid pattern bank.');
  }
  if (!Number.isFinite(bank.songBpm) || bank.songBpm < 32 || bank.songBpm > 999) throw Error('Song BPM must be between 32 and 999.');
  for (const s of bank.slots) {
    if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 40) throw Error('Invalid slot name.');
    if (s.editor) validateEditor(s.editor);
  }
  if (!bank.slots[bank.active]!.editor) throw Error('Active slot is empty.');
  for (const step of bank.sequence) {
    if (!step || !Number.isInteger(step.slot) || step.slot < 0 || step.slot >= bank.slots.length || !bank.slots[step.slot]!.editor || !Number.isInteger(step.repeats) || step.repeats < 1 || step.repeats > 16 || (step.section !== undefined && (typeof step.section !== 'string' || step.section.length > 32 || /[\x00-\x1f\x7f]/.test(step.section)))) {
      throw Error('Invalid arrangement step.');
    }
  }
}

export function validateEditor(e: EditorState) {
  compile(e.pattern);
  if (!Array.isArray(e.lockedIds) || e.lockedIds.some(x => typeof x !== 'string') || !Array.isArray(e.lockedRoles) || e.lockedRoles.some(x => !['kick', 'snare', 'hat', 'percussion'].includes(x)) || !Number.isInteger(e.revision) || e.revision < 0 || !e.selection || !Array.isArray(e.selection.ids) || e.selection.ids.some(x => typeof x !== 'string')) {
    throw Error('Invalid slot editor.');
  }
  const rows = e.selection.rows;
  if (rows !== null && (!Array.isArray(rows) || rows.length !== 2 || rows.some(x => !Number.isInteger(x) || x < 0) || rows[0] > rows[1] || rows[1] >= e.pattern.settings.bars * e.pattern.settings.resolution)) {
    throw Error('Invalid slot selection.');
  }
}

export function arrange(bank: Bank, bpm: number = bank.songBpm) {
  validateBank(bank);
  if (!bank.sequence.length) throw Error('Add a pattern to the arrangement.');
  return bank.sequence.flatMap(step => Array.from({ length: step.repeats }, () => {
    const p = structuredClone(bank.slots[step.slot]!.editor!.pattern);
    p.settings.bpm = bpm;
    return p;
  }));
}

/** One entry per repeat, shared by the transport and timeline. */
export function songTimeline(bank: Bank) {
  validateBank(bank);
  let start = 0;
  return bank.sequence.flatMap((step, index) => Array.from({length: step.repeats}, (_, repeat) => {
    const settings = bank.slots[step.slot]!.editor!.pattern.settings;
    const duration = settings.bars * 240 / bank.songBpm;
    const entry = {step: index, slot: step.slot, section: step.section, repeat, start, duration, lines: settings.bars * settings.resolution};
    start += duration;
    return entry;
  }));
}
/** One visual block per arrangement step, measured in song bars and seconds. */
export function songBlocks(bank: Bank) {
  validateBank(bank);
  let start = 0;
  let startBar = 1;
  return bank.sequence.map((step, index) => {
    const bars = bank.slots[step.slot]!.editor!.pattern.settings.bars * step.repeats;
    const duration = bars * 240 / bank.songBpm;
    const block = {step: index, slot: step.slot, section: step.section, repeats: step.repeats, start, duration, bars, startBar, endBar: startBar + bars - 1};
    start += duration;
    startBar += bars;
    return block;
  });
}
export function songPosition(timeline: ReturnType<typeof songTimeline>, seconds: number) {
  const entry = timeline.find(e => seconds >= e.start && seconds < e.start + e.duration);
  return entry ? {...entry, row: Math.min(entry.lines - 1, Math.floor((seconds - entry.start) / entry.duration * entry.lines))} : undefined;
}
export function moveSequenceStep(bank: Bank, from: number, to: number) {
  if (![from, to].every(i => Number.isInteger(i) && i >= 0 && i < bank.sequence.length)) throw Error('Invalid arrangement position.');
  const [step] = bank.sequence.splice(from, 1);
  bank.sequence.splice(to, 0, step!);
}
/** Move an existing step into a gap (0 is before the first step). */
export function moveSequenceStepToInsertion(bank: Bank, from: number, before: number) {
  if (!Number.isInteger(before) || before < 0 || before > bank.sequence.length) throw Error('Invalid arrangement insertion point.');
  moveSequenceStep(bank, from, from < before ? before - 1 : before);
}
export function insertSequenceStep(bank: Bank, before: number, slot: number) {
  if (!Number.isInteger(before) || before < 0 || before > bank.sequence.length || bank.sequence.length >= 64 || !Number.isInteger(slot) || !bank.slots[slot]?.editor) throw Error('Invalid arrangement insertion.');
  bank.sequence.splice(before, 0, {slot, repeats: 1});
}
