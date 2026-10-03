import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newBank,
  duplicateSequenceStep,
  sectionKind,
  songBlocks,
  insertSequenceStep,
  moveSequenceStep
} from '../dist/core/bank.js';
import {groupSongBlocksIntoSections} from '../dist/ui/vertical-song-map.js';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {ArrangementHistory} from '../dist/core/arrangement-history.js';

function createTestBank() {
  const p = generate({...defaults(), bars: 1});
  const b = newBank(p);
  b.slots[1].editor = structuredClone(b.slots[0].editor);
  b.slots[2].editor = structuredClone(b.slots[0].editor);
  b.slots[3].editor = structuredClone(b.slots[0].editor);
  return b;
}

test('sectionKind correctly classifies common section naming styles', () => {
  assert.equal(sectionKind('Intro'), 'intro');
  assert.equal(sectionKind('Opening verse'), 'intro');
  assert.equal(sectionKind('Build_01'), 'build');
  assert.equal(sectionKind('Rising swell'), 'build');
  assert.equal(sectionKind('Drop_01'), 'drop');
  assert.equal(sectionKind('Chorus hook'), 'drop');
  assert.equal(sectionKind('Break_01'), 'break');
  assert.equal(sectionKind('Fill turnaround'), 'fill');
  assert.equal(sectionKind('Outro'), 'outro');
  assert.equal(sectionKind('Ending fade'), 'outro');
  assert.equal(sectionKind(''), 'unlabeled');
  assert.equal(sectionKind(undefined), 'unlabeled');
  assert.equal(sectionKind('Solo bridge'), 'other');
});

test('groupSongBlocksIntoSections groups contiguous steps by section name with bar counts', () => {
  const b = createTestBank();
  // 1-bar pattern per slot
  b.sequence = [
    { slot: 0, repeats: 2, section: 'Intro' },      // step 0: bars 1-2 (2 bars)
    { slot: 1, repeats: 2, section: 'Intro' },      // step 1: bars 3-4 (2 bars)
    { slot: 1, repeats: 4, section: 'Drop_01' },    // step 2: bars 5-8 (4 bars)
    { slot: 2, repeats: 2, section: 'Break_01' },   // step 3: bars 9-10 (2 bars)
    { slot: 1, repeats: 4, section: 'Drop_01' },    // step 4: bars 11-14 (4 bars)
  ];

  const blocks = songBlocks(b);
  const sections = groupSongBlocksIntoSections(blocks);

  assert.equal(sections.length, 4);

  // Section 0: Intro (contiguous steps 0 and 1)
  assert.equal(sections[0].name, 'Intro');
  assert.equal(sections[0].kind, 'intro');
  assert.equal(sections[0].startBar, 1);
  assert.equal(sections[0].endBar, 4);
  assert.equal(sections[0].totalBars, 4);
  assert.deepEqual(sections[0].stepIndices, [0, 1]);
  assert.equal(sections[0].blocks.length, 2);

  // Section 1: Drop_01
  assert.equal(sections[1].name, 'Drop_01');
  assert.equal(sections[1].kind, 'drop');
  assert.equal(sections[1].startBar, 5);
  assert.equal(sections[1].endBar, 8);
  assert.equal(sections[1].totalBars, 4);
  assert.deepEqual(sections[1].stepIndices, [2]);

  // Section 2: Break_01
  assert.equal(sections[2].name, 'Break_01');
  assert.equal(sections[2].kind, 'break');
  assert.equal(sections[2].startBar, 9);
  assert.equal(sections[2].endBar, 10);
  assert.equal(sections[2].totalBars, 2);

  // Section 3: Drop_01 (subsequent occurrence creates its own contiguous group)
  assert.equal(sections[3].name, 'Drop_01');
  assert.equal(sections[3].kind, 'drop');
  assert.equal(sections[3].startBar, 11);
  assert.equal(sections[3].endBar, 14);
  assert.equal(sections[3].totalBars, 4);
});

test('duplicateSequenceStep clones clip with slot, repeats, and section in-place', () => {
  const b = createTestBank();
  b.sequence = [
    { slot: 0, repeats: 2, section: 'Intro' },
    { slot: 1, repeats: 4, section: 'Drop' },
  ];

  const newIdx = duplicateSequenceStep(b, 1);
  assert.equal(newIdx, 2);
  assert.equal(b.sequence.length, 3);
  assert.deepEqual(b.sequence[2], { slot: 1, repeats: 4, section: 'Drop' });

  // Duplicating first step
  const dup0 = duplicateSequenceStep(b, 0);
  assert.equal(dup0, 1);
  assert.equal(b.sequence.length, 4);
  assert.deepEqual(b.sequence[1], { slot: 0, repeats: 2, section: 'Intro' });
});

test('arrangement history undo and redo covers clip adding, section renaming, and reordering', () => {
  const b = createTestBank();
  b.sequence = [{ slot: 0, repeats: 2, section: 'Intro' }];
  const history = new ArrangementHistory(b);

  // 1. Add clip
  history.execute(bank => {
    insertSequenceStep(bank, bank.sequence.length, 1);
    bank.sequence[1].section = 'Drop';
  }, 'Add clip to section');
  assert.equal(history.bank.sequence.length, 2);
  assert.equal(history.bank.sequence[1].section, 'Drop');

  // 2. Duplicate clip
  history.execute(bank => {
    duplicateSequenceStep(bank, 1);
  }, 'Duplicate arrangement clip');
  assert.equal(history.bank.sequence.length, 3);
  assert.equal(history.bank.sequence[2].section, 'Drop');

  // 3. Rename section
  history.execute(bank => {
    bank.sequence[1].section = 'Chorus';
    bank.sequence[2].section = 'Chorus';
  }, 'Rename section');
  assert.equal(history.bank.sequence[1].section, 'Chorus');
  assert.equal(history.bank.sequence[2].section, 'Chorus');

  // 4. Reorder
  history.execute(bank => {
    moveSequenceStep(bank, 2, 0);
  }, 'Reorder arrangement');
  assert.equal(history.bank.sequence[0].section, 'Chorus');
  assert.equal(history.bank.sequence[1].section, 'Intro');
  assert.equal(history.bank.sequence[2].section, 'Chorus');

  // Undo reorder
  assert.ok(history.undo());
  assert.equal(history.bank.sequence[0].section, 'Intro');
  assert.equal(history.bank.sequence[1].section, 'Chorus');

  // Undo rename section
  assert.ok(history.undo());
  assert.equal(history.bank.sequence[1].section, 'Drop');

  // Undo duplicate clip
  assert.ok(history.undo());
  assert.equal(history.bank.sequence.length, 2);

  // Redo duplicate clip
  assert.ok(history.redo());
  assert.equal(history.bank.sequence.length, 3);
  assert.equal(history.bank.sequence[2].section, 'Drop');
});
