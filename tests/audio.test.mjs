import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeWav,validateWav} from '../dist/audio/wav.js';
import {renderPatternWav} from '../dist/audio/render.js';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
test('WAV interleaves PCM channels and validates source metadata',()=>{
 const wav=encodeWav([new Float32Array([-1,0,1]),new Float32Array([1,0,-1])],44100),v=new DataView(wav);
 assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(46,true),32767);
 assert.equal(v.getUint32(40,true),12);assert.equal(validateWav(wav).channels,2);
 assert.throws(()=>validateWav(new ArrayBuffer(44)),/valid RIFF/);
 assert.throws(()=>validateWav(wav.slice(0,48)),/truncated/);
 assert.throws(()=>encodeWav([new Float32Array([NaN])],44100),/Non-finite/);
});
test('pattern WAV covers phrase and tails, preserves edits and exports deterministic audible PCM',()=>{
 const t=compile(generate(defaults())),wav=renderPatternWav(t),info=validateWav(wav);
 assert.equal(info.channels,2);assert.equal(info.sampleRate,44100);
 assert.ok(Math.abs(info.duration-(t.timing.bars*4*60/t.timing.bpm+.6))<1/44100);
 assert.deepEqual(wav,renderPatternWav(t));
 const v=new DataView(wav);let max=0;for(let i=44;i<wav.byteLength;i+=2)max=Math.max(max,Math.abs(v.getInt16(i,true)));
 assert.ok(max>1000&&max<32767);
 t.notes=t.notes.map(n=>({...n,volume:0}));const silent=new DataView(renderPatternWav(t));
 for(let i=44;i<silent.byteLength;i+=2)assert.equal(silent.getInt16(i,true),0);
});
