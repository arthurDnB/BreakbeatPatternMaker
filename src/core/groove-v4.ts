import {BREAKS} from './breaks.js';
import {PPQ,ROLES,type Hit,type Pattern,type Role,type Settings} from './model.js';
import {random} from './random.js';
import {V3_RULES} from './groove-v3-profiles.js';
import {euclideanSteps} from './groove-v3-primitives.js';
import {phrasePosition} from './groove-v3-development.js';
import {V4_PROFILES,type V4Gesture,type V4Profile,type V4Note} from './groove-v4-profiles.js';

export const GROOVE_V4_VERSION='0.4.0-groove.1';
const BAR=PPQ*4,STEP=PPQ/4;
const round=(n:number)=>Math.round(n*10000)/10000;
const actual=(h:Hit)=>h.baseTick+h.offsetTick;
const active=(s:Settings,role:Role)=>!s.enabledRoles||s.enabledRoles.includes(role);
const density=(s:Settings,role:Role)=>s.laneDensity?.[role]??1;
const detail=(s:Settings,role:Role)=>{const d=density(s,role);return d>1?1-(1-s.complexity)/d:s.complexity;};
const probability=(s:Settings,role:Role,value:number)=>Math.min(1,value*Math.max(1,density(s,role)));
const order=(a:Hit,b:Hit)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||a.id.localeCompare(b.id);

/** Separate named streams keep a changed layer from perturbing the spine or another layer. */
export function v4Chance(s:Settings,stage:string,key:string,variation=true):number {
 return random(s.seed,`groove-v4:${s.genre}:${stage}:${variation?s.variation??0:0}:${key}${variation&&s.phraseLength?`:phrase-${s.phraseOffset??0}`:''}`)();
}
function pick<T>(items:readonly T[],s:Settings,stage:string,key:string,variation=true):T {
 if(!items.length)throw Error('A Groove V4 choice needs at least one item.');
 return items[Math.floor(v4Chance(s,stage,key,variation)*items.length)]!;
}

/** Timing follows a genre's pocket while keeping every onset within its pattern. */
export function grooveV4Timing(hit:Hit,s:Settings):void {
 const rule=V3_RULES[s.genre];
 const swingRole=hit.role==='hat'?rule.hatSwing:hit.role==='percussion'?rule.percussionSwing:hit.ghost?.5:0;
 const sixteenth=hit.baseTick/STEP;
 const swing=Number.isInteger(sixteenth)&&sixteenth%2===1?(s.swing-.5)*2*STEP*swingRole:0;
 const pocket=hit.role==='snare'&&!hit.ghost?rule.snareDragMs:hit.ghost?-rule.ghostPushMs:hit.role==='kick'&&!hit.anchor?-1.5:0;
 const humanize=(v4Chance(s,'timing',hit.id,false)*2-1)*s.humanizeMs*(hit.anchor?.12:1);
 hit.offsetTick=Math.max(-hit.baseTick,Math.min(BAR*s.bars-2-hit.baseTick,PPQ,Math.max(-PPQ,Math.round(swing+(pocket+humanize)*s.bpm*PPQ/60000))));
}
function hit(s:Settings,role:Role,tick:number,gain:number,anchor:boolean,ghost:boolean,reason:string):Hit {
 const baseTick=Math.round(tick);
 const result:Hit={id:`${role}-${baseTick}`,role,sourceId:'kit.'+role,sourceKind:'oneShot',baseTick,offsetTick:0,gain:round(gain),pan:0,anchor,ghost,reason,
  articulation:{durationTicks:PPQ,mode:'natural',...(role==='hat'?{chokeGroup:'hat' as const}:{})}};
 grooveV4Timing(result,s);return result;
}
interface State {settings:Settings;profile:V4Profile;events:Map<string,Hit>;add:(item:Hit)=>boolean}
function state(settings:Settings):State {
 const profile=V4_PROFILES[settings.genre],events=new Map<string,Hit>();
 const add=(item:Hit)=>{
  if(!active(settings,item.role)||item.baseTick<0||item.baseTick>=settings.bars*BAR)return false;
  if(!item.anchor&&density(settings,item.role)<1&&v4Chance(settings,'lane-density',item.id)>=density(settings,item.role))return false;
  const key=`${item.role}:${item.baseTick}`;
  if(events.has(key))return false;
  events.set(key,item);return true;
 };
 return {settings,profile,events,add};
}

