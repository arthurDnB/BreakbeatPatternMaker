import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {generatePiano} from '../dist/core/piano.js';
import {SYNTH_PRESETS} from '../dist/audio/synth-instrument.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';

function pcm16Wav(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tag=p=>bytes.toString('ascii',p,p+4);
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE')throw Error('Expected a RIFF WAV.');
 let format,channels,rate,bits,dataStart,dataSize;
 for(let p=12;p+8<=bytes.length;){const size=view.getUint32(p+4,true);if(tag(p)==='fmt '){format=view.getUint16(p+8,true);channels=view.getUint16(p+10,true);rate=view.getUint32(p+12,true);bits=view.getUint16(p+22,true);}if(tag(p)==='data'){dataStart=p+8;dataSize=size;}p+=8+size+(size%2);}
 if(format!==1||bits!==16||![1,2].includes(channels)||!rate||dataStart===undefined||dataSize===undefined)throw Error('This local audition accepts 16-bit mono/stereo PCM WAV.');
 const frames=Math.floor(dataSize/(channels*2));
 return {id:'piano-audition',name:'Local piano audition',sampleRate:rate,channels:Array.from({length:channels},(_,c)=>Float32Array.from({length:frames},(_,i)=>view.getInt16(dataStart+(i*channels+c)*2,true)/32768))};
}

const source=process.argv[2]?pcm16Wav(await readFile(resolve(process.argv[2]))):undefined;
const output=resolve('test-results/piano-audition');await mkdir(output,{recursive:true});
const cards=[];
for(const genre of ['liquiddnb','lofihiphop','twostepgarage','atmosphericjungle','boombap']){
 const settings={...defaults(genre),seed:'lush-harmony-audition',bars:2,melodyKey:0,melodyScale:genre==='twostepgarage'?'dorian':'natural-minor',complexity:.7,spicy:.25};
 const base=generate(settings),notes=generatePiano(settings,'audition-piano');
 const chords=[...new Map(notes.map(note=>[note.baseTick,note.reason.split(':')[0]])).values()];
 for(const sampled of source?[false,true]:[false]){
  const instrument={...SYNTH_PRESETS.piano,...(sampled?{sample:{assetId:source.id,rootNote:72}}:{})};
  const track={id:'audition-piano',name:'Generated Piano',kind:'synth',generatedPart:'piano',role:'percussion',instrument,level:1,pan:0,mute:false,solo:false};
  const pattern={...base,events:notes,userTracks:[track]},assets=sampled?new Map([[source.id,source]]):new Map();
  const wav=renderPerformance(pattern,assets,44100);
  const file=`${genre}-${sampled?'one-shot':'built-in'}.wav`;await writeFile(join(output,file),Buffer.from(encodeWav(wav.channels,wav.sampleRate)));
  cards.push(`<section><h2>${genre} · ${sampled?'user one-shot':'built-in tone'}</h2><p>${chords.join(' → ')}</p><audio controls src="${file}"></audio></section>`);
 }
}
await writeFile(join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>Piano harmony audition</title><style>body{background:#090b10;color:#e8edf7;font:16px system-ui;max-width:850px;margin:40px auto}section{background:#171b26;padding:18px;margin:14px 0;border-radius:10px}audio{width:100%}</style><h1>Piano harmony audition</h1><p>Two-bar patterns at each genre's default BPM. Compare chord movement and piano sources by ear.</p>${cards.join('')}`);
console.log(`Piano audition: ${cards.length} WAVs and index.html in ${output}`);
