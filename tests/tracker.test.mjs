import test from 'node:test';import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';import {generate} from '../dist/core/generate.js';import {Editor} from '../dist/core/editor.js';
import {reconstruct,sliceReference} from '../dist/audio/slices.js';import {renderPerformance} from '../dist/audio/performance.js';
const rate=44100,channels=[Float32Array.from({length:rate},(_,i)=>Math.sin(i*.13)*.4),Float32Array.from({length:rate},(_,i)=>Math.sin(i*.17)*.3)];
const asset={id:'asset-test',name:'Test',sampleRate:rate,channels};const assets=new Map([[asset.id,asset]]);
test('original groove reconstructs stereo audio at its measured sample positions',()=>{
 const p=reconstruct(asset,[0,7001,22051,33079,rate],{...defaults(),bars:1});
 assert.equal(p.settings.bpm,240);
 const out=renderPerformance(p,assets,rate);
 for(let c=0;c<2;c++)for(let i=0;i<rate;i++)assert.ok(Math.abs(out.channels[c][i]-channels[c][i])<1e-6);
 assert.throws(()=>renderPerformance(p,new Map()),/missing/);
});
test('slices retain boundaries and pitch doubles playback speed',()=>{
 const p=reconstruct(asset,[0,22050,rate],{...defaults(),bars:1});p.events=p.events.slice(0,1);p.events[0].pitch=12;
 const out=renderPerformance(p,assets,rate);
 assert.ok(Math.abs(out.channels[0][100]-channels[0][200])<1e-6);
 assert.equal(out.channels[0][12000],0);
 assert.equal(sliceReference(asset,[0,22050,rate],1).startFrame,22050);
});
test('manual edits obey locks, permit anchor edits, undo, delete to silence and reinsert',()=>{
 const e=new Editor(generate(defaults())),hit=structuredClone(e.state.pattern.events[0]);
 hit.gain=.2;assert.equal(e.write(hit,hit.id),true);assert.equal(e.state.pattern.events.find(h=>h.id===hit.id).gain,.2);
 e.undo();assert.notEqual(e.state.pattern.events.find(h=>h.id===hit.id).gain,.2);e.redo();
 e.toggleRole(hit.role);assert.equal(e.write({...hit,gain:.3},hit.id),false);e.toggleRole(hit.role);
 e.state.selection={ids:e.state.pattern.events.map(h=>h.id),rows:null};e.deleteSelected();assert.equal(e.state.pattern.events.length,0);
 const audio=renderPerformance(e.state.pattern,new Map());assert.ok(audio.channels[0].every(n=>n===0));
 e.write({...hit,id:'new'});assert.equal(e.state.pattern.events.length,1);
 assert.throws(()=>e.write({...hit,id:'invalid',pitch:100}),/pitch/);
});
