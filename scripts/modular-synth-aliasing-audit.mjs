// Deterministic offline alias/stability audit for the modular synth renderer.
//
// Protocol and interpretation: docs/MODULAR-SYNTH-ALIASING.md
// Regression gates:            tests/modular-synth-aliasing.test.mjs
// Evidences:                   modular_synth_realism_plan.md:75 (aliasing at C5/192 kHz,
//                              low-rate stability at 8 kHz) and modular_synth_realism_plan.md:41
//                              (simple FM/ring modulation aliases readily).
//
// This script never renders PCM of its own: every sample comes from the shared
// renderer src/audio/modular-synth.ts (`renderModularSynthNote`) through the same
// `starterPatch` factory default the preview/song/export path uses.
//
// Determinism: no timestamps, no host/environment data, no Math.random, no Map
// iteration order dependence. Same inputs -> byte-identical report.json.

import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {starterPatch,renderModularSynthNote,modularTailSeconds} from '../dist/audio/modular-synth.js';
import {SYNTH_PRESET_CATALOG} from '../dist/core/synth-presets.js';

export const REPORT_SCHEMA='modular-synth-aliasing-audit/v1';
export const REPORT_PATH=join('test-results','modular-synth-aliasing','report.json');

// Every analysis constant is documented here so the report is self-describing.
export const ANALYSIS={
  windowName:'blackman-harris-4-term',
  windowCoefficients:[0.35875,0.48829,0.14128,0.01168],
  // The first 50 ms are skipped: the attack transient is broadband and would be
  // counted as inharmonic energy at low f0.
  startOffsetSeconds:0.05,
  // The analysis window is a FIXED DURATION in seconds at every sample rate,
  // then zero-padded up to the next power of two for the FFT. That keeps the
  // spectral resolution - and therefore the harmonic tolerance in Hz - the
  // same at 8 kHz and at 192 kHz, which is what makes the inharmonic ratio
  // comparable across rates. (Using a fixed SAMPLE count instead would make
  // the tolerance, and hence the measured ratio, depend on the sample rate.)
  analysisSeconds:0.75,
  // Hard ceiling on the transform size; 192 kHz x 0.75 s = 144000 samples,
  // whose next power of two is 262144.
  maxFftSize:262144,
  // Peak-picking tolerance for "this bin belongs to a harmonic".
  harmonicToleranceCents:25,
  // A 4-term Blackman-Harris window has a main lobe +/-4/T wide in Hz, i.e.
  // +/-4 in units of 1/T where T is the window duration. A bin closer than
  // that to a partial cannot be resolved away from it, so the effective
  // tolerance is max(4/T Hz, 25 cents of the harmonic frequency).
  windowMainLobeHalfWidthUnits:4,
  // The autocorrelation lag search is guided to within +/- this factor of the
  // ideal period of the requested note. Rationale: several factory patches
  // deliberately stack a partial an exact 3rd-harmonic interval above the
  // fundamental (bell-pluck tunes source-b +19 semitones = 12*log2(3)), and an
  // unguided search then locks onto that partial's period instead of the
  // fundamental's. A +/-1.6x window (+/-814 cents) is far wider than any real
  // pitch-tracking error and still rejects harmonic multiples: the only
  // period-related peaks inside it are the fundamental's own.
  f0TrackingRatio:1.6,
  analysisLowHz:20,
  // Partials at or above Nyquist cannot exist in a correctly band-limited
  // render, so they are not part of the legitimate harmonic grid: foldback of
  // those partials therefore lands in the inharmonic bucket (that is the point).
  excludeHarmonicsAboveNyquist:true,
  // Anti-alias low-pass used to build the 192 kHz -> low-rate projections.
  projectionHalfTapsOut:16,
  decimationTaps:161,
  projectionCutoffRatio:0.45
};

export const MATRIX={
  durationSeconds:1.5,
  notes:[['C1',24],['C3',48],['C5',72]],
  // The plan requires 8000/22050/44100/96000/192000. 48000 is added because it
  // is the project's preview rate and the required 192 kHz -> 48 kHz projection
  // needs a native 48 kHz render to be compared against.
  rates:[8000,22050,44100,48000,96000,192000],
  velocities:[['soft',0.25],['hard',0.95]],
  // 192000 is the projection source, so it is not compared against itself.
  projectionTargets:[8000,22050,44100,48000,96000]
};

