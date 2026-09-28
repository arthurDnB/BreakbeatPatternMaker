/** Offline, deterministic waveform-similarity overlap/add for short samples.
 * The same candidate offset is used for every channel so stereo timing stays linked.
 * Playback speed changes duration; pitch is left to the ordinary voice pitch control.
 */
export function stretchAudio(channels:Float32Array[],rate:number,speed:number):Float32Array[]{
  if(!channels.length||channels.some(c=>c.length!==channels[0]!.length))throw Error('Time-stretch requires aligned audio channels.');
  if(!Number.isFinite(speed)||speed<.5||speed>2)throw Error('Time-stretch speed must be 0.5×–2×.');
  if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Invalid time-stretch sample rate.');
  const length=channels[0]!.length;
  if(speed===1||length<128)return channels;
  const outputLength=Math.max(1,Math.round(length/speed));
  const grain=Math.max(64,Math.min(2048,Math.round(rate*.032),Math.floor(length/2)));
  const hop=Math.floor(grain/2),search=Math.max(8,Math.min(256,Math.round(rate*.006),Math.floor(grain/4)));
  const searchStep=grain<512?1:4,compareStep=grain<512?4:16;
  const output=channels.map(()=>new Float32Array(outputLength));
  const weights=new Float32Array(outputLength);
  // Correlate one channel: a stereo side signal can cancel completely in L+R.
  // Candidate offsets still apply identically to both channels.
  const reference=channels[0]!;
  const referenceOut=new Float32Array(outputLength);
  let previous=0;
  for(let out=0,grainIndex=0;out<outputLength;out+=hop,grainIndex++){
    const nominal=Math.round(out*speed),low=Math.max(previous+1,nominal-search),high=Math.min(length-grain,nominal+search);
    let source=grainIndex===0?0:Math.max(0,Math.min(length-grain,nominal));
    if(grainIndex>0&&low<=high){
      let best=-Infinity;
      for(let candidate=low;candidate<=high;candidate+=searchStep){
        let dot=0,left=0,right=0;
        for(let i=0;i<hop&&out+i<outputLength;i+=compareStep){
          const a=referenceOut[out+i]!,b=reference[candidate+i]!;
          dot+=a*b;left+=a*a;right+=b*b;
        }
        const score=dot/Math.sqrt(left*right+1e-12)-Math.abs(candidate-nominal)*.0001;
        if(score>best){best=score;source=candidate;}
      }
    }
    previous=source;
    for(let i=0;i<grain&&out+i<outputLength&&source+i<length;i++){
      const target=out+i;
      // Nonzero endpoints allow the first and last samples to remain audible.
      const weight=.001+.999*(.5-.5*Math.cos(2*Math.PI*(i+.5)/grain));
      weights[target]!+=weight;
      referenceOut[target]!+=reference[source+i]!*weight;
      for(let c=0;c<channels.length;c++)output[c]![target]!+=channels[c]![source+i]!*weight;
    }
  }
  for(const channel of output)for(let i=0;i<outputLength;i++)channel[i]=weights[i]!>0?channel[i]!/weights[i]!:0;
  return output;
}
