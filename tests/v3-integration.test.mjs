import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {genreDefaults,defaults} from '../dist/core/profiles.js';
import {Editor,locked} from '../dist/core/editor.js';
import {compile} from '../dist/core/compile.js';
import {setRatchets} from '../dist/core/articulation.js';
import {newBank} from '../dist/core/bank.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {makeProject,readProject} from '../dist/audio/project.js';

const settings=(genre='jungle')=>({...genreDefaults(genre),algorithm:'groove-v3',seed:'v3-integration',bars:2,complexity:.9,spicy:1,fillAmount:1});

test('v3 dispatch, mixed-engine project v3 and legacy project migration retain every field',()=>{
  const p=generate(settings()),bank=newBank(p);
  assert.equal(p.settings.algorithm,'groove-v3');assert.notEqual(p.engineVersion,'0.2.0-groove.1');
  bank.slots[1].editor=new Editor(generate(defaults())).state;
  bank.slots[2].editor=new Editor(generate({...genreDefaults('drill'),algorithm:'groove-v2'})).state;
  bank.sequence=[{slot:0,repeats:1},{slot:1,repeats:1},{slot:2,repeats:2}];
  const file=makeProject(bank.slots[0].editor,p.settings,defaultKitState(),new Map(),bank);
  assert.equal(file.version,3);
  assert.deepEqual(readProject(JSON.parse(JSON.stringify(file))).project,file);
  const old=new Editor(generate(defaults()));const legacy=makeProject(old.state,defaults(),defaultKitState(),new Map());
  assert.equal(legacy.version,2);legacy.version=1;
  const oldSnapshot=structuredClone(legacy),loaded=readProject(legacy).project;
  assert.equal(loaded.version,2);assert.deepEqual(loaded.editor,old.state);assert.deepEqual(legacy,oldSnapshot);
  assert.throws(()=>readProject({...file,version:4}),/supported/);
});

test('v3 editing preserves exact lane/hit locks, anchors, engine and reversible history',()=>{
  for(const genre of ['jungle','twostepgarage','boombap','drill','breakcore']){
    const e=new Editor(generate(settings(genre)));
    e.toggleRole('kick');const ornament=e.state.pattern.events.find(h=>!h.anchor&&h.role!=='kick');assert.ok(ornament);
    e.state.selection={ids:[ornament.id],rows:null};e.toggleSelectedLocks();e.state.selection={ids:[],rows:null};
    const protectedHits=e.state.pattern.events.filter(h=>locked(e.state,h)||h.anchor);
    for(const action of [()=>e.variation(),()=>e.mutate(),()=>{e.state.selection={ids:[],rows:[e.state.pattern.settings.resolution*2-4,e.state.pattern.settings.resolution*2-1]};return e.fill();}]){
      const before=structuredClone(e.state);const changed=action();
      compile(e.state.pattern);assert.equal(e.state.pattern.settings.algorithm,'groove-v3');
      for(const hit of protectedHits)assert.deepEqual(e.state.pattern.events.find(h=>h.id===hit.id),hit,genre+':'+hit.id);
      if(changed){const after=structuredClone(e.state.pattern);assert.ok(e.undo());assert.deepEqual(e.state.pattern,before.pattern);assert.ok(e.redo());assert.deepEqual(e.state.pattern,after);}
    }
    e.toggleRole('hat');const previous=structuredClone(e.state.pattern);
    e.replace(generate({...settings(genre),seed:'replacement'}));
    for(const hit of previous.events.filter(h=>locked(e.state,h)))assert.deepEqual(e.state.pattern.events.find(h=>h.id===hit.id),hit);
  }
});

test('v3 selected edits leave outside rows intact; fills and exclusions honor locks',()=>{
  for(const resolution of [8,16,32,64]){
    const e=new Editor(generate({...settings(),resolution}));const start=resolution*2-4,end=resolution*2-1;
    const outside=new Set(compile(e.state.pattern).notes.filter(n=>n.row<start||n.row>end).map(n=>n.id));
    const kept=e.state.pattern.events.filter(h=>outside.has(h.id));
    e.state.selection={ids:[],rows:[start,end]};e.mutate();e.fill();
    for(const h of kept)assert.deepEqual(e.state.pattern.events.find(n=>n.id===h.id),h);
    compile(e.state.pattern);
  }
  const e=new Editor(generate({...settings(),enabledRoles:['hat']}));e.state.selection={ids:[],rows:[28,31]};e.fill();e.variation();
  assert.ok(e.state.pattern.events.every(h=>h.role==='hat'));
  e.toggleRole('hat');assert.throws(()=>e.replace(generate({...settings(),enabledRoles:[]})),/excluded.*locked/);
});

test('v3 expression validation rejects malformed projects and count edits reset only contours',()=>{
  const p=generate(settings()),hit=p.events.find(h=>h.articulation?.repeats);assert.ok(hit);
  const changed=setRatchets(hit,2,60);assert.equal(changed.articulation.durationTicks,hit.articulation.durationTicks);
  assert.equal(changed.articulation.repeats,undefined);assert.notEqual(changed,hit);
  const expression={durationTicks:480,mode:'gate',repeats:[{gain:1},{gain:.5}]};
  const base={...hit,ratchets:2,articulation:expression};
  compile({...p,events:[base]});
  for(const invalid of [null,{}, {...expression,mode:'random'}, {...expression,durationTicks:0}, {...expression,durationTicks:NaN}, {...expression,durationTicks:3841}, {...expression,repeats:[{gain:1}]}, {...expression,repeats:[{gain:2},{gain:.5}]}, {...expression,repeats:[{gain:1,sourceOffset:1},{gain:.5}]}, {...expression,repeats:[{gain:1,glide:Infinity},{gain:.5}]}, {...expression,chokeGroup:'all'}]){
    assert.throws(()=>compile({...p,events:[{...base,articulation:invalid}]}));
  }
});