// The required matrix is the factory Rhodes patch. The other two subjects are
// the patches the plan actually calls out: the phase-modulation/multistage
// envelope draft (modular_synth_realism_plan.md:75) and a metallic patch (:75).
export const SUBJECTS=[
  {presetId:'rhodes-keys',role:'factory Rhodes "Electric Piano (Tine)" (required matrix)',velocityMode:'both'},
  {presetId:'rhodes-model-v2',role:'Rhodes FM draft: fm-operator + multi-envelope tranche patch',velocityMode:'both'},
  {presetId:'bell-pluck',role:'metallic test patch ("FM Bells")',velocityMode:'hard'}
];

// ------------------------------------------------------------------ controls
//
// Positive controls. A "no aliasing measured" result is only worth anything if
// the metric is demonstrably able to see aliasing when it is there, so the
// audit also renders two deliberately alias-prone variants of the same factory
// patches (edited copies of the patch objects, through the same shared
// renderer) and reports the same numbers for them. These are NOT products
// patches and nothing in src/ is touched.
export const CONTROLS=[
  {
    id:'control-saw-foldback',
    description:'Harmonic-rich control: rhodes-keys source-a switched from sine to sawtooth, source-b muted, filter opened, chorus removed. C7 (2093 Hz) has 3 harmonics below 4 kHz; C8 (4186 Hz) is above Nyquist at 8 kHz, so the render must fold.',
    presetId:'rhodes-keys',
    notes:[['C7',96],['C8',108]],
    rates:[8000,192000],
    velocity:0.95,
    mutate(patch){
      const node=id=>patch.nodes.find(entry=>entry.id===id);
      Object.assign(node('source-a').params,{wave:'saw',tune:0,level:0.8,warmth:0});
      node('source-b').params.level=0;
      Object.assign(node('filter').params,{mode:'lowpass',cutoff:7000,resonance:0.1});
      Object.assign(node('env').params,{attack:0.002,decay:4,sustain:1,release:0.5});
      node('chorus').params.wet=0;
    }
  },
  {
    id:'control-fm-index-8',
    description:'Phase-modulation control: rhodes-model-v2 FM core with carrier index 8, modulator level 1 and both envelopes held open, so sidebands run well past Nyquist. This is the "simple FM ... aliases readily" case from modular_synth_realism_plan.md:41.',
    presetId:'rhodes-model-v2',
    notes:[['C5',72]],
    rates:[8000,192000],
    velocity:0.95,
    mutate(patch){
      const node=id=>patch.nodes.find(entry=>entry.id===id);
      node('modulator').params.index=0;
      node('modulator').params.level=1;
      node('carrier').params.index=8;
      Object.assign(node('tine-env').params,{attack:0.001,fall:3,breakLevel:1,decay2:4,sustain:1,release:0.5});
      Object.assign(node('amp-env').params,{attack:0.002,fall:3,breakLevel:1,decay2:4,sustain:1,release:0.5});
      node('chorus').params.wet=0;
    }
  }
];

export function buildControlPatch(control){
  const patch=structuredClone(starterPatch(control.presetId));
  control.mutate(patch);
  return patch;
}

// ---------------------------------------------------------------- primitives

const round6=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clampValue=(value,low,high)=>Math.max(low,Math.min(high,value));

export function pow2Ceil(value){
  let n=1;
  while(n<value)n*=2;
  return n;
}

export function blackmanHarris(length){
  const [a0,a1,a2,a3]=ANALYSIS.windowCoefficients;
  const window=new Float64Array(length),denominator=Math.max(1,length-1);
  for(let i=0;i<length;i++){
    const phase=2*Math.PI*i/denominator;
    window[i]=a0-a1*Math.cos(phase)+a2*Math.cos(2*phase)-a3*Math.cos(3*phase);
  }
  return window;
}

export function hann(length){
  const window=new Float64Array(length),denominator=Math.max(1,length-1);
  for(let i=0;i<length;i++)window[i]=0.5-0.5*Math.cos(2*Math.PI*i/denominator);
  return window;
}

