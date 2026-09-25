import fs from 'node:fs';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {compile} from '../dist/core/compile.js';
import {Editor,locked} from '../dist/core/editor.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {planV3Voices,applyV3Chokes} from '../dist/audio/voice-v3.js';
import {LIBRARY,KIT_PRESETS,GENRE_KITS} from '../dist/audio/library.js';
import {withDrumKit,defaultKitState} from '../dist/audio/drum-kit.js';
import {defaultEffects} from '../dist/audio/effects.js';
import {encodeWav} from '../dist/audio/wav.js';
const dir=process.env.AUDIT_DIR??'test-results/loop-audit-current';fs.mkdirSync(dir,{recursive:true});
const roles=['kick','snare','hat','percussion'],modes=['groove','auto','fill','roll','build'];
const fast=['amenscience','breakcore','atmosphericbreakcore','jungle','drumfunk','liquiddnb','hardcore'];
const base=genreDefaults('amenscience'),results=[],issues=[];
const signature=p=>JSON.stringify(p.events.map(({reason,...h})=>h));
function check(s,label){let p;try{p=generate(s);compile(p);const again=generate(s);if(JSON.stringify(p)!==JSON.stringify(again))throw Error('Nondeterministic');}catch(e){issues.push({label,s,error:String(e)});return;}
 const attacks=p.events.flatMap(h=>Array.from({length:h.ratchets??1},(_,i)=>({role:h.role,t:h.baseTick+h.offsetTick+(h.fineOffset??0)+i*(h.articulation?.durationTicks??3840/s.resolution)/(h.ratchets??1)})));
 const excluded=p.events.filter(h=>s.enabledRoles&&!s.enabledRoles.includes(h.role)).length;
 const beyond=attacks.filter(h=>h.t<0||h.t>=s.bars*3840).length;
 const duplicate=attacks.length-new Set(attacks.map(h=>h.role+':'+h.t.toFixed(6))).size;
 let minGap=Infinity;for(const role of roles){const a=attacks.filter(h=>h.role===role).sort((a,b)=>a.t-b.t);for(let i=1;i<a.length;i++)minGap=Math.min(minGap,(a[i].t-a[i-1].t)*60000/s.bpm/960);}
 results.push({label,settings:s,events:p.events.length,attacks:attacks.length,ratchets:p.events.filter(h=>h.ratchets>1).length,anchors:p.events.filter(h=>h.anchor).length,excluded,beyond,duplicate,minGapMs:Number.isFinite(minGap)?minGap:null});
 if(excluded||beyond||duplicate)issues.push({label,excluded,beyond,duplicate,s});return p;
}
for(const genre of Object.keys(PROFILES))for(const mode of modes)for(const seed of ['break-042','audit-1','audit-2'])check({...genreDefaults(genre),seed,patternStructure:mode},'genre-mode');
const sweeps={complexity:[0,.25,.5,.75,1],spicy:[0,.25,.5,.75,1],syncopation:[0,.25,.5,.75,1],ghostAmount:[0,.25,.5,.75,1],fillAmount:[0,.25,.5,.75,1],swing:[.5,.54,.58,.62,.67],humanizeMs:[0,2.5,5,7.5,10],bpm:[32,120,172,200,220,260,999],bars:[1,2,3,4],resolution:[8,16,32,64],breakStyle:['genre','amen','think','apache','funkyDrummer','hotPants'],variation:[0,1,5,1000000]};
const effectsByControl={};for(const [key,values] of Object.entries(sweeps)){effectsByControl[key]=[];for(const mode of modes){const patterns=values.map(value=>check({...base,patternStructure:mode,[key]:value},'sweep-'+key));effectsByControl[key].push({mode,distinct: new Set(patterns.filter(Boolean).map(signature)).size,values});}}
for(const genre of fast)for(const bpm of [120,172,200,220,260,999])for(const mode of modes)for(const resolution of [8,16,32,64])check({...genreDefaults(genre),bpm,resolution,patternStructure:mode},'fast-grid');
for(const mode of modes)for(let mask=0;mask<16;mask++)check({...base,patternStructure:mode,enabledRoles:roles.filter((_,i)=>mask&(1<<i))},'exclusion');
for(const mode of modes)for(const phraseLength of [4,8,16])for(let phraseOffset=0;phraseOffset<phraseLength;phraseOffset++)check({...base,patternStructure:mode,phraseLength,phraseOffset},'phrase');
const keys=['complexity','spicy','syncopation','ghostAmount','fillAmount','swing','humanizeMs'];
for(let a=0;a<keys.length;a++)for(let b=a+1;b<keys.length;b++)for(const mode of modes)for(const lo of [0,1])for(const hi of [0,1]){const ka=keys[a],kb=keys[b];check({...base,patternStructure:mode,[ka]:lo?sweeps[ka].at(-1):sweeps[ka][0],[kb]:hi?sweeps[kb].at(-1):sweeps[kb][0]},'pairwise');}
for(const algorithm of ['legacy-v1','groove-v2'])for(const genre of Object.keys(PROFILES))for(const mode of modes){try{const s={...genreDefaults(genre),algorithm,patternStructure:mode};generate(s);check(s,'older-engine');}catch{}}
const locks=[];for(const mode of modes){const e=new Editor(generate(base));e.toggleRole('snare');const selected=e.state.pattern.events.find(h=>h.role==='kick');e.state.selection={ids:[selected.id],rows:null};e.toggleSelectedLocks();const before=structuredClone(e.state);try{e.replace(generate({...base,patternStructure:mode}));const kept=before.pattern.events.filter(h=>locked(before,h));const ok=kept.every(h=>JSON.stringify(e.state.pattern.events.find(x=>x.id===h.id))===JSON.stringify(h));const after=structuredClone(e.state);e.undo();const undo=JSON.stringify(e.state)===JSON.stringify(before);e.redo();locks.push({mode,ok,undo,redo:JSON.stringify(e.state)===JSON.stringify(after)});}catch(e){locks.push({mode,error:String(e)});}}
function decode(path){const b=fs.readFileSync(path);let fmt,pcm;for(let i=12;i+8<=b.length;){const size=b.readUInt32LE(i+4),tag=b.toString('ascii',i,i+4);if(tag==='fmt ')fmt={format:b.readUInt16LE(i+8),channels:b.readUInt16LE(i+10),rate:b.readUInt32LE(i+12),bits:b.readUInt16LE(i+22)};if(tag==='data')pcm=b.subarray(i+8,i+8+size);i+=8+size+(size%2);}const stride=fmt.bits/8,frames=pcm.length/stride/fmt.channels;return {sampleRate:fmt.rate,channels:Array.from({length:fmt.channels},(_,c)=>Float32Array.from({length:frames},(_,i)=>{const off=(i*fmt.channels+c)*stride;if(fmt.format===3)return pcm.readFloatLE(off);if(stride===2)return pcm.readInt16LE(off)/32768;if(stride===3)return pcm.readIntLE(off,3)/8388608;return pcm.readInt32LE(off)/2147483648;}))};}
const assets=new Map(),kit={},mix=defaultKitState(),preset=KIT_PRESETS.find(k=>k.id===GENRE_KITS.amenscience);
for(const role of roles){const entry=LIBRARY.find(e=>e.id===preset.slots[role]);const a={id:entry.id,name:entry.name,...decode(entry.path.slice(1))};assets.set(a.id,a);kit[role]={assetId:a.id,label:a.name,sampleRate:a.sampleRate,startFrame:0,endFrame:a.channels[0].length};mix[role].level=preset.levels?.[role]??1;mix[role].decay=preset.decays?.[role]??1;}
function wav(name,a,repeat=1){const ch=a.channels.map(c=>{const x=new Float32Array(c.length*repeat);for(let i=0;i<repeat;i++)x.set(c,i*c.length);return x;});fs.writeFileSync(`${dir}/${name}.wav`,Buffer.from(encodeWav(ch,a.sampleRate)));}
function delta(a,b,offset){let sq=0,peak=0,n=0;for(let c=0;c<2;c++)for(let i=0;i<a.channels[c].length;i++){const d=a.channels[c][i]-(b.channels[c][i+offset]??0);sq+=d*d;peak=Math.max(peak,Math.abs(d));n++;}return {rms:Math.sqrt(sq/n),peak};}
const audio=[];
for(const mode of modes)for(const spicy of [.0,.95]){
 const p=withDrumKit(generate({...base,patternStructure:mode,spicy}),kit,mix),rate=44100;
 const t=performance.now(),loop=renderPerformance(p,assets,rate,{}, {loop:true}),ms=performance.now()-t;
 const sequence=renderSequence(Array(4).fill(p),assets,rate,{}),tail=renderPerformance(p,assets,rate,{});
 const name=mode+'-spicy-'+spicy;wav(name,loop,4);wav(name+'-continuous',sequence);if(mode==='auto'&&spicy===.95)wav('auto-tail-export',tail);
 const voices=p.events.flatMap(h=>{const a=assets.get(h.slice.assetId);return planV3Voices(p,h,a.channels,a.sampleRate,0,a.channels[0].length,0,Infinity,rate);});const original=voices.map(v=>v.length);applyV3Chokes(voices,rate,loop.duration);
 const lengths=voices.map((v,i)=>({id:v.hit.id,role:v.hit.role,start:v.start,ms:v.length/rate*1000,beforeMs:original[i]/rate*1000,gated:v.gated}));
 audio.push({name,settings:p.settings,renderMs:ms,loopFrames:loop.channels[0].length,sequenceDelta:delta(loop,sequence,Math.round(2*loop.duration*rate)),shortVoices:lengths.filter(v=>v.ms<10),finalVoices:lengths.filter(v=>v.start>loop.duration-.5)});
 fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(p,null,2));
}
const p=withDrumKit(generate({...base,patternStructure:'auto'}),kit,mix);
for(const fx of [{...defaultEffects(),mix:.35,feedback:.5,drive:.3},{...defaultEffects(),highpass:100,lowpass:6000,punch:.5,resonance:.4}]){const effects=Object.fromEntries(roles.map(r=>[r,fx]));const loop=renderPerformance(p,assets,44100,effects,{loop:true}),seq=renderSequence(Array(4).fill(p),assets,44100,effects);audio.push({name:'effects-'+audio.length,fx,sequenceDelta:delta(loop,seq,Math.round(2*loop.duration*44100))});wav('effects-'+audio.length,loop,4);}
const standardDifference=[];for(const genre of fast)for(let i=0;i<20;i++){const s={...genreDefaults(genre),seed:'audit-'+i,patternStructure:'groove'};const a=generate({...s,fillAmount:0}),b=generate({...s,fillAmount:1});if(signature(a)!==signature(b))standardDifference.push({genre,seed:s.seed,a:a.events.length,b:b.events.length,removed:a.events.filter(h=>!b.events.some(x=>x.id===h.id)).map(h=>({id:h.id,role:h.role,baseTick:h.baseTick,anchor:h.anchor}))});}
const report={count:results.length,base,preset,issues,locks,effectsByControl,audio,standardDifference,results};fs.writeFileSync(`${dir}/results.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({count:results.length,issueCases:issues.length,compileErrors:issues.filter(i=>i.error).length,exclusionCases:issues.filter(i=>i.excluded).length,duplicates:issues.filter(i=>i.duplicate).length,standardDifference:standardDifference.length,locks,audio:audio.map(({name,renderMs,sequenceDelta,shortVoices})=>({name,renderMs,sequenceDelta,short:shortVoices?.length}))},null,2));

if(issues.length||standardDifference.length||locks.some(x=>!x.ok||!x.undo||!x.redo))process.exitCode=1;
