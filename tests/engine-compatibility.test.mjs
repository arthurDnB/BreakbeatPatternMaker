import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate} from '../dist/core/generate.js';
import {hash,audioFingerprint} from '../scripts/engine-compatibility-fixture.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/engine-compatibility.json',import.meta.url),'utf8'));

for(const algorithm of ['legacy-v1','groove-v2'])test(`${algorithm}: pre-v3 saved generation settings reproduce exact original patterns`,()=>{
  const entries=fixture.patterns.filter(item=>item.settings.algorithm===algorithm);
  assert.equal(entries.length,algorithm==='legacy-v1'?18:38);
  for(const item of entries){
    const pattern=generate(structuredClone(item.settings));
    assert.equal(pattern.events.length,item.eventCount,`${algorithm}/${item.settings.genre} hit count`);
    assert.equal(hash(JSON.stringify(pattern)),item.sha256,`${algorithm}/${item.settings.genre} event and settings compatibility`);
  }
});

for(const source of ['synth','uploaded'])test(`${source}: pre-v3 engines retain exported PCM at both sample rates with loop and tail rendering`,()=>{
  const entries=fixture.audio.filter(item=>item.source===source);
  assert.equal(entries.length,24);
  for(const item of entries){
    const actual=audioFingerprint(item.settings,item.rate,item.source,item.loop);
    const label=`${item.settings.algorithm}/${item.settings.genre}/${item.rate}/${item.loop?'loop':'tail'}`;
    assert.equal(actual.frames,item.frames,`${label} rendered duration`);
    assert.equal(actual.pcm16Sha256,item.pcm16Sha256,`${label} PCM16 audio compatibility`);
  }
});
