import {BREAKS} from './breaks.js';
import {PPQ,ROLES,bounded,type Hit,type Pattern,type Role,type Settings} from './model.js';
import {random} from './random.js';
import {v5ProfileFor} from './groove-v5-baseline.js';
import type {V5AnchorMotif,V5BarPlan,V5Gesture,V5LayerNote,V5PhrasePlan,V5Profile} from './groove-v5-contract.js';

export const GROOVE_V5_VERSION='0.5.0-groove.1';
const BAR=PPQ*4,STEP=PPQ/4;
const round=(value:number)=>Math.round(value*10000)/10000;
const onset=(hit:Hit)=>hit.baseTick+hit.offsetTick;
const order=(a:Hit,b:Hit)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||a.id.localeCompare(b.id);
const enabled=(s:Settings,role:Role)=>!s.enabledRoles||s.enabledRoles.includes(role);
const density=(s:Settings,role:Role)=>s.laneDensity?.[role]??1;

/** Named, independent streams prevent one layer's changes from redrawing others. */
export function v5Chance(s:Settings,stage:string,key:string,withVariation=true):number {
 const variation=withVariation?s.variation??0:0;
 const phrase=withVariation&&s.phraseLength?`:${s.phraseLength}:${s.phraseOffset??0}`:'';
 return random(s.seed,`groove-v5:${s.genre}:${stage}:${variation}:${key}${phrase}`)();
}

const validId=(id:string)=>/^[a-zA-Z0-9._-]{1,80}$/.test(id);
const step=(value:number)=>Number.isFinite(value)&&value>=0&&value<16&&Number.isInteger(value*4);
/** Catch bad profile data at the boundary rather than producing broken audio. */
export function validateV5Profile(profile:V5Profile,genre:Settings['genre']):void {
 if(profile.genre!==genre||!profile.anchors.length||profile.anchors.length>32||profile.layers.length>128||profile.cadences.length>32)throw Error('Invalid Groove V5 profile.');
 const ids=new Set<string>();
 const identity=(id:string)=>{if(!validId(id)||ids.has(id))throw Error('Invalid Groove V5 profile ID.');ids.add(id);};
 for(const motif of profile.anchors){
  identity(motif.id);
  if(![1,2].includes(motif.bars)||!motif.notes.length||motif.notes.length>32)throw Error('Invalid Groove V5 anchor motif.');
  const positions=new Set<string>();
  for(const note of motif.notes){
   if(!Number.isInteger(note.bar)||note.bar<0||note.bar>=motif.bars||!step(note.step)||!['kick','snare'].includes(note.role))throw Error('Invalid Groove V5 anchor position.');
   bounded(note.gain,0,1,'Groove V5 anchor gain');
   const key=`${note.bar}:${note.step}:${note.role}`;
   if(positions.has(key))throw Error('Duplicate Groove V5 anchor.');positions.add(key);
  }
 }
 const checkNotes=(notes:readonly V5LayerNote[])=>{
  if(!notes.length||notes.length>64)throw Error('Invalid Groove V5 layer notes.');
  for(const note of notes){if(!step(note.step))throw Error('Invalid Groove V5 step.');bounded(note.gain,0,1,'Groove V5 gain');if(note.pan!==undefined)bounded(note.pan,-1,1,'Groove V5 pan');if(note.probability!==undefined)bounded(note.probability,0,1,'Groove V5 probability');}
 };
 for(const layer of profile.layers){identity(layer.id);if(!ROLES.includes(layer.role))throw Error('Invalid Groove V5 role.');bounded(layer.minimum,0,1,'Groove V5 layer minimum');if(layer.on?.some(value=>!['opening','continuation','response','turnaround'].includes(value)))throw Error('Invalid Groove V5 bar function.');checkNotes(layer.notes);}
 for(const cadence of profile.cadences){identity(cadence.id);if(!ROLES.includes(cadence.role))throw Error('Invalid Groove V5 cadence role.');bounded(cadence.minimum,0,1,'Groove V5 cadence minimum');checkNotes(cadence.notes);}
 for(const role of ROLES){const timing=profile.timing[role];if(!timing)throw Error('Missing Groove V5 timing.');bounded(timing.swing,0,1,'Groove V5 swing');bounded(timing.dragMs,-25,25,'Groove V5 drag');}
 const spice=profile.spice;
 if(!spice.gestures.length||spice.gestures.some(value=>!['roll','chop','reverse','pitch','push'].includes(value))||spice.roles.some(role=>!ROLES.includes(role)))throw Error('Invalid Groove V5 gestures.');
 bounded(spice.maxPerBar,0,16,'Groove V5 gesture budget',true);
 if(![2,3,4,6,8].includes(spice.maxRepeats))throw Error('Invalid Groove V5 repeat limit.');
 bounded(spice.minRepeatMs,10,100,'Groove V5 repeat gap');
 if(spice.pitchSteps.some(value=>!Number.isInteger(value)||value< -24||value>24))throw Error('Invalid Groove V5 pitch step.');
 bounded(profile.responseWeight,0,1,'Groove V5 response weight');
}

