// Slice boundaries are decoded-audio frame indices, including fixed start/end.
export function gridMarkers(length:number,count:number):number[]{
  if(!Number.isInteger(length)||length<1||!Number.isInteger(count)||count<1||count>128)throw new Error('Invalid grid.');
  return [...new Set(Array.from({length:Math.min(count,length)+1},(_,i)=>Math.round(i*length/Math.min(count,length))))];
}
export function transientMarkers(channels:Float32Array[],rate:number,sensitivity=.5,minGapMs=80):number[]{
  const length=channels[0]?.length??0;
  if(!length||channels.some(c=>c.length!==length)||!Number.isFinite(rate)||rate<8000||!Number.isFinite(sensitivity)||sensitivity<0||sensitivity>1||!Number.isFinite(minGapMs)||minGapMs<10||minGapMs>1000)throw new Error('Invalid chop settings.');
  const hop=Math.max(1,Math.round(rate*.002)),energy:number[]=[];
  for(let start=0;start<length;start+=hop){let sum=0;
    for(let i=start;i<Math.min(length,start+hop);i++){let power=0;for(const c of channels)power+=c[i]!*c[i]!;sum+=power/channels.length;}
    energy.push(Math.sqrt(sum/Math.min(hop,length-start)));
  }
  const peak=Math.max(...energy),threshold=peak*(.32-.29*sensitivity);
  if(peak<1e-5)return [0,length];
  const candidates:{frame:number;strength:number}[]=[];let baseline=0;
  for(let i=0;i<energy.length;i++){
    const current=energy[i]!,rise=current-baseline;
    if(rise>threshold&&current>(energy[i-1]??0)&&current>peak*.015)candidates.push({frame:Math.max(0,(i-1)*hop),strength:rise});
    baseline=baseline*.85+current*.15;
  }
  const gap=Math.round(rate*minGapMs/1000),markers=[0,length];
  // Keep stronger attacks when two candidates compete inside the minimum gap.
  for(const candidate of candidates.sort((a,b)=>b.strength-a.strength)){
    if(markers.length>=129)break;
    if(markers.every(p=>Math.abs(p-candidate.frame)>=gap))markers.push(candidate.frame);
  }
  return markers.sort((a,b)=>a-b);
}
export function moveMarker(markers:number[],index:number,frame:number):number[]{
  if(index<=0||index>=markers.length-1||!Number.isFinite(frame))return [...markers];
  const next=[...markers];next[index]=Math.max(markers[index-1]!+1,Math.min(markers[index+1]!-1,Math.round(frame)));return next;
}
