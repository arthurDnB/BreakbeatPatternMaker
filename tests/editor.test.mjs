import test from 'node:test';
import assert from 'node:assert/strict';
import {Editor,locked,selectedIds} from '../dist/core/editor.js';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {compile,serialize} from '../dist/core/compile.js';
const create=()=>new Editor(generate({...defaults(),ghostAmount:1,complexity:.8}));
const exported=e=>serialize(compile(e.state.pattern));
test('mutation preserves exact locks and anchors and changes no more than 20% of eligible hits',()=>{
 const e=create();e.toggleRole('kick');const hat=e.state.pattern.events.find(h=>h.role==='hat');
 e.state.selection={ids:[hat.id],rows:null};e.toggleSelectedLocks();e.state.selection={ids:[],rows:null};
 const before=structuredClone(e.state),eligible=before.pattern.events.filter(h=>!h.anchor&&!locked(before,h));
 assert.ok(e.mutate());let changed=0;
 for(const h of before.pattern.events){
  const after=e.state.pattern.events.find(n=>n.id===h.id);
  if(h.anchor||locked(before,h))assert.deepEqual(after,h);
  if(JSON.stringify(after)!==JSON.stringify(h))changed++;
 }
 assert.ok(changed>0&&changed<=Math.ceil(eligible.length*.2));
});
test('single-hit mutation and row-range mutation leave everything else byte-identical',()=>{
 for(const mode of ['hit','rows']){
  const e=create();e.state.selection=mode==='hit'?{ids:[e.state.pattern.events.find(h=>!h.anchor).id],rows:null}:{ids:[],rows:[24,31]};
  const ids=selectedIds(e.state),before=structuredClone(e.state.pattern);
  assert.ok(e.mutate());
  for(const h of before.events)if(!ids.has(h.id))assert.deepEqual(e.state.pattern.events.find(n=>n.id===h.id),h);
  if(mode==='rows')for(const n of compile(e.state.pattern).notes)if(ids.has(n.id))assert.ok(n.row>=24&&n.row<=31);
 }
});
test('fills stay in the selection, preserve locked snares and anchors, and undo/redo exact exports',()=>{
 const e=create();e.state.selection={ids:[],rows:[28,31]};
 const ghost=e.state.pattern.events.find(h=>h.role==='snare'&&!h.anchor&&h.baseTick>=28*240);
 if(ghost)e.state.lockedIds=[ghost.id];
 const before=structuredClone(e.state),original=exported(e),oldIds=new Set(before.pattern.events.map(h=>h.id));
 assert.ok(e.fill());const filled=exported(e);assert.notEqual(filled,original);
 for(const h of before.pattern.events)if(h.anchor||locked(before,h)||h.baseTick<28*240)assert.deepEqual(e.state.pattern.events.find(n=>n.id===h.id),h);
 for(const n of compile(e.state.pattern).notes)if(!oldIds.has(n.id))assert.ok(n.row>=28&&n.row<=31);
 assert.ok(e.undo());assert.equal(exported(e),original);assert.deepEqual(e.state,before);
 assert.ok(e.redo());assert.equal(exported(e),filled);
});
test('locks and generation are undoable, timing changes with locks are rejected, redo branches clear',()=>{
 const e=create(),original=structuredClone(e.state);e.toggleRole('snare');
 assert.ok(e.undo());assert.deepEqual(e.state,original);assert.ok(e.redo());
 const protectedHits=structuredClone(e.state.pattern.events.filter(h=>h.role==='snare'));
 e.replace(generate({...defaults(),seed:'new'}));assert.deepEqual(e.state.pattern.events.filter(h=>h.role==='snare'),protectedHits);
 const before=structuredClone(e.state);assert.throws(()=>e.replace(generate({...defaults(),bars:4})),/Unlock/);assert.deepEqual(e.state,before);
 e.undo();assert.ok(e.redoLabel);e.toggleRole('hat');assert.equal(e.redoLabel,undefined);
});
test('all-locked and anchor-only mutations do not make history or modify data',()=>{
 const e=create();for(const role of ['kick','snare','hat','percussion'])e.toggleRole(role);
 const before=structuredClone(e.state),label=e.undoLabel;
 assert.equal(e.mutate(),false);e.state.selection={ids:[],rows:[28,31]};assert.equal(e.fill(),false);
 assert.deepEqual(e.state.pattern,before.pattern);assert.equal(e.undoLabel,label);
 const another=create();another.state.selection={ids:[another.state.pattern.events.find(h=>h.anchor).id],rows:null};assert.equal(another.mutate(),false);
});
test('replaying an edit after Undo is deterministic, including fill IDs and velocities',()=>{
 const e=create();e.state.selection={ids:[],rows:[24,31]};e.fill();const result=exported(e);e.undo();e.fill();assert.equal(exported(e),result);
});
test('repeated edits across resolutions preserve protected hits and always compile',()=>{
 for(const resolution of [8,16,32,64])for(let seed=0;seed<20;seed++){
  const e=new Editor(generate({...defaults(),resolution,seed:String(seed),humanizeMs:5,swing:.6}));e.toggleRole('kick');
  const before=e.state.pattern.events.filter(h=>h.role==='kick'||h.anchor);
  for(let i=0;i<8;i++){e.mutate();if(i%2===0){const t=compile(e.state.pattern);e.state.selection={ids:[],rows:[t.timing.lines-t.timing.lpb,t.timing.lines-1]};e.fill();}compile(e.state.pattern);}
  for(const h of before)assert.deepEqual(e.state.pattern.events.find(n=>n.id===h.id),h);
 }
});
test('scramble shuffles timing/slices while strictly preserving anchors and locks',()=>{
 const e=create();
 e.toggleRole('snare');
 const before=structuredClone(e.state.pattern);
 assert.ok(e.scramble());
 for(const h of before.events.filter(ev=>ev.role==='snare')){
  assert.deepEqual(e.state.pattern.events.find(ev=>ev.id===h.id), h);
 }
 for(const h of before.events.filter(ev=>ev.anchor)){
  assert.deepEqual(e.state.pattern.events.find(ev=>ev.id===h.id), h);
 }
 assert.ok(e.undo());
 assert.deepEqual(e.state.pattern, before);
 assert.ok(e.redo());
});