function motifFor(s:Settings,profile:V5Profile):V5AnchorMotif {
 const preset=s.breakStyle&&s.breakStyle!=='genre'?BREAKS[s.breakStyle]:undefined;
 if(preset){
  const index=Math.floor(v5Chance(s,'motif','break-preset',false)*preset.kicks.length);
  return {id:`break-${s.breakStyle}-${index}`,bars:1,notes:[
   ...preset.kicks[index]!.map(step=>({bar:0,step,role:'kick' as const,gain:step%4===0?.94:.8})),
   ...preset.snares.map(step=>({bar:0,step,role:'snare' as const,gain:.93}))]};
 }
 return profile.anchors[Math.floor(v5Chance(s,'motif','genre',false)*profile.anchors.length)]!;
}

/** Phrase position is explicit so one-bar requests can belong to a longer song. */
export function planV5Phrase(s:Settings,profile:V5Profile):V5PhrasePlan {
 const motif=motifFor(s,profile),length=s.phraseLength??s.bars;
 const bars:V5BarPlan[]=Array.from({length:s.bars},(_,bar)=>{
  const absoluteBar=(s.phraseOffset??0)+bar,phrasePosition=absoluteBar%length;
  const ending=phrasePosition===length-1;
  // A one-bar pattern is both an opening and an ending: keep its call while
  // still allowing an explicit cadence into the loop boundary.
  const functionName=phrasePosition===0?'opening':ending?'turnaround':phrasePosition%2===1?'response':'continuation';
  return {bar,absoluteBar,phrasePosition,function:functionName,ending,
   energy:round(.35+.45*phrasePosition/Math.max(1,length-1)+(functionName==='response'?.08:0))};
 });
 return {motifId:motif.id,bars};
}

/** Role pocket is shared by the core generator and editor operations. */
export function grooveV5Timing(hit:Hit,s:Settings,profile:V5Profile):void {
 const role=profile.timing[hit.role],offbeat=Number.isInteger(hit.baseTick/STEP)&&(hit.baseTick/STEP)%2===1;
 const swing=offbeat?(s.swing-.5)*2*STEP*role.swing:0;
 const human=hit.anchor?0:(v5Chance(s,'timing',hit.id,false)*2-1)*s.humanizeMs;
 const milliseconds=role.dragMs+(hit.ghost?-2:0)+human;
 hit.offsetTick=Math.max(-hit.baseTick,Math.min(s.bars*BAR-2-hit.baseTick,Math.round(swing+milliseconds*s.bpm*PPQ/60000)));
}

function makeHit(s:Settings,profile:V5Profile,role:Role,tick:number,gain:number,anchor:boolean,ghost:boolean,reason:string):Hit {
 const baseTick=Math.round(tick);
 const hit:Hit={id:`${role}-${baseTick}`,role,sourceId:`kit.${role}`,sourceKind:'oneShot',baseTick,offsetTick:0,
  gain:round(gain),pan:0,anchor,ghost,reason,articulation:{durationTicks:PPQ,mode:'natural',...(role==='hat'?{chokeGroup:'hat' as const}:{})}};
 grooveV5Timing(hit,s,profile);return hit;
}

