import {PPQ,ROLES,type Hit,type Pattern,type Role,type Settings} from './model.js';
import {BREAKS} from './breaks.js';
import {V3_RULES,type V3Rule,type V3Cadence} from './groove-v3-profiles.js';
import {V3_BAR as BAR,V3_SIXTEENTH as STEP,euclideanSteps,v3Chance,v3LayerEnabled,v3Pick} from './groove-v3-primitives.js';

import {developmentFor,phrasePosition,SUPPORT,musicalSpans} from './groove-v3-development.js';

export const GROOVE_V3_VERSION='0.3.0-groove.2';
const rounded=(n:number)=>Math.round(n*10000)/10000;
const actual=(h:Hit)=>h.baseTick+h.offsetTick;
const compare=(a:Hit,b:Hit)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role);
const enabled=(s:Settings,role:Role)=>!s.enabledRoles||s.enabledRoles.includes(role);
const isResponse=(s:Settings,bar:number)=>phrasePosition(s,bar).response;

/** Stage 2: a selective groove map. Anchors are never randomized by variation/depth. */
export function grooveV3Timing(hit:Hit,s:Settings):void {
 const rule=V3_RULES[s.genre],sixteenth=hit.baseTick/STEP;
 const swingRole=hit.role==='hat'?rule.hatSwing:hit.role==='percussion'?rule.percussionSwing:hit.ghost?.5:0;
 // Apply swing only to exact offbeat sixteenths. Tuplets retain their own divisions.
 const swung=Number.isInteger(sixteenth)&&sixteenth%2===1?(s.swing-.5)*2*STEP*swingRole:0;
 const msToTick=s.bpm*PPQ/60000;
 const pocket=hit.role==='snare'&&!hit.ghost?rule.snareDragMs:hit.ghost?-rule.ghostPushMs:hit.role==='kick'&&!hit.anchor?-1.5:0;
 const humanize=(v3Chance(s,'timing',hit.id,false)*2-1)*s.humanizeMs*(hit.anchor?.12:1);
 const offset=Math.round(swung+(pocket+humanize)*msToTick);
 // Leave room for future onsets and prevent compile's 1/256-row rounding crossing the boundary.
 hit.offsetTick=Math.max(-hit.baseTick,Math.min(PPQ,BAR*s.bars-2-hit.baseTick,Math.max(-PPQ,offset)));
}

function createHit(s:Settings,role:Role,tick:number,gain:number,anchor:boolean,ghost:boolean,reason:string):Hit {
 const baseTick=Math.round(tick),hit:Hit={id:`${role}-${baseTick}`,role,sourceId:'kit.'+role,sourceKind:'oneShot',baseTick,offsetTick:0,gain:rounded(gain),pan:0,anchor,ghost,reason,
  articulation:{durationTicks:PPQ,mode:'natural',...(role==='hat'?{chokeGroup:'hat' as const}:{})}};
 grooveV3Timing(hit,s);
 return hit;
}

interface Context {s:Settings;rule:V3Rule;hits:Map<string,Hit>;add:(hit:Hit)=>boolean}
function context(s:Settings):Context {
 const rule=V3_RULES[s.genre],hits=new Map<string,Hit>();
 const add=(hit:Hit)=>{
  if(!enabled(s,hit.role)||hit.baseTick<0||hit.baseTick>=s.bars*BAR||hits.has(hit.id))return false;
  // Linear funk support uses one hand/foot voice per moment, retaining deliberate main accents.
  if(rule.linear&&!hit.anchor&&hit.role!=='hat'&&[...hits.values()].some(h=>h.baseTick===hit.baseTick&&h.role!=='hat'))return false;
  hits.set(hit.id,hit);return true;
 };
 return {s,rule,hits,add};
}