/** Stage 1: the recurring, seed-selected kick/snare phrase. Variation does not redraw it. */
function spine(c:State):void {
 const s=c.settings,rule=V3_RULES[s.genre],recipe=s.breakStyle&&s.breakStyle!=='genre'?BREAKS[s.breakStyle]:undefined;
 const kicks=pick(recipe?.kicks??rule.kicks,s,'spine','kick',false);
 const snares=recipe?.snares??(rule.snareMotifs?pick(rule.snareMotifs,s,'spine','snare',false):rule.snares);
 for(let bar=0;bar<s.bars;bar++){
  for(const step of kicks)c.add(hit(s,'kick',bar*BAR+step*STEP,step%4===0?.94:.8,true,false,'A protected kick defines the recurring '+s.genre+' motif.'));
  for(const step of snares)c.add(hit(s,'snare',bar*BAR+step*STEP,step===8?.94:step===4?.89:.93,true,false,'A protected backbeat defines the recurring '+s.genre+' motif.'));
 }
}
function addSignature(c:State,bar:number,note:V4Note,response:boolean):void {
 const s=c.settings;
 if(detail(s,note.role)<note.depth||(note.ghost&&s.ghostAmount===0))return;
 if(note.ghost&&v4Chance(s,'signature-ghost',`${bar}:${note.step}:${note.role}`)>probability(s,note.role,s.ghostAmount))return;
 const item=hit(s,note.role,bar*BAR+note.step*STEP,note.gain,false,!!note.ghost,
  `A ${response?'response':'call'} accent develops the ${s.genre} phrase at ${Math.round(note.depth*100)}% complexity.`);
 c.add(item);
}

