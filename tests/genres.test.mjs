import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,PROFILES} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
test('all genre profiles are distinct at matched tempo and deterministic across resolutions',()=>{
 const signatures=new Set();
 for(const genre of Object.keys(PROFILES)) {
  signatures.add(JSON.stringify(generate({...defaults(genre),bpm:165}).events.map(h=>[h.role,h.baseTick])));
  for(const resolution of [8,16,32,64])for(let i=0;i<20;i++) {
   const s={...defaults(genre),resolution,seed:String(i),complexity:i/20};
   const p=generate(s);assert.deepEqual(generate(s),p);const t=compile(p);
   assert.equal(t.notes.length,p.events.length);
   assert.ok(t.notes.every(n=>n.row>=0&&n.row<t.timing.lines&&n.column<12));
  }
 }
 assert.equal(signatures.size,Object.keys(PROFILES).length);
});
test('complexity adds detail without moving anchors for each genre',()=>{
 for(const genre of Object.keys(PROFILES)) {
  let difference=0;
  for(let i=0;i<20;i++) {
   const s={...defaults(genre),seed:String(i),resolution:32,fillAmount:0};
   const low=generate({...s,complexity:0}),high=generate({...s,complexity:1});
   assert.deepEqual(low.events.filter(h=>h.anchor),high.events.filter(h=>h.anchor));
   assert.ok(high.events.length>=low.events.length);difference+=high.events.length-low.events.length;
  }
  assert.ok(difference>0,genre);
 }
});
test('trap half-time and hardcore four-on-the-floor anchors',()=>{
 assert.deepEqual(generate({...defaults('trap'),bars:1}).events.filter(h=>h.anchor&&h.role==='snare').map(h=>h.baseTick),[1920]);
 assert.deepEqual(generate({...defaults('hardcore'),bars:1}).events.filter(h=>h.anchor&&h.role==='kick').map(h=>h.baseTick),[0,960,1920,2880]);
});
