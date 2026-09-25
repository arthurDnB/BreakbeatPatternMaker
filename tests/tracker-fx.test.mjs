import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';

const rate=8000;
function fixture(){
  const p=generate({...defaults('jungle'),algorithm:'groove-v3',bpm:120,bars:1,resolution:16});
  const samples=Float32Array.from({length:rate},(_,i)=>.1+i/rate*.3);
  const asset={id:'fx-sample',name:'FX sample',sampleRate:rate,channels:[samples]};
  p.events=[{...p.events[0],id:'fx-hit',role:'snare',sourceId:'kit.snare',baseTick:0,offsetTick:0,gain:1,pan:0,pitch:0,sourceKind:'oneShot',slice:{assetId:asset.id,startFrame:0,endFrame:rate,sampleRate:rate,label:'FX sample'},articulation:undefined,ratchets:1}];
  return {p,assets:new Map([[asset.id,asset]])};
}
const audio=(p,assets)=>renderPerformance(p,assets,rate).channels[0];
test('tracker FX offset, reverse, cut, slide, and retrigger produce bounded audio',()=>{
  const {p,assets}=fixture(),plain=audio(p,assets);
  p.events[0].effect={command:'0S',param:128};const offset=audio(p,assets);
  assert.ok(offset[40]>plain[40]*1.8);
  p.events[0].effect={command:'09',param:128};assert.deepEqual(audio(p,assets),offset);
  p.events[0].effect={command:'0B',param:0};const reversed=audio(p,assets);assert.ok(reversed[40]>plain[40]*1.8);
  p.events[0].effect={command:'0C',param:0x06};const cut=audio(p,assets);assert.ok(cut[400]>0);assert.equal(cut[700],0);
  p.events[0].effect={command:'0R',param:0x03};const repeated=audio(p,assets);for(const i of [20,270,520,770])assert.ok(repeated[i]>0);
  p.events[0].effect={command:'0U',param:0x10};const up=audio(p,assets);assert.notDeepEqual(up.slice(1000,1200),plain.slice(1000,1200));
  p.events[0].effect={command:'01',param:0x10};assert.deepEqual(audio(p,assets),up);
  p.events[0].effect={command:'0D',param:0x10};const down=audio(p,assets);assert.notDeepEqual(down.slice(1000,1200),up.slice(1000,1200));
  p.events[0].effect={command:'02',param:0x10};assert.deepEqual(audio(p,assets),down);
});
test('tracker FX validates, persists in projects, and edits with one undo step',()=>{
  const {p,assets}=fixture(),editor=new Editor(p);
  assert.ok(editor.editTrackerEffect('fx-hit',{command:'0R',param:0x23}));
  assert.deepEqual(editor.state.pattern.events[0].effect,{command:'0R',param:0x23});
  assert.match(compile(editor.state.pattern).warnings[0],/tracker FX/);
  assert.equal(readProject(makeProject(editor.state,p.settings,defaultKitState(),assets)).project.editor.pattern.events[0].effect.param,0x23);
  assert.ok(editor.undo());assert.equal(editor.state.pattern.events[0].effect,undefined);
  assert.ok(editor.redo());assert.ok(editor.editTrackerEffect('fx-hit'));assert.equal(editor.state.pattern.events[0].effect,undefined);
  for(const effect of [{command:'0X',param:4},{command:'0R',param:256},{command:'0S',param:-1},{command:'0C',param:1.5},{command:'0B',param:2}]){
    const bad=structuredClone(p);bad.events[0].effect=effect;assert.throws(()=>compile(bad));
  }
});
