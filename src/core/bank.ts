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
  active: number;
  slots: PatternSlot[];
  sequence: { slot: number; repeats: number }[];
}

export function newBank(pattern: Pattern): Bank {
  return {
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
  if (!bank || !Number.isInteger(bank.active) || bank.active < 0 || bank.active >= bank.slots.length || !Array.isArray(bank.slots) || bank.slots.length < 1 || bank.slots.length > 256 || !Array.isArray(bank.sequence) || bank.sequence.length > 64) {
    throw Error('Invalid pattern bank.');
  }
  for (const s of bank.slots) {
    if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 40) throw Error('Invalid slot name.');
    if (s.editor) validateEditor(s.editor);
  }
  if (!bank.slots[bank.active]!.editor) throw Error('Active slot is empty.');
  for (const step of bank.sequence) {
    if (!step || !Number.isInteger(step.slot) || step.slot < 0 || step.slot >= bank.slots.length || !bank.slots[step.slot]!.editor || !Number.isInteger(step.repeats) || step.repeats < 1 || step.repeats > 16) {
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

export function arrange(bank: Bank, bpm: number) {
  validateBank(bank);
  if (!bank.sequence.length) throw Error('Add a pattern to the arrangement.');
  return bank.sequence.flatMap(step => Array.from({ length: step.repeats }, () => {
    const p = structuredClone(bank.slots[step.slot]!.editor!.pattern);
    p.settings.bpm = bpm;
    return p;
  }));
}
