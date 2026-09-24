import { readFile } from 'node:fs/promises';
import { validateWav } from '../dist/audio/wav.js';

async function diagnoseWavs() {
  const dir = 'site/public/samples/';
  const files = [
    'udnb-kick-01.wav',
    'udnb-kick-10.wav',
    'acoustic-kick.wav'
  ];

  for (const f of files) {
    try {
      const buf = await readFile(dir + f);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const audioAsset = validateWav(ab);
      
      const v = new DataView(ab);
      let maxAmp = 0;
      // Assuming 16-bit PCM at offset 44
      for (let i = 44; i < ab.byteLength; i += 2) {
          const val = Math.abs(v.getInt16(i, true) / 32768);
          if (val > maxAmp) maxAmp = val;
      }

      console.log(`[OK] ${f}: ${audioAsset.channels} channels, ${audioAsset.sampleRate} Hz, max amp: ${maxAmp}`);
    } catch (e) {
      console.log(`[ERROR] ${f}: ${e.message}`);
    }
  }
}

diagnoseWavs().catch(console.error);
