import {PPQ,ROLES,type Hit,type Pattern,type Role,type Settings} from './model.js';
import {PROFILES} from './profiles.js';
import {BREAKS} from './breaks.js';
import {GROOVES,FILL_PHRASES} from './groove-profiles.js';
import {random} from './random.js';

export const GROOVE_VERSION='0.2.0-groove.1';
const BAR=4*PPQ;
const chance=(s:Settings,key:string)=>random(s.seed+':v'+(s.variation??0),key)();
export function grooveTiming(hit:Hit,s:Settings){
 const rule=GROOVES[s.genre],step=Math.floor(hit.baseTick/240)%16;
 const amount=hit.role==='hat'?rule.hatSwing:hit.role==='percussion'?1:hit.ghost?.8:.25;
 const swing=step%2 ? (s.swing-.5)*480*amount : 0;
 const late=hit.role==='snare'?rule.lateSnareMs*s.bpm*PPQ/60000:0;
 const jitter=(random(s.seed,'timing:'+hit.id)()*2-1)*(hit.anchor?Math.min(1,s.humanizeMs):s.humanizeMs)*s.bpm*PPQ/60000;
 hit.offsetTick=Math.round(Math.max(-hit.baseTick,Math.min(s.bars*BAR-1-hit.baseTick,swing+late+jitter)));
}

/** Curated phrase endings, shared by Generate and the selected-row Fill action. */
export function grooveFill(s:Settings,start:number,end:number):Hit[]{
 const phrases=FILL_PHRASES[GROOVES[s.genre].fillStyle];
 const phrase=phrases[Math.floor(chance(s,'fill-choice')*phrases.length)]!;
 const grid=BAR/s.resolution,seen=new Set<string>();
 return phrase.flatMap((note,i)=>{
  if(s.enabledRoles&&!s.enabledRoles.includes(note.role))return [];
  const tick=Math.round((start+(note.step-12)/4*(end-start))/grid)*grid;
  const id=note.role+'-'+tick;
  if(tick<start||tick>=end||seen.has(id))return [];
  seen.add(id);
  const hit:Hit={id,role:note.role,sourceId:'kit.'+note.role,baseTick:tick,offsetTick:0,gain:note.gain,pan:0,anchor:false,ghost:note.role==='snare'&&note.gain<.3,reason:'A '+GROOVES[s.genre].fillStyle+' phrase-ending response leads back to the main motif.'};
  grooveTiming(hit,s);
  hit.offsetTick=Math.max(start-tick,Math.min(end-1-tick,hit.offsetTick));
  if(s.complexity>.75&&(s.spicy??0)>.5&&GROOVES[s.genre].maxBursts>0&&i===phrase.length-1){hit.ratchets=Math.min(2,GROOVES[s.genre].maxRatchet);hit.gate=.75;}
  return [hit];
 });
}

