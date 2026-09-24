import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults} from '../dist/core/profiles.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {withDrumKit,defaultKitState} from '../dist/audio/drum-kit.js';
import {encodeWav} from '../dist/audio/wav.js';

const RATE=12000;
function fixture(changes={},samples=new Float32Array(RATE).fill(.2)){
 const a={id:'v3-audio',name:'test source',sampleRate:RATE,channels:[samples]};
 const hit={id:'test-hit',role:'snare',sourceId:'kit.snare',baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Audio test',sourceKind:'oneShot',slice:{assetId:a.id,startFrame:0,endFrame:samples.length,sampleRate:RATE,label:'test'},...changes};
 return {p:{engineVersion:'0.3.0',ppq:960,settings:{...defaults(),algorithm:'groove-v3',bpm:120,bars:1,resolution:16},events:[hit]},a,assets:new Map([[a.id,a]])};
}
const render=(p,assets)=>renderPerformance(p,assets,RATE).channels[0];
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('v3 triplet gestures have exact musical spacing and PCM independent of display resolution',()=>{
 const {p,assets}=fixture({ratchets:3,gate:.5,articulation:{durationTicks:960,mode:'gate',repeats:[{gain:1},{gain:.6},{gain:.3}]}});
 const baseline=render(p,assets);
 for(const [start,level] of [[0,.2],[2000,.12],[4000,.06]]){
   assert.equal(baseline[start],0);close(baseline[start+30],level);
   assert.equal(baseline[start+999],0);assert.equal(baseline[start+1100],0);
 }
 for(const resolution of [8,16,32,64]){p.settings.resolution=resolution;assert.deepEqual(render(p,assets),baseline);}
 assert.ok(baseline.slice(6000).every(v=>v===0));
 // Preview and WAV deliberately consume exactly the same rendered channels.
 assert.deepEqual(encodeWav(renderPerformance(p,assets,RATE).channels,RATE),encodeWav(renderSequence([p],assets,RATE).channels,RATE));
});

test('v3 natural imported one-shots and tightened decay keep their bodies at fast tempos',()=>{
 const {p,a,assets}=fixture({decay:.5});
 const reference=render(p,assets).slice(0,6000);
 for(const bpm of [170,200,220]){
   p.settings.bpm=bpm;p.settings.resolution=64;
   const result=render(p,assets);
   assert.deepEqual(result.slice(0,6000),reference);
   assert.ok(result[Math.round(RATE*.1)]>.1,'snare body survives beyond a 1/64 row');
   assert.ok(result.slice(6000).every(v=>v===0));
 }
 const noSource=structuredClone(p);delete noSource.events[0].slice;delete noSource.events[0].sourceKind;
 const assigned=withDrumKit(noSource,{snare:p.events[0].slice});
 assert.equal(assigned.events[0].sourceKind,'oneShot');
 assert.equal(withDrumKit({...noSource,settings:{...noSource.settings,algorithm:'groove-v2'}},{snare:p.events[0].slice}).events[0].sourceKind,undefined);
 const sliced=structuredClone(p);delete sliced.events[0].sourceKind;
 assert.equal(withDrumKit(sliced,{snare:p.events[0].slice}).events[0].sourceKind,'slice');
 assert.equal(a.channels[0][0],Math.fround(.2));
});

test('v3 actual bundled acoustic snare retains identical natural body across 170–220 BPM',()=>{
 const bytes=readFileSync(new URL('../public/samples/acoustic-snare.wav',import.meta.url));
 let offset=12,format,channels,rate,bits,pcm;
 while(offset+8<=bytes.length){const size=bytes.readUInt32LE(offset+4),tag=bytes.toString('ascii',offset,offset+4);if(tag==='fmt '){format=bytes.readUInt16LE(offset+8);channels=bytes.readUInt16LE(offset+10);rate=bytes.readUInt32LE(offset+12);bits=bytes.readUInt16LE(offset+22);}if(tag==='data')pcm=bytes.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
 assert.equal(format,1);assert.equal(bits,16);
 const frames=pcm.length/(2*channels),decoded=Array.from({length:channels},(_,c)=>Float32Array.from({length:frames},(_,i)=>pcm.readInt16LE((i*channels+c)*2)/32768));
 const {p,a,assets}=fixture({gain:.25,decay:.85});
 a.sampleRate=rate;a.channels=decoded;p.events[0].slice.sampleRate=rate;p.events[0].slice.endFrame=frames;
 let body;
 for(const bpm of [170,200,220]){p.settings.bpm=bpm;p.settings.resolution=64;const next=render(p,assets).slice(0,Math.round(RATE*.2));if(body)assert.deepEqual(next,body);else body=next;}
 assert.ok(body.slice(Math.round(RATE*.07)).some(v=>Math.abs(v)>.0001));
});

test('v3 choke groups stop open hats across sequence slots and at the loop seam',()=>{
 const {p,assets}=fixture({role:'hat',sourceId:'kit.hat',baseTick:3600});
 const second=structuredClone(p);second.events[0].baseTick=0;second.events[0].id='quiet-hat';second.events[0].gain=0;
 const combined=renderSequence([p,second],assets,RATE).channels[0];
 assert.ok(combined[23000]>.1);assert.ok(combined.slice(24000).every(v=>v===0));
 const loop=renderPerformance(p,assets,RATE,{}, {loop:true}).channels[0];
 // A sole end-of-loop hat may ring until its next iteration, so its tail wraps.
 assert.ok(loop[0]>.1);
 p.events.push({...second.events[0]});
 const chokedLoop=renderPerformance(p,assets,RATE,{}, {loop:true}).channels[0];
 assert.equal(chokedLoop[0],0);assert.ok(chokedLoop.slice(0,22000).every(v=>v===0));
});

test('v3 reverse/source offset are per repeat and preserve original sample PCM',()=>{
 const samples=Float32Array.from({length:RATE},(_,i)=>i/RATE*.2);
 const {p,assets}=fixture({ratchets:2,articulation:{durationTicks:960,mode:'chop',repeats:[{gain:1,sourceOffset:.25},{gain:.5,reverse:true,sourceOffset:.5}]}},samples);
 const before=samples.slice(),result=render(p,assets);
 close(result[100],samples[3100]);close(result[3100],samples[5899]*.5);
 assert.deepEqual(samples,before);assert.ok(result.slice(6000).every(v=>v===0));
});

test('v3 pitch glide integrates continuous phase and differs from static pitch transposition',()=>{
 const samples=Float32Array.from({length:RATE},(_,i)=>i/RATE*.2);
 const {p,assets}=fixture({articulation:{durationTicks:960,mode:'gate',repeats:[{gain:1,glide:12}]}},samples);
 const result=render(p,assets);
 let phase=0;for(let i=0;i<1500;i++)phase+=2**(i/6000);
 close(result[1500],phase/RATE*.2);
 p.events[0].articulation.repeats[0].glide=0;
 const steady=render(p,assets);assert.ok(result[1500]>steady[1500]);
 p.events[0].articulation.repeats[0].pitch=12;
 close(render(p,assets)[1500],samples[3000]);
});

test('v3 gates and late bursts never bleed past the phrase while natural tails can breathe',()=>{
 const {p,assets}=fixture({baseTick:3830,ratchets:8,articulation:{durationTicks:960,mode:'chop'}});
 for(const bpm of [137,170,200,220]){
   p.settings.bpm=bpm;
   const result=render(p,assets),end=Math.round(240/bpm*RATE);
   assert.ok(result.slice(end).every(v=>v===0));
   assert.ok(result.slice(0,end).some(v=>v!==0));
 }
 p.events[0].ratchets=1;p.events[0].articulation.mode='natural';
 const result=render(p,assets);assert.ok(result[Math.round(240/p.settings.bpm*RATE)+100]>.1);
});


test('v3 natural kick/snare minimum body does not override deliberate chop gates',()=>{
 const {p,assets}=fixture({decay:.02});p.settings.bpm=220;p.settings.resolution=64;
 const natural=render(p,assets);
 assert.ok(natural[Math.round(RATE*.03)]>.04);
 assert.ok(natural.slice(Math.round(RATE*.065)).every(v=>v===0));
 p.events[0].gate=.1;
 const chopped=render(p,assets);
 assert.ok(chopped.slice(30).every(v=>v===0),'manual micro-chop cuts despite natural body protection');
});

test('v3 natural reverse and source offsets fade discontinuities without softening ordinary attacks',()=>{
 const {p,assets}=fixture();const normal=render(p,assets);close(normal[0],.2);
 p.events[0].reverse=true;const reverse=render(p,assets);
 assert.equal(reverse[0],0);assert.equal(reverse[RATE-1],0);close(reverse[30],.2);
 p.events[0].reverse=false;p.events[0].articulation={durationTicks:960,mode:'natural',repeats:[{gain:1,sourceOffset:.5}]};
 const offset=render(p,assets);assert.equal(offset[0],0);assert.equal(offset[RATE/2-1],0);close(offset[30],.2);
});


test('v3 lane reverse applies to every expressive repeat without mutating saved hits',()=>{
 const {p}=fixture({ratchets:2,articulation:{durationTicks:960,mode:'gate',repeats:[{gain:1,reverse:false},{gain:.5,reverse:true}]}});
 const before=structuredClone(p),mix=defaultKitState();mix.snare.reverse=true;
 const applied=withDrumKit(p,{},mix);
 assert.ok(applied.events[0].articulation.repeats.every(r=>r.reverse));
 assert.deepEqual(p,before);
});
