import test from 'node:test';
import assert from 'node:assert/strict';
import {ArrangementHistory} from '../dist/core/arrangement-history.js';
import {newBank, addPatternSlot, duplicatePatternSlot, deletePatternSlot, moveSequenceStep, validateBank} from '../dist/core/bank.js';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';

function makeBank() {
  const p = generate(defaults());
  const b = newBank(p);
  b.slots[1].editor = structuredClone(b.slots[0].editor);
  b.slots[1].editor.pattern.settings.seed = 'slot-b';
  return b;
}

test('basic undo/redo cycle', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);
  assert.equal(h.undoLabel, undefined);
  assert.equal(h.redoLabel, undefined);

  h.execute(bank => { bank.songBpm = 140; }, 'Change song tempo');
  assert.equal(h.bank.songBpm, 140);
  assert.equal(h.undoLabel, 'Change song tempo');

  assert.ok(h.undo());
  assert.equal(h.bank.songBpm, b.songBpm);
  assert.equal(h.redoLabel, 'Change song tempo');

  assert.ok(h.redo());
  assert.equal(h.bank.songBpm, 140);
});

test('add slot → undo restores slot count', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);
  const before = b.slots.length;

  h.execute(bank => { addPatternSlot(bank, 'New One'); }, 'Add pattern');
  assert.equal(h.bank.slots.length, before + 1);
  assert.equal(h.bank.slots.at(-1).name, 'New One');

  h.undo();
  assert.equal(h.bank.slots.length, before);
});

test('delete slot → undo restores deleted slot with editor state', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);
  const deleted = structuredClone(b.slots[1]);

  h.execute(bank => { deletePatternSlot(bank, 1); }, 'Delete pattern');
  assert.equal(h.bank.slots.length, b.slots.length - 1);

  h.undo();
  assert.equal(h.bank.slots.length, b.slots.length);
  assert.equal(h.bank.slots[1].name, deleted.name);
  assert.deepEqual(h.bank.slots[1].editor?.pattern.settings.seed, 'slot-b');
});

test('duplicate slot → undo removes the copy', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);
  const before = b.slots.length;

  h.execute(bank => { duplicatePatternSlot(bank, 0); }, 'Duplicate pattern');
  assert.equal(h.bank.slots.length, before + 1);

  h.undo();
  assert.equal(h.bank.slots.length, before);
});

test('song BPM change → undo restores previous BPM', () => {
  const b = makeBank();
  b.songBpm = 170;
  const h = new ArrangementHistory(b);

  h.execute(bank => { bank.songBpm = 120; }, 'Change song tempo');
  assert.equal(h.bank.songBpm, 120);

  h.undo();
  assert.equal(h.bank.songBpm, 170);
});

test('sequence append → undo removes step', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);
  const before = b.sequence.length;

  h.execute(bank => { bank.sequence.push({ slot: 1, repeats: 2 }); }, 'Append to arrangement');
  assert.equal(h.bank.sequence.length, before + 1);

  h.undo();
  assert.equal(h.bank.sequence.length, before);
});

test('sequence remove → undo restores step', () => {
  const b = makeBank();
  b.sequence.push({ slot: 1, repeats: 3 });
  const h = new ArrangementHistory(b);

  h.execute(bank => { bank.sequence.splice(1, 1); }, 'Remove arrangement step');
  assert.equal(h.bank.sequence.length, 1);

  h.undo();
  assert.equal(h.bank.sequence.length, 2);
  assert.equal(h.bank.sequence[1].repeats, 3);
});

test('sequence reorder → undo restores original order', () => {
  const b = makeBank();
  b.sequence = [{ slot: 0, repeats: 1 }, { slot: 1, repeats: 2 }, { slot: 0, repeats: 3 }];
  const h = new ArrangementHistory(b);

  h.execute(bank => { moveSequenceStep(bank, 0, 2); }, 'Reorder arrangement');
  assert.deepEqual(h.bank.sequence.map(s => s.repeats), [2, 3, 1]);

  h.undo();
  assert.deepEqual(h.bank.sequence.map(s => s.repeats), [1, 2, 3]);
});