/** In-place iterative radix-2 forward FFT. re/im length must be a power of two. */
export function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){const tr=re[i];re[i]=re[j];re[j]=tr;const ti=im[i];im[i]=im[j];im[j]=ti;}
  }
  for(let len=2;len<=n;len<<=1){
    const angle=-2*Math.PI/len,stepRe=Math.cos(angle),stepIm=Math.sin(angle),half=len>>1;
    for(let start=0;start<n;start+=len){
      let curRe=1,curIm=0;
      for(let k=0;k<half;k++){
        const a=start+k,b=a+half;
        const vr=re[b]*curRe-im[b]*curIm,vi=re[b]*curIm+im[b]*curRe;
        re[b]=re[a]-vr;im[b]=im[a]-vi;
        re[a]+=vr;im[a]+=vi;
        const nextRe=curRe*stepRe-curIm*stepIm;
        curIm=curRe*stepIm+curIm*stepRe;curRe=nextRe;
      }
    }
  }
}

/** Inverse FFT via the conjugate trick; scales by 1/n. */
export function ifft(re,im){
  const n=re.length;
  for(let i=0;i<n;i++){const tmp=re[i];re[i]=im[i];im[i]=tmp;}
  fft(re,im);
  for(let i=0;i<n;i++){const tmp=re[i];re[i]=im[i]/n;im[i]=tmp/n;}
}

// ------------------------------------------------------------- f0 estimation

/**
 * Fundamental estimate by normalised autocorrelation (Wiener-Khinchin through
 * the FFT so the cost stays O(n log n)).
 *
 * `segment` must already be Hann-windowed and zero-padded up to a power-of-two
 * length: the circular autocorrelation of that array is then the linear
 * autocorrelation of the window. `idealF0` guides the lag search to within
 * +/-ANALYSIS.f0TrackingRatio of the ideal period (see that constant for why);
 * within that window the fundamental's own period is the only period-related
 * peak, so the strongest lag wins and is refined by parabolic interpolation.
 */
export function estimateF0(segment,rate,idealF0){
  const size=segment.length;
  if(size<64||!(idealF0>0))return {f0:null,acfPeak:null,periodSamples:null};
  let mean=0;
  for(let i=0;i<size;i++)mean+=segment[i];
  mean/=size;
  const re=new Float64Array(size),im=new Float64Array(size);
  for(let i=0;i<size;i++)re[i]=segment[i]-mean;
  fft(re,im);
  for(let i=0;i<size;i++){const power=re[i]*re[i]+im[i]*im[i];re[i]=power;im[i]=0;}
  const real=new Float64Array(size),imag=new Float64Array(size);
  real.set(re);
  ifft(real,imag);
  const zero=real[0];
  if(!(zero>0))return {f0:null,acfPeak:null,periodSamples:null};
  const idealPeriod=rate/idealF0;
  const lagMin=Math.max(2,Math.floor(idealPeriod/ANALYSIS.f0TrackingRatio));
  const lagMax=Math.min(size-2,Math.ceil(idealPeriod*ANALYSIS.f0TrackingRatio));
  if(lagMax<=lagMin+1)return {f0:null,acfPeak:null,periodSamples:null};
  let chosen=-1,peak=-Infinity;
  for(let k=lagMin;k<=lagMax;k++){
    const value=real[k]/zero;
    if(value>peak){peak=value;chosen=k;}
  }
  if(chosen<0||!(peak>0.1))return {f0:null,acfPeak:round6(peak),periodSamples:null};
  const a=real[chosen-1]/zero,b=real[chosen]/zero,c=real[chosen+1]/zero;
  const denominator=a-2*b+c;
  const delta=Math.abs(denominator)>1e-12?0.5*(a-c)/denominator:0;
  const periodSamples=chosen+clampValue(delta,-1,1);
  return {f0:rate/periodSamples,acfPeak:b,periodSamples};
}

// ---------------------------------------------------------- alias measurement

/**
 * Inharmonic energy ratio.
 *
 * Harmonic grid = integer multiples of the estimated f0 that are strictly below
 * Nyquist. A spectral bin inside the analysis band counts as harmonic only when
 * it lies within max(25 cents of the harmonic, the window main lobe
 * +/-4/T Hz) of a grid frequency. Everything else in the band counts as
 * inharmonic: real foldback, but also window leakage, the block-transform time
 * resolution, and the patch's own intentional modulation (the Rhodes patch has
 * a chorus, whose +/-1.6 % delay sweep spreads each partial by roughly
 * +/-27 cents). That is why the audit also reports the same ratio measured on
 * the 192 kHz render and treats it as the per-note metric floor rather than
 * assuming a 0 % ideal.
 */
