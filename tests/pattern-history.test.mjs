import test from 'node:test';
import assert from 'node:assert/strict';
import {newBank, rememberPattern, validateBank, PATTERN_HISTORY_LIMIT} from '../dist/core/bank.js';
import {Editor} from '../dist/core/editor.js';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {makeProject, readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';

function fixture() {
  const pattern = generate(defaults());
  const bank = newBank(pattern);
  return {pattern, bank, slot: bank.slots[0]};
}

test('recent patterns are independent, bounded, and validated', () => {
  const {bank, slot} = fixture();
  const original = structuredClone(slot.editor);
  for (let i = 0; i < PATTERN_HISTORY_LIMIT + 3; i++) {
    const state = structuredClone(original);
    state.pattern.settings.seed = `history-${i}`;
    assert.equal(rememberPattern(slot, state, 'Before variation', 1000 + i), true);
    state.pattern.settings.seed = 'changed-after-capture';
  }
  assert.equal(slot.patternHistory.length, PATTERN_HISTORY_LIMIT);
  assert.equal(slot.patternHistory[0].editor.pattern.settings.seed, 'history-3');
  assert.equal(slot.patternHistory.at(-1).editor.pattern.settings.seed, `history-${PATTERN_HISTORY_LIMIT + 2}`);
  assert.deepEqual(slot.patternHistory[0].editor.selection, {ids: [], rows: null});
  assert.doesNotThrow(() => validateBank(bank));
  const bad = structuredClone(bank);
  bad.slots[0].patternHistory[0].capturedAt = -1;
  assert.throws(() => validateBank(bad), /history entry/);
});

test('restoring an earlier beat supports Undo and Redo', () => {
  const {pattern} = fixture();
  const editor = new Editor(pattern);
  const saved = structuredClone(editor.state);
  const generated = generate({...defaults(), seed: 'another-seed'});
  assert.equal(editor.replace(generated), true);
  const previous = structuredClone(editor.state);
  assert.equal(editor.restore(saved), true);
  assert.deepEqual(editor.state.pattern, saved.pattern);
  assert.equal(editor.undo(), true);
  assert.deepEqual(editor.state.pattern, previous.pattern);
  assert.equal(editor.redo(), true);
  assert.deepEqual(editor.state.pattern, saved.pattern);
});

test('project save retains audio used only in a historical pattern', () => {
  const {pattern, bank, slot} = fixture();
  const sample = {id: 'historical-slice', name: 'Old break', sampleRate: 8000, channels: [new Float32Array(100).fill(.2)]};
  const historical = structuredClone(slot.editor);
  historical.pattern.events[0].slice = {assetId: sample.id, startFrame: 0, endFrame: 100, sampleRate: 8000, label: 'old hit'};
  rememberPattern(slot, historical, 'Before Generate', 1000);
  const project = makeProject(slot.editor, pattern.settings, defaultKitState(), new Map([[sample.id, sample]]), bank);
  const reopened = readProject(project);
  assert.equal(reopened.project.bank.slots[0].patternHistory[0].editor.pattern.events[0].slice.assetId, sample.id);
  assert.equal(reopened.assets.get(sample.id).channels[0].length, 100);
  const incomplete = structuredClone(project);
  incomplete.assets = [];
  assert.throws(() => readProject(incomplete), /Missing slice audio/);
});
