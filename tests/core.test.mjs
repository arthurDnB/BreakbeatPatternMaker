import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {generate} from '../dist/core/generate.js';
import {compile,serialize} from '../dist/core/compile.js';
import {defaults} from '../dist/core/profiles.js';
import {DEFAULT_SOURCES} from '../dist/core/model.js';
const digest=p=>createHash('sha256').update(serialize(compile(p))).digest('hex');

test('version 0.1.0 keeps its published default-seed fingerprint',()=>{
 assert.equal(digest(generate(defaults())),'24253fe759850f220f14b53ba73b62ed44cf6532b4598ee9d37655ea55fa5f15');
});

test('same seed/settings produce byte-identical transfers; input stays immutable',()=>{
 const settings=Object.freeze(defaults());
 assert.equal(serialize(compile(generate(settings))),serialize(compile(generate(settings))));
 assert.notEqual(digest(generate(settings)),digest(generate({...settings,seed:'different'})));
});
test('changing ghost amount leaves kick and hat streams unchanged',()=>{
 const s=defaults();
 const core=p=>p.events.filter(h=>h.role==='kick'||h.role==='hat');
 assert.deepEqual(core(generate({...s,ghostAmount:0})),core(generate({...s,ghostAmount:1})));
});
test('profiles change rhythm at matched tempo',()=>{
 const signature=genre=>generate({...defaults(genre),bpm:165}).events.map(h=>[h.role,h.baseTick,h.gain]);
 assert.notDeepEqual(signature('jungle'),signature('dnb'));
 assert.notDeepEqual(signature('dnb'),signature('hiphop'));
});
test('anchors, bounds, mappings and cell uniqueness across 1200 generation cases',()=>{
 for(const genre of ['jungle','dnb','hiphop'])for(const resolution of [8,16,32,64])for(let seed=0;seed<100;seed++){
  const s={...defaults(genre),resolution,seed:String(seed),bars:seed%4+1,complexity:(seed%11)/10,humanizeMs:seed%11,swing:.5+(seed%18)/100};
  const p=generate(s),t=compile(p),cells=new Set();
  assert.equal(t.notes.length,p.events.length);
  for(let bar=0;bar<s.bars;bar++)for(const beat of [1,3])assert.ok(p.events.some(h=>h.anchor&&h.role==='snare'&&h.baseTick===(bar*4+beat)*960));
  for(const n of t.notes){
   assert.ok(n.row>=0&&n.row<t.timing.lines&&n.delay>=0&&n.delay<=255&&n.column<12);
   const key=`${n.lane}:${n.row}:${n.column}`;assert.ok(!cells.has(key));cells.add(key);
   assert.ok(t.sources.some(x=>x.id===n.source));
  }
 }
});
test('microtiming is nearest delay unit with row carry and early-note handling',()=>{
 const p=generate(defaults());p.events=[{...p.events[0],id:'late',baseTick:240,offsetTick:-1}, {...p.events[0],id:'carry',baseTick:239,offsetTick:1}];
 const t=compile(p);
 assert.equal(t.notes[0].row,0);assert.equal(t.notes[0].delay,255);
 assert.equal(t.notes[1].row,1);assert.equal(t.notes[1].delay,0);
 p.events=[{...p.events[0],baseTick:0,offsetTick:-20}];
 const clamped=compile(p);assert.equal(clamped.notes[0].row,0);assert.equal(clamped.notes[0].delay,0);assert.equal(clamped.warnings.length,1);
});
test('same-row notes receive different columns even with distinct delays',()=>{
 const p=generate(defaults());p.events=[{...p.events[0],id:'a',baseTick:0,offsetTick:0},{...p.events[0],id:'b',baseTick:120,offsetTick:0}];
 const t=compile(p);assert.deepEqual(t.notes.map(n=>[n.row,n.column,n.delay]),[[0,0,0],[0,1,128]]);
 p.events=Array.from({length:13},(_,i)=>({...p.events[0],id:`x${i}`,baseTick:i}));assert.throws(()=>compile(p),/12 notes/);
});
test('invalid numeric input, duplicate IDs and missing sources are rejected',()=>{
 for(const patch of [{bpm:NaN},{complexity:Infinity},{resolution:24},{seed:''},{swing:.4},{bars:5}])assert.throws(()=>generate({...defaults(),...patch}));
 const p=generate(defaults());p.events.push({...p.events[0]});assert.throws(()=>compile(p),/Duplicate/);
 assert.throws(()=>compile(generate(defaults()),[]),/sources/);
 const original=generate(defaults());original.events[0].gain=NaN;assert.throws(()=>compile(original),/gain/);
});
test('a source can be mapped to a slice key without transposing it',()=>{
 const sources=DEFAULT_SOURCES.map(s=>({...s,kind:'slice',instrument:7,note:48+s.instrument}));
 const t=compile(generate(defaults()),sources);
 assert.ok(t.sources.every(s=>s.kind==='slice'&&s.instrument===7));
 assert.equal(t.sources.find(s=>s.role==='snare').note,49);
});
test('CLI writes an importable file and rejects unknown arguments',()=>{
 const output='test-results/cli.bbpattern';
 execFileSync(process.execPath,['dist/cli.js','--genre','hiphop','--bpm','92','--seed','cli-test','--out',output]);
 const result=JSON.parse(readFileSync(output,'utf8'));assert.equal(result.timing.bpm,92);assert.equal(result.seed,'cli-test');
 assert.throws(()=>execFileSync(process.execPath,['dist/cli.js','--unknown'],{stdio:'pipe'}));
});
