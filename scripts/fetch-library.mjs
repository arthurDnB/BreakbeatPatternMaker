import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const a=JSON.parse(await readFile('test-results/vcsl-tree.json')),b=JSON.parse(await readFile('test-results/808-tree.json'));
const cached=JSON.parse(await readFile('public/samples/catalog.json','utf8'));
const entries=[
 ['acoustic-kick','kick','Acoustic bass drum','Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v3_rr1_Sum.wav'],
 ['acoustic-snare','snare','Acoustic snare — firm','Membranophones/Struck Membranophones/Legacy Snares/OldSnare/snare_f1.wav'],
 ['acoustic-snare-soft','snare','Acoustic snare — soft','Membranophones/Struck Membranophones/Legacy Snares/OldSnare/snare_mf1.wav'],
 ['acoustic-hat','hat','Acoustic closed hat','Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitC_v3_rr1_Mid.wav'],
 ['bongo','percussion','Acoustic high bongo','Membranophones/Struck Membranophones/Bongos/BongoH_Hit1_v2_rr1_Mid.wav'],
 ['tambourine','percussion','Tambourine hit','Idiophones/Struck Idiophones/Tambourine 1/Tamb1_Hit_v2_rr1_Mid.wav'],
 ['808-kick','kick','808 kick — round','bd8/BD5050.WAV'],['808-kick-long','kick','808 kick — long','bd8/BD0010.WAV'],
 ['808-snare','snare','808 snare','sd8/SD5050.WAV'],['808-hat','hat','808 closed hat','ch8/CH.WAV'],['808-openhat','hat','808 open hat','oh8/OH50.WAV'],['808-clap','percussion','808 clap','cp8/CP.WAV'],
 ['acoustic-kick-2','kick','Acoustic bass drum — hard strike','Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v7_rr1_Sum.wav'],
 ['acoustic-kick-muted','kick','Acoustic bass drum — muted','Membranophones/Struck Membranophones/Bass Drum 3 - Legacy/bdrum_muted_ff_rr1.wav'],
 ['808-kick-00','kick','808 kick — tone 0 / decay 0','bd8/BD0000.WAV'],
 ['808-kick-75','kick','808 kick — tone 75 / decay 75','bd8/BD7575.WAV'],
 ['acoustic-rimshot','snare','Acoustic snare — rimshot','Membranophones/Struck Membranophones/Legacy Snares/drum1/snare1_rimshot_fff_rr1.wav'],
 ['marching-snare','snare','Marching snare','Membranophones/Struck Membranophones/Legacy Snares/drum3_marching/snare3_f_rr1.wav'],
 ['808-snare-00','snare','808 snare — tone 0 / snappy 0','sd8/SD0000.WAV'],
 ['808-snare-75','snare','808 snare — tone 75 / snappy 75','sd8/SD7575.WAV'],
 ['acoustic-openhat','hat','Acoustic open hat','Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitO_rr1_Mid.wav'],
 ['acoustic-loosehat','hat','Acoustic loose hat','Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitLoose_rr1_Mid.wav'],
 ['acoustic-pedalhat','hat','Acoustic pedal hat','Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_Close_rr1_Mid.wav'],
 ['808-openhat-short','hat','808 open hat — decay 0','oh8/OH00.WAV'],
 ['808-cowbell','percussion','808 cowbell','cb8/CB.WAV'],
 ['808-rim','percussion','808 rim shot','rs8/RS.WAV'],
 ['808-maracas','percussion','808 maracas','ma8/MA.WAV'],
 ['808-lowtom','percussion','808 low tom','lt8/LT50.WAV'],
 ['808-hightom','percussion','808 high tom','ht8/HT50.WAV'],
 ['808-conga','percussion','808 low conga','lc8/LC50.WAV'],
 ['acoustic-claves','percussion','Acoustic claves','Idiophones/Struck Idiophones/Claves/Claves1_Hit_v3_rr1_Mid.wav'],
 ['acoustic-shaker','percussion','Acoustic shaker','Idiophones/Struck Idiophones/Shaker, Large/LShaker_Shake1U_rr1_Mid.wav']
];
await mkdir('public/samples',{recursive:true});const manifest=[];
for(const [id,role,name,path] of entries){const vintage=id.startsWith('808'),repo=vintage?'tidalcycles/sounds-tr808-fischer':'sgossner/VCSL',tree=vintage?b:a;
 if(!tree.tree.some(f=>f.path===path))throw Error('Unknown source '+path);
 const url=`https://raw.githubusercontent.com/${repo}/${tree.sha}/${path.split('/').map(encodeURIComponent).join('/')}`;
 let data;try{if(!cached.some(s=>s.id===id&&s.source===url))throw Error('Source changed');data=await readFile('public/samples/'+id+'.wav');if(createHash('sha256').update(data).digest('hex')!==cached.find(s=>s.id===id).sha256)throw Error('Cache hash mismatch');}catch{const response=await fetch(url);if(!response.ok)throw Error(url+' '+response.status);data=Buffer.from(await response.arrayBuffer());}
 if(data.toString('ascii',0,4)!=='RIFF')throw Error('Not WAV '+id);await writeFile('public/samples/'+id+'.wav',data);
 manifest.push({id,role,name,path:'/public/samples/'+id+'.wav',license:'CC0-1.0',author:vintage?'Michael Fischer':'Versilian Studios / VCSL contributors',source:url,sha256:createHash('sha256').update(data).digest('hex')});
}
for(const [name,repo,sha] of [['VCSL','sgossner/VCSL',a.sha],['TR808','tidalcycles/sounds-tr808-fischer',b.sha]]){
 const r=await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/LICENSE`);if(!r.ok)throw Error('License download failed');await writeFile('public/samples/'+name+'-LICENSE.txt',await r.text());
}
await writeFile('public/samples/catalog.json',JSON.stringify(manifest,null,2));
await writeFile('src/audio/library.ts','export const LIBRARY = '+JSON.stringify(manifest.map(({id,role,name,path})=>({id,role,name,path})),null,2)+' as const;\n');
console.log('Downloaded '+manifest.length+' licensed WAVs.');
