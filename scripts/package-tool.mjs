import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {zipSync} from 'fflate';
import {synthesize} from '../public/synth.js';
const root=resolve(import.meta.dirname,'..');
const tool=join(root,'tools/renoise/com.breakbeat.PatternImporter.xrnx');
const files={};
async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const full=join(dir,entry.name);if(entry.isDirectory())await collect(full);
  else files[relative(tool,full).replaceAll('\\','/')]=[new Uint8Array(await readFile(full)),{mtime:new Date(2026,0,1)}];
}}
await collect(tool);
for(const role of ['kick','snare','hat','percussion']){
  const samples=synthesize(role);const wav=Buffer.alloc(44+samples.length*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
  samples.forEach((s,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),44+i*2));
  files[`samples/${role}.wav`]=[wav,{mtime:new Date(2026,0,1)}];
}
await mkdir(join(root,'releases'),{recursive:true});
const output=join(root,'releases/com.breakbeat.PatternImporter.xrnx');
await writeFile(output,zipSync(files,{level:6}));console.log(`Packaged ${output}`);
