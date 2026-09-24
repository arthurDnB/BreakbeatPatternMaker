import {createHash} from 'node:crypto';
import {generate} from '../dist/core/generate.js';
import {defaults,PROFILES} from '../dist/core/profiles.js';
import {NEW_GENRES} from '../dist/core/new-genres.js';
import {withDrumKit,defaultKitState} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';

export const hash=value=>createHash('sha256').update(value).digest('hex');
export function compatibilitySettings(genre,algorithm) {
  return {...defaults(genre),algorithm,seed:'pre-v3-compatibility',bars:2,resolution:32,complexity:.73,spicy:.81,syncopation:.62,ghostAmount:.6,fillAmount:.76,swing:.57,humanizeMs:3};
}
// Integer triangle/noise data avoids platform-dependent transcendental math in uploaded fixtures.
export function uploadedFixture() {
  const channels=[new Float32Array(9600),new Float32Array(9600)];
  for(let i=0;i<9600;i++){
    const envelope=(9600-i)/9600;
    channels[0][i]=(((i*37)%256-128)/128)*envelope*.4;
    channels[1][i]=(((i*53)%256-128)/128)*envelope*.3;
  }
  const asset={id:'compatibility-upload',name:'Deterministic uploaded hit',sampleRate:24000,channels};
  const slice={assetId:asset.id,startFrame:0,endFrame:9600,sampleRate:asset.sampleRate,label:asset.name};
  const mix=defaultKitState();
  mix.kick.level=.83;mix.snare.tune=-2;mix.hat.reverse=true;mix.hat.decay=.23;mix.percussion.decay=.7;
  return {assets:new Map([[asset.id,asset]]),kit:{kick:slice,snare:slice,hat:slice,percussion:slice},mix};
}
export function audioFingerprint(settings,rate,source,loop) {
  let pattern=generate(settings),assets=new Map();
  if(source==='uploaded'){
    const upload=uploadedFixture();assets=upload.assets;pattern=withDrumKit(pattern,upload.kit,upload.mix);
  }
  const audio=renderPerformance(pattern,assets,rate,{}, {loop});
  // Compare rendered PCM16, the public export format, rather than internal double precision arithmetic.
  const bytes=Buffer.from(encodeWav(audio.channels,rate));
  return {frames:audio.channels[0].length,pcm16Sha256:hash(bytes.subarray(44))};
}
export function captureCompatibility() {
  const patterns=[];
  for(const algorithm of ['legacy-v1','groove-v2'])for(const genre of Object.keys(PROFILES)){
    if(algorithm==='legacy-v1'&&Object.hasOwn(NEW_GENRES,genre))continue;
    const settings=compatibilitySettings(genre,algorithm),pattern=generate(settings);
    patterns.push({settings,eventCount:pattern.events.length,sha256:hash(JSON.stringify(pattern))});
  }
  const audio=[];
  for(const [algorithm,genre] of [['legacy-v1','jungle'],['legacy-v1','hiphop'],['groove-v2','jungle'],['groove-v2','breakcore'],['groove-v2','drill'],['groove-v2','atmosphericbreakcore']]){
    const settings=compatibilitySettings(genre,algorithm);
    for(const rate of [8000,44100])for(const source of ['synth','uploaded'])for(const loop of [false,true]){
      audio.push({settings,rate,source,loop,...audioFingerprint(settings,rate,source,loop)});
    }
  }
  return {patterns,audio};
}
