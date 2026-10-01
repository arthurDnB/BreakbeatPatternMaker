import {Mp3Encoder} from './vendor/lamejs.js';

self.onmessage=({data})=>{
  try{
    const {channels,sampleRate}=data;
    if(!Array.isArray(channels)||channels.length!==2||channels.some(channel=>!(channel instanceof Float32Array))||channels[0].length!==channels[1].length||sampleRate!==44100)throw Error('Invalid stereo PCM for MP3 export.');
    const encoder=new Mp3Encoder(2,sampleRate,192);
    const parts=[];
    const block=1152;
    for(let offset=0;offset<channels[0].length;offset+=block){
      const frames=Math.min(block,channels[0].length-offset);
      const left=new Int16Array(frames),right=new Int16Array(frames);
      for(let i=0;i<frames;i++){
        left[i]=Math.round(Math.max(-1,Math.min(1,channels[0][offset+i]))*32767);
        right[i]=Math.round(Math.max(-1,Math.min(1,channels[1][offset+i]))*32767);
      }
      const bytes=encoder.encodeBuffer(left,right);
      if(bytes.length)parts.push(bytes);
    }
    const tail=encoder.flush();if(tail.length)parts.push(tail);
    const size=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(size);
    let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}
    self.postMessage({bytes:out.buffer},[out.buffer]);
  }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