interface State {s:Settings;profile:V5Profile;plan:V5PhrasePlan;motif:V5AnchorMotif;events:Map<string,Hit>}
function add(c:State,hit:Hit,optional:boolean):boolean {
 if(!enabled(c.s,hit.role)||hit.baseTick<0||hit.baseTick>=c.s.bars*BAR)return false;
 if(optional&&density(c.s,hit.role)<1&&v5Chance(c.s,'lane-density',hit.id)>=density(c.s,hit.role))return false;
 const key=`${hit.role}:${hit.baseTick}`;
 if(c.events.has(key))return false;
 c.events.set(key,hit);return true;
}
function spine(c:State):void {
 for(const bar of c.plan.bars)for(const note of c.motif.notes){
  if(note.bar!==bar.absoluteBar%c.motif.bars)continue;
  add(c,makeHit(c.s,c.profile,note.role,bar.bar*BAR+note.step*STEP,note.gain,true,false,
   `The ${c.profile.genre} ${c.motif.id} motif protects this recurring anchor.`),false);
 }
}
function layerNote(c:State,bar:V5BarPlan,id:string,role:Role,note:V5LayerNote):void {
 const s=c.s,key=`${id}:${bar.absoluteBar}:${note.step}`;
 if(note.probability!==undefined&&v5Chance(s,'layer-probability',key)>note.probability)return;
 if(note.ghost&&v5Chance(s,'ghost',key)>s.ghostAmount)return;
 if(note.syncopated&&v5Chance(s,'syncopation',key)>s.syncopation)return;
 const item=makeHit(s,c.profile,role,bar.bar*BAR+note.step*STEP,note.gain,false,!!note.ghost,
  `${id} places a ${role} ${bar.function} accent in the ${s.genre} phrase.`);
 item.pan=note.pan??0;add(c,item,true);
}
function layers(c:State):void {
 for(const bar of c.plan.bars)for(const layer of c.profile.layers){
  if(layer.on&&!layer.on.includes(bar.function))continue;
  const d=density(c.s,layer.role),complexity=d>1?1-(1-c.s.complexity)/d:c.s.complexity;
  if(complexity<layer.minimum)continue;
  for(const note of layer.notes)layerNote(c,bar,layer.id,layer.role,note);
 }
}
function cadences(c:State,forced=false):void {
 const s=c.s;
 for(const bar of c.plan.bars){
  if(forced?bar.bar!==s.bars-1:!bar.ending||s.fillAmount===0)continue;
  if(!forced&&v5Chance(s,'cadence',`${bar.absoluteBar}`)>s.fillAmount*c.profile.responseWeight)continue;
  for(const cadence of c.profile.cadences){
   const d=density(s,cadence.role),complexity=d>1?1-(1-s.complexity)/d:s.complexity;
   if(!forced&&complexity<cadence.minimum)continue;
   const count=forced?Math.max(1,Math.ceil(complexity*cadence.notes.length)):Math.max(1,Math.ceil((complexity-cadence.minimum)/(1-cadence.minimum||1)*cadence.notes.length));
   for(const note of cadence.notes.slice(0,count))layerNote(c,bar,`cadence-${cadence.id}`,cadence.role,note);
  }
 }
}
function nextOnset(c:State,item:Hit):number {
 return [...c.events.values()].filter(other=>other!==item&&other.role===item.role&&onset(other)>onset(item))
  .reduce((minimum,other)=>Math.min(minimum,onset(other)),c.s.bars*BAR);
}
function articulate(c:State,item:Hit,kind:'roll'|'chop',amount:number):boolean {
 const limit=Math.min(PPQ/2,nextOnset(c,item)-onset(item)-2,c.s.bars*BAR-onset(item)-2);
 const wanted=amount<.4?2:amount<.75?3:c.profile.spice.maxRepeats;
 const count=[8,6,4,3,2].find(value=>value<=wanted&&value<=c.profile.spice.maxRepeats&&limit/value*60000/c.s.bpm/PPQ>=c.profile.spice.minRepeatMs);
 if(!count||limit<STEP/2)return false;
 const repeats=Array.from({length:count},(_,index)=>({gain:round(.55+.45*index/(count-1)),
  ...(kind==='chop'?{sourceOffset:round(index/count*.75)}:{})}));
 const energy=Math.sqrt(repeats.reduce((sum,repeat)=>sum+repeat.gain*repeat.gain,0));
 for(const repeat of repeats)repeat.gain=round(repeat.gain/Math.max(1,energy));
 item.articulation={durationTicks:Math.floor(limit),mode:kind==='chop'?'chop':'gate',repeats,
  ...(item.role==='hat'?{chokeGroup:'hat' as const}:{})};
 item.ratchets=count;item.gate=.86;return true;
}
function resolvingRoll(c:State,build:boolean):void {
 const role=enabled(c.s,'snare')?'snare':c.profile.cadences.find(value=>enabled(c.s,value.role))?.role;
 if(!role)return;
 const start=build?0:c.s.bars*BAR-2*PPQ;
 for(let tick=start;tick<c.s.bars*BAR;tick+=PPQ/2){
  const item=makeHit(c.s,c.profile,role,tick,.3+.45*(tick-start)/Math.max(1,c.s.bars*BAR-start),false,false,
   `A ${c.s.genre} roll rises toward the next downbeat.`);
  if(add(c,item,true)){item.id+='-roll';articulate(c,item,'roll',Math.max(.4,c.s.spicy??0));}
 }
}
const thresholds:Record<V5Gesture,number>={roll:0,chop:.65,reverse:.55,pitch:.35,push:0};
function spice(c:State):void {
 const s=c.s,amount=s.spicy??0,policy=c.profile.spice;
 if(amount<=0)return;
 for(const bar of c.plan.bars){
  const begin=bar.bar*BAR,end=begin+BAR;
  const candidates=[...c.events.values()].filter(hit=>!hit.anchor&&!hit.id.endsWith('-roll')&&policy.roles.includes(hit.role)&&onset(hit)>=begin&&onset(hit)<end);
  candidates.sort((a,b)=>{
   const rank=(hit:Hit)=>((hit.baseTick-begin)>=3*PPQ?.5:0)+(hit.ghost?.15:0)+v5Chance(s,'spice-rank',hit.id);
   return rank(b)-rank(a)||order(a,b);
  });
  const budget=Math.min(candidates.length,Math.ceil(amount*policy.maxPerBar));
  for(const item of candidates.slice(0,budget)){
   const allowed=policy.gestures.filter(gesture=>amount>=thresholds[gesture]);
   if(!allowed.length)continue;
   const gesture=allowed[Math.floor(v5Chance(s,'spice-type',item.id)*allowed.length)]!;
   if(gesture==='roll'||gesture==='chop'){
    if(articulate(c,item,gesture,amount))item.reason+=gesture==='roll'?' A bounded velocity roll adds motion.':' A short source-offset chop adds motion.';
   }else if(gesture==='reverse'){
    item.reverse=true;item.reason+=' A secondary accent reverses.';
   }else if(gesture==='pitch'){
    const choices=policy.pitchSteps.filter(value=>value!==0);
    if(choices.length)item.pitch=choices[Math.floor(v5Chance(s,'spice-pitch',item.id)*choices.length)]!;
   }else{
    const shift=(v5Chance(s,'spice-direction',item.id)>.5?1:-1)*(8+Math.round(amount*22))*s.bpm*PPQ/60000;
    const offset=Math.max(-item.baseTick,Math.min(s.bars*BAR-2-item.baseTick,item.offsetTick+Math.round(shift)));
    if(![...c.events.values()].some(other=>other!==item&&other.anchor&&other.role===item.role&&Math.abs(onset(other)-(item.baseTick+offset))<STEP/3))item.offsetTick=offset;
   }
  }
 }
}

