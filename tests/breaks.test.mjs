import test from 'node:test';
import assert from 'node:assert/strict';
import {BREAKS} from '../dist/core/breaks.js';
import {PROFILES,defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
test('break presets are distinct, deterministic and export across every genre and resolution',()=>{
 const signatures=new Set();
 for(const breakStyle of Object.keys(BREAKS)) {
  signatures.add(JSON.stringify(generate({...defaults(),breakStyle}).events.map(h=>[h.role,h.baseTick])));
  for(const genre of Object.keys(PROFILES))for(const resolution of [8,16,32,64]){
   const s={...defaults(genre),breakStyle,resolution};const p=generate(s);
   assert.deepEqual(generate(s),p);const t=compile(p);
   assert.ok(t.name.includes(breakStyle));assert.equal(t.notes.length,p.events.length);
  }
 }
 assert.equal(signatures.size,Object.keys(BREAKS).length);
 assert.throws(()=>generate({...defaults(),breakStyle:'invalid'}),/break preset/);
});
test('changing breaks preserves locked kicks and history restores break selection',()=>{
 const editor=new Editor(generate(defaults()));editor.toggleRole('kick');
 const kicks=editor.state.pattern.events.filter(h=>h.role==='kick');
 editor.replace(generate({...defaults(),breakStyle:'apache'}));
 assert.deepEqual(editor.state.pattern.events.filter(h=>h.role==='kick'),kicks);
 assert.equal(editor.state.pattern.settings.breakStyle,'apache');
 editor.undo();assert.equal(editor.state.pattern.settings.breakStyle,'genre');
 editor.redo();assert.equal(editor.state.pattern.settings.breakStyle,'apache');
});
