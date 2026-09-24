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
 const pushKick=(hit.role==='kick'&&!hit.anchor&&step%2===1)?-3*s.bpm*PPQ/60000:0;
 const ghostDrag=(hit.ghost&&(step===3||step===11||step===15))?2.5*s.bpm*PPQ/60000:0;
 const jitter=(random(s.seed,'timing:'+hit.id)()*2-1)*(hit.anchor?Math.min(1,s.humanizeMs):s.humanizeMs)*s.bpm*PPQ/60000;
 hit.offsetTick=Math.round(Math.max(-hit.baseTick,Math.min(s.bars*BAR-1-hit.baseTick,swing+late+pushKick+ghostDrag+jitter)));
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
 const kicksPool=breakRecipe?profile.kicks:(rule.kicks??profile.kicks);
 const motifCount=kicksPool.length;
 const baseMotif=Math.floor(random(s.seed,'motif')()*motifCount);
 const motif=kicksPool[(baseMotif + (s.variation??0)) % motifCount]!;
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
  for(const step of motif){
   const isDownbeat=step===0;
   const isAnchor=isDownbeat||(!!profile.fourFloor&&step%4===0)||(s.genre==='dub'&&step===8);
   const kickGain=isDownbeat?.94:.78;
   add('kick',origin+step*240,kickGain,isAnchor,false,s.genre==='dub'?'The one-drop kick leaves space on beat 1.':isDownbeat?'The downbeat kick anchors the recurring motif.':'This kick belongs to the recurring core motif.');
  }
  const snares=!breakRecipe&&s.genre==='drill'&&response?[8,14]:profile.snares??[4,12];
  for(const step of snares){
   const snareGain=step===4?.88:.94;
   add('snare',origin+step*240,snareGain,true,false,step===8?'The beat-3 snare anchors a half-time or one-drop groove.':'The main snare anchors the phrase.');
  }
  if(s.complexity>.25&&(rule.family==='Jungle & DnB'||rule.family==='Breaks & Rave'||rule.family==='Experimental'||rule.family==='Garage')){
   if(chance(s,'snare-push:'+bar)<s.syncopation*(response?.7:.42)*s.complexity){
    const pushStep=(s.genre==='footworkjungle'||s.genre==='idm')?10:11;
    add('snare',origin+pushStep*240,.8,false,false,'An anticipated snare push drives the syncopated breakbeat pulse.');
   }
   if(response&&s.complexity>.5&&chance(s,'snare-double:'+bar)<s.syncopation*.45){
    add('snare',origin+14*240,.72,false,false,'A syncopated snare bounce responds to beat 4.');
   }
  }
  const hats=profile.hatSteps??Array.from({length:16/profile.hats},(_,i)=>i*profile.hats);
  for(const step of hats){
   // Atmospheric breakcore deliberately leaves breathing room before its response bar.
   if(s.genre==='atmosphericbreakcore'&&!response&&step%4!==0)continue;
   const gain=rule.accent[step%4]!*(response?1:.96);
   add('hat',origin+step*240,gain,false,false,'A recurring hat accent defines the pulse; quieter hits leave room for the backbeat.');
  }
  if(response){
   const answerPool=rule.response;
   const answerIndex=(Math.floor(random(s.seed,'answer:'+bar)()*answerPool.length) + (s.variation??0)) % answerPool.length;
   const answer=answerPool[answerIndex]!;
   if(chance(s,'answer-enabled:'+bar)<Math.min(0.9, s.syncopation*1.35))add('kick',origin+answer*240,.64,false,false,'This response-bar kick answers the original motif.');
  }
  for(let step=0;step<16;step++){
   if(!hats.includes(step)&&chance(s,'hat:'+bar+':'+step)<s.complexity*Math.max(0.35, rule.detail*1.4))
    add('hat',origin+step*240,.22+(step%4===2?.08:0),false,false,'A quiet subdivision adds detail between the main hat accents.');
  }
  for(const step of rule.kickExtras){
   if(chance(s,'kick:'+bar+':'+step)<s.complexity*(0.25+s.syncopation*0.45))
    add('kick',origin+step*240,.54,false,false,'A quiet syncopated pickup supports the recurring kick motif.');
  }
  for(const step of profile.ghosts){
   const ghostThreshold=Math.max(s.ghostAmount, s.complexity*0.45);
   if(chance(s,'ghost:'+bar+':'+step)<ghostThreshold){
    const roll=chance(s,'ghost-tier:'+bar+':'+step);
    const isDrag=(step===3||step===11||step===15);
    const ghostGain=isDrag&&roll>.55?rule.ghostLevel*(1.3+.3*roll):roll>.35?rule.ghostLevel*(.95+.25*roll):rule.ghostLevel*(.65+.2*roll);
    add('snare',origin+step*240,Math.min(.65,ghostGain),false,true,'This quiet ghost snare connects the backbeats without replacing them.');
   }
  }
  for(const step of profile.percussion??rule.response){
   if(chance(s,'perc:'+bar+':'+step)<s.complexity*(response?.95:.6))
    add('percussion',origin+step*240,.3+(response?.08:0),false,false,'Percussion answers the main drums, with stronger responses in alternating bars.');
  }
 }
 // Fills are phrase endings, not automatic rolls at the end of every bar.
 if(chance(s,'fill-enabled')<s.fillAmount*profile.fill){
  for(const hit of grooveFill(s,s.bars*BAR-PPQ,s.bars*BAR))add(hit.role,hit.baseTick,hit.gain,hit.anchor,hit.ghost,hit.reason);
 }
 const events=[...hits.values()].sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
 for(const hit of events){
  grooveTiming(hit,s);
  if(hit.role==='hat'){
   const step=Math.floor(hit.baseTick/240)%16;
   if(step%4===0||(profile.hats===4&&step%2===0)){
    hit.decay=.85+.15*chance(s,'hat-decay:'+hit.id);
   }else if(step%2===1){
    hit.decay=.26+.18*chance(s,'hat-decay:'+hit.id);
   }else{
    hit.decay=.55+.2*chance(s,'hat-decay:'+hit.id);
   }
   const bar=Math.floor(hit.baseTick/BAR);
   if(bar===s.bars-1&&step>=12)hit.gain=Math.min(1,hit.gain*1.12);
  }
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
  if(chance(s,'burst:'+hit.id)>=(s.spicy??0)*0.9)continue;
  bursts.set(bar,(bursts.get(bar)??0)+1);
  const pool=(s.spicy??0)>.75?[2,3,4,6,8]:(s.spicy??0)>.4?[2,3,4]:[2];
  const validPool=pool.filter(r=>r<=rule.maxRatchet);
  hit.ratchets=validPool[Math.floor(chance(s,'ratchet:'+hit.id)*validPool.length)]??2;
  hit.gate=(s.spicy??0)>.6?(chance(s,'gate:'+hit.id)>.5?.5:.75):(rule.family==='Experimental'?.55:.8);
  hit.reason+=' A bounded ×'+hit.ratchets+' burst marks the phrase response.';
  if(chance(s,'reverse:'+hit.id)<Math.max(rule.reverse,0.15)*(s.spicy??0)){hit.reverse=true;hit.reason+=' This ornament plays in reverse.';}
  const pitchRange=Math.max(rule.pitch,3);
  if(rule.pitch>0&&hit.role!=='snare')hit.pitch=Math.round((chance(s,'pitch:'+hit.id)*2-1)*pitchRange);
 }
 if((s.spicy??0)>0){
  for(const hit of events){
   if(hit.anchor||hit.ratchets)continue;
   if((hit.role==='percussion'||hit.ghost||hit.role==='hat')&&chance(s,'reverse-ornament:'+hit.id)<Math.max(rule.reverse,0.2)*(s.spicy??0)*0.75){
    hit.reverse=true;
    hit.reason+=' (Spicy reverse ornament)';
   }
   if((hit.role==='hat'||hit.role==='percussion'||hit.ghost)&&chance(s,'pitch-roll:'+hit.id)<(s.spicy??0)*0.5&&hit.role!=='snare'){
    const pitchRange=Math.max(rule.pitch,3);
    const shift=Math.floor(chance(s,'pitch-val:'+hit.id)*(pitchRange*2+1))-pitchRange;
    if(shift!==0){
     hit.pitch=shift;
     hit.reason+=` (Spicy pitch ${shift>0?'+':''}${shift})`;
    }
   }
  }
 }
 return {engineVersion:GROOVE_VERSION,ppq:PPQ,settings:s,events};
}
