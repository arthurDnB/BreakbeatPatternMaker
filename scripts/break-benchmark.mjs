import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {analyzeBreak} from '../dist/audio/break-analysis.js';
import {transientMarkers} from '../dist/audio/chop.js';
import {encodeWav} from '../dist/audio/wav.js';

// Reproducible assembled breaks from the project's licensed one-shots. These are
// engineering fixtures with known trigger times, NOT a human-labelled real-break dataset.
const rate=44100;
async function sample(id){
 const bytes=await readFile(new URL('../public/samples/'+id+'.wav',import.meta.url));let format,channels,bits,sourceRate,data;
 for(let p=12;p+8<=bytes.length;){const tag=bytes.toString('ascii',p,p+4),length=bytes.readUInt32LE(p+4),from=p+8;
  if(tag==='fmt '){format=bytes.readUInt16LE(from);channels=bytes.readUInt16LE(from+2);sourceRate=bytes.readUInt32LE(from+4);bits=bytes.readUInt16LE(from+14);}
  if(tag==='data')data=bytes.subarray(from,from+length);p=from+length+(length%2);
 }
 if(format!==1||bits!==16)throw Error('Fixture decoder requires PCM16: '+id);
 const source=new Float32Array(data.length/2/channels);for(let i=0;i<source.length;i++){let sum=0;for(let c=0;c<channels;c++)sum+=data.readInt16LE((i*channels+c)*2)/32768;source[i]=sum/channels;}
 let peak=0;for(const v of source)peak=Math.max(peak,Math.abs(v));let start=0;while(start<source.length&&Math.abs(source[start])<peak*.02)start++;
 const frames=Math.ceil((source.length-start)/sourceRate*rate),out=new Float32Array(frames);
 for(let i=0;i<frames;i++){const at=start+i*sourceRate/rate,j=Math.floor(at),f=at-j;out[i]=((source[j]??0)*(1-f)+(source[j+1]??0)*f)/Math.max(.001,peak);}
 return out;
}
function score(markers,truth){const remaining=new Set(truth);let tp=0;const errors=[];for(const frame of markers){const closest=[...remaining].sort((a,b)=>Math.abs(a-frame)-Math.abs(b-frame))[0];if(closest!==undefined&&Math.abs(closest-frame)<=rate*.01){tp++;errors.push(Math.abs(closest-frame)/rate*1000);remaining.delete(closest);}}
 const precision=tp/Math.max(1,markers.length),recall=tp/Math.max(1,truth.length);return {tp,falsePositive:markers.length-tp,missed:truth.length-tp,precision,recall,f1:2*precision*recall/Math.max(1e-9,precision+recall),meanErrorMs:errors.reduce((a,b)=>a+b,0)/Math.max(1,tp)};
}
const ids=['acoustic-kick','acoustic-snare','acoustic-hat','808-kick','808-snare','808-hat','acoustic-kick-2','acoustic-snare-soft','acoustic-loosehat','808-kick-75','808-snare-75','808-openhat-short'];
const sounds=await Promise.all(ids.map(sample));
const cases=[
 {name:'acoustic-straight',bpm:110,kit:0,swung:false,noise:0},
 {name:'acoustic-ghosts-swung',bpm:165,kit:0,swung:true,noise:0},
 {name:'electronic-fast',bpm:220,kit:3,swung:false,noise:0},
 {name:'electronic-noisy-swung',bpm:178,kit:3,swung:true,noise:.003},
 {name:'heldout-acoustic',bpm:148,kit:6,swung:true,noise:0,heldOut:true},
 {name:'heldout-electronic',bpm:196,kit:9,swung:true,noise:.002,heldOut:true},
];
const results=[];await mkdir('test-results/break-transcription',{recursive:true});
for(const spec of cases){const step=60/spec.bpm/4,length=Math.round(8*60/spec.bpm*rate),pcm=new Float32Array(length),truth=[];let noiseSeed=17;
 for(let i=0;i<length;i++){noiseSeed=(Math.imul(noiseSeed,1664525)+1013904223)>>>0;pcm[i]=(noiseSeed/4294967296-.5)*spec.noise;}
 for(let n=0;n<32;n++){const hits=[];if(n%8===0||n===11||n===27)hits.push([0,.7]);if(n%8===4)hits.push([1,.65]);if(n%2===0)hits.push([2,.21]);if(spec.swung&&[7,15,23,30,31].includes(n))hits.push([1,.17]);if(!hits.length)continue;
  const frame=Math.round((n*step+(spec.swung&&n%2?.025:0))*rate);if(frame>=length)continue;truth.push(frame);
  for(const [kind,gain] of hits){const sound=sounds[spec.kit+kind];for(let i=0;i<sound.length&&frame+i<length;i++)pcm[frame+i]+=sound[i]*gain;}
 }
 const options={sensitivity:Number(process.env.BREAK_SENSITIVITY??.35),minGapMs:Number(process.env.BREAK_GAP_MS??35),startFrame:0,endFrame:length};const start=performance.now(),analysis=analyzeBreak([pcm],rate,options),elapsedMs=performance.now()-start;
 const annotations=[...new Set(truth)].filter(f=>f>0),markers=analysis.markers.filter(f=>f>0&&f<length);
 const row={name:spec.name,heldOut:!!spec.heldOut,durationSeconds:length/rate,elapsedMs,current:score(markers,annotations),previous:score(transientMarkers([pcm],rate,.5,25).filter(f=>f>0&&f<length),annotations)};results.push(row);
 await writeFile('test-results/break-transcription/'+spec.name+'.wav',new Uint8Array(encodeWav([pcm],rate)));
 await writeFile('test-results/break-transcription/'+spec.name+'.json',JSON.stringify({sourceSampleIds:ids.slice(spec.kit,spec.kit+3),triggerFrames:truth,detectedFrames:analysis.markers},null,2));
}
const report={dataset:'Assembled licensed one-shot fixtures; trigger annotations, not human-labelled recordings',toleranceMs:10,defaults:{sensitivity:.35,minGapMs:35},results,heldOutMeanF1:results.filter(r=>r.heldOut).reduce((s,r)=>s+r.current.f1,0)/results.filter(r=>r.heldOut).length,meanF1:results.reduce((s,r)=>s+r.current.f1,0)/results.length,realRecordingGate:'Pending independent manually annotated breaks and listening review'};
await writeFile('test-results/break-transcription/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
