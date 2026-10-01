/** Encode the exact PCM returned by the common pattern/song renderer off the UI thread. */
export function encodeMp3(channels:Float32Array[],sampleRate:number):Promise<ArrayBuffer>{
  if(channels.length!==2||channels[0]?.length!==channels[1]?.length||sampleRate!==44100)return Promise.reject(Error('MP3 export requires stereo audio at 44.1 kHz.'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../../public/mp3-worker.js',import.meta.url),{type:'module'});
    const finish=(error?:Error,bytes?:ArrayBuffer)=>{worker.terminate();if(error)reject(error);else resolve(bytes!);};
    worker.onmessage=({data}:{data:{bytes?:ArrayBuffer,error?:string}})=>data.error?finish(Error(data.error)):data.bytes?finish(undefined,data.bytes):finish(Error('MP3 encoder returned no audio.'));
    worker.onerror=event=>finish(Error(event.message||'MP3 encoder could not start.'));
    worker.postMessage({channels,sampleRate},channels.map(channel=>channel.buffer));
  });
}
