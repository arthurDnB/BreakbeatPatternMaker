import {generate} from '../dist/core/generate.js';
import {defaults} from '../dist/core/profiles.js';
import {hash} from './engine-compatibility-fixture.mjs';

// F-DET (M0 audit sections 3.3 and 3.8). The contract these fixtures pin is the one settled in
// docs/M1-RENDER-PLAN-CONTRACT.md: the hash is over JSON.stringify(pattern), so JSON member order
// and number formatting are part of it, and `reason` stays inside it because it is user-visible
// provenance. `layerOf` is render-only (src/core/model.ts:116) and is asserted absent instead of
// serialized. The engine version strings are literals here on purpose: a silent engine bump has to
// fail this matrix rather than be absorbed by importing the version constant from the engine.
export const F_DET_ENGINES=[['legacy-v1','0.1.0'],['groove-v2','0.2.0-groove.1'],['groove-v3','0.3.0-groove.3'],['groove-v4','0.4.0-groove.1'],['groove-v5','0.5.0-groove.1'],['groove-v5.1','0.5.1-groove.1']];
export const F_DET_SEEDS=['pre-v3-compatibility','a','break-042','sééd-ünicode'];
export const F_DET_GENRE='jungle';
export const F_DET_KNOBS=['variation','phraseLength','phraseOffset','breakStyle','enabledRoles','laneDensity','hitTarget','breakLayer','lpb'];
// The compatibility flavour, so an F-DET case and a compatibility case of the same engine and seed
// differ only in the knob under test.
export const F_DET_FLAVOR={bars:2,resolution:32,complexity:.73,spicy:.81,syncopation:.62,ghostAmount:.6,fillAmount:.76,swing:.57,humanizeMs:3};
const slug=seed=>seed.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();

const cases=[];
const add=(id,algorithm,seed,overrides,axes)=>cases.push({id,genre:F_DET_GENRE,algorithm,seed,overrides,axes});
for(const [algorithm] of F_DET_ENGINES)for(const seed of F_DET_SEEDS)add(`core-${algorithm}-${slug(seed)}`,algorithm,seed,{},['engine','seed']);
add('variation-zero','groove-v3','break-042',{variation:0},['variation']);
add('variation-max','groove-v3','break-042',{variation:1000000},['variation']);
add('phrase-4-at-0','groove-v3','a',{phraseLength:4,phraseOffset:0},['phraseLength','phraseOffset']);
add('phrase-16-at-15','groove-v3','a',{phraseLength:16,phraseOffset:15},['phraseLength','phraseOffset']);
add('phrase-8-at-3','groove-v5.1','a',{phraseLength:8,phraseOffset:3},['phraseLength','phraseOffset']);
add('breakstyle-genre','groove-v2','break-042',{breakStyle:'genre'},['breakStyle']);
add('breakstyle-amen','groove-v2','break-042',{breakStyle:'amen'},['breakStyle']);
add('breakstyle-hotPants','groove-v5','break-042',{breakStyle:'hotPants'},['breakStyle']);
add('roles-kick-snare','legacy-v1','break-042',{enabledRoles:['kick','snare']},['enabledRoles']);
add('roles-all','legacy-v1','break-042',{enabledRoles:['kick','snare','hat','percussion']},['enabledRoles']);
add('roles-empty','groove-v5','break-042',{enabledRoles:[]},['enabledRoles']);
add('density-floor','groove-v4','break-042',{laneDensity:{kick:0,snare:.5,hat:1,percussion:2}},['laneDensity']);
add('density-ceiling','groove-v4','break-042',{laneDensity:{kick:2,snare:1.75,hat:0,percussion:.25}},['laneDensity']);
// 10 is the engine's own floor ("Exact hits needs at least 10 notes for protected anchors..."), so the
// pair varies the target between its floor and a value the count can actually reach.
add('hittarget-floor','groove-v4','break-042',{hitTarget:10},['hitTarget']);
add('hittarget-40','groove-v4','break-042',{hitTarget:40},['hitTarget']);
add('breaklayer-off','groove-v3','break-042',{breakLayer:'off'},['breakLayer']);
add('breaklayer-think','groove-v3','break-042',{breakLayer:'think-passage2'},['breakLayer']);
add('lpb-12','groove-v5','break-042',{lpb:12},['lpb']);
add('lpb-8-in-7-8','groove-v5.1','break-042',{lpb:8,timeSignature:'7/8'},['lpb']);
add('lpb-4-in-5-8','groove-v5.1','sééd-ünicode',{lpb:4,timeSignature:'5/8'},['lpb']);
export const F_DET_CASES=cases;

export function fdetSettings(item){
  return {...defaults(item.genre??F_DET_GENRE),...F_DET_FLAVOR,algorithm:item.algorithm,seed:item.seed,...(item.overrides??{})};
}

// One digest per event field across the whole pattern: when the pinned whole-pattern hash moves,
// this names which musical field moved without storing every hit.
export function fdetFieldDigest(pattern,field){
  return hash(JSON.stringify(pattern.events.map(hit=>hit[field]??null)));
}
export function fdetFieldDigests(pattern){
  const fields=new Set();
  for(const hit of pattern.events)for(const key of Object.keys(hit))fields.add(key);
  const out={};
  for(const field of [...fields].sort())out[field]=fdetFieldDigest(pattern,field);
  return out;
}
const hitDigest=hit=>hash(JSON.stringify(hit));

// Locate drift against a captured case: which field moved, and the first event whose own digest no
// longer matches. Per-hit digests are stored truncated to 16 hex characters as a locator; the
// authoritative comparison stays the full whole-pattern sha256.
export function locateDrift(pattern,meta){
  const fields=Object.keys(meta.fieldDigests??{}).filter(field=>fdetFieldDigest(pattern,field)!==meta.fieldDigests[field]);
  if(pattern.events.length!==meta.eventCount)return {kind:'event-count',expected:meta.eventCount,actual:pattern.events.length,fields};
  if(hash(JSON.stringify(pattern))===meta.sha256)return null;
  const index=pattern.events.findIndex((hit,i)=>hitDigest(hit).slice(0,16)!==meta.hitDigests?.[i]);
  return {kind:'hit',index:index<0?null:index,fields,hit:index<0?null:pattern.events[index]};
}

// Compare two patterns generated in the same process (the property scripts/loop-generation-audit.mjs
// has always checked) and report the first divergent hit index and field instead of a bare boolean.
export function firstDivergence(reference,candidate){
  if(reference.events.length!==candidate.events.length)return {kind:'event-count',index:Math.min(reference.events.length,candidate.events.length),field:null,reference:reference.events.length,candidate:candidate.events.length};
  for(let index=0;index<reference.events.length;index++){
    const left=reference.events[index],right=candidate.events[index];
    for(const field of [...new Set([...Object.keys(left),...Object.keys(right)])]){
      const a=left[field]??null,b=right[field]??null;
      if(JSON.stringify(a)!==JSON.stringify(b))return {kind:'hit',index,field,reference:a,candidate:b,id:left.id??right.id??null};
    }
  }
  return null;
}

export function captureFdet(){
  return {cases:F_DET_CASES.map(item=>{
    const settings=fdetSettings(item);
    const pattern=generate(settings);
    return {id:item.id,axes:item.axes,genre:settings.genre,algorithm:item.algorithm,seed:settings.seed,engineVersion:pattern.engineVersion,ppq:pattern.ppq,eventCount:pattern.events.length,sha256:hash(JSON.stringify(pattern)),hitDigests:pattern.events.map(hit=>hitDigest(hit).slice(0,16)),fieldDigests:fdetFieldDigests(pattern),settings};
  })};
}
