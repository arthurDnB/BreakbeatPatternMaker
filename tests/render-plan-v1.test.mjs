// Precondition 4 — the frozen RenderPlanV1 contract.
//
// schemas/render-plan-v1.schema.json is the published contract between this engine and the
// future native renderer. It is frozen deliberately: the digest below is the reviewed
// revision. The schema is the authority, not this test — every assertion here is derived from
// the schema document itself, so the test cannot drift away from it. Any edit to the schema is
// a deliberate contract revision recorded in docs/M1-RENDER-PLAN-CONTRACT.md, with the digest
// updated in the same change.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv';
import {PPQ,ROLES} from '../dist/core/model.js';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile} from '../dist/core/compile.js';
import {Editor} from '../dist/core/editor.js';
import {parseTimeSignature} from '../dist/core/meter.js';
import {validateSettings} from '../dist/core/settings.js';
import {renderPerformance} from '../dist/audio/performance.js';

const PLAN_SCHEMA='schemas/render-plan-v1.schema.json';
const TRANSFER_SCHEMA='schemas/bbpattern-v1.schema.json';
// SHA-256 of the frozen schema with line endings normalised to LF, so a CRLF checkout of the
// same revision still verifies. r2 narrows sampleRate to 192 kHz and generationRole to the role
// vocabulary; the revision history lives in docs/M1-RENDER-PLAN-CONTRACT.md.
const FROZEN_DIGEST='e1ddcea1de60e77697e35251eeaed9a25edc9064c78d169c61bb4fa1314cd243';

const source=readFileSync(PLAN_SCHEMA,'utf8');
const schema=JSON.parse(source);
const check=new Ajv({strict:true}).compile(schema);

test('the frozen plan contract is byte-identical to the reviewed revision',()=>{
  const digest=createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
  assert.equal(digest,FROZEN_DIGEST,`${PLAN_SCHEMA} changed: record the revision in docs/M1-RENDER-PLAN-CONTRACT.md and update FROZEN_DIGEST in the same change`);
});

// A fully populated plan: every optional field present, both source variants, both track kinds.
const plan=()=>({
  planVersion:'RenderPlanV1',
  projectRevision:3,
  planRevision:7,
  engineVersion:'0.5.1-groove.1',
  profileVersion:'0.3.0-groove.3',
  dspVersion:'0.1.0',
  timeline:{
    ppq:960,
    sampleRate:44100,
    tempoEvents:[{tick:0,bpm:165}],
    meterEvents:[{tick:0,numerator:7,denominator:8}],
    totalTicks:13440,
    totalFrames:195555
  },
  tracks:[
    {trackId:'kick',name:'Kick',kind:'sample',gain:.83,pan:0,mute:false,solo:false,generationRole:'kick',instrumentId:'jungle-kit',modularGraph:null},
    {trackId:'lead',kind:'synth',gain:.7,pan:-.25,generationRole:null,instrumentId:'sine-whistle',modularGraph:{nodes:[]}}
  ],
  events:[
    {eventId:'kick-0',trackId:'kick',tick:0,tickFraction:0,
      source:{kind:'sample',assetKey:'asset:jungle-kick',sliceId:'kick-a',startFrame:0,endFrame:4410,velocityLayer:'piano-kw-060-H'},
      gain:.9,pan:0,pitch:0,gate:.5,decay:.35,playbackRate:1,articulation:{mode:'auto'},ratchetIndex:null,occurrenceId:null},
    {eventId:'lead-0',trackId:'lead',tick:960,source:{kind:'synth',note:60,durationTicks:480},gain:.6,pitch:12,decay:1}
  ],
  loopPolicy:{mode:'pattern',loopStartTick:0,loopEndTick:13440,tailSeconds:1.5},
  vinylState:{seed:'break-042'},
  busEffects:[{kind:'compressor'}]
});
const mutate=change=>{const p=plan();change(p);return p;};

test('the frozen plan contract accepts a fully populated plan and a minimal one',()=>{
  assert.equal(check(plan()),true,JSON.stringify(check.errors));
  // Only the eight required top-level members, with empty track/event lists and no optional
  // timeline totals: the smallest plan a renderer must still accept.
  assert.equal(check({
    planVersion:'RenderPlanV1',projectRevision:0,planRevision:0,engineVersion:'0.5.1-groove.1',
    timeline:{ppq:960,sampleRate:44100,tempoEvents:[],meterEvents:[]},
    tracks:[],events:[],loopPolicy:{mode:'oneShot',tailSeconds:0}
  }),true,JSON.stringify(check.errors));
});

