import {PPQ,type Hit,type Pattern} from '../core/model.js';

// V1/V2 voices use the same shape; their sample loop remains in performance.ts.
export interface RenderVoice {
  hit:Hit; channels:Float32Array[]; from:number; to:number;
  start:number; step:number; length:number; gated:boolean;
  v3?:true; repeatGain?:number; reverse?:boolean; sourceOffset?:number;
  glide?:number; glideFrames?:number; chokeGroup?:'hat'; edgeFade?:boolean;
}

// Source distance travelled over n output frames by a continuous pitch ramp.
// A closed form lets us size natural tails without allocating or scanning audio.
function distance(n:number,step:number,glide:number,ramp:number):number {
  if(!glide)return n*step;
  const rising=Math.min(n,ramp),logRatio=Math.LN2*glide/12/ramp;
  const during=step*Math.expm1(logRatio*rising)/Math.expm1(logRatio);
  return during+Math.max(0,n-ramp)*step*2**(glide/12);
}
function naturalFrames(available:number,step:number,glide:number,ramp:number,rate:number):number {
  if(!glide)return Math.ceil(available/step);
  // The shared renderer rejects audio beyond three minutes before allocating buses.
  let low=0,high=Math.ceil(180*rate)+1;
  while(low<high){const mid=Math.floor((low+high)/2);if(distance(mid,step,glide,ramp)<available)low=mid+1;else high=mid;}
  return low;
}

export function planV3Voices(pattern:Pattern,hit:Hit,channels:Float32Array[],sourceRate:number,from:number,to:number,origin:number,end:number,rate:number):RenderVoice[]{
  const secondsPerTick=60/pattern.settings.bpm/PPQ;
  const start=origin+Math.max(0,(hit.baseTick+hit.offsetTick+(hit.fineOffset??0))*secondsPerTick);
  const count=hit.ratchets??1,art=hit.articulation;
  // Old/manual hits have a row-sized burst. Generated gestures always carry ticks.
  const durationTicks=art?.durationTicks??PPQ*4/pattern.settings.resolution;
  const interval=durationTicks*secondsPerTick/count;
  const mode=hit.gate!==undefined?'gate':art?.mode??(count>1?'gate':'natural');
  return Array.from({length:count},(_,repeat)=>{
    const expression=art?.repeats?.[repeat],onset=start+repeat*interval;
    const pitch=(hit.pitch??0)+(expression?.pitch??0),step=sourceRate/rate*2**(pitch/12);
    const sourceOffset=Math.min(to-from-1,(expression?.sourceOffset??0)*(to-from));
    const glide=expression?.glide??0,glideFrames=Math.max(1,Math.round(interval*rate));
    const natural=naturalFrames(to-from-sourceOffset,step,glide,glideFrames,rate);
    // Decay shapes the source body, never the display row. This also applies to
    // uploaded and library one-shots, whose source happens to be a SliceRef.
    const decay=hit.decay??1;
    const oneShot=(hit.sourceKind??(hit.slice?'slice':'oneShot'))==='oneShot';
    const body=mode==='natural'&&oneShot?(hit.role==='kick'?.08:hit.role==='snare'&&!hit.ghost&&count===1?.065:0):0;
    const decayLength=decay<1?Math.min(natural,Math.max(Math.round(rate*Math.max(.02,body)),Math.round(natural*decay))):natural;
    const gated=mode!=='natural';
    const window=Math.min(Math.round(interval*(hit.gate??1)*rate),Math.max(0,Math.round(end*rate)-Math.round(onset*rate)));
    const length=gated?Math.min(decayLength,window):decayLength;
    return {v3:true as const,hit,channels,from,to,start:onset,step,length,gated,
      repeatGain:expression?.gain??1,reverse:expression?.reverse??hit.reverse??false,
      sourceOffset,glide,glideFrames,edgeFade:!!(expression?.reverse??hit.reverse)||sourceOffset>0,chokeGroup:art?.chokeGroup??(hit.role==='hat'?'hat':undefined)};
  }).filter(voice=>voice.length>0&&voice.start<end);
}

// A subsequent hat stops a preceding V3 hat, including across arrangement slots.
// Legacy voices can trigger that stop, but their own PCM is never modified.
export function applyV3Chokes(voices:RenderVoice[],rate:number,loopDuration?:number):void {
  const hats=voices.filter(v=>v.chokeGroup==='hat'||v.hit.role==='hat').sort((a,b)=>a.start-b.start);
  for(let i=0;i<hats.length;i++){
    const previous=hats[i]!,next=hats[i+1];
    const nextStart=next?.start??(loopDuration!==undefined?hats[0]!.start+loopDuration:undefined);
    if(nextStart===undefined)continue;
    if(previous.v3&&previous.chokeGroup==='hat'){
      const length=Math.max(0,Math.round(nextStart*rate)-Math.round(previous.start*rate));
      if(length<previous.length){previous.length=length;previous.gated=true;}
    }
  }
}

export function renderV3Voice(v:RenderVoice,bus:Float32Array[],rate:number):void {
  const offset=Math.round(v.start*rate),pan=v.hit.pan;
  const gains=v.channels.length===1?[Math.cos((pan+1)*Math.PI/4),Math.sin((pan+1)*Math.PI/4)]:[pan>0?1-pan:1,pan<0?1+pan:1];
  const level=v.hit.gain*(v.repeatGain??1)*(v.hit.slice?(v.channels.length===1?Math.SQRT2:1):.65);
  const fade=Math.max(1,Math.min(Math.round(rate*.002),Math.floor(v.length/2)));
  let phase=v.sourceOffset??0;
  for(let i=0;i<v.length&&offset+i<bus[0]!.length;i++){
    const pos=v.reverse?v.to-1-phase:v.from+phase,index=Math.floor(pos),fraction=pos-index;
    if(index<v.from||index>=v.to)break;
    let envelope=v.gated||v.edgeFade?Math.max(0,Math.min(1,i/fade,(v.length-1-i)/fade)):1;
    if(v.hit.decay!==undefined&&v.hit.decay<1)envelope*=(1-i/v.length)**2;
    for(let c=0;c<2;c++){
      const data=v.channels[Math.min(c,v.channels.length-1)]!;
      const value=data[index]!*(1-fraction)+data[Math.min(v.to-1,index+1)]!*fraction;
      bus[c]![offset+i]!+=value*level*gains[c]!*envelope;
    }
    // Integrate changing playback speed: using i*speed would jump/discontinue phase.
    phase+=v.step*2**((v.glide??0)/12*Math.min(1,i/(v.glideFrames??1)));
  }
}
