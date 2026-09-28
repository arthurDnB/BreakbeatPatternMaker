import type {AudioAsset} from './slices.js';

export interface AudioQuality {
  samplePeak:number;
  estimatedTruePeak:number;
  rms:number;
  dcOffset:number;
  monoRms:number;
  stereoCorrelation:number;
  clippedSamples:number;
}

function cubic(a:number,b:number,c:number,d:number,t:number){
  return b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
}

/** A conservative 4× interpolation estimate, not a certified true-peak meter. */
export function measureAudioQuality(channels:Float32Array[]):AudioQuality{
  if(!channels.length||channels.some(c=>c.length!==channels[0]!.length))throw Error('Audio channels must have equal lengths.');
  const length=channels[0]!.length;
  let peak=0,truePeak=0,sum=0,dc=0,mono=0,cross=0,leftEnergy=0,rightEnergy=0,clipped=0;
  for(let i=0;i<length;i++){
    for(const channel of channels){
      const value=channel[i]!;
      if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');
      const abs=Math.abs(value);peak=Math.max(peak,abs);if(abs>=1)clipped++;
      sum+=value*value;dc+=value;
      if(abs>.5&&i+1<length){
        const a=channel[Math.max(0,i-1)]!,c=channel[i+1]!,d=channel[Math.min(length-1,i+2)]!;
        truePeak=Math.max(truePeak,Math.abs(cubic(a,value,c,d,.25)),Math.abs(cubic(a,value,c,d,.5)),Math.abs(cubic(a,value,c,d,.75)));
      }
    }
    const left=channels[0]![i]!,right=channels[1]?.[i]??left;
    mono+=((left+right)*.5)**2;cross+=left*right;leftEnergy+=left*left;rightEnergy+=right*right;
  }
  return {samplePeak:peak,estimatedTruePeak:Math.max(peak,truePeak),rms:Math.sqrt(sum/Math.max(1,length*channels.length)),
    dcOffset:dc/Math.max(1,length*channels.length),monoRms:Math.sqrt(mono/Math.max(1,length)),
    stereoCorrelation:cross/Math.sqrt(leftEnergy*rightEnergy||1),clippedSamples:clipped};
}

/** Linked, linear master trim leaves quiet renders untouched and protects stereo balance. */
export function protectMaster(channels:Float32Array[],ceiling=.96){
  if(!Number.isFinite(ceiling)||ceiling<=0||ceiling>=1)throw Error('Master ceiling must be between zero and one.');
  // Low-level material cannot develop an intersample over at this ceiling.
  let samplePeak=0;
  for(const channel of channels)for(let i=0;i<channel.length;i++)samplePeak=Math.max(samplePeak,Math.abs(channel[i]!));
  if(samplePeak<ceiling*.5)return {attenuation:1,before:undefined,after:undefined};
  const before=measureAudioQuality(channels),gain=Math.min(1,ceiling/before.estimatedTruePeak);
  if(gain<1)for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]!*=gain;
  return {attenuation:gain,before,after:gain<1?measureAudioQuality(channels):before};
}
/** Compare the first 100 ms of two sounds after their selected layer offset. */
export function assessLayerMono(primary:AudioAsset,layer:AudioAsset,level:number,offsetMs:number,phaseInvert=false){
  const rate=12000,count=Math.round(rate*.1),shift=offsetMs/1000;
  const sample=(asset:AudioAsset,time:number)=>{
    const frame=Math.round(time*asset.sampleRate);
    if(frame<0||frame>=asset.channels[0]!.length)return 0;
    return (asset.channels[0]![frame]!+(asset.channels[1]?.[frame]??asset.channels[0]![frame]!))*.5;
  };
  let a=0,b=0,mix=0;
  for(let i=0;i<count;i++){
    const first=sample(primary,i/rate),second=sample(layer,i/rate-shift)*level*(phaseInvert?-1:1);
    a+=first*first;b+=second*second;mix+=(first+second)**2;
  }
  const strongest=Math.sqrt(Math.max(a,b)/count),combined=Math.sqrt(mix/count);
  return {monoLossDb:20*Math.log10(Math.max(combined,1e-8)/Math.max(strongest,1e-8)),warning:combined<strongest*.79};
}