export function inharmonicRatio(power,binHz,f0,nyquist,mainLobeHalfWidthHz){
  if(!(f0>0)||!(binHz>0))return {inharmonicToTotal:null,inharmonicToHarmonicDb:null,harmonicEnergy:null,inharmonicEnergy:null,bins:0};
  const lowHz=Math.max(ANALYSIS.analysisLowHz,f0/2);
  const firstBin=Math.max(1,Math.ceil(lowHz/binHz));
  const lastBin=Math.min(power.length-1,Math.floor(nyquist/binHz));
  const maxHarmonic=Math.floor(nyquist/f0);
  const centsRatio=2**(ANALYSIS.harmonicToleranceCents/1200)-1;
  const lobe=mainLobeHalfWidthHz>0?mainLobeHalfWidthHz:ANALYSIS.windowMainLobeHalfWidthUnits/ANALYSIS.analysisSeconds;
  let harmonic=0,inharmonic=0,bins=0;
  for(let bin=firstBin;bin<=lastBin;bin++){
    const frequency=bin*binHz,energy=power[bin];
    let isHarmonic=false;
    const harmonicIndex=Math.round(frequency/f0);
    if(harmonicIndex>=1&&harmonicIndex<=maxHarmonic){
      const centre=harmonicIndex*f0;
      const tolerance=Math.max(lobe,centre*centsRatio);
      if(Math.abs(frequency-centre)<=tolerance)isHarmonic=true;
    }
    if(isHarmonic)harmonic+=energy;else inharmonic+=energy;
    bins++;
  }
  const total=harmonic+inharmonic;
  return {
    inharmonicToTotal:total>0?inharmonic/total:null,
    inharmonicToHarmonicDb:harmonic>0&&inharmonic>0?10*Math.log10(inharmonic/harmonic):(inharmonic===0?-Infinity:null),
    harmonicEnergy:harmonic,
    inharmonicEnergy:inharmonic,
    bins
  };
}

/** Time-domain statistics plus the spectral alias measurement for one render. */
export function analyzeRender(pcm,rate,idealF0){
  const samples=pcm.length;
  let sum=0,sumSquares=0,peak=0,nonFinite=0,finite=0;
  for(let i=0;i<samples;i++){
    const value=pcm[i];
    if(!Number.isFinite(value)){nonFinite++;continue;}
    finite++;
    sum+=value;sumSquares+=value*value;
    const magnitude=Math.abs(value);
    if(magnitude>peak)peak=magnitude;
  }
  const dcOffset=finite>0?sum/finite:null;
  const rms=finite>0?Math.sqrt(sumSquares/finite):null;
  const offset=Math.min(samples,Math.round(rate*ANALYSIS.startOffsetSeconds));
  const available=samples-offset;
  let spectrum=null;
  if(available>=256&&nonFinite===0){
    // Fixed DURATION, zero-padded up to a power of two: the resolution in Hz,
    // and therefore the harmonic tolerance, is then the same at every sample
    // rate, which is what makes the ratio comparable across rates.
    const requested=Math.round(rate*ANALYSIS.analysisSeconds);
    let windowSamples=Math.min(available,requested);
    let fftSize=pow2Ceil(windowSamples);
    if(fftSize>ANALYSIS.maxFftSize){fftSize=ANALYSIS.maxFftSize;windowSamples=Math.min(windowSamples,fftSize);}
    const windowSeconds=windowSamples/rate;
    const mainLobeHalfWidthHz=ANALYSIS.windowMainLobeHalfWidthUnits/windowSeconds;
    const window=blackmanHarris(windowSamples),acfWindow=hann(windowSamples);
    const segment=new Float64Array(fftSize);
    for(let i=0;i<windowSamples;i++)segment[i]=pcm[offset+i];
    const acfSegment=new Float64Array(fftSize);
    for(let i=0;i<windowSamples;i++)acfSegment[i]=segment[i]*acfWindow[i];
    const estimated=estimateF0(acfSegment,rate,idealF0);
    const re=new Float64Array(fftSize),im=new Float64Array(fftSize);
    for(let i=0;i<windowSamples;i++)re[i]=segment[i]*window[i];
    fft(re,im);
    const power=new Float64Array(fftSize>>1);
    for(let bin=0;bin<power.length;bin++)power[bin]=re[bin]*re[bin]+im[bin]*im[bin];
    const binHz=rate/fftSize;
    const ratio=inharmonicRatio(power,binHz,estimated.f0,rate/2,mainLobeHalfWidthHz);
    spectrum={
      analysisSamples:windowSamples,
      fftSize,
      analysisStartSample:offset,
      analysisStartSeconds:round6(offset/rate),
      analysisSeconds:round6(windowSeconds),
      mainLobeHalfWidthHz:round6(mainLobeHalfWidthHz),
      binHz,
      estimatedF0:round6(estimated.f0),
      estimatedPeriodSamples:round6(estimated.periodSamples),
      acfPeak:estimated.acfPeak,
      centsError:estimated.f0&&idealF0?round6(1200*Math.log2(estimated.f0/idealF0)):null,
      ...ratio
    };
  }
  return {samples,peak,rms,dcOffset,nonFinite,spectrum};
}

