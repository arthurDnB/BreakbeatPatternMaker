import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(readFileSync(resolve(root,'public/samples/catalog.json'),'utf8'));
const findings=[];
for(const entry of catalog){
  const bytes=readFileSync(resolve(root,entry.path.replace(/^\//,'')));
  const hash=createHash('sha256').update(bytes).digest('hex');
  if(hash!==entry.sha256)throw Error(`Hash mismatch: ${entry.id}`);
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error(`Invalid WAV: ${entry.id}`);
  let format,channels,rate,bits,data;
  for(let at=12;at+8<=bytes.length;){
    const tag=bytes.toString('ascii',at,at+4),size=bytes.readUInt32LE(at+4),start=at+8;
    if(tag==='fmt '){format=bytes.readUInt16LE(start);channels=bytes.readUInt16LE(start+2);rate=bytes.readUInt32LE(start+4);bits=bytes.readUInt16LE(start+14);}
    if(tag==='data')data=bytes.subarray(start,start+size);
    at=start+size+(size%2);
  }
  if(format!==1||![16,24].includes(bits)||!data||!channels||!rate)throw Error(`Unsupported PCM: ${entry.id}`);
  const step=bits/8,frames=Math.floor(data.length/(step*channels));
  let peak=0,energy=0,first=frames,dc=0;
  for(let i=0;i<frames;i++){
    let framePeak=0;
    for(let ch=0;ch<channels;ch++){
      const offset=(i*channels+ch)*step;
      const v=bits===16?data.readInt16LE(offset)/32768:data.readIntLE(offset,3)/8388608;
      peak=Math.max(peak,Math.abs(v));framePeak=Math.max(framePeak,Math.abs(v));energy+=v*v;dc+=v;
    }
    if(first===frames&&framePeak>.001)first=i;
  }
  const rms=Math.sqrt(energy/Math.max(1,frames*channels));
  findings.push({id:entry.id,role:entry.role,duration:+(frames/rate).toFixed(3),peak:+peak.toFixed(3),rms:+rms.toFixed(4),leadMs:+(first/rate*1000).toFixed(1),dc:+(dc/Math.max(1,frames*channels)).toFixed(4),source:entry.source?'recorded':'missing'});
}
const flagged=findings.filter(x=>x.peak>.999||x.peak<.05||x.leadMs>25||Math.abs(x.dc)>.03);
console.log(JSON.stringify({total:findings.length,missingSource:findings.filter(x=>x.source==='missing').length,flagged:flagged.length,details:process.argv.includes('--all')?findings:flagged},null,2));