test('rename slot → undo restores original name', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);

  h.execute(bank => { bank.slots[0].name = 'Intro'; }, 'Rename pattern');
  assert.equal(h.bank.slots[0].name, 'Intro');

  h.undo();
  assert.equal(h.bank.slots[0].name, 'A');
});

test('repeat count change → undo restores original count', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);

  h.execute(bank => { bank.sequence[0].repeats = 8; }, 'Change repeats');
  assert.equal(h.bank.sequence[0].repeats, 8);

  h.undo();
  assert.equal(h.bank.sequence[0].repeats, 2);
});

test('history depth limit — keeps only 50 entries', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);

  for (let i = 0; i < 55; i++) {
    h.execute(bank => { bank.songBpm = 100 + i; }, `BPM ${100 + i}`);
  }

  // Should be able to undo exactly 50 times
  let undone = 0;
  while (h.undo()) undone++;
  assert.equal(undone, 50);
});

test('no-op mutation returns false and does not push to history', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);

  // Mutation that doesn't change anything
  const result = h.execute(bank => { /* no-op */ }, 'Nothing');
  assert.equal(result, false);
  assert.equal(h.undoLabel, undefined);
});

test('redo is cleared after new mutation', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);

  h.execute(bank => { bank.songBpm = 140; }, 'BPM 140');
  h.execute(bank => { bank.songBpm = 160; }, 'BPM 160');
  h.undo(); // back to 140
  assert.equal(h.redoLabel, 'BPM 160');

  h.execute(bank => { bank.songBpm = 180; }, 'BPM 180');
  assert.equal(h.redoLabel, undefined);
  assert.equal(h.bank.songBpm, 180);
});

test('reset clears all history', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);

  h.execute(bank => { bank.songBpm = 140; }, 'Change');
  h.execute(bank => { bank.songBpm = 160; }, 'Change');
  h.undo();

  const fresh = makeBank();
  fresh.songBpm = 200;
  h.reset(fresh);

  assert.equal(h.bank.songBpm, 200);
  assert.equal(h.undoLabel, undefined);
  assert.equal(h.redoLabel, undefined);
  assert.equal(h.undo(), false);
  assert.equal(h.redo(), false);
});

test('snapshots are independent deep clones', () => {
  const b = makeBank();
  const originalBpm = b.songBpm;
  const h = new ArrangementHistory(b);

  // Mutating original object after passing to constructor does not affect history bank
  b.songBpm = 999;
  assert.equal(h.bank.songBpm, originalBpm);

  h.execute(bank => { bank.songBpm = 140; }, 'Change');

  // Mutating current bank directly does not mutate past snapshot
  h.bank.songBpm = 888;
  h.bank.slots[0].name = 'Mutated';

  h.undo();
  assert.equal(h.bank.songBpm, originalBpm);
  assert.equal(h.bank.slots[0].name, 'A');

  // Redo restores the state that was active when undo was called
  h.redo();
  assert.equal(h.bank.songBpm, 888);
  assert.equal(h.bank.slots[0].name, 'Mutated');
});

test('thrown mutation does not corrupt state', () => {
  const b = makeBank();
  const h = new ArrangementHistory(b);
  const before = structuredClone(h.bank);

  const result = h.execute(() => { throw Error('boom'); }, 'Bad');
  assert.equal(result, false);
  assert.deepEqual(h.bank, before);
  assert.equal(h.undoLabel, undefined);
});

test('validateBank passes after undo/redo cycles', () => {
  const b = makeBank();
  b.sequence = [{ slot: 0, repeats: 2 }, { slot: 1, repeats: 1 }];
  const h = new ArrangementHistory(b);

  h.execute(bank => { addPatternSlot(bank, 'Extra'); }, 'Add');
  h.execute(bank => { bank.sequence.push({ slot: 0, repeats: 1 }); }, 'Append');
  h.execute(bank => { moveSequenceStep(bank, 0, 2); }, 'Reorder');
  h.execute(bank => { bank.songBpm = 155; }, 'BPM');

  // Undo all 4
  for (let i = 0; i < 4; i++) h.undo();
  validateBank(h.bank);

  // Redo all 4
  for (let i = 0; i < 4; i++) h.redo();
  validateBank(h.bank);
});
