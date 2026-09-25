import {validateBank, type Bank} from './bank.js';

interface ArrangementSnapshot {
  bank: Bank;
  label: string;
}

const copy = <T>(v: T): T => structuredClone(v);

/**
 * Memento-based undo/redo for arrangement-level mutations.
 * Pattern-level edits (hits, locks, selection) remain in Editor.
 * This covers: slot add/delete/duplicate/rename, song BPM,
 * sequence append/remove/reorder, and repeat-count changes.
 */
export class ArrangementHistory {
  bank: Bank;
  private past: ArrangementSnapshot[] = [];
  private future: ArrangementSnapshot[] = [];
  private static MAX_HISTORY = 50;

  constructor(bank: Bank) {
    this.bank = copy(bank);
  }

  get undoLabel(): string | undefined { return this.past.at(-1)?.label; }
  get redoLabel(): string | undefined { return this.future.at(-1)?.label; }

  /**
   * Execute a bank mutation with undo support.
   * @param mutate - Function that mutates a cloned Bank.
   * @param label - Human-readable label for the undo stack.
   * @returns true if the mutation changed state, false if it was a no-op.
   */
  execute(mutate: (bank: Bank) => void, label: string): boolean {
    const before = copy(this.bank);
    const next = copy(this.bank);
    try {
      mutate(next);
      validateBank(next);
    } catch {
      return false;
    }
    if (JSON.stringify(next) === JSON.stringify(this.bank)) return false;
    this.past.push({ bank: before, label });
    if (this.past.length > ArrangementHistory.MAX_HISTORY) this.past.shift();
    this.future = [];
    this.bank = next;
    return true;
  }

  undo(): boolean {
    const item = this.past.pop();
    if (!item) return false;
    this.future.push({ bank: copy(this.bank), label: item.label });
    this.bank = item.bank;
    return true;
  }

  redo(): boolean {
    const item = this.future.pop();
    if (!item) return false;
    this.past.push({ bank: copy(this.bank), label: item.label });
    this.bank = item.bank;
    return true;
  }

  /** Reset history (e.g., on project load). Clears undo/redo stacks. */
  reset(bank: Bank): void {
    this.bank = copy(bank);
    this.past = [];
    this.future = [];
  }
}
