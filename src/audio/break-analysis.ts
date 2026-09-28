/** Deterministic multi-band onset analysis. All coordinates refer to source PCM frames. */
export interface BreakAnalysisOptions {sensitivity:number;minGapMs:number;startFrame:number;endFrame:number;manualMarkers?:number[]}
export interface BreakAnalysis {markers:number[];candidates:{frame:number;strength:number}[];overflow:boolean}
// Small radix-2 FFT, with Hann windowing applied by the caller. Kept independent
// of the UI/worker so another onset backend can replace this implementation.
function fft(re:Float64Array,im:Float64Array){
  const size=re.length;
  for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j]!,re[i]!];}}
  for(let len=2;len<=size;len*=2){const angle=-2*Math.PI/len,ar=Math.cos(angle),ai=Math.sin(angle);
    for(let i=0;i<size;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){
      const p=i+j,q=p+len/2,tr=wr*re[q]!-wi*im[q]!,ti=wr*im[q]!+wi*re[q]!;
      re[q]=re[p]!-tr;im[q]=im[p]!-ti;re[p]=re[p]!+tr;im[p]=im[p]!+ti;
      const next=wr*ar-wi*ai;wi=wr*ai+wi*ar;wr=next;
    }}
  }
}
export function analyzeBreak(channels:Float32Array[],rate:number,options:BreakAnalysisOptions,progress:(value:number)=>void=()=>{}):BreakAnalysis {
  const {sensitivity,minGapMs,startFrame,endFrame}=options;
  if(!channels.length||channels.length>2||channels.some(c=>c.length!==channels[0]!.length)||!Number.isInteger(rate)||rate<8000||rate>192000||!Number.isFinite(sensitivity)||sensitivity<0||sensitivity>1||!Number.isFinite(minGapMs)||minGapMs<10||minGapMs>1000||!Number.isInteger(startFrame)||!Number.isInteger(endFrame)||startFrame<0||endFrame>channels[0]!.length||endFrame<=startFrame)throw Error('Invalid break analysis settings.');
  const hop=Math.max(1,Math.round(rate*.002)),count=Math.ceil((endFrame-startFrame)/hop);
  const bands=Array.from({length:3},()=>new Float64Array(count));
  const low=new Float64Array(channels.length),mid=new Float64Array(channels.length);
  const a=1-Math.exp(-2*Math.PI*180/rate),b=1-Math.exp(-2*Math.PI*2500/rate);
  for(let n=0;n<count;n++){
    const from=startFrame+n*hop,to=Math.min(endFrame,from+hop);
    for(let f=from;f<to;f++)for(let c=0;c<channels.length;c++){
      const x=channels[c]![f]!;if(!Number.isFinite(x))throw Error('Audio contains invalid samples.');
      low[c]=low[c]!+a*(x-low[c]!);mid[c]=mid[c]!+b*(x-mid[c]!);
      const values=[low[c]!,mid[c]!-low[c]!,x-mid[c]!];
      for(let k=0;k<3;k++)bands[k]![n]=bands[k]![n]!+values[k]!*values[k]!;
    }
    for(const band of bands)band[n]=Math.sqrt(band[n]!/((to-from)*channels.length));
    if(n%256===0)progress(n/count*.65);
  }
  const novelty=new Float64Array(count);
  for(const band of bands){
    let peak=0;for(const value of band)peak=Math.max(peak,value);if(peak<1e-6)continue;
    let baseline=0;
    for(let n=0;n<count;n++){
      const value=band[n]!/peak,rise=Math.max(0,value-baseline);
      novelty[n]=Math.max(novelty[n]!,rise);baseline=.85*baseline+.15*value;
    }
  }
  const size=2**Math.ceil(Math.log2(rate*.006)),re=new Float64Array(size),im=new Float64Array(size),previous=channels.map(()=>new Float64Array(size/2));
  const flux=new Float64Array(count);let peakFlux=0;
  for(let n=0;n<count;n++){
    for(let c=0;c<channels.length;c++){
      im.fill(0);const end=startFrame+(n+1)*hop;
      for(let j=0;j<size;j++){const frame=end-size+j;re[j]=(frame>=startFrame&&frame<endFrame?channels[c]![frame]!:0)*(.5-.5*Math.cos(2*Math.PI*j/(size-1)));}
      fft(re,im);
      for(let k=1;k<size/2;k++){const magnitude=Math.log1p(10*Math.hypot(re[k]!,im[k]!)/size);flux[n]=flux[n]!+Math.max(0,magnitude-previous[c]![k]!);previous[c]![k]=magnitude;}
    }
    peakFlux=Math.max(peakFlux,flux[n]!);if(n%256===0)progress(.65+.3*n/count);
  }
  // Spectral novelty supplements energy evidence; quiet high-frequency attacks
  // need their own band to avoid a loud kick masking every following hat.
  if(peakFlux>1e-6)for(let n=0;n<count;n++)novelty[n]=Math.max(novelty[n]!,.65*flux[n]!/peakFlux);
  const candidates:{frame:number;strength:number}[]=[];
  for(let n=1;n<count-1;n++){
    const value=novelty[n]!;if(value<novelty[n-1]!||value<=novelty[n+1]!)continue;
    let mean=0;const left=Math.max(0,n-25),right=Math.min(count,n+26);
    for(let j=left;j<right;j++)mean+=novelty[j]!;mean/=(right-left);
    if(value<Math.max(.035+(1-sensitivity)*.18,mean*(1.2+(1-sensitivity)*1.4)))continue;
    // Backtrack a local rise to its foot, never across more than 12 ms.
    let foot=n;while(foot>Math.max(0,n-6)&&novelty[foot-1]!<novelty[foot]!&&novelty[foot-1]!>value*.08)foot--;
    const frame=Math.max(startFrame,startFrame+(foot-1)*hop);
    candidates.push({frame,strength:value});
  }
  const gap=Math.round(minGapMs*rate/1000),kept:number[]=[startFrame,endFrame];
  for(const frame of options.manualMarkers??[]){if(!Number.isInteger(frame)||frame<startFrame||frame>endFrame)throw Error('Invalid manual marker.');if(!kept.includes(frame))kept.push(frame);}
  for(const candidate of candidates.sort((a,b)=>b.strength-a.strength||a.frame-b.frame))if(kept.every(f=>Math.abs(candidate.frame-f)>=gap))kept.push(candidate.frame);
  progress(1);return {markers:kept.sort((a,b)=>a-b),candidates,overflow:kept.length>121};
}