/** Stage 1: recurring seed-selected spine; break presets are rhythm interpretations. */
function anchors(c:Context):void {
 const {s,rule,add}=c,recipe=s.breakStyle&&s.breakStyle!=='genre'?BREAKS[s.breakStyle]:undefined;
 const motif=v3Pick(recipe?.kicks??rule.kicks,s,'spine','kick',false);
 const snares=recipe?.snares??(rule.snareMotifs?v3Pick(rule.snareMotifs,s,'spine','snare',false):rule.snares);
 for(let bar=0;bar<s.bars;bar++){
  for(const step of motif)add(createHit(s,'kick',bar*BAR+step*STEP,step%4===0?.94:.79,true,false,
   s.genre==='dub'&&!recipe?'The one-drop kick and snare meet on beat 3, leaving beat 1 open.':'This recurring kick belongs to the protected rhythmic spine.'));
  for(const step of snares)add(createHit(s,'snare',bar*BAR+step*STEP,step===8?.94:step===4?.88:.93,true,false,
   step===8?'The beat-3 backbeat establishes the half-time pulse.':[10,14].includes(step)?'This seed-selected displaced backbeat is part of the protected break motif, not a random fill.':'This protected backbeat gives the surrounding edits a stable reference.'));
 }
}

/** Stage 3: fixed pulse, then nested detail, ghosts and coordinated counter-rhythms. */
function layers(c:Context):void {
 const {s,rule,add,hits}=c,recipe=s.breakStyle&&s.breakStyle!=='genre'?BREAKS[s.breakStyle]:undefined;
 for(let bar=0;bar<s.bars;bar++){
  const origin=bar*BAR,response=isResponse(s,bar),callSpace=rule.spaciousCall&&!response;
  const pulse=callSpace?rule.hats.filter(step=>step%4===0):rule.hats;
  for(const step of pulse){
   const hit=createHit(s,'hat',origin+step*STEP,rule.accents[step%4]!,false,false,'A repeating hat accent carries the pulse between the main drums.');
   hit.decay=rule.family==='garage'&&step%4===2?.92:.68;
   add(hit);
  }
  const detailSteps=[...new Set([...rule.hatDetails,...(recipe?.hatSteps??[])])];
  for(const step of detailSteps){
   const key=`${bar}:${step}`;
   if(!v3LayerEnabled(s,'hats',key,callSpace?rule.activity*.4:rule.activity,.15))continue;
   const hit=createHit(s,'hat',origin+step*STEP,rule.accents[step%4]!*.68,false,false,'A quieter hat subdivision adds depth while the repeating pulse remains audible.');
   hit.decay=step%2===1?.35:.62;add(hit);
  }
  for(const step of rule.pickups){
   const key=`${bar}:${step}`;
   if(!v3LayerEnabled(s,'kick-answer',key,rule.activity*(response?1:.5),.4)||v3Chance(s,'syncopation',key)>=s.syncopation)continue;
   add(createHit(s,'kick',origin+step*STEP,.57,false,false,'This quieter kick pickup answers the recurring spine without moving its anchors.'));
  }
  for(const step of recipe?.ghosts??rule.ghosts){
   const key=`${bar}:${step}`;
   if(s.complexity<.12||v3Chance(s,'ghost-amount',key)>=s.ghostAmount||!v3LayerEnabled(s,'ghost-depth',key,callSpace?.7:1,.12))continue;
   const gain=rule.ghostGain*(.78+.4*v3Chance(s,'ghost-accent',key));
   add(createHit(s,'snare',origin+step*STEP,gain,false,true,'A quiet ghost snare pushes toward the next backbeat; its lower velocity preserves the main accent.'));
  }
  const percussion=recipe?.percussion.length?recipe.percussion:rule.percussion;
  for(const [i,step] of percussion.entries()){
   const key=`${bar}:${step}`;
   if(!v3LayerEnabled(s,'percussion',key,rule.activity*(response?1:.6),rule.melodicPercussion?.22:.32))continue;
   const hit=createHit(s,'percussion',origin+step*STEP,rule.melodicPercussion?.48:.3+(response?.07:0),false,false,
    rule.melodicPercussion?'A minor-pentatonic pitch interval connects the atmospheric percussion phrase; its key follows the loaded sound.':'A percussion response occupies space between the main kick and snare accents.');
   if(rule.melodicPercussion){
    const pitches=[[0,3,7,10],[7,10,12,7],[12,10,7,3],[3,0,-5,0]][bar%4]!;
    hit.pitch=pitches[i%4]!;hit.decay=.94;
   }
   add(hit);
  }
  if(rule.euclidean&&v3LayerEnabled(s,'cross-rhythm',String(bar),callSpace?.25:rule.activity,.65)){
   const [pulses,steps,rotation]=rule.euclidean;
   for(const index of euclideanSteps(pulses,steps,rotation)){
    const tick=origin+Math.round(index*BAR/steps);
    // Cross-rhythms are a supporting layer, never a replacement backbeat.
    if([...hits.values()].some(h=>h.anchor&&Math.abs(h.baseTick-tick)<STEP/2))continue;
    const hit=createHit(s,'percussion',tick,.24,false,false,`Supporting accents from a ${pulses}-in-${steps} Euclidean phrase reset at the bar boundary, leaving space around the anchors.`);
    hit.pan=(index%2?.16:-.16);add(hit);
   }
  }
  // Snare anticipations are optional responses. They do not displace the main snare.
  if(response&&s.complexity>=.7&&s.syncopation>.4&&['jungle','breaks','experimental'].includes(rule.family)){
   const step=s.genre==='footworkjungle'?10:11;
   if(v3LayerEnabled(s,'snare-answer',String(bar),rule.activity,.7))add(createHit(s,'snare',origin+step*STEP,.56,false,false,'This supporting snare anticipates the backbeat by a sixteenth; the main backbeat remains in place.'));
  }
 }
}

