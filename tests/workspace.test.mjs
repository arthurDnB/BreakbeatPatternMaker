import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {generate} from '../dist/core/generate.js';import {defaults} from '../dist/core/profiles.js';import {Editor} from '../dist/core/editor.js';import {defaultKitState,withDrumKit} from '../dist/audio/drum-kit.js';import {makeProject,readProject} from '../dist/audio/project.js';
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
test('bundled audio matches recorded provenance hashes and CC0 license records',()=>{
 const catalog=JSON.parse(readFileSync('public/samples/catalog.json','utf8'));assert.equal(catalog.length,32);
 for(const sound of catalog){const data=readFileSync('.'+sound.path);assert.equal(createHash('sha256').update(data).digest('hex'),sound.sha256);assert.equal(sound.license,'CC0-1.0');assert.equal(data.toString('ascii',0,4),'RIFF');}
});