test('the frozen plan contract rejects malformed plans',()=>{
  const rejected={
    'an unknown top-level field':p=>{p.catalog='x';},
    'a missing required member':p=>{delete p.loopPolicy;},
    'a null required member':p=>{p.projectRevision=null;},
    'a plan version other than RenderPlanV1':p=>{p.planVersion='RenderPlanV2';},
    'a PPQ other than 960':p=>{p.timeline.ppq=480;},
    'a sample rate above the ceiling':p=>{p.timeline.sampleRate=400000;},
    'a sample rate one hertz above the engine ceiling':p=>{p.timeline.sampleRate=192001;},
    'a device sample rate the reference renderer rejects':p=>{p.timeline.sampleRate=384000;},
    'a sample rate below the floor':p=>{p.timeline.sampleRate=4000;},
    'a generation role outside the role set':p=>{p.tracks[0].generationRole='banjo';},
    'a generation role that is an empty string':p=>{p.tracks[0].generationRole='';},
    'a negative tick':p=>{p.events[0].tick=-1;},
    'a negative total tick count':p=>{p.timeline.totalTicks=-1;},
    'a meter numerator above 32':p=>{p.timeline.meterEvents[0].numerator=33;},
    'a meter denominator outside the set':p=>{p.timeline.meterEvents[0].denominator=3;},
    'a tick fraction of exactly one':p=>{p.events[0].tickFraction=1;},
    'a negative tick fraction':p=>{p.events[0].tickFraction=-.1;},
    'a sample source without an asset key':p=>{delete p.events[0].source.assetKey;},
    'a source claiming to be both sample and synth':p=>{p.events[0].source.note=60;},
    'an extra field on a source':p=>{p.events[0].source.quantize=true;},
    'a synth source without a note':p=>{delete p.events[1].source.note;},
    'a synth note above 119':p=>{p.events[1].source.note=120;},
    'a fractional note':p=>{p.events[1].source.note=60.5;},
    'a zero-length synth note':p=>{p.events[1].source.durationTicks=0;},
    'an event without an id':p=>{delete p.events[0].eventId;},
    'a decay below the floor':p=>{p.events[0].decay=.01;},
    'a playback rate above 2x':p=>{p.events[0].playbackRate=2.5;},
    'an event gain above 4x':p=>{p.events[1].gain=4.5;},
    'a track gain above 2x':p=>{p.tracks[0].gain=2.5;},
    'a pan outside -1..1':p=>{p.tracks[1].pan=1.5;},
    'a track kind that is neither sample nor synth':p=>{p.tracks[0].kind='midi';},
    'a track name longer than 120 characters':p=>{p.tracks[0].name='x'.repeat(121);},
    'a numeric instrument id':p=>{p.tracks[1].instrumentId=42;},
    'a negative ratchet index':p=>{p.events[0].ratchetIndex=-1;},
    'a loop mode outside the policy set':p=>{p.loopPolicy.mode='once';},
    'a tail longer than 30 seconds':p=>{p.loopPolicy.tailSeconds=31;},
    'a bus effect that is not an object':p=>{p.busEffects=[7];}
  };
  for(const [description,change] of Object.entries(rejected)){
    assert.equal(check(mutate(change)),false,`the frozen contract must reject ${description}`);
  }
});

test('the frozen plan contract accepts the boundary values the engine allows',()=>{
  assert.equal(check(mutate(p=>{
    p.timeline.sampleRate=8000;
    p.timeline.tempoEvents=[{tick:0,bpm:32},{tick:960,bpm:999}];
    p.timeline.meterEvents=[{tick:0,numerator:32,denominator:1}];
    p.timeline.totalTicks=0;
    p.tracks[0].gain=0;p.tracks[0].pan=-1;p.tracks[0].name='x'.repeat(120);
    p.tracks[1].gain=2;p.tracks[1].pan=1;
    p.events[0].tick=0;p.events[0].tickFraction=0;p.events[0].gain=0;p.events[0].pan=-1;
    p.events[0].decay=.02;p.events[0].playbackRate=.5;p.events[0].ratchetIndex=0;
    p.events[1].source.note=0;p.events[1].source.durationTicks=1;
    p.events[1].gain=4;p.events[1].pan=1;p.events[1].decay=1;p.events[1].playbackRate=2;
    p.loopPolicy.tailSeconds=0;
  })),true,JSON.stringify(check.errors));
  assert.equal(check(mutate(p=>{
    p.timeline.sampleRate=192000;
    p.timeline.meterEvents=[{tick:0,numerator:1,denominator:32}];
    p.events[1].source.note=119;
    p.loopPolicy.tailSeconds=30;
    p.vinylState=null;
  })),true,JSON.stringify(check.errors));
});

