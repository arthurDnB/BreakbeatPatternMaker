import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scoreOnsets, familyMacroF1, chooseSettings, interiorOnsets } from '../scripts/real-break-metrics.mjs';
import { decodePcmWav } from '../scripts/real-break-wav.mjs';

function wav(depth, channels, samples) {
  const dataLength = samples.length * depth / 8;
  const bytes = Buffer.alloc(44 + dataLength);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(44100, 24); bytes.writeUInt32LE(44100 * channels * depth / 8, 28);
  bytes.writeUInt16LE(channels * depth / 8, 32); bytes.writeUInt16LE(depth, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(dataLength, 40);
  samples.forEach((sample, index) => {
    const offset = 44 + index * depth / 8;
    if (depth === 16) bytes.writeInt16LE(sample, offset);
    else bytes.writeUIntLE(sample < 0 ? sample + 0x1000000 : sample, offset, 3);
  });
  return bytes;
}

test('benchmark decoder preserves signed 24-bit stereo and 16-bit mono', () => {
  const stereo = decodePcmWav(wav(24, 2, [-8388608, 8388607, 0, -4194304]));
  assert.equal(stereo.rate, 44100);
  assert.deepEqual(stereo.channels.map(channel => [...channel]), [[-1, 0], [8388607 / 8388608, -.5]]);
  assert.deepEqual([...decodePcmWav(wav(16, 1, [-32768, 16384])).channels[0]], [-1, .5]);
});

test('onset scoring uses unique matches and exposes timing failures', () => {
  const result = scoreOnsets([.100, .103, .250], [.101, .200], 5);
  assert.equal(result.tp, 1);
  assert.equal(result.falsePositive, 2);
  assert.equal(result.missed, 1);
  assert.equal(result.f1, .4);
  assert.ok(Math.abs(result.meanErrorMs - 1) < 1e-9);
  assert.deepEqual(result.missedSeconds, [.2]);
  assert.equal(scoreOnsets([.120], [.101], 10).tp, 0);
  assert.equal(scoreOnsets([.120], [.101], 20).tp, 1);
});

test('benchmark excludes only the fixed start boundary from detected-onset scoring', () => {
  assert.deepEqual(interiorOnsets([0.00001, .1, .3], 0), [.1, .3]);
  assert.deepEqual(interiorOnsets([1.00001, 1.0008, 1.002, 1.1], 1), [1.002, 1.1]);
  assert.equal(scoreOnsets([.1, .3], interiorOnsets([.00001, .1, .3], 0), 5).f1, 1);
});

test('family macro gives each source break equal weight and fold selection ignores its holdout', () => {
  assert.equal(familyMacroF1([{ family: 'a', f1: 0 }, { family: 'a', f1: 0 }, { family: 'b', f1: 1 }], ['a', 'b']), .5);
  const settings = [{ sensitivity: .35, minGapMs: 35 }, { sensitivity: .65, minGapMs: 35 }];
  const rowsFor = setting => setting.sensitivity === .35
    ? [{ family: 'train', f1: .8 }, { family: 'holdout', f1: 0 }]
    : [{ family: 'train', f1: .7 }, { family: 'holdout', f1: 1 }];
  assert.deepEqual(chooseSettings(settings, rowsFor, ['train'], settings[0]).setting, settings[0]);
});

test('all eight local recordings have ordered, path-free benchmark annotations in four grouped families', async () => {
  const data = JSON.parse(await readFile(new URL('../benchmarks/real-breaks.json', import.meta.url)));
  assert.equal(data.cases.length, 8);
  assert.deepEqual([...new Set(data.cases.map(item => item.family))].sort(), ['amen', 'apache', 'funky-drummer', 'think']);
  for (const item of data.cases) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.ok(item.filename.endsWith('.wav'));
    assert.equal(item.onsetsSeconds.length > 0, true);
    assert.ok(item.onsetsSeconds.every((value, index) => value > item.regionSeconds[0] && value < item.regionSeconds[1] && (!index || value > item.onsetsSeconds[index - 1])));
    assert.equal('path' in item, false);
  }
});