/** Supporting phrases are coordinated units, not independent random extra notes. */
function interaction(c:Context):void {
 const {s,rule,add,hits}=c,dev=developmentFor(s.genre);
 for(let bar=0;bar<s.bars;bar++){
  const phase=phrasePosition(s,bar),answer=phase.response;
  if(!v3LayerEnabled(s,'interaction',String(bar),answer?1:.65,.48))continue;
  const phrase=SUPPORT[dev.style][answer?1:0]!;
  for(const [index,note] of phrase.entries()){
   if(index>1&&s.complexity<.82)continue;
   if(note.ghost&&(s.ghostAmount===0||v3Chance(s,'interaction-ghost',`${bar}`)>=s.ghostAmount))continue;
   if(rule.melodicPercussion&&note.role==='percussion')continue;
   const tick=bar*BAR+note.step*STEP;
   if([...hits.values()].some(h=>h.anchor&&Math.abs(h.baseTick-tick)<STEP/2))continue;
   const hit=createHit(s,note.role,tick,note.gain,false,!!note.ghost,
    `This ${dev.style} ${answer?'answer':'call'} links softer drum accents instead of filling every subdivision.`);
   if(note.role==='hat')hit.decay=.42;
   add(hit);
  }
 }
}

interface CadenceNote {role:Role;at:number;gain:number;ghost?:boolean}
const n=(role:Role,at:number,gain:number,ghost=false):CadenceNote=>({role,at,gain,ghost});
const CADENCES:Record<V3Cadence,CadenceNote[][]>={
 soft:[[n('snare',.5,.25,true),n('hat',.75,.29)],[n('percussion',.25,.3),n('snare',.75,.24,true)]],
 funk:[[n('snare',.125,.29,true),n('kick',.5,.65),n('snare',.75,.43)],[n('percussion',.25,.34),n('snare',.5,.27,true),n('kick',.75,.62)]],
 jungle:[[n('snare',.125,.31,true),n('kick',.5,.61),n('snare',.625,.4),n('snare',.875,.54)],[n('kick',.25,.63),n('snare',.5,.3,true),n('snare',.75,.53)]],
 hats:[[n('hat',0,.33),n('hat',.5,.28),n('percussion',.75,.34)],[n('hat',.25,.3),n('hat',.75,.4)]],
 dub:[[n('percussion',.25,.35),n('snare',.75,.32,true)],[n('snare',.5,.37),n('percussion',.875,.28)]],
 garage:[[n('percussion',.25,.34),n('snare',.5,.27,true),n('hat',.75,.39)],[n('hat',.125,.28),n('percussion',.625,.34),n('snare',.875,.25,true)]],
 broken:[[n('snare',0,.52),n('percussion',1/3,.31),n('hat',2/3,.35)],[n('percussion',.125,.31),n('snare',.5,.4),n('kick',.875,.61)]],
 rave:[[n('snare',0,.51),n('snare',.5,.59),n('snare',.75,.7)],[n('kick',.25,.67),n('snare',.5,.52),n('snare',.875,.7)]]
};