test('the frozen plan contract agrees with the shipped transfer schema and the engine',()=>{
  // The plan and the transfer schema must describe the same note domain, or a compiled pattern
  // cannot be planned for rendering.
  const transfer=JSON.parse(readFileSync(TRANSFER_SCHEMA,'utf8'));
  assert.deepEqual(ROLES,transfer.definitions.role.enum);
  assert.equal(schema.properties.events.items.properties.source.oneOf[1].properties.note.maximum,
    transfer.properties.sources.items.properties.note.maximum);
  // PPQ is not a tunable: the plan pins the engine's own constant.
  assert.equal(schema.properties.timeline.properties.ppq.const,PPQ);
  // The sample-rate ceiling and the role vocabulary were narrowed in r2 to the engine's own
  // limits, so the plan can no longer describe a render the reference engine refuses.
  assert.equal(schema.properties.timeline.properties.sampleRate.maximum,192000);
  for(const rate of [192000,192001]){
    assert.equal(check(mutate(p=>{p.timeline.sampleRate=rate;})),rate<=192000,`schema sample-rate bound disagrees at ${rate} Hz`);
    const render=()=>renderPerformance(generate(defaults('jungle')),new Map(),rate,{},{loop:false});
    if(rate<=192000){
      // The engine accepts its own ceiling. Any failure here is a missing-asset error rather than
      // a rate error, so only a rate error counts as a disagreement.
      try{render();}catch(error){assert.doesNotMatch(String(error?.message??error),/Render sample rate must be 8–192 kHz\./,`the engine rejects ${rate} Hz`);}
    }else assert.throws(render,/Render sample rate must be 8–192 kHz\./);
  }
  // src/core/compile.ts:25 validates drum lanes and :38 sample tracks against ROLES, so no string
  // outside the role vocabulary can reach a render. Editor.setDrumLane routes through compile().
  assert.deepEqual(schema.properties.tracks.items.properties.generationRole.enum,[...ROLES,null]);
  const editor=new Editor(generate(defaults('jungle')));
  assert.throws(()=>editor.setDrumLane('kick',{generationRole:'banjo'}),
    /Invalid drum lane visibility or generation role\./);
  // Every tempo and meter bound in the schema is a bound the engine already enforces, so a
  // plan the schema accepts is never a plan the generator would refuse.
  for(const bpm of [31,32,999,1000]){
    assert.equal(check(mutate(p=>{p.timeline.tempoEvents=[{tick:0,bpm}];})),bpm>=32&&bpm<=999,`schema tempo bound disagrees at ${bpm} BPM`);
    const settings={...defaults('jungle'),bpm};
    if(bpm>=32&&bpm<=999)assert.doesNotThrow(()=>validateSettings(settings),`the engine rejects ${bpm} BPM`);
    else assert.throws(()=>validateSettings(settings),/BPM must be a number from 32 to 999\./);
  }
  // Meter bounds are compared against parseTimeSignature, which is the meter authority. The
  // tracker row rule (src/core/meter.ts:16, a whole number of rows per bar, at most 512 rows) is
  // a further constraint on the LPB/bars combination that the plan deliberately does not carry:
  // it belongs to the transfer schema, where note rows are bounded at 511.
  assert.equal(transfer.properties.notes.items.properties.row.maximum,511);
  for(const numerator of [0,1,32,33])for(const denominator of [1,2,3,4,8,16,32]){
    const accepted=check(mutate(p=>{p.timeline.meterEvents=[{tick:0,numerator,denominator}];}));
    assert.equal(accepted,accepts(()=>parseTimeSignature(`${numerator}/${denominator}`)),`schema meter bound disagrees at ${numerator}/${denominator}`);
  }
});

test('the two r1 disagreements are settled at r2 and the last one stays recorded',()=>{
  // r1 shipped with three schema/engine disagreements. Arthur approved the first two as r2
  // narrowings (revision history in docs/M1-RENDER-PLAN-CONTRACT.md); they are pinned here so
  // that widening the contract again is a deliberate, visible change rather than a quiet drift.
  //
  // 1. Settled (r2): the plan no longer admits a timeline rate the renderer refuses.
  assert.equal(schema.properties.timeline.properties.sampleRate.maximum,192000);
  assert.equal(check(mutate(p=>{p.timeline.sampleRate=384000;})),false,'the frozen contract must not admit a 384 kHz timeline');
  // 2. Settled (r2): generationRole is the engine's role vocabulary or null, nothing else.
  assert.deepEqual(schema.properties.tracks.items.properties.generationRole.enum,[...ROLES,null]);
  assert.equal(ROLES.length,4);
  // 3. Still open: the plan excludes only a tick fraction of exactly 1; the engine caps the same
  //    concept at 0.9999999999, so the two differ in the last ten decimal places.
  assert.equal(check(mutate(p=>{p.events[0].tickFraction=.99999999999;})),true);
  const pattern=generate(defaults('jungle'));
  pattern.events[0].fineOffset=.99999999999;
  assert.throws(()=>compile(pattern),/fine offset must be a number from 0 to 0\.9999999999\./);
});

function accepts(thunk){try{thunk();return true;}catch{return false;}}