/** Stage 2/3: pulse, progressive subdivisions, and coordinated counter-rhythms. */
function layers(c:State):void {
 const s=c.settings,rule=V3_RULES[s.genre],profile=c.profile;
 for(let bar=0;bar<s.bars;bar++){
  const origin=bar*BAR,phase=phrasePosition(s,bar),response=phase.response;
  const spacious=!!rule.spaciousCall&&!response;
  for(const [index,step] of rule.hats.entries()){
   if(spacious&&index%2)continue;
   if(index%2&&detail(s,'hat')<.22+.65*v4Chance(s,'pulse-depth',`${bar}:${step}`))continue;
   if(v4Chance(s,'pulse-density',`${bar}:${step}`)>probability(s,'hat',profile.pulseDensity))continue;
   const item=hit(s,'hat',origin+step*STEP,rule.accents[step%4]??.28,false,false,'The hat pulse makes the underlying meter audible.');
   item.decay=step%2?.45:.72;c.add(item);
  }
  for(const step of rule.hatDetails){
   if(detail(s,'hat')<.18+.78*v4Chance(s,'hat-depth',`${bar}:${step}`))continue;
   if(v4Chance(s,'hat-density',`${bar}:${step}`)>probability(s,'hat',rule.activity*(spacious?.55:1)))continue;
   const item=hit(s,'hat',origin+step*STEP,(rule.accents[step%4]??.28)*.7,false,false,'A softer subdivision adds detail without replacing the pulse.');
   item.decay=.44;c.add(item);
  }
  const motif=response?profile.answer:profile.call;
  for(const note of motif)addSignature(c,bar,note,response);
  for(const step of rule.pickups){
   if(detail(s,'kick')<.36+.54*v4Chance(s,'pickup-depth',`${bar}:${step}`)||v4Chance(s,'pickup-sync',`${bar}:${step}`)>probability(s,'kick',s.syncopation*(response?1:.65)))continue;
   c.add(hit(s,'kick',origin+step*STEP,.53,false,false,'A quiet kick pickup answers the main motif.'));
  }
  for(const step of rule.ghosts){
   if(detail(s,'snare')<.2+.65*v4Chance(s,'ghost-depth',`${bar}:${step}`)||v4Chance(s,'ghost-amount',`${bar}:${step}`)>probability(s,'snare',s.ghostAmount))continue;
   c.add(hit(s,'snare',origin+step*STEP,rule.ghostGain*(.8+.35*v4Chance(s,'ghost-gain',`${bar}:${step}`)),false,true,'A lower-velocity ghost snare leads into the main backbeat.'));
  }
  for(const step of rule.percussion){
   if(detail(s,'percussion')<.28+.6*v4Chance(s,'percussion-depth',`${bar}:${step}`)||v4Chance(s,'percussion-density',`${bar}:${step}`)>probability(s,'percussion',rule.activity*(response?1:.7)))continue;
   const item=hit(s,'percussion',origin+step*STEP,rule.melodicPercussion?.46:.31,false,false,'Secondary percussion answers the primary drums.');
   if(rule.melodicPercussion)item.pitch=[0,3,7,10][bar%4]!;
   c.add(item);
  }
  if(rule.euclidean&&detail(s,'percussion')>.66){
   const [pulses,steps,rotation]=rule.euclidean;
   for(const i of euclideanSteps(pulses,steps,rotation)){
    if(v4Chance(s,'cross-density',`${bar}:${i}`)>probability(s,'percussion',s.complexity*.65))continue;
    const tick=origin+Math.round(i*BAR/steps);
    if([...c.events.values()].some(e=>e.anchor&&Math.abs(e.baseTick-tick)<STEP/2))continue;
    const item=hit(s,'percussion',tick,.23,false,false,`A supporting ${pulses}-in-${steps} rhythm crosses the bar without moving its anchors.`);
    item.pan=i%2?.14:-.14;c.add(item);
   }
  }
 }
}

/** Stage 4: cadence choices are controlled by phrase context and Fill Amount. */
function cadence(c:State,forced=false):void {
 const s=c.settings,profile=c.profile;
 if(!forced&&s.fillAmount===0)return;
 const finalBar=s.bars-1;
 for(let bar=0;bar<s.bars;bar++){
  const phase=phrasePosition(s,bar);
  if(!forced&&!phase.ending&&!phase.turnaround)continue;
  if(forced&&bar!==finalBar)continue;
  const strength=phase.ending?1:.4;
  if(!forced&&v4Chance(s,'cadence',String(phase.position))>s.fillAmount*profile.responseWeight*strength)continue;
  const count=forced?profile.fillSteps.length:Math.max(1,Math.ceil(detail(s,profile.fillRole)*profile.fillSteps.length));
  for(const [index,step] of profile.fillSteps.entries()){
   if(index>=count)break;
   const item=hit(s,profile.fillRole,bar*BAR+step*STEP,.25+.42*(index+1)/profile.fillSteps.length,false,false,
    `A ${s.genre} turnaround resolves into the next bar.`);
   c.add(item);
  }
 }
}