/** Stage 5, also used by selected-row Fill: only the final two beats of a long selection fill. */
export function grooveV3Fill(s:Settings,startTick:number,endTick:number):Hit[] {
 const start=Math.max(0,Math.ceil(startTick)),end=Math.min(s.bars*BAR,Math.floor(endTick));
 if(end-start<2)return [];
 const rule=V3_RULES[s.genre],span=Math.min(2*PPQ,end-start),origin=end-span;
 const notes=v3Pick(CADENCES[rule.cadence],s,'cadence',`${start}:${end}`),seen=new Set<string>();
 const hits:Hit[]=[];
 for(const [i,note] of notes.entries()){
  if(!enabled(s,note.role)||(note.ghost&&s.ghostAmount===0))continue;
  // Low depth leaves a compact two-note turnaround, preserving intentional rest.
  if(i>1&&s.complexity<.4)continue;
  const hit=createHit(s,note.role,origin+Math.round(note.at*span),note.gain,false,!!note.ghost,'This '+rule.cadence+' turnaround answers the phrase and leaves room for the next downbeat.');
  if(hit.baseTick>=end||seen.has(hit.id))continue;
  hit.offsetTick=Math.max(start-hit.baseTick,Math.min(end-2-hit.baseTick,hit.offsetTick));
  seen.add(hit.id);hits.push(hit);
 }
 spice(hits,s,rule,end,[],start);
 // Natural one-shots may sustain, but every scheduled repeat stays inside the selection.
 for(const h of hits)if(h.articulation)h.articulation.durationTicks=Math.min(h.articulation.durationTicks,end-actual(h));
 return hits.sort(compare);
}

