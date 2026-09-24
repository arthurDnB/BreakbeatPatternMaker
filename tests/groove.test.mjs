import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,validateSettings} from '../dist/core/generate.js';
import {defaults,genreDefaults,PROFILES} from '../dist/core/profiles.js';
import {GROOVES} from '../dist/core/groove-profiles.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {renderPerformance} from '../dist/audio/performance.js';
const genres=Object.keys(PROFILES);

test('groove v2: all 38 genres deterministic and bounded across seeds, grids and extreme controls',()=>{
 assert.equal(genres.length,38);
 for(const genre of genres)for(const resolution of [8,16,32,64])for(let seed=0;seed<8;seed++){
  const s={...genreDefaults(genre),bars:4,resolution,seed:'qa-'+seed,complexity:seed%2,spicy:seed%2,swing:.67,humanizeMs:10};
  const before=structuredClone(s),p=generate(s);
  assert.deepEqual(p,generate(s));assert.deepEqual(s,before);assert.equal(p.engineVersion,'0.2.0-groove.1');
  const t=compile(p);assert.equal(t.notes.length,p.events.length);assert.equal(t.warnings.length,0);
  assert.ok(p.events.every(h=>h.baseTick+h.offsetTick>=0&&h.baseTick+h.offsetTick<s.bars*3840));
  assert.ok(p.events.length<=4*64);
  for(let bar=0;bar<4;bar++){
   const bursts=p.events.filter(h=>h.ratchets&&Math.floor(h.baseTick/3840)===bar);
   assert.ok(bursts.length<=GROOVES[genre].maxBursts,genre);
   assert.ok(bursts.every(h=>h.baseTick%3840>=2880&&!h.anchor));
  }
 }
});

test('genre grammar: one-drop, four-floor, two-step, half-time and atmospheric space differ',()=>{
 const p=(genre,bars=1)=>generate({...genreDefaults(genre),seed:'grammar',bars,complexity:0,syncopation:0,ghostAmount:0,fillAmount:0,spicy:0});
 assert.equal(p('dub').events.some(h=>h.role==='kick'&&h.baseTick===0),false);
 assert.ok(p('dub').events.some(h=>h.anchor&&h.role==='kick'&&h.baseTick===1920));
 for(const genre of ['garage','speedgarage','hardcore'])assert.deepEqual(p(genre).events.filter(h=>h.role==='kick'&&h.anchor).map(h=>h.baseTick),[0,960,1920,2880]);
 assert.notDeepEqual(p('twostepgarage').events.filter(h=>h.role==='kick').map(h=>h.baseTick),[0,960,1920,2880]);
 for(const genre of ['dubstep','brostep','trap','halftimednb'])assert.deepEqual(p(genre).events.filter(h=>h.role==='snare'&&h.anchor).map(h=>h.baseTick),[1920]);
 const atmospheric=p('atmosphericbreakcore',2).events;
 assert.ok(atmospheric.filter(h=>h.role==='hat'&&h.baseTick<3840).length<atmospheric.filter(h=>h.role==='hat'&&h.baseTick>=3840).length);
 assert.ok(p('lofihiphop').events.find(h=>h.role==='snare'&&h.anchor).offsetTick>p('neurofunk').events.find(h=>h.role==='snare'&&h.anchor).offsetTick);
});

test('groove complexity preserves anchors and ghost amount has independent kick and hat streams',()=>{
 for(const genre of genres){
  const s={...genreDefaults(genre),fillAmount:0,spicy:0};
  const low=generate({...s,complexity:0}),high=generate({...s,complexity:1});
  assert.deepEqual(low.events.filter(h=>h.anchor),high.events.filter(h=>h.anchor),genre);
  assert.ok(high.events.length>=low.events.length,genre);
  const lanes=p=>p.events.filter(h=>['kick','hat'].includes(h.role));
  assert.deepEqual(lanes(generate({...s,ghostAmount:0})),lanes(generate({...s,ghostAmount:1})),genre);
 }
});

test('every groove differs at matched tempo and has audible, finite output',()=>{
 const signatures=new Set();
 for(const genre of genres){
  const p=generate({...genreDefaults(genre),bpm:150,bars:1,seed:'sound-check'});
  signatures.add(JSON.stringify(p.events.map(h=>[h.role,h.baseTick,h.offsetTick,h.gain,h.ratchets])));
  const audio=renderPerformance(p,new Map(),8000);let peak=0;
  for(const ch of audio.channels)for(const v of ch){assert.ok(Number.isFinite(v)&&Math.abs(v)<=1);peak=Math.max(peak,Math.abs(v));}
  assert.ok(peak>.05,genre);
 }
 assert.equal(signatures.size,38);
});