function roll(c:State,build:boolean):void {
 const s=c.settings,role=active(s,'snare')?'snare':c.profile.fillRole;
 if(!active(s,role))return;
 const start=build?0:s.bars*BAR-2*PPQ;
 for(let tick=start;tick<s.bars*BAR;tick+=PPQ/2){
  if(c.events.has(`${role}:${tick}`))continue;
  const item=hit(s,role,tick,.3+.48*(tick-start)/Math.max(1,s.bars*BAR-start),false,false,'A phrase-directed roll builds toward the next downbeat.');
  item.id+='-roll';
  const next=[...c.events.values()].filter(e=>e.role===role&&actual(e)>actual(item)).reduce((min,e)=>Math.min(min,actual(e)),s.bars*BAR);
  const span=Math.max(1,Math.floor(Math.min(PPQ/2-2,next-actual(item)-2,s.bars*BAR-actual(item)-2)));
  const wanted=(s.complexity<.35?2:s.complexity<.75?3:4)+((s.spicy??0)>.55?2:0);
  const minimumMs=role==='snare'?22:12;
  const count=[8,6,4,3,2,1].find(n=>n<=wanted&&n<=V3_RULES[s.genre].maxRepeats&&span/n*60000/s.bpm/PPQ>=minimumMs)!;
  const pitches=V3_RULES[s.genre].pitchSteps.filter(value=>value!==0);
  const repeats=Array.from({length:count},(_,i)=>({gain:round(count===1?1:.58+.42*i/(count-1)),
   ...((s.spicy??0)>.45&&i===count-1&&pitches.length?{pitch:pick(pitches,s,'roll-pitch',item.id)}:{})}));
  const energy=Math.sqrt(repeats.reduce((sum,r)=>sum+r.gain*r.gain,0));
  for(const repeat of repeats)repeat.gain=round(repeat.gain/Math.max(1,energy));
  item.articulation={durationTicks:span,mode:'gate',repeats};
  item.ratchets=count;item.gate=.9-.16*(s.spicy??0);
  c.add(item);
 }
}

/** Stage 5: Spicy articulates ornaments. Anchors are never selected or moved. */
function gestures(c:State):void {
 const s=c.settings,amount=s.spicy??0;
 if(amount<=0)return;
 const profile=c.profile;
 for(let bar=0;bar<s.bars;bar++){
  const begin=bar*BAR,end=begin+BAR;
  const candidates=[...c.events.values()].filter(e=>!e.anchor&&actual(e)>=begin&&actual(e)<end&&e.role!=='kick'&&!e.id.endsWith('-roll'));
  candidates.sort((a,b)=>{
   const rank=(e:Hit)=>((e.baseTick-begin)>=3*PPQ?.5:0)+(e.ghost?.15:0)+(e.baseTick%STEP?.12:0)+v4Chance(s,'gesture-rank',e.id);
   return rank(b)-rank(a)||order(a,b);
  });
  const budget=Math.min(candidates.length,Math.ceil(amount*profile.gestureBudget));
  for(let i=0;i<budget;i++){
   const item=candidates[i]!;
   const allowed=profile.gestures.filter(g=>amount>=({roll:0,push:0,pitch:.3,reverse:.5,chop:.65} satisfies Record<V4Gesture,number>)[g]);
   if(!allowed.length)continue;
   const gesture=allowed[(i+Math.floor(v4Chance(s,'gesture-type',item.id)*allowed.length))%allowed.length]!;
   if(gesture==='push'){
    const shift=(v4Chance(s,'gesture-direction',item.id)>.5?1:-1)*(12+Math.round(amount*24))*s.bpm*PPQ/60000;
    const offset=Math.max(-item.baseTick,Math.min(s.bars*BAR-2-item.baseTick,item.offsetTick+Math.round(shift)));
    if(![...c.events.values()].some(other=>other!==item&&other.anchor&&other.role===item.role&&Math.abs(actual(other)-(item.baseTick+offset))<STEP/3))item.offsetTick=offset;
    item.reason+=' A deliberate microtiming push changes the pocket.';
   }else if(gesture==='pitch'){
    const shifts=V3_RULES[s.genre].pitchSteps.filter(x=>x!==0);
    if(shifts.length)item.pitch=pick(shifts,s,'gesture-pitch',item.id);
    item.reason+=' Pitch movement marks a secondary accent.';
   }else if(gesture==='reverse'){
    item.reverse=true;item.reason+=' This secondary accent plays in reverse.';
   }else{
    const next=[...c.events.values()].filter(e=>e!==item&&e.role===item.role&&actual(e)>actual(item)).reduce((min,e)=>Math.min(min,actual(e)),s.bars*BAR);
    const span=Math.min(PPQ/2,next-actual(item)-2,s.bars*BAR-actual(item)-2);
    const minGapMs=item.role==='snare'?22:12;
    const minTicks=minGapMs*s.bpm*PPQ/60000;
    const wanted=amount<.35?2:amount<.6?3:amount<.85?4:V3_RULES[s.genre].maxRepeats;
    const count=[8,6,4,3,2].find(n=>n<=wanted&&span/n>=minTicks);
    if(!count||span<STEP/2)continue;
    const chop=gesture==='chop';
    const repeats=Array.from({length:count},(_,j)=>({gain:round(.52+.48*j/(count-1)),...(chop?{sourceOffset:round(j/count*.75)}:{})}));
    const energy=Math.sqrt(repeats.reduce((sum,r)=>sum+r.gain*r.gain,0));
    for(const repeat of repeats)repeat.gain=round(repeat.gain/Math.max(1,energy));
    item.ratchets=count;item.gate=.84;
    item.articulation={durationTicks:Math.floor(span),mode:chop?'chop':'gate',repeats,...(item.role==='hat'?{chokeGroup:'hat' as const}:{})};
    item.reason+=chop?' The sound is retriggered from successive source offsets.':' A short velocity-shaped retrigger adds motion before the next hit.';
   }
  }
 }
}