/** Stage 4: phrase-local gestures with explicit musical length, independent of tracker rows. */
function spice(events:Hit[],s:Settings,rule:V3Rule,end:number,protectedHits:Hit[]=events,start=0):void {
 const spicy=s.spicy??0;if(spicy<=0)return;
 const budget=new Map<number,number>();
 const ranked=events.filter(h=>!h.anchor&&h.role!=='kick'&&!(rule.melodicPercussion&&h.role==='percussion'))
  .sort((a,b)=>Number(b.baseTick%BAR>=3*PPQ)-Number(a.baseTick%BAR>=3*PPQ)||v3Chance(s,'gesture-rank',a.id)-v3Chance(s,'gesture-rank',b.id)||compare(a,b));
 for(const hit of ranked){
  const bar=Math.floor(hit.baseTick/BAR),local=hit.baseTick%BAR,onset=actual(hit);
  const dev=developmentFor(s.genre),phase=phrasePosition(s,bar);
  const phraseEnding=local>=PPQ*3,halfTimePickup=dev.style==='hat-roll'&&local>=PPQ&&local<PPQ*2;
  // Main hats stay legible; variation is concentrated on answers and pickups.
  const offbeat=local%PPQ!==0;
  if(onset<start||(!phraseEnding&&!halfTimePickup&&!(spicy>=.55&&offbeat)))continue;
  const capacity=phase.ending?dev.ending:phase.response||phase.turnaround?dev.answer:dev.call;
  const maxBudget=Math.ceil(capacity*spicy);
  if((budget.get(bar)??0)>=maxBudget)continue;
  if(dev.style==='hat-roll'&&hit.role!=='hat')continue;
  if(['pocket','space','skip'].includes(dev.style)&&hit.role==='snare'&&!hit.ghost)continue;
  if(v3Chance(s,'gesture-enabled',hit.id)>.2+spicy*.8)continue;
  const nextEvent=Math.min(end,...events.filter(h=>h.id!==hit.id&&h.role===hit.role&&actual(h)>onset).map(actual));
  const nextAnchor=Math.min(end,...protectedHits.filter(h=>h.anchor&&actual(h)>onset).map(actual));
  const available=Math.floor(Math.min(nextEvent,nextAnchor,end)-onset);
  const wanted=phase.ending&&spicy>.65?PPQ/2:PPQ/4;
  // Keep exact musical subdivisions despite microtiming. Never stretch a tuplet to an arbitrary collision gap.
  const duration=[...musicalSpans].reverse().find(t=>t<=Math.min(wanted,available));
  if(duration===undefined)continue;
  const minGap=hit.role==='hat'?Math.min(18,dev.minGapMs):dev.minGapMs;
  const choices=(spicy<.3?[2]:spicy<.65?[2,3]:[2,3,4,6,8])
    .filter(x=>x<=rule.maxRepeats&&duration*60000/s.bpm/PPQ/x>=minGap);
  if(!choices.length)continue;
  const count=v3Pick(choices,s,'gesture-count',hit.id);
  const rising=v3Chance(s,'gesture-curve',hit.id)>.48;
  const pitched=spicy>.4&&v3Chance(s,'gesture-pitch',hit.id)<spicy*.6;
  const pitch=pitched?v3Pick(rule.pitchSteps,s,'gesture-interval',hit.id):0;
  const reverse=phase.ending&&spicy>.65&&v3Chance(s,'gesture-reverse',hit.id)<rule.reverseChance*spicy;
  const chopped=dev.chop&&phase.response&&spicy>.75&&v3Chance(s,'gesture-chop',hit.id)<.35;
  hit.ratchets=count;
  hit.articulation={durationTicks:duration,mode:chopped?'chop':'natural',...(hit.role==='hat'?{chokeGroup:'hat' as const}:{}),
   repeats:Array.from({length:count},(_,i)=>({gain:rounded(rising?.55+.45*i/(count-1):1-.55*i/(count-1)),
    ...(pitch?{pitch:i%2===0?0:pitch}:{}),
    ...(reverse&&i===0?{reverse:true}:{}),
    ...(chopped?{sourceOffset:rounded(i*.035)}:{}),
    ...(pitched&&pitch!==0&&i===count-1&&spicy>.8?{glide:hit.role==='snare'?-1:-2}:{})}))};
  const energy=Math.sqrt(hit.articulation.repeats!.reduce((sum,r)=>sum+r.gain*r.gain,0));
  for(const r of hit.articulation.repeats!)r.gain=rounded(r.gain/Math.max(1,energy));
  if(chopped)hit.gate=.82;
  hit.reason+=` A ${phase.ending?'phrase-ending':phase.response?'answer':'pickup'} gesture: ${count===3?'triplet':`×${count}`} ${rising?'rising':'falling'} velocity burst spans ${duration/PPQ} beats and resolves before the next accent.`;
  if(reverse)hit.reason+=' Its first repeat is reversed.';
  if(pitch)hit.reason+=' The pitch contour adds a short melodic flutter.';
  budget.set(bar,(budget.get(bar)??0)+1);
 }
}

function cadence(c:Context):void {
 const {s,rule,add}=c;
 for(let bar=0;bar<s.bars;bar++){
  const phase=phrasePosition(s,bar);
  if(!phase.ending&&!phase.turnaround)continue;
  const strength=phase.ending?1:.35;
  if(s.fillAmount===0||v3Chance(s,'cadence-enabled',String(phase.position))>=s.fillAmount*rule.fillStrength*strength)continue;
  const ending=(bar+1)*BAR;
  const notes=grooveV3Fill(s,ending-(phase.ending?PPQ:PPQ/2),ending);
  for(const hit of phase.ending?notes:notes.slice(0,1)){
   delete hit.ratchets;delete hit.gate;
   hit.articulation={durationTicks:PPQ,mode:'natural',...(hit.role==='hat'?{chokeGroup:'hat' as const}:{})};
   hit.reason+=` Bar ${phase.position+1} of ${phase.length}: ${phase.ending?'phrase resolution':'small turnaround'}.`;
   hit.id += '-drop';
   add(hit);
  }
 }
}


