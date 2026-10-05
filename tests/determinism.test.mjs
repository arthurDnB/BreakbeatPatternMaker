import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as vinylTexture from '../dist/audio/vinyl-texture.js';

// M1 precondition 3. The audio layer had exactly one unseeded entropy source -- the vinyl
// texture pool pick at src/audio/vinyl-texture.ts:12 -- and it made reproducible golden PCM
// impossible to capture. The chooser was removed rather than seeded, because it was dead
// code and a random draw can never be part of a fixture. These tests keep it out.

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const LAYERS=[{name:'core',dir:'src/core',minFiles:40},{name:'audio',dir:'src/audio',minFiles:25}];

// Blank every comment and quoted string while preserving byte offsets and newlines, so a
// regex hit can be reported as a file:line and the same word inside prose or a message
// string can never trip the scan.
function maskNonCode(source){
 const out=source.split('');
 let i=0,state='code';
 while(i<source.length){
  const c=source[i],next=source[i+1];
  if(state==='code'){
   if(c==='/'&&next==='/'){out[i]=out[i+1]=' ';i+=2;state='line';continue;}
   if(c==='/'&&next==='*'){out[i]=out[i+1]=' ';i+=2;state='block';continue;}
   if(c==="'"||c==='"'){out[i]=' ';i++;state=c;continue;}
   i++;continue;
  }
  if(state==='line'){
   if(c==='\n'){state='code';i++;continue;}
   out[i]=' ';i++;continue;
  }
  if(state==='block'){
   if(c==='*'&&next==='/'){out[i]=out[i+1]=' ';i+=2;state='code';continue;}
   out[i]=c==='\n'?'\n':' ';i++;continue;
  }
  if(c==='\\'){out[i]=' ';if(i+1<out.length)out[i+1]=' ';i+=2;continue;}
  if(c===state){out[i]=' ';i++;state='code';continue;}
  out[i]=c==='\n'?'\n':' ';i++;continue;
 }
 return out.join('');
}

function layerFiles(dir){
 const abs=join(ROOT,dir);
 return readdirSync(abs,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&entry.name.endsWith('.ts'))
  .map(entry=>({rel:`${dir}/${entry.name}`,abs:join(abs,entry.name)}))
  .sort((a,b)=>a.rel.localeCompare(b.rel));
}

const scanned=LAYERS.flatMap(layer=>layerFiles(layer.dir).map(file=>({...file,layer:layer.name})));

test('the determinism scan really walked the generation and audio layers',()=>{
 for(const {name,dir,minFiles} of LAYERS){
  const count=scanned.filter(file=>file.layer===name).length;
  assert.ok(count>=minFiles,`expected at least ${minFiles} TypeScript files under ${dir}, saw ${count}`);
 }
 assert.ok(scanned.some(file=>file.rel==='src/core/random.ts'),'the scan missed src/core/random.ts');
 assert.ok(scanned.some(file=>file.rel==='src/audio/vinyl-texture.ts'),'the scan missed src/audio/vinyl-texture.ts');
});

test('no generation or audio module draws unseeded randomness',()=>{
 const hits=[];
 for(const file of scanned){
  const masked=maskNonCode(readFileSync(file.abs,'utf8'));
  for(const match of masked.matchAll(/Math\s*\.\s*random\s*\(/g)){
   hits.push(`${file.rel}:${masked.slice(0,match.index).split('\n').length}`);
  }
 }
 assert.deepEqual(hits,[],`unseeded randomness must be seeded or excluded from fixtures: ${hits.join(', ')}`);
});

test('the vinyl texture module offers no random chooser',()=>{
 const names=Object.keys(vinylTexture).filter(name=>/random/i.test(name));
 assert.deepEqual(names,[],'texture choice must come from the user or the restored project, never a random draw');
 for(const name of ['VINYL_TEXTURES','DEFAULT_VINYL_TEXTURE','isVinylTexture','validateVinylTexture','loadVinylTexture','mixVinylTexture']){
  assert.ok(name in vinylTexture,`${name} should still be exported`);
 }
});

// Captured from the JavaScript reference implementation on Node v26, hashed over the
// little-endian Float32 sample bytes of both channels. The desktop port compares its own
// output against the same 2400-frame render with the M0 §3.6 tolerance, not bit equality.
const GOLDEN_DIGEST='716a29d85be55a8b37c8d2ab1274b5ae5ce5395d987ff4ea4160a4672258840d';

function renderVinylReference(){
 const rate=8000,frames=1600,length=2400;
 // Deliberately rational arithmetic only: no Math.sin or Math.pow on the input side, so the
 // golden cannot drift with a different engine's transcendental implementations.
 const asset={id:'lofi2-vinyl-01',name:'Texture',sampleRate:rate,channels:[
  Float32Array.from({length:frames},(_,i)=>(((i*37)%101)/101)*0.5-0.25),
  Float32Array.from({length:frames},(_,i)=>(((i*53)%97)/97)*0.4-0.2),
 ]};
 const output=[new Float32Array(length),new Float32Array(length)];
 vinylTexture.mixVinylTexture(output,rate,asset,-30,true);
 return output;
}

test('the vinyl texture golden PCM is reproducible and unchanged',()=>{
 const first=renderVinylReference(),second=renderVinylReference();
 assert.deepEqual(first[0],second[0],'repeated renders must be byte-identical');
 assert.deepEqual(first[1],second[1],'repeated renders must be byte-identical');
 const bytes=channel=>Buffer.from(channel.buffer,channel.byteOffset,channel.byteLength);
 const digest=createHash('sha256').update(bytes(first[0])).update(bytes(first[1])).digest('hex');
 assert.equal(digest,GOLDEN_DIGEST,'vinyl texture PCM moved: regenerate the golden only with a deliberate audio change');
 assert.ok(Math.max(...first[0])<0.04,'the recorded texture must stay well under full scale');
});