test('cell selections include empty positions while mutation stays limited to selected hits',()=>{
 const e=create(),hit=e.state.pattern.events.find(h=>!h.anchor);assert.ok(hit);
 const n=compile(e.state.pattern).notes.find(note=>note.id===hit.id);
 e.state.selection={ids:[],rows:null,cells:[{row:n.row,lane:n.lane},{row:n.row+1,lane:'hat'}]};
 const chosen=selectedIds(e.state);assert.deepEqual([...chosen],[hit.id]);
 const before=structuredClone(e.state.pattern);assert.ok(e.mutate());
 for(const old of before.events)if(old.id!==hit.id)assert.deepEqual(e.state.pattern.events.find(next=>next.id===old.id),old);
 assert.doesNotThrow(()=>compile(e.state.pattern));
});

test('top transport tempo changes are undoable and validated',()=>{
 const e=create(),before=e.state.pattern.settings.bpm;
 assert.ok(e.setTempo(132.5));assert.equal(e.state.pattern.settings.bpm,132.5);assert.equal(e.undoLabel,'Change BPM');
 assert.ok(e.undo());assert.equal(e.state.pattern.settings.bpm,before);assert.ok(e.redo());assert.equal(e.state.pattern.settings.bpm,132.5);
 assert.throws(()=>e.setTempo(31),/Tempo/);assert.throws(()=>e.setTempo(NaN),/Tempo/);
});

test('cell copy and paste preserve empty cells, replace destinations atomically, and undo',()=>{
 const e=create(),notes=compile(e.state.pattern).notes,source=notes.find(n=>n.lane==='kick'&&n.row<20);
 assert.ok(source);
 e.state.selection={ids:[],rows:null,cells:[{row:source.row,lane:'kick'},{row:source.row+1,lane:'hat'}]};
 const clip=e.copySelection(),before=exported(e),target=24;
 assert.equal(clip.cells.length,2);
 assert.equal(clip.cells[0].hits.length,notes.filter(n=>n.row===source.row&&n.lane==='kick').length);
 assert.ok(e.pasteCells(clip,target,'kick'));
 const after=compile(e.state.pattern).notes;
 assert.equal(after.filter(n=>n.row===target&&n.lane==='kick').length,clip.cells[0].hits.length);
 assert.equal(after.filter(n=>n.row===target+1&&n.lane==='hat').length,clip.cells[1].hits.length);
 assert.ok(e.undo());assert.equal(exported(e),before);assert.ok(e.redo());
 const pasted=exported(e);e.toggleRole('kick');const lockedBefore=exported(e);
 assert.throws(()=>e.pasteCells(clip,target,'kick'),/Unlock/);
 assert.equal(exported(e),lockedBefore);assert.equal(exported(e),pasted);
});