test('genre fill and mutation respect selection, exclusions, exact locks and undo/redo',()=>{
 for(const genre of genres){
  const editor=new Editor(generate({...genreDefaults(genre),bars:2,enabledRoles:['kick','snare','hat']}));
  const last=editor.state.pattern.settings.resolution*2-1;
  editor.state.selection.rows=[last-3,last];editor.state.lockedRoles=['kick'];
  editor.state.lockedIds=[editor.state.pattern.events.find(h=>h.role==='snare').id];
  const before=structuredClone(editor.state);
  const protectedHits=before.pattern.events.filter(h=>h.role==='kick'||before.lockedIds.includes(h.id)||h.anchor);
  const outIds=new Set(compile(before.pattern).notes.filter(n=>n.row<last-3).map(n=>n.id));
  editor.fill();
  for(const h of protectedHits)assert.deepEqual(editor.state.pattern.events.find(e=>e.id===h.id),h,genre);
  for(const h of before.pattern.events.filter(h=>outIds.has(h.id)))assert.deepEqual(editor.state.pattern.events.find(e=>e.id===h.id),h,genre);
  assert.ok(editor.state.pattern.events.every(h=>h.role!=='percussion'));
  const changed=structuredClone(editor.state);if(editor.undo()){assert.deepEqual(editor.state,before);editor.redo();assert.deepEqual(editor.state,changed);}
  const preMutation=structuredClone(editor.state);editor.mutate();
  for(const h of preMutation.pattern.events.filter(h=>h.role==='kick'||h.anchor||preMutation.lockedIds.includes(h.id)))assert.deepEqual(editor.state.pattern.events.find(e=>e.id===h.id),h,genre);
  compile(editor.state.pattern);
 }
});

test('related variations develop motifs, keep anchors, exclusions and locks while preserving seed and history',()=>{
 for(const genre of genres){
  const e=new Editor(generate({...genreDefaults(genre),complexity:.8,enabledRoles:['kick','snare','hat']}));
  e.state.lockedRoles=['hat'];const before=structuredClone(e.state);
  e.variation();
  assert.equal(e.state.pattern.settings.seed,before.pattern.settings.seed);
  assert.equal(e.state.pattern.settings.variation,1);
  for(const h of before.pattern.events.filter(h=>h.anchor||h.role==='hat'))assert.deepEqual(e.state.pattern.events.find(n=>n.id===h.id),h,genre);
  assert.ok(e.state.pattern.events.every(h=>h.role!=='percussion'));
  const after=structuredClone(e.state);e.undo();assert.deepEqual(e.state,before);e.redo();assert.deepEqual(e.state,after);
 }
});

test('engine and variation survive project roundtrip; legacy settings remain reproducible',()=>{
 const e=new Editor(generate(genreDefaults('amenscience')));e.variation();
 const project=makeProject(e.state,e.state.pattern.settings,defaultKitState(),new Map());
 const restored=readProject(JSON.parse(JSON.stringify(project))).project;
 assert.deepEqual(restored.editor,e.state);assert.deepEqual(generate(restored.draft),generate(e.state.pattern.settings));
 assert.equal(generate(defaults()).engineVersion,'0.1.0');
 assert.throws(()=>validateSettings({...defaults(),algorithm:'unknown'}),/engine/);
 assert.throws(()=>validateSettings({...defaults(),variation:-1}),/variation/);
 assert.throws(()=>generate({...genreDefaults('dub'),algorithm:'legacy-v1'}),/requires Groove/);
});


test('variation handles moved primary hits without duplicate IDs; fill leaves adjacent outside hits intact',()=>{
 const e=new Editor(generate({...genreDefaults('jungle'),complexity:1,bars:2}));
 const kick=e.state.pattern.events.find(h=>h.role==='kick'&&h.anchor);
 e.write({...kick,baseTick:kick.baseTick+60},kick.id);
 e.variation();assert.deepEqual(e.state.pattern.events.find(h=>h.id===kick.id),{...kick,baseTick:kick.baseTick+60});compile(e.state.pattern);
 const f=new Editor(generate({...genreDefaults('brostep'),resolution:16,bars:1}));
 const outside={id:'outside-selection',role:'snare',sourceId:'kit.snare',baseTick:2879,offsetTick:0,gain:.2,pan:0,anchor:false,ghost:true,reason:'Outside selected ending.'};
 f.write(outside);f.state.selection={ids:[],rows:[12,15]};f.fill();
 assert.deepEqual(f.state.pattern.events.find(h=>h.id===outside.id),outside);
});