export function generateGroove(settings:Settings):Pattern{
 const s={...settings,algorithm:'groove-v2' as const},rule=GROOVES[s.genre];
 const breakRecipe=s.breakStyle&&s.breakStyle!=='genre'?BREAKS[s.breakStyle]:undefined;
 const profile=breakRecipe?{...PROFILES[s.genre],...breakRecipe,fourFloor:false}:PROFILES[s.genre];
 const motif=profile.kicks[Math.floor(random(s.seed,'motif')()*profile.kicks.length)]!;
 const hits=new Map<string,Hit>(),grid=BAR/s.resolution;
 const add=(role:Role,tick:number,gain:number,anchor:boolean,ghost:boolean,reason:string)=>{
  if(s.enabledRoles&&!s.enabledRoles.includes(role))return;
  const baseTick=Math.round(tick/grid)*grid,id=role+'-'+baseTick;
  if(baseTick<0||baseTick>=s.bars*BAR)return;
  const old=hits.get(id);
  if(old&&(old.anchor||(!anchor&&old.gain>=gain)))return;
  hits.set(id,{id,role,sourceId:'kit.'+role,baseTick,offsetTick:0,gain,pan:0,anchor,ghost,reason});
 };
 for(let bar=0;bar<s.bars;bar++){
  const origin=bar*BAR,response=bar%2===1;
  for(const step of motif)add('kick',origin+step*240,step===0?.9:.76,step===0||(!!profile.fourFloor&&step%4===0)||(s.genre==='dub'&&step===8),false,s.genre==='dub'?'The one-drop kick leaves space on beat 1.':step===0?'The downbeat kick anchors the recurring motif.':'This kick belongs to the recurring core motif.');
  const snares=!breakRecipe&&s.genre==='drill'&&response?[8,14]:profile.snares??[4,12];
  for(const step of snares)add('snare',origin+step*240,.9,true,false,step===8?'The beat-3 snare anchors a half-time or one-drop groove.':'The main snare anchors the phrase.');
  const hats=profile.hatSteps??Array.from({length:16/profile.hats},(_,i)=>i*profile.hats);
  for(const step of hats){
   // Atmospheric breakcore deliberately leaves breathing room before its response bar.
   if(s.genre==='atmosphericbreakcore'&&!response&&step%4!==0)continue;
   const gain=rule.accent[step%4]!*(response?1:.96);
   add('hat',origin+step*240,gain,false,false,'A recurring hat accent defines the pulse; quieter hits leave room for the backbeat.');
  }
  if(response){
   const answer=rule.response[Math.floor(random(s.seed,'answer:'+bar)()*rule.response.length)]!;
   if(chance(s,'answer-enabled:'+bar)<s.syncopation)add('kick',origin+answer*240,.62,false,false,'This response-bar kick answers the original motif.');
  }
  for(let step=0;step<16;step++){
   if(!hats.includes(step)&&chance(s,'hat:'+bar+':'+step)<s.complexity*rule.detail)
    add('hat',origin+step*240,.22+(step%4===2?.06:0),false,false,'A quiet subdivision adds detail between the main hat accents.');
  }
  for(const step of rule.kickExtras){
   if(chance(s,'kick:'+bar+':'+step)<s.complexity*s.syncopation*.22)
    add('kick',origin+step*240,.52,false,false,'A quiet syncopated pickup supports the recurring kick motif.');
  }
  for(const step of profile.ghosts){
   if(chance(s,'ghost:'+bar+':'+step)<s.ghostAmount)
    add('snare',origin+step*240,rule.ghostLevel*(.85+.3*chance(s,'ghost-level:'+bar+':'+step)),false,true,'This quiet ghost snare connects the backbeats without replacing them.');
  }
  for(const step of profile.percussion??rule.response){
   if(chance(s,'perc:'+bar+':'+step)<s.complexity*(response?.85:.5))
    add('percussion',origin+step*240,.28+(response?.06:0),false,false,'Percussion answers the main drums, with stronger responses in alternating bars.');
  }
 }
 // Fills are phrase endings, not automatic rolls at the end of every bar.
 if(chance(s,'fill-enabled')<s.fillAmount*profile.fill){
  for(const hit of grooveFill(s,s.bars*BAR-PPQ,s.bars*BAR))add(hit.role,hit.baseTick,hit.gain,hit.anchor,hit.ghost,hit.reason);
 }
 const events=[...hits.values()].sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
 for(const hit of events){
  grooveTiming(hit,s);
  if(!hit.anchor){
   hit.gain*=.94+.12*random(s.seed,'accent:'+hit.id)();
   if(s.humanizeMs)hit.gain*=.96+.08*random(s.seed,'humanize:'+hit.id)();
  }
  hit.gain=Math.round(Math.min(1,hit.gain)*10000)/10000;
  if(breakRecipe)hit.reason=breakRecipe.name+' interpretation: '+hit.reason;
 }
 const bursts=new Map<number,number>();
 const candidates=events.filter(h=>!h.anchor&&h.role!=='kick').sort((a,b)=>chance(s,'spice-rank:'+a.id)-chance(s,'spice-rank:'+b.id));
 for(const hit of candidates){
  const bar=Math.floor(hit.baseTick/BAR),local=hit.baseTick%BAR;
  const eligibleBar=bar===s.bars-1||(bar%2===1&&s.genre!=='atmosphericbreakcore');
  if(!eligibleBar||local<PPQ*3||(bursts.get(bar)??0)>=rule.maxBursts)continue;
  if(chance(s,'burst:'+hit.id)>=(s.spicy??0)*.85)continue;
  bursts.set(bar,(bursts.get(bar)??0)+1);
  const max=Math.min(rule.maxRatchet,(s.spicy??0)>.75?8:(s.spicy??0)>.4?4:2);
  hit.ratchets=max>2&&chance(s,'ratchet:'+hit.id)>.55?max:2;
  hit.gate=rule.family==='Experimental'?.55:.8;
  hit.reason+=' A bounded ×'+hit.ratchets+' burst marks the phrase response.';
  if(chance(s,'reverse:'+hit.id)<rule.reverse*(s.spicy??0)){hit.reverse=true;hit.reason+=' This ornament plays in reverse.';}
  if(rule.pitch>0&&hit.role!=='snare')hit.pitch=Math.round((chance(s,'pitch:'+hit.id)*2-1)*rule.pitch);
 }
 return {engineVersion:GROOVE_VERSION,ppq:PPQ,settings:s,events};
}
