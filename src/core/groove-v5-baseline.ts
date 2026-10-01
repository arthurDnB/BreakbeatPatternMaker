import {V3_RULES} from './groove-v3-profiles.js';
import {V4_PROFILES} from './groove-v4-profiles.js';
import {ROLES,type Genre,type Role} from './model.js';
import type {V5Profile,V5Layer,V5Timing} from './groove-v5-contract.js';
import {V5_PROFILE_OVERRIDES} from './groove-v5-profiles.js';

/** A compatibility fixture for untuned genres, not a claim of finished V5 profiles. */
export function baselineV5Profile(genre:Genre):V5Profile {
 const rule=V3_RULES[genre],v4=V4_PROFILES[genre];
 const timing=Object.fromEntries(ROLES.map(role=>[role,{
  swing:role==='hat'?rule.hatSwing:role==='percussion'?rule.percussionSwing:role==='snare'?.5:0,
  dragMs:role==='snare'?rule.snareDragMs:role==='kick'?0:role==='hat'?0:-rule.ghostPushMs
 } satisfies V5Timing])) as Record<Role,V5Timing>;
 const layers:V5Layer[]=[
  {id:'pulse',role:'hat',minimum:0,notes:rule.hats.map((step,index)=>({step,gain:rule.accents[index%4]??.3,probability:v4.pulseDensity}))},
  {id:'hat-detail',role:'hat',minimum:.35,notes:rule.hatDetails.map(step=>({step,gain:.22,probability:rule.activity*.8}))},
  {id:'ghosts',role:'snare',minimum:.3,notes:rule.ghosts.map(step=>({step,gain:rule.ghostGain,ghost:true,probability:.8}))},
  {id:'pickup',role:'kick',minimum:.45,notes:rule.pickups.map(step=>({step,gain:.53,syncopated:true,probability:.7}))},
  {id:'percussion',role:'percussion',minimum:.42,notes:rule.percussion.map(step=>({step,gain:.3,probability:rule.activity}))},
  ...v4.call.map((note,index)=>({id:`call-${index}`,role:note.role,minimum:note.depth,on:['opening','continuation'] as const,notes:[{step:note.step,gain:note.gain,ghost:note.ghost}]})),
  ...v4.answer.map((note,index)=>({id:`response-${index}`,role:note.role,minimum:note.depth,on:['response','turnaround'] as const,notes:[{step:note.step,gain:note.gain,ghost:note.ghost}]}))
 ];
 return {genre,
  anchors:rule.kicks.map((kicks,index)=>({id:`baseline-${index}`,bars:1 as const,notes:[...kicks.map(step=>({bar:0,step,role:'kick' as const,gain:step%4===0?.94:.8})),...(rule.snareMotifs?.[index%rule.snareMotifs.length]??rule.snares).map(step=>({bar:0,step,role:'snare' as const,gain:.93}))]})),
  layers:layers.filter(layer=>layer.notes.length>0),cadences:[{id:'baseline-turnaround',role:v4.fillRole,minimum:.25,notes:v4.fillSteps.map((step,index)=>({step,gain:.28+.35*(index+1)/v4.fillSteps.length}))}],
  timing,spice:{gestures:v4.gestures,roles:['snare','hat','percussion'],maxPerBar:v4.gestureBudget,maxRepeats:rule.maxRepeats,minRepeatMs:rule.family==='jungle'||rule.family==='experimental'?18:22,pitchSteps:rule.pitchSteps},
  responseWeight:v4.responseWeight};
}

export function v5ProfileFor(genre:Genre):V5Profile{return V5_PROFILE_OVERRIDES[genre]??baselineV5Profile(genre);}