export const idealFrequency=note=>440*2**((note-69)/12);

// ------------------------------------------------------- projection / compare

const sinc=x=>x===0?1:Math.sin(Math.PI*x)/(Math.PI*x);
const hammingTap=(index,length)=>length<=1?1:0.54-0.46*Math.cos(2*Math.PI*index/(length-1));

/** Symmetric windowed-sinc low-pass; the returned kernel is normalised to unit DC gain. */
export function designLowpass(taps,cutoffHz,sourceRate){
  const delay=(taps-1)>>1,kernel=new Float64Array(taps);
  let sum=0;
  for(let i=0;i<taps;i++){
    const value=2*(cutoffHz/sourceRate)*sinc(2*(cutoffHz/sourceRate)*(i-delay))*hammingTap(i,taps);
    kernel[i]=value;sum+=value;
  }
  for(let i=0;i<taps;i++)kernel[i]/=sum;
  return {kernel,delay};
}

/**
 * Convolution with the kernel's group delay compensated, so out[i] is aligned
 * with x[i]. The tap index range follows from j = i + delay - k having to stay
 * inside the source array: k runs over [max(0, base-(length-1)), min(taps-1, base)].
 */
export function lowpassFIR(x,kernel,delay){
  const length=x.length,taps=kernel.length,out=new Float64Array(length);
  for(let i=0;i<length;i++){
    const base=i+delay;
    const from=Math.max(0,base-(length-1)),to=Math.min(taps-1,base);
    let acc=0;
    for(let k=from;k<=to;k++)acc+=x[base-k]*kernel[k];
    out[i]=acc;
  }
  return out;
}

export function decimateBy(signal,factor){
  const length=Math.floor(signal.length/factor),out=new Float64Array(length);
  for(let i=0;i<length;i++)out[i]=signal[i*factor];
  return out;
}

/**
 * Zero-delay band-limited resample. The sinc kernel cutoff is applied at the
 * source rate, so the same call both anti-alias filters and retimes the signal
 * (needed for 192000 -> 44100, whose ratio 640/147 is not an integer).
 */
export function bandlimitedResample(x,sourceRate,destinationRate,cutoffHz,halfTapsOut=ANALYSIS.projectionHalfTapsOut){
  const length=Math.floor(x.length*destinationRate/sourceRate);
  const out=new Float64Array(length);
  const step=destinationRate/sourceRate;
  const halfSource=Math.max(1,Math.ceil(halfTapsOut/step));
  const normalisedCutoff=cutoffHz/sourceRate;
  for(let n=0;n<length;n++){
    const position=n/step,centre=Math.round(position);
    let acc=0,weightSum=0;
    for(let k=centre-halfSource;k<=centre+halfSource;k++){
      if(k<0||k>=x.length)continue;
      const distance=position-k;
      const weight=2*normalisedCutoff*sinc(2*normalisedCutoff*distance)*(0.54+0.46*Math.cos(Math.PI*distance/halfSource));
      acc+=x[k]*weight;weightSum+=weight;
    }
    out[n]=weightSum!==0?acc/weightSum:0;
  }
  return out;
}

export function compareSignals(reference,candidate){
  const length=Math.min(reference.length,candidate.length);
  if(length===0)return {correlation:null,residualDb:null,comparedSamples:0};
  let meanReference=0,meanCandidate=0;
  for(let i=0;i<length;i++){meanReference+=reference[i];meanCandidate+=candidate[i];}
  meanReference/=length;meanCandidate/=length;
  let covariance=0,varianceReference=0,varianceCandidate=0,residualSquares=0,candidateSquares=0;
  for(let i=0;i<length;i++){
    const a=reference[i]-meanReference,b=candidate[i]-meanCandidate;
    covariance+=a*b;varianceReference+=a*a;varianceCandidate+=b*b;
    const difference=reference[i]-candidate[i];
    residualSquares+=difference*difference;candidateSquares+=candidate[i]*candidate[i];
  }
  const denominator=Math.sqrt(varianceReference*varianceCandidate);
  return {
    comparedSamples:length,
    correlation:denominator>0?covariance/denominator:null,
    residualDb:candidateSquares>0?10*Math.log10(residualSquares/candidateSquares):null
  };
}

