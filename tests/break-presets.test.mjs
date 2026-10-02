import test from 'node:test';
import assert from 'node:assert/strict';
import {BREAK_PRESETS, getBreakPreset, getBreakPresetAsset} from '../dist/audio/break-presets.js';

test('BREAK_PRESETS catalog contains all 5 classic breaks', () => {
  assert.equal(BREAK_PRESETS.length, 5);
  const ids = BREAK_PRESETS.map(p => p.id);
  assert.deepEqual(ids, ['think-142x', 'amen-classic', 'apache-bongo', 'funky-drummer', 'hot-pants']);
});

test('All break presets have valid monotonic slice markers within frame bounds', () => {
  for (const preset of BREAK_PRESETS) {
    assert.ok(preset.name.length > 0, `Preset ${preset.id} has name`);
    assert.ok(preset.bars >= 1 && preset.bars <= 4, `Preset ${preset.id} valid bars`);
    assert.ok(preset.bpm >= 80 && preset.bpm <= 200, `Preset ${preset.id} valid bpm`);
    assert.ok(preset.totalFrames > 1000, `Preset ${preset.id} totalFrames > 1000`);
    assert.ok(preset.sliceMarkers.length >= 8, `Preset ${preset.id} has at least 8 slice markers`);

    // First marker is at frame 0
    assert.equal(preset.sliceMarkers[0], 0, `Preset ${preset.id} starts at frame 0`);
    // Last marker matches or is close to totalFrames
    assert.ok(preset.sliceMarkers.at(-1) <= preset.totalFrames, `Preset ${preset.id} end frame within bounds`);

    // Strictly monotonically increasing
    for (let i = 1; i < preset.sliceMarkers.length; i++) {
      assert.ok(preset.sliceMarkers[i] > preset.sliceMarkers[i - 1], `Preset ${preset.id} markers strictly increasing at index ${i}`);
    }
  }
});

test('getBreakPreset returns correct preset by id', () => {
  const amen = getBreakPreset('amen-classic');
  assert.ok(amen);
  assert.equal(amen.shortName, 'Amen Break');
  assert.equal(amen.bpm, 165);

  const unknown = getBreakPreset('non-existent');
  assert.equal(unknown, undefined);
});

test('Acoustic presets render valid stereo audio channels with real signal', async () => {
  const assets = new Map();
  const amenAsset = await getBreakPresetAsset('amen-classic', assets);
  assert.ok(amenAsset);
  assert.equal(amenAsset.channels.length, 2);
  assert.equal(amenAsset.sampleRate, 44100);
  assert.equal(amenAsset.channels[0].length, amenAsset.channels[1].length);

  // Peak check: verify signal is non-silent and within normalized range
  let maxLeft = 0;
  for (let i = 0; i < amenAsset.channels[0].length; i++) {
    maxLeft = Math.max(maxLeft, Math.abs(amenAsset.channels[0][i]));
  }
  assert.ok(maxLeft > 0.1, 'Amen audio has audible signal');
  assert.ok(maxLeft <= 1.0, 'Amen audio is not clipping');
});

test('All acoustic recreation presets generate non-empty audio without error', async () => {
  const assets = new Map();
  for (const id of ['amen-classic', 'apache-bongo', 'funky-drummer', 'hot-pants']) {
    const asset = await getBreakPresetAsset(id, assets);
    assert.ok(asset.channels[0].length > 10000);
    assert.ok(asset.name.length > 0);
  }
});
