// The comparison contract for every F-DET and F-DSP golden fixture.
//
// The table below is the frozen M0 §3.6 tolerance policy, tracked in
// docs/M1-RENDER-PLAN-CONTRACT.md ("Fixture tolerance policy (M0 §3.6)"). It used to live only in the
// gitignored M0 audit report, which meant the definition of "equal" could not survive that directory.
// `tests/fixture-tolerance.test.mjs` asserts this module and the tracked table still agree, so the two
// cannot drift apart silently.
//
// Two policies travel with the table, and both are enforced here rather than documented:
//   1. Gain errors are never normalised away. There is deliberately no helper in this module that
//      rescales a candidate to match a reference, and `compareRender` has no option to do so. A render
//      that is 2 % loud is a failure, not a near-miss.
//   2. Non-silence is not evidence of parity. Two silent renders are a failed comparison, because
//      silence agrees with silence no matter what the mixers did. Pass `expectSilence:true` only for a
//      fixture that is meant to be silent.
import {measureAudioQuality} from '../dist/audio/audio-quality.js';

/** PCM16's own step size, quoted by the table: Math.round(s*(s<0?32768:32767)) in src/audio/wav.ts:13. */
export const PCM16_LSB=3.0518e-5;

/**
 * The frozen numbers. `doc` mirrors the tracked table's tolerance cell verbatim; the agreement test
 * compares it against docs/M1-RENDER-PLAN-CONTRACT.md row by row.
 */
export const TOLERANCES={
  sampleError:{value:1e-5,doc:'1e-5'},
  onset:{highRateFrames:1,lowRateFrames:2,lowRateCeiling:8000,doc:'±1 frame (≥44.1 kHz), ±2 frames (8 kHz)'},
  peak:{value:1e-4,doc:'1e-4'},
  rms:{relative:1e-3,absolute:1e-4,doc:'relative 1e-3 **with** 1e-4 absolute floor'},
  window:{milliseconds:100,value:2e-3,doc:'2e-3'},
  dcOffset:{value:1e-5,doc:'1e-5'},
  stereoCorrelation:{value:1e-3,doc:'1e-3'},
  spectral:{size:4096,hop:2048,binError:1e-2,aggregateDb:.25,doc:'1e-2 per bin, 0.25 dB aggregate'},
  truePeak:{value:1e-3,doc:'1e-3'},
  clippedSamples:{doc:'identical'},
  pcm16:{doc:'byte-identical, else float sidecar'}
};

/** The onset frame quantisation limit for a sample rate. */
export function onsetTolerance(rate){
  return rate<=TOLERANCES.onset.lowRateCeiling?TOLERANCES.onset.lowRateFrames:TOLERANCES.onset.highRateFrames;
}

export function maximumSampleError(reference,candidate){
  sameShape(reference,candidate);
  let worst=0;
  for(let c=0;c<reference.length;c++)for(let i=0;i<reference[c].length;i++){
    worst=Math.max(worst,Math.abs(reference[c][i]-candidate[c][i]));
  }
  return worst;
}

export function maximumWindowRmsError(reference,candidate,rate){
  sameShape(reference,candidate);
  const window=Math.max(1,Math.round(rate*TOLERANCES.window.milliseconds/1000));
  const frames=reference[0].length;
  let worst=0;
  for(let start=0;start<frames;start+=window){
    const end=Math.min(frames,start+window);
    let a=0,b=0;
    for(let c=0;c<reference.length;c++)for(let i=start;i<end;i++){
      const x=reference[c][i],y=candidate[c][i];
      a+=x*x;b+=y*y;
    }
    const scale=Math.max(1,(end-start)*reference.length);
    worst=Math.max(worst,Math.abs(Math.sqrt(a/scale)-Math.sqrt(b/scale)));
  }
  return worst;
}