// ------------------------------------------------------------------- driving

function sameSamples(a,b){
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
}

function projectionFor(highRatePcm,rate){
  if(rate===48000){
    const {kernel,delay}=designLowpass(ANALYSIS.decimationTaps,ANALYSIS.projectionCutoffRatio*rate,192000);
    return {projection:decimateBy(lowpassFIR(highRatePcm,kernel,delay),4),method:'fir-lowpass+decimate-by-4'};
  }
  if(rate===44100){
    const {kernel,delay}=designLowpass(ANALYSIS.decimationTaps,ANALYSIS.projectionCutoffRatio*48000,192000);
    const base48=decimateBy(lowpassFIR(highRatePcm,kernel,delay),4);
    return {projection:bandlimitedResample(base48,48000,44100,ANALYSIS.projectionCutoffRatio*44100),method:'fir-lowpass+decimate-by-4+bandlimited-resample-48k-to-44k1'};
  }
  return {
    projection:bandlimitedResample(highRatePcm,192000,rate,ANALYSIS.projectionCutoffRatio*rate),
    method:`bandlimited-resample-192k-to-${rate}`
  };
}

export function runAudit(){
  const renders=[],subjects=[],projections=[],floors=[],velocityInvariance=[];
  for(const subject of SUBJECTS){
    const patch=starterPatch(subject.presetId);
    const definition=SYNTH_PRESET_CATALOG[subject.presetId];
    const tailSeconds=modularTailSeconds(patch);
    const velocities=subject.velocityMode==='both'?MATRIX.velocities:MATRIX.velocities.filter(entry=>entry[0]==='hard');
    const pcmByKey=new Map();
    for(const [noteName,note] of MATRIX.notes){
      const idealF0=idealFrequency(note);
      for(const [velocityName,velocity] of velocities){
        for(const rate of MATRIX.rates){
          const pcm=renderModularSynthNote(note,MATRIX.durationSeconds,rate,patch,undefined,60,0,velocity);
          pcmByKey.set(`${note}:${velocityName}:${rate}`,pcm);
          const metrics=analyzeRender(pcm,rate,idealF0);
          renders.push({
            presetId:subject.presetId,note,noteName,rate,velocityName,velocity,
            tailSeconds:round6(tailSeconds),
            peak:round6(metrics.peak),
            rms:round6(metrics.rms),
            dcOffset:round6(metrics.dcOffset),
            nonFinite:metrics.nonFinite,
            samples:metrics.samples,
            spectrum:metrics.spectrum&&{
              analysisSamples:metrics.spectrum.analysisSamples,
              fftSize:metrics.spectrum.fftSize,
              analysisStartSeconds:round6(metrics.spectrum.analysisStartSeconds,4),
              analysisSeconds:round6(metrics.spectrum.analysisSeconds,4),
              mainLobeHalfWidthHz:round6(metrics.spectrum.mainLobeHalfWidthHz,6),
              binHz:round6(metrics.spectrum.binHz,6),
              estimatedF0:round6(metrics.spectrum.estimatedF0,4),
              acfPeak:round6(metrics.spectrum.acfPeak,4),
              centsError:round6(metrics.spectrum.centsError,4),
              inharmonicToTotal:round6(metrics.spectrum.inharmonicToTotal,8),
              inharmonicToHarmonicDb:round6(metrics.spectrum.inharmonicToHarmonicDb,4),
              bins:metrics.spectrum.bins
            }
          });
        }
      }
      if(velocities.length===2){
        velocityInvariance.push({
          presetId:subject.presetId,note,noteName,rate:44100,
          softVelocity:velocities[0][1],hardVelocity:velocities[1][1],
          identical:sameSamples(
            pcmByKey.get(`${note}:${velocities[0][0]}:44100`),
            pcmByKey.get(`${note}:${velocities[1][0]}:44100`)
          )
        });
      }
      const floor=renders.find(entry=>entry.presetId===subject.presetId&&entry.note===note&&entry.rate===192000&&entry.velocityName==='hard');
      floors.push({
        presetId:subject.presetId,note,noteName,
        referenceRate:192000,
        referenceVelocityName:'hard',
        inharmonicToTotal:floor?floor.spectrum.inharmonicToTotal:null,
        estimatedF0:floor?floor.spectrum.estimatedF0:null,
        centsError:floor?floor.spectrum.centsError:null
      });
      for(const rate of MATRIX.projectionTargets){
        const native=pcmByKey.get(`${note}:hard:${rate}`);
        const high=pcmByKey.get(`${note}:hard:192000`);
        const {projection,method}=projectionFor(high,rate);
        const comparison=compareSignals(native,projection);
        const nativeMetrics=analyzeRender(native,rate,idealF0);
        const projectedMetrics=analyzeRender(projection,rate,idealF0);
        projections.push({
          presetId:subject.presetId,note,noteName,rate,
          sourceRate:192000,velocityName:'hard',method,
          nativeSamples:native.length,projectedSamples:projection.length,
          comparedSamples:comparison.comparedSamples,
          correlation:round6(comparison.correlation,8),
          residualDb:round6(comparison.residualDb,4),
          nativeInharmonicToTotal:round6(nativeMetrics.spectrum&&nativeMetrics.spectrum.inharmonicToTotal,8),
          projectedInharmonicToTotal:round6(projectedMetrics.spectrum&&projectedMetrics.spectrum.inharmonicToTotal,8),
          projectedPeak:round6(projectedMetrics.peak),
          projectedRms:round6(projectedMetrics.rms)
        });
      }
    }
    subjects.push({
      presetId:subject.presetId,
      presetLabel:definition?definition.name:null,
      presetCategory:definition?definition.category:null,
      patchSource:'starterPatch',
      role:subject.role,
      velocityMode:subject.velocityMode,
      tailSeconds:round6(tailSeconds),
      notesRendered:MATRIX.notes.map(entry=>entry[0]),
      nodeTypes:Array.from(new Set(patch.nodes.map(node=>node.type))).sort()
    });
  }
  const controls=[];
  for(const control of CONTROLS){
    const patch=buildControlPatch(control);
    const definition=SYNTH_PRESET_CATALOG[control.presetId];
    for(const [noteName,note] of control.notes){
      const idealF0=idealFrequency(note);
      for(const rate of control.rates){
        const pcm=renderModularSynthNote(note,MATRIX.durationSeconds,rate,patch,undefined,60,0,control.velocity);
        const metrics=analyzeRender(pcm,rate,idealF0);
        controls.push({
          controlId:control.id,
          description:control.description,
          presetId:control.presetId,
          presetLabel:definition?definition.name:null,
          note,noteName,rate,
          velocity:control.velocity,
          samples:metrics.samples,
          peak:round6(metrics.peak),
          rms:round6(metrics.rms),
          dcOffset:round6(metrics.dcOffset),
          nonFinite:metrics.nonFinite,
          idealF0:round6(idealF0,4),
          estimatedF0:metrics.spectrum?round6(metrics.spectrum.estimatedF0,4):null,
          centsError:metrics.spectrum?round6(metrics.spectrum.centsError,4):null,
          inharmonicToTotal:metrics.spectrum?round6(metrics.spectrum.inharmonicToTotal,8):null,
          inharmonicToHarmonicDb:metrics.spectrum?round6(metrics.spectrum.inharmonicToHarmonicDb,4):null
        });
      }
    }
  }
  return {
    schema:REPORT_SCHEMA,
    subject:'modular synth alias behaviour and low-rate stability',
    evidence:[
      'modular_synth_realism_plan.md:75',
      'modular_synth_realism_plan.md:41',
      'DEVELOPMENT-LOG.md:167'
    ],
    analysis:ANALYSIS,
    matrix:MATRIX,
    subjects,
    velocityInvariance,
    floors,
    renders,
    projections,
    controls
  };
}

