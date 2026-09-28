/** Decode only the PCM WAV formats present in the locally supplied benchmark set. */
export function decodePcmWav(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw Error('Expected RIFF/WAVE audio.');
  let format, count, rate, depth, blockSize, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4), start = offset + 8, end = start + length;
    if (end > bytes.length) throw Error('Truncated WAV chunk.');
    if (bytes.toString('ascii', offset, offset + 4) === 'fmt ') {
      format = bytes.readUInt16LE(start); count = bytes.readUInt16LE(start + 2);
      rate = bytes.readUInt32LE(start + 4); blockSize = bytes.readUInt16LE(start + 12);
      depth = bytes.readUInt16LE(start + 14);
    }
    if (bytes.toString('ascii', offset, offset + 4) === 'data') data = bytes.subarray(start, end);
    offset = end + (length & 1);
  }
  if (format !== 1 || ![1, 2].includes(count) || ![16, 24].includes(depth) || !rate || !data || blockSize !== count * depth / 8) throw Error('Benchmark supports mono/stereo PCM16 or PCM24 WAV.');
  const length = Math.floor(data.length / blockSize);
  const channels = Array.from({ length: count }, () => new Float32Array(length));
  for (let frame = 0; frame < length; frame++) for (let channel = 0; channel < count; channel++) {
    const offset = frame * blockSize + channel * depth / 8;
    let value;
    if (depth === 16) value = data.readInt16LE(offset) / 32768;
    else { const raw = data.readUIntLE(offset, 3); value = (raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608; }
    channels[channel][frame] = value;
  }
  return { channels, rate, length };
}
