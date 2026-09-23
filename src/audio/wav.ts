// Browser-independent PCM WAV encoding; interleaved, stereo/mono, 16-bit PCM.
export function encodeWav(channels:Float32Array[],sampleRate:number):ArrayBuffer {
  const frames=channels[0]?.length??0;
  if(!frames||channels.length>2||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000||channels.some(c=>c.length!==frames))throw new Error('Invalid PCM audio.');
  const bytes=new ArrayBuffer(44+frames*channels.length*2),v=new DataView(bytes);
  const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels.length,true);
  v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels.length*2,true);
  v.setUint16(32,channels.length*2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,bytes.byteLength-44,true);
  for(let i=0;i<frames;i++)for(let c=0;c<channels.length;c++){
    const value=channels[c]![i]!;if(!Number.isFinite(value))throw new Error('Non-finite PCM audio.');
    const s=Math.max(-1,Math.min(1,value));v.setInt16(44+(i*channels.length+c)*2,Math.round(s*(s<0?32768:32767)),true);
  }
  return bytes;
}
export function validateWav(bytes:ArrayBuffer){
  const v=new DataView(bytes),tag=(o:number)=>String.fromCharCode(...new Uint8Array(bytes,o,4));
  if(bytes.byteLength<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')throw new Error('Choose a valid RIFF WAV file.');
  let channels=0,rate=0,align=0,frames=0;
  for(let p=12;p+8<=bytes.byteLength;){
    const length=v.getUint32(p+4,true),end=p+8+length;if(end>bytes.byteLength)throw new Error('WAV file is truncated.');
    if(tag(p)==='fmt '){
      if(length<16)throw new Error('Invalid WAV format.');
      const format=v.getUint16(p+8,true);
      if(![1,3,65534].includes(format))throw new Error('Use an uncompressed PCM or float WAV.');
      channels=v.getUint16(p+10,true);rate=v.getUint32(p+12,true);align=v.getUint16(p+20,true);
    }
    if(tag(p)==='data')frames+=length;
    p=end+(length%2);
  }
  if(![1,2].includes(channels)||rate<8000||rate>192000||!align||!frames)throw new Error('Use a mono or stereo WAV, 8–192 kHz.');
  const duration=frames/align/rate;
  if(duration>120)throw new Error('Choose a break up to two minutes long.');
  return {channels,sampleRate:rate,duration};
}
