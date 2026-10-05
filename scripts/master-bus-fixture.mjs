// The two legacy master-bus code paths, captured as mandatory fixtures.
//
// src/audio/performance.ts:203-215 applies a tanh soft-clip above 0.7 that is skipped entirely when
// every event is `mapped` (`:206`, `transparent`). A port that reproduces every existing golden can
// still change already-published v1-v3 PCM if it only ever sees one of those two branches, so both are
// captured here and tests/master-bus-paths.test.mjs requires both for each legacy algorithm.
//
// How each path is reached:
//   'transparent' - every event carries `mapped`, so performance.ts:206 computes transparent=true and
//                   the clip never runs. Loud material is left alone and the later attenuation fires
//                   (attenuation < 1), which is only reachable on this branch.
//   'clipped'     - the same events carry a plain `slice` instead, so transparent=false and the clip
//                   caps the signal below 1.0 (attenuation stays exactly 1 even though the raw mix is
//                   louder than the transparent render).
// `mapped` also selects different voice planning (src/audio/performance.ts:135-145) and skips the
// drum-kit velocity layers (src/audio/drum-kit.ts:83,90), so this pair is *not* a strict isolation of
// the master bus alone; the coverage requirement is what the fixture set enforces.
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {validateSliceInstruments} from '../dist/core/slice-instrument.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {measureAudioQuality} from '../dist/audio/audio-quality.js';
import {encodeWav} from '../dist/audio/wav.js';
import {hash} from './engine-compatibility-fixture.mjs';

export const MASTER_BUS_ALGORITHMS=['legacy-v1','groove-v2','groove-v3'];
export const MASTER_BUS_PATHS=['transparent','clipped'];
export const MASTER_BUS_GENRE='jungle';
const INSTRUMENT_ID='master-bus-break';
const ASSET_ID='master-bus-upload';
const ASSET_RATE=24000;
const ASSET_FRAMES=9600;

// Integer triangle/noise data, like uploadedFixture(), so no platform transcendental math enters a
// fixture. Amplitude is deliberately high: this fixture exists to drive the master bus hard.
export function masterBusAsset(){
  const channels=[new Float32Array(ASSET_FRAMES),new Float32Array(ASSET_FRAMES)];
  for(let i=0;i<ASSET_FRAMES;i++){
    const envelope=(ASSET_FRAMES-i)/ASSET_FRAMES;
    channels[0][i]=(((i*37)%256-128)/128)*envelope*.8;
    channels[1][i]=(((i*53)%256-128)/128)*envelope*.6;
  }
  return {id:ASSET_ID,name:'Deterministic master bus hit',sampleRate:ASSET_RATE,channels};
}

export function masterBusSettings(genre=MASTER_BUS_GENRE,algorithm='legacy-v1'){
  return {...defaults(genre),algorithm,seed:'pre-v3-compatibility',bars:2,resolution:32,complexity:.73,spicy:.81,syncopation:.62,ghostAmount:.6,fillAmount:.76,swing:.57,humanizeMs:3};
}

export function masterBusPattern(genre=MASTER_BUS_GENRE,algorithm='legacy-v1',path='clipped'){
  if(!MASTER_BUS_PATHS.includes(path))throw Error(`Unknown master bus path: ${path}`);
  const pattern=generate(masterBusSettings(genre,algorithm));
  if(pattern.events.some(hit=>hit.synthNote))throw Error('Master-bus fixtures are drum-only.');
  const asset=masterBusAsset();
  const slice={assetId:ASSET_ID,startFrame:0,endFrame:ASSET_FRAMES,sampleRate:ASSET_RATE,label:'Master bus fixture hit'};
  pattern.sliceInstruments=[{id:INSTRUMENT_ID,name:'Master bus fixture break',assetId:ASSET_ID,sampleRate:ASSET_RATE,
    startFrame:0,endFrame:ASSET_FRAMES,slices:[{id:'master-bus-slice-1',note:36,startFrame:0,endFrame:ASSET_FRAMES}]}];
  pattern.events=pattern.events.map(hit=>path==='transparent'
    ?{...hit,sourceKind:'slice',mapped:{instrumentId:INSTRUMENT_ID,note:36}}
    :{...hit,sourceKind:'slice',slice});
  validateSliceInstruments(pattern);
  return pattern;
}

export function masterBusFingerprint(genre,algorithm,path,rate,loop){
  const pattern=masterBusPattern(genre,algorithm,path);
  const assets=new Map([[ASSET_ID,masterBusAsset()]]);
  const audio=renderPerformance(pattern,assets,rate,{},{loop});
  const bytes=Buffer.from(encodeWav(audio.channels,rate));
  const quality=measureAudioQuality(audio.channels);
  return {frames:audio.channels[0].length,pcm16Sha256:hash(bytes.subarray(44)),
    attenuation:audio.attenuation===undefined?null:audio.attenuation,
    hasQuality:audio.quality!==undefined,events:pattern.events.length,
    allEventsMapped:pattern.events.every(hit=>hit.mapped!==undefined),samplePeak:quality.samplePeak,clippedSamples:quality.clippedSamples};
}

export function captureMasterBus(){
  const entries=[];
  for(const algorithm of MASTER_BUS_ALGORITHMS)for(const path of MASTER_BUS_PATHS)for(const rate of [8000,44100])for(const loop of [false,true]){
    entries.push({algorithm,genre:MASTER_BUS_GENRE,path,rate,loop,...masterBusFingerprint(MASTER_BUS_GENRE,algorithm,path,rate,loop)});
  }
  return {entries};
}
