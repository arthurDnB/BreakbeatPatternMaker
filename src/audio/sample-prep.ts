import type {Role} from '../core/model.js';

// Prepare bundled one-shots in memory. Uploaded audio remains exactly as imported.
export function prepareLibraryHit(channels:Float32Array[],sampleRate:number,role:Role):Float32Array[]{
  if(!channels.length||!channels[0]?.length)return channels;
  const length=Math.min(...channels.map(c=>c.length));
  let peak=0;
  for(const channel of channels)for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(channel[i]!));
  if(peak<1e-7)return channels.map(c=>c.slice(0,length));
  // Preserve two milliseconds of the transient lead-in when trimming dead air.
  const threshold=Math.max(peak*.004,1e-5);
  let first=0;
  while(first<length-1&&channels.every(c=>Math.abs(c[first]!)<threshold))first++;
  first=Math.max(0,first-Math.round(sampleRate*.002));
  const count=length-first;
  const window=Math.min(count,Math.round(sampleRate*.12));
  let energy=0;
  for(const c of channels)for(let i=0;i<window;i++){const v=c[first+i]!;energy+=v*v;}
  const rms=Math.sqrt(energy/Math.max(1,window*channels.length));
  // Transient RMS balances perceived punch; peak ceiling protects sharp attacks.
  const targetRms={kick:.14,snare:.12,hat:.065,percussion:.09}[role];
  const ceiling={kick:.92,snare:.8,hat:.55,percussion:.7}[role];
  const gain=Math.min(3.5,ceiling/peak,targetRms/Math.max(rms,.01));
  const fade=Math.min(Math.round(sampleRate*.002),Math.floor(count/4));
  return channels.map(c=>{
    const out=new Float32Array(count);
    // Preserve kick sub phase; only remove material whole-hit DC from other roles.
    let mean=0;
    if(role!=='kick')for(let i=0;i<count;i++)mean+=c[first+i]!;
    mean/=Math.max(1,count);
    const dc=Math.abs(mean)>.015?mean:0;
    for(let i=0;i<count;i++){
      const edge=fade?Math.min(1,(i+1)/fade,(count-i)/fade):1;
      out[i]=Math.max(-ceiling,Math.min(ceiling,(c[first+i]!-dc)*gain*edge));
    }
    return out;
  });
}