/** The profile is injected for tests and tuning; the registry supplies production defaults. */
export function generateGrooveV5(settings:Settings,profile:V5Profile=v5ProfileFor(settings.genre)):Pattern {
 validateV5Profile(profile,settings.genre);
 const s:Settings={...settings,algorithm:'groove-v5'},motif=motifFor(s,profile),plan=planV5Phrase(s,profile);
 const c:State={s,profile,plan,motif,events:new Map()};
 spine(c);layers(c);
 const structure=s.patternStructure??'auto';
 if(structure==='auto')cadences(c);
 else if(structure==='fill'||structure==='roll'||structure==='build'){
  const start=structure==='build'?0:s.bars*BAR-2*PPQ;
  for(const [key,item] of c.events)if(!item.anchor&&onset(item)>=start)c.events.delete(key);
  if(structure==='fill')cadences(c,true);else resolvingRoll(c,structure==='build');
 }
 spice(c);
 const events=[...c.events.values()].sort(order);
 if(s.breakStyle&&s.breakStyle!=='genre')for(const item of events)item.reason=BREAKS[s.breakStyle].name+' rhythm interpretation: '+item.reason;
 return {engineVersion:GROOVE_V5_VERSION,ppq:PPQ,settings:s,events};
}

/** Selected-row fills reuse V5's cadence vocabulary without moving anchors. */
export function grooveV5Fill(s:Settings,startTick:number,endTick:number,profile:V5Profile=v5ProfileFor(s.genre)):Hit[] {
 validateV5Profile(profile,s.genre);
 const start=Math.max(0,Math.ceil(startTick)),end=Math.min(s.bars*BAR,Math.floor(endTick));
 if(end-start<2)return [];
 const span=Math.min(2*PPQ,end-start),origin=end-span,hits=new Map<string,Hit>();
 for(const cadence of profile.cadences){
  if(!enabled(s,cadence.role))continue;
  for(const [index,note] of cadence.notes.entries()){
   if(index>=Math.max(1,Math.ceil(s.complexity*cadence.notes.length)))break;
   const tick=origin+Math.round((note.step-10)/6*span);
   if(tick<start||tick>=end)continue;
   const item=makeHit(s,profile,cadence.role,tick,note.gain,false,!!note.ghost,
    `A ${s.genre} cadence resolves the selected ending.`);
   item.offsetTick=Math.max(start-item.baseTick,Math.min(end-2-item.baseTick,item.offsetTick));
   item.articulation!.durationTicks=Math.min(item.articulation!.durationTicks,end-onset(item));
   if(density(s,item.role)>=1||v5Chance(s,'fill-density',item.id)<density(s,item.role))hits.set(`${item.role}:${item.baseTick}`,item);
  }
 }
 return [...hits.values()].sort(order);
}