export function generateGrooveV4(settings:Settings):Pattern {
 const s:Settings={...settings,algorithm:'groove-v4'},c=state(s);
 spine(c);layers(c);
 const structure=s.patternStructure??'auto';
 if(structure==='auto')cadence(c);
 else if(structure==='fill'){
  const start=s.bars*BAR-2*PPQ;
  for(const [key,item] of c.events)if(!item.anchor&&actual(item)>=start)c.events.delete(key);
  cadence(c,true);
 }else if(structure==='roll'||structure==='build'){
  const start=structure==='build'?0:s.bars*BAR-2*PPQ;
  for(const [key,item] of c.events)if(!item.anchor&&actual(item)>=start)c.events.delete(key);
  roll(c,structure==='build');
 }
 gestures(c);
 const events=[...c.events.values()].sort(order);
 for(const item of events)if(s.breakStyle&&s.breakStyle!=='genre')item.reason=BREAKS[s.breakStyle].name+' rhythm interpretation: '+item.reason;
 return {engineVersion:GROOVE_V4_VERSION,ppq:PPQ,settings:s,events};
}

/** The editor's selected-row Fill command uses this same genre cadence grammar. */
export function grooveV4Fill(s:Settings,startTick:number,endTick:number):Hit[] {
 const start=Math.max(0,Math.ceil(startTick)),end=Math.min(s.bars*BAR,Math.floor(endTick));
 if(end-start<2)return [];
 const profile=V4_PROFILES[s.genre],span=Math.min(2*PPQ,end-start),origin=end-span;
 return profile.fillSteps.slice(0,Math.max(1,Math.ceil(detail(s,profile.fillRole)*profile.fillSteps.length))).map((step,index)=>{
  // Profile positions occupy the final 10–16 sixteenths. Scale that phrase
  // into any selected ending, including a single beat, without dropping notes.
  const tick=origin+Math.round((step-10)/6*span);
  const item=hit(s,profile.fillRole,tick,.28+.4*(index+1)/profile.fillSteps.length,false,false,`A ${s.genre} fill resolves the selected ending.`);
  item.offsetTick=Math.max(start-item.baseTick,Math.min(end-2-item.baseTick,item.offsetTick));
  item.articulation!.durationTicks=Math.min(item.articulation!.durationTicks,end-actual(item));
  return item;
 }).filter(item=>active(s,item.role)&&item.baseTick>=start&&item.baseTick<end&&(density(s,item.role)>=1||v4Chance(s,'lane-density',item.id)<density(s,item.role))).sort(order);
}