// --------------------------------------------------------------------- table

const fixed=(value,width,digits=4)=>value===null||value===undefined?'n/a'.padStart(width):Number(value).toFixed(digits).padStart(width);

function renderRow(render){
  const spectrum=render.spectrum;
  const flags=[];
  if(render.nonFinite>0)flags.push('NONFINITE');
  if(render.peak>=0.999)flags.push('CLIPPED');
  if(render.dcOffset!==null&&Math.abs(render.dcOffset)>1e-4)flags.push('DC');
  if(render.rms!==null&&render.rms<1e-6)flags.push('SILENT');
  if(!spectrum||spectrum.estimatedF0===null)flags.push('F0-MISS');
  else if(Math.abs(spectrum.centsError)>50)flags.push('F0-OFF');
  return [
    render.presetId.padEnd(17),
    render.noteName.padEnd(4),
    String(render.rate).padStart(7),
    render.velocityName.padEnd(5),
    String(render.samples).padStart(8),
    fixed(render.peak,8),
    fixed(render.rms,8),
    fixed(render.dcOffset,10,7),
    spectrum&&spectrum.estimatedF0!==null?Number(spectrum.estimatedF0).toFixed(2).padStart(9):'n/a'.padStart(9),
    spectrum&&spectrum.centsError!==null?Number(spectrum.centsError).toFixed(3).padStart(8):'n/a'.padStart(8),
    fixed(spectrum?spectrum.inharmonicToTotal:null,9,6),
    fixed(spectrum?spectrum.inharmonicToHarmonicDb:null,9,2),
    flags.join(',')
  ].join(' ');
}