/** Mono onset positions: first frame reaching `threshold` after falling back below the release floor. */
export function onsetFrames(channels,threshold=1e-3){
  if(!channels.length)return [];
  const frames=channels[0].length,release=threshold*.3,out=[];
  let armed=true;
  for(let i=0;i<frames;i++){
    let value=0;
    for(const channel of channels)value+=channel[i];
    const magnitude=Math.abs(value/channels.length);
    if(armed&&magnitude>=threshold){out.push(i);armed=false;}
    else if(!armed&&magnitude<release)armed=true;
  }
  return out;
}

function hann(size){
  const window=new Float64Array(size);
  for(let i=0;i<size;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/(size-1));
  return window;
}

/** In-place iterative radix-2 Cooley-Tukey FFT. Deterministic and free of any library dependency. */
function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){const tr=re[i];re[i]=re[j];re[j]=tr;const ti=im[i];im[i]=im[j];im[j]=ti;}
  }
  for(let size=2;size<=n;size<<=1){
    const angle=-2*Math.PI/size,stepRe=Math.cos(angle),stepIm=Math.sin(angle),half=size>>1;
    for(let start=0;start<n;start+=size){
      let twiddleRe=1,twiddleIm=0;
      for(let k=0;k<half;k++){
        const evenRe=re[start+k],evenIm=im[start+k];
        const oddRe=re[start+k+half]*twiddleRe-im[start+k+half]*twiddleIm;
        const oddIm=re[start+k+half]*twiddleIm+im[start+k+half]*twiddleRe;
        re[start+k]=evenRe+oddRe;im[start+k]=evenIm+oddIm;
        re[start+k+half]=evenRe-oddRe;im[start+k+half]=evenIm-oddIm;
        const nextRe=twiddleRe*stepRe-twiddleIm*stepIm;
        twiddleIm=twiddleRe*stepIm+twiddleIm*stepRe;twiddleRe=nextRe;
      }
    }
  }
}

/**
 * Welch-averaged magnitude spectrum: successive Hann-windowed `size`-frame blocks, hop `size/2` by
 * default, so a divergence in one part of the render cannot hide behind a clean opening.
 */
export function meanMagnitudeSpectrum(signal,size=TOLERANCES.spectral.size,hop=TOLERANCES.spectral.hop){
  if(signal.length<size)throw Error('Signal is shorter than one spectral window.');
  const window=hann(size),bins=(size>>1)+1,total=new Float64Array(bins);
  const re=new Float64Array(size),im=new Float64Array(size);
  let blocks=0;
  for(let start=0;start+size<=signal.length;start+=hop){
    let gain=0;
    for(let i=0;i<size;i++){gain+=window[i];re[i]=signal[start+i]*window[i];im[i]=0;}
    fft(re,im);
    for(let bin=0;bin<bins;bin++)total[bin]+=Math.hypot(re[bin],im[bin])/(gain/2);
    blocks++;
  }
  for(let bin=0;bin<bins;bin++)total[bin]/=blocks;
  return {magnitudes:total,blocks};
}

export function spectralDifference(reference,candidate,options={}){
  sameShape(reference,candidate);
  const size=options.size??TOLERANCES.spectral.size,hop=options.hop??TOLERANCES.spectral.hop;
  const floor=options.floor??1e-6;
  const mixed=channels=>{
    const frames=channels[0].length,mono=new Float64Array(frames);
    for(let i=0;i<frames;i++){
      let value=0;
      for(const channel of channels)value+=channel[i];
      mono[i]=value/channels.length;
    }
    return mono;
  };
  const a=meanMagnitudeSpectrum(mixed(reference),size,hop),b=meanMagnitudeSpectrum(mixed(candidate),size,hop);
  let maxBinError=0,dbTotal=0,dbCount=0;
  for(let bin=0;bin<a.magnitudes.length;bin++){
    maxBinError=Math.max(maxBinError,Math.abs(a.magnitudes[bin]-b.magnitudes[bin]));
    if(a.magnitudes[bin]>floor){
      dbTotal+=Math.abs(20*Math.log10(Math.max(b.magnitudes[bin],1e-12)/a.magnitudes[bin]));
      dbCount++;
    }
  }
  return {maxBinError,aggregateDb:dbCount?dbTotal/dbCount:0,bins:a.magnitudes.length,blocks:a.blocks};
}

