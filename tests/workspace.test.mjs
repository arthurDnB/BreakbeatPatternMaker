import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {generate} from '../dist/core/generate.js';import {defaults} from '../dist/core/profiles.js';import {Editor} from '../dist/core/editor.js';import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';import {makeProject,readProject,needsVinylMigration} from '../dist/audio/project.js';
test('generation exclusion reaches ghosts, fills, variation and lock conflicts',()=>{
 const s={...defaults(),enabledRoles:['kick','hat'],ghostAmount:1,fillAmount:1};const p=generate(s);assert.ok(p.events.every(h=>['kick','hat'].includes(h.role)));
 const e=new Editor(p);e.state.selection={rows:[0,3],ids:[]};assert.throws(()=>e.fill(),/excluded/);
 const locked=new Editor(generate(defaults()));locked.toggleRole('snare');assert.throws(()=>locked.replace(p),/excluded.*locked/);
 assert.throws(()=>generate({...s,enabledRoles:['bad']}));
});
test('project embeds PCM and restores kit, draft, locks without rounding audio',()=>{
 const e=new Editor(generate(defaults())),kit=defaultKitState();e.toggleRole('kick');
 const a={id:'one-shot',name:'Custom',sampleRate:44100,channels:[new Float32Array([.1,-.2,.3])]};kit.kick={...kit.kick,choice:'upload',uploadId:a.id,assetId:a.id,level:.5,tune:2};
 const p=makeProject(e.state,defaults(),kit,new Map([[a.id,a]]));const restored=readProject(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(restored.assets.get(a.id),a);assert.deepEqual(restored.project.kit,kit);assert.deepEqual(restored.project.editor,e.state);
 const corrupt=structuredClone(p);corrupt.assets=[];assert.throws(()=>readProject(corrupt),/Missing/);
 const bad=structuredClone(p);bad.kit.snare.level=NaN;assert.throws(()=>readProject(bad));
 const mixed=withDrumKit(e.state.pattern,{}, {...kit,snare:{...kit.snare,mute:true}});assert.ok(mixed.events.every(h=>h.role!=='snare'));
});
test('older scratch and vinyl instruments migrate to sampled percussion and background texture',()=>{
 const e=new Editor(generate(defaults())),kit=defaultKitState();
 const replacement={id:'library-lofi2-perc-02',name:'Lo-Fi Percussion 02',sampleRate:44100,channels:[new Float32Array([0,.2,0])]};
 const saved=makeProject(e.state,defaults(),kit,new Map());
 const older=structuredClone(saved);older.kit.percussion={...kit.percussion,choice:'synth-scratch',assetId:'synth-scratch'};
 older.assets.push({id:'synth-scratch',name:'Old scratch',sampleRate:44100,channels:[btoa(String.fromCharCode(...new Uint8Array(new Float32Array([0,.3,0]).buffer)))]});
 const hit=older.editor.pattern.events.find(h=>h.role==='percussion')??{...older.editor.pattern.events[0],id:'legacy-percussion',role:'percussion',sourceId:'synth-scratch'};
 if(!older.editor.pattern.events.some(h=>h.id===hit.id))older.editor.pattern.events.push(hit);
 hit.slice={assetId:'synth-scratch',startFrame:0,endFrame:3,sampleRate:44100,label:'Old scratch'};
 assert.ok(needsVinylMigration(older));
 const opened=readProject(older,replacement);
 assert.ok(opened.migrated);assert.equal(opened.project.kit.percussion.choice,'lofi2-perc-02');
 assert.equal(opened.project.editor.pattern.events.find(h=>h.id===hit.id).slice.assetId,replacement.id);
 assert.ok(!opened.project.assets.some(a=>a.id==='synth-scratch'));
 assert.deepEqual(opened.project.vinylTexture,{enabled:false,catalogId:'lofi2-vinyl-01',levelDb:-10});
 const vinyl=structuredClone(saved);vinyl.kit.percussion={...kit.percussion,choice:'lofi2-vinyl-08',assetId:'library-lofi2-vinyl-08'};
 vinyl.assets.push({id:'library-lofi2-vinyl-08',name:'Vinyl 08',sampleRate:44100,channels:[btoa(String.fromCharCode(...new Uint8Array(new Float32Array([0,.1,0]).buffer)))]});
 const vinylOpened=readProject(vinyl,replacement);
 assert.deepEqual(vinylOpened.project.vinylTexture,{enabled:true,catalogId:'lofi2-vinyl-08',levelDb:-10});
 assert.equal(vinylOpened.project.kit.percussion.choice,'lofi2-perc-02');
});
test('bundled audio matches provenance hashes and approved license records',()=>{
 const catalog=JSON.parse(readFileSync('public/samples/catalog.json','utf8'));assert.equal(catalog.length,345);
 for(const sound of catalog){const data=readFileSync('.'+sound.path);assert.equal(createHash('sha256').update(data).digest('hex'),sound.sha256);assert.ok(['CC0-1.0','CC-BY-4.0'].includes(sound.license));if(sound.license==='CC-BY-4.0'){assert.ok(sound.author);assert.ok(sound.source);assert.ok(sound.changes);assert.equal(sound.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');}assert.equal(data.toString('ascii',0,4),'RIFF');}
 const think=catalog.find(sound=>sound.id==='think-uh-plus6');assert.equal(think?.author,'Arthur DnB');assert.equal(think?.role,'percussion');assert.equal(think?.name,'Think Passage 2 (1.42x)');assert.equal(think?.path,'/public/samples/think-passage2-142x.wav');const pcm=readFileSync('.'+think.path);assert.equal(pcm.readUInt32LE(24),44100);assert.ok(Math.abs((pcm.length-44)/2/44100-2.23/1.42)<.001,'bundled render follows the 2.23 s passage at the selected 1.42x speed');
});