export function formatTable(report){
  const lines=[];
  lines.push('preset            note    rate  vel    samples     peak      rms   dcOffset     f0(Hz)    cents     inh/tot   inh/harm  flags');
  lines.push('-'.repeat(132));
  for(const render of report.renders)lines.push(renderRow(render));
  lines.push('');
  lines.push('192 kHz -> low-rate projections (hard velocity; native render vs band-limited projection from the 192 kHz render)');
  lines.push('preset            note    rate  compared  method                                                          corr     resid(dB)  nativeInh  projInh');
  lines.push('-'.repeat(160));
  for(const item of report.projections){
    lines.push([
      item.presetId.padEnd(17),
      item.noteName.padEnd(4),
      String(item.rate).padStart(7),
      String(item.comparedSamples).padStart(8),
      item.method.padEnd(63),
      fixed(item.correlation,9,6),
      fixed(item.residualDb,9,2),
      fixed(item.nativeInharmonicToTotal,10,6),
      fixed(item.projectedInharmonicToTotal,8,6)
    ].join(' '));
  }
  lines.push('');
  lines.push('alias-positive controls (deliberately alias-prone edits of the same factory patches, same shared renderer)');
  lines.push('control              preset            note    rate  vel       peak      rms      idealF0     f0(Hz)    cents     inh/tot   inh/harm  flags');
  lines.push('-'.repeat(158));
  for(const control of report.controls){
    const flags=[];
    if(control.nonFinite>0)flags.push('NONFINITE');
    if(control.peak>=0.999)flags.push('CLIPPED');
    if(control.centsError!==null&&Math.abs(control.centsError)>50)flags.push('F0-OFF');
    lines.push([
      control.controlId.padEnd(20),
      control.presetId.padEnd(17),
      control.noteName.padEnd(4),
      String(control.rate).padStart(7),
      control.velocity.toFixed(2).padStart(5),
      fixed(control.peak,8),
      fixed(control.rms,8),
      fixed(control.idealF0,10,2),
      fixed(control.estimatedF0,9,2),
      fixed(control.centsError,8,2),
      fixed(control.inharmonicToTotal,9,6),
      fixed(control.inharmonicToHarmonicDb,9,2),
      flags.join(',')
    ].join(' '));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------- main

async function main(){
  const report=runAudit();
  const json=JSON.stringify(report,null,2)+'\n';
  if(process.argv.includes('--verify-twice')){
    const repeat=JSON.stringify(runAudit(),null,2)+'\n';
    const first=createHash('sha256').update(json).digest('hex');
    const second=createHash('sha256').update(repeat).digest('hex');
    console.log(`run 1 sha256 ${first} (${Buffer.byteLength(json)} bytes)`);
    console.log(`run 2 sha256 ${second} (${Buffer.byteLength(repeat)} bytes)`);
    if(json!==repeat){
      console.error('NON-DETERMINISTIC: the two serialized reports differ');
      process.exitCode=1;
      return;
    }
    console.log('determinism verified: two runs are byte-identical');
  }
  await mkdir(join('test-results','modular-synth-aliasing'),{recursive:true});
  await writeFile(REPORT_PATH,json,'utf8');
  console.log(formatTable(report));
  console.log('');
  console.log(`Wrote ${REPORT_PATH} (${Buffer.byteLength(json)} bytes)`);
  console.log(`sha256 ${createHash('sha256').update(json).digest('hex')}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