function sameShape(reference,candidate){
  if(!reference.length||reference.length!==candidate.length)throw Error('Renders must have the same channel count.');
  if(reference[0].length!==candidate[0].length)throw Error('Renders must have the same frame count.');
}

/**
 * The whole table in one call. Returns every measured quantity plus the failures that exceeded it, so a
 * failing fixture reports which row broke instead of only that the bytes differ.
 */
export function compareRender(reference,candidate,options={}){
  const rate=options.rate??44100;
  const expectSilence=options.expectSilence===true;
  sameShape(reference,candidate);
  const a=measureAudioQuality(reference),b=measureAudioQuality(candidate);
  const failures=[];
  const fail=(metric,detail)=>failures.push({metric,detail});

  if(a.samplePeak===0&&b.samplePeak===0&&!expectSilence)fail('silence','both renders are silent, which is not evidence of parity');
  {
    const sampleError=maximumSampleError(reference,candidate);
    if(sampleError>TOLERANCES.sampleError.value)fail('sampleError',`maximum sample error ${sampleError} exceeds 1e-5`);
    const windowError=maximumWindowRmsError(reference,candidate,rate);
    if(windowError>TOLERANCES.window.value)fail('window',`worst 100 ms window RMS error ${windowError} exceeds 2e-3`);
    if(Math.abs(a.samplePeak-b.samplePeak)>TOLERANCES.peak.value)fail('peak',`peak error ${Math.abs(a.samplePeak-b.samplePeak)} exceeds 1e-4`);
    if(Math.abs(a.estimatedTruePeak-b.estimatedTruePeak)>TOLERANCES.truePeak.value)fail('truePeak',`true-peak error ${Math.abs(a.estimatedTruePeak-b.estimatedTruePeak)} exceeds 1e-3`);
    const rmsError=Math.abs(a.rms-b.rms);
    if(rmsError>TOLERANCES.rms.absolute&&rmsError>Math.abs(a.rms)*TOLERANCES.rms.relative){
      fail('rms',`RMS error ${rmsError} exceeds the relative 1e-3 and absolute 1e-4 floors`);
    }
    if(Math.abs(a.dcOffset-b.dcOffset)>TOLERANCES.dcOffset.value)fail('dcOffset',`DC offset error ${Math.abs(a.dcOffset-b.dcOffset)} exceeds 1e-5`);
    if(Math.abs(a.stereoCorrelation-b.stereoCorrelation)>TOLERANCES.stereoCorrelation.value){
      fail('stereoCorrelation',`correlation error ${Math.abs(a.stereoCorrelation-b.stereoCorrelation)} exceeds 1e-3`);
    }
    if(a.clippedSamples!==b.clippedSamples)fail('clippedSamples',`clipped samples ${a.clippedSamples} vs ${b.clippedSamples} must be identical`);
    if(reference[0].length>=TOLERANCES.spectral.size){
      const spectral=spectralDifference(reference,candidate);
      if(spectral.maxBinError>TOLERANCES.spectral.binError)fail('spectralBin',`maximum bin error ${spectral.maxBinError} exceeds 1e-2`);
      if(spectral.aggregateDb>TOLERANCES.spectral.aggregateDb)fail('spectralAggregate',`aggregate ${spectral.aggregateDb} dB exceeds 0.25 dB`);
    }
    const onsetsA=onsetFrames(reference),onsetsB=onsetFrames(candidate),limit=onsetTolerance(rate);
    if(onsetsA.length!==onsetsB.length)fail('onsetCount',`${onsetsA.length} onsets vs ${onsetsB.length}`);
    else for(let i=0;i<onsetsA.length;i++){
      if(Math.abs(onsetsA[i]-onsetsB[i])>limit){fail('onsetPosition',`onset ${i} moved ${Math.abs(onsetsA[i]-onsetsB[i])} frames, limit ${limit} at ${rate} Hz`);break;}
    }
  }
  return {equal:failures.length===0,failures,reference:a,candidate:b,rate};
}