export function grooveV3Roll(s:Settings,startTick:number,endTick:number):Hit[] {
 const start=Math.max(0,Math.ceil(startTick)),end=Math.min(s.bars*BAR,Math.floor(endTick));
 if(end-start<PPQ/2)return [];
 const dev=developmentFor(s.genre),span=end-start;
 const hits:Hit[]=[];
 const hyper = dev.chop;
 const liquid = s.genre === 'liquiddnb' || dev.style === 'pocket';
 const machineGun = !hyper && !liquid;
 
 const steps = Math.floor(span / (PPQ/2));
 for(let i=0; i<steps; i++) {
  const hitStart = start + i*(PPQ/2);
  const progress = i / Math.max(1, steps - 1);
  const gain = 0.3 + 0.7 * progress;
  const count = hyper ? (i === steps-1 ? 8 : 4) : machineGun ? (i < steps/2 ? 2 : 4) : 4;
  
  const hit=createHit(s,'snare',hitStart,gain,false,false,'Tension-building snare roll riser.');
  hit.ratchets = count;
  hit.gate = 0.8;
  hit.articulation = {
    durationTicks: PPQ/2,
    mode: hyper ? 'chop' : 'gate',
    repeats: Array.from({length:count},(_,j)=>({
      gain: rounded(0.6 + 0.4*j/(count-1)),
      ...(hyper && progress>0.5 ? {pitch: 1+j%3} : machineGun ? {pitch: Math.floor(progress*4)} : {})
    }))
  };
  hits.push(hit);
 }
 return hits;
}

/** V3 leaves old-engine RNG streams, profiles and serialization untouched. */

export function generateGrooveV3(settings:Settings):Pattern {
 const s:Settings={...settings,algorithm:'groove-v3'},c=context(s);
 anchors(c);layers(c);interaction(c);cadence(c);
 const events=[...c.hits.values()].sort(compare);
 spice(events,s,c.rule,s.bars*BAR);
 
 if(s.patternStructure === 'groove') {
  const toRemove = new Set();
  for(const e of events) if(e.id.includes('-drop')) toRemove.add(e.id);
  events.splice(0, events.length, ...events.filter(e => !toRemove.has(e.id)));
 } else if (s.patternStructure === 'fill') {
  const start = s.bars*BAR - (s.bars*BAR >= PPQ*4 ? PPQ*2 : PPQ);
  const fillNotes = grooveV3Fill(s, start, s.bars*BAR);
  const toRemove = new Set();
  for(const e of events) if(actual(e) >= start) toRemove.add(e.id);
  events.splice(0, events.length, ...events.filter(e => !toRemove.has(e.id)));
  for(const note of fillNotes) { note.id += '-drop'; events.push(note); }
 } else if (s.patternStructure === 'roll' || s.patternStructure === 'build') {
  const start = s.patternStructure === 'build' ? 0 : s.bars*BAR - (s.bars*BAR >= PPQ*4 ? PPQ*2 : PPQ);
  const rollNotes = grooveV3Roll(s, start, s.bars*BAR);
  const toRemove = new Set();
  for(const e of events) if(actual(e) >= start) toRemove.add(e.id);
  events.splice(0, events.length, ...events.filter(e => !toRemove.has(e.id)));
  for(const note of rollNotes) { note.id += '-roll'; events.push(note); }
 }

 for(const hit of events){
  if(!hit.anchor){hit.gain=rounded(Math.min(1,hit.gain*(.96+.08*v3Chance(s,'velocity',hit.id,false))));}
  if(s.breakStyle&&s.breakStyle!=='genre')hit.reason=BREAKS[s.breakStyle].name+' rhythm interpretation: '+hit.reason;
 }
 return {engineVersion:GROOVE_V3_VERSION,ppq:PPQ,settings:s,events};
}
