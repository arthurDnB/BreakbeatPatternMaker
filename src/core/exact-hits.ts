import {PPQ,ROLES,type Hit,type Pattern,type Role} from './model.js';
import {generateGrooveV4,grooveV4Timing,v4Chance} from './groove-v4.js';
import {generateGrooveV5,v5Chance} from './groove-v5.js';
import {routeGeneratedDrums} from './drum-lanes.js';
import {V3_RULES} from './groove-v3-profiles.js';

const lane=(hit:Hit)=>hit.trackId??hit.role;
const drum=(hit:Hit)=>!hit.synthNote;
const position=(hit:Hit)=>hit.baseTick+hit.offsetTick;

function densePattern(pattern:Pattern){
 const s=pattern.settings;
 const laneDensity=Object.fromEntries(ROLES.map(role=>[role,s.laneDensity?.[role]===0?0:2])) as Record<Role,number>;
 const denseSettings={...s,hitTarget:undefined,complexity:1,ghostAmount:1,fillAmount:1,laneDensity};
 const dense=s.algorithm==='groove-v5'?generateGrooveV5(denseSettings):generateGrooveV4(denseSettings);
 return {source:dense,routed:routeGeneratedDrums(dense,pattern)};
}

function availableV5Hits(pattern:Pattern,dense:Pattern):Hit[]{
 const usedIds=new Set(pattern.events.map(hit=>hit.id));
 const usedPlaces=new Set(pattern.events.filter(drum).map(hit=>`${lane(hit)}:${hit.baseTick}`));
 const available:Hit[]=[];
 for(const hit of dense.events){
  const place=`${lane(hit)}:${hit.baseTick}`;
  if(hit.anchor||usedIds.has(hit.id)||usedPlaces.has(place))continue;
  available.push(hit);usedIds.add(hit.id);usedPlaces.add(place);
 }
 return available;
}

/** Maximum notes V5 can supply from its genre vocabulary with the current settings. */
export function maximumV5ExactHits(pattern:Pattern):number{
 if(pattern.settings.algorithm!=='groove-v5')throw Error('Groove V5 is required to calculate its exact-hit capacity.');
 return pattern.events.filter(drum).length+availableV5Hits(pattern,densePattern(pattern).routed).length;
}

/** Apply a note budget to the merged tracker state, before its Undo transaction commits. */
export function balanceExactHits(pattern:Pattern,lockedIds:readonly string[],lockedRoles:readonly Role[]):void{
 const target=pattern.settings.hitTarget;
 if(target===undefined)return;
 const s=pattern.settings,all=pattern.events.filter(drum);
 const v5=s.algorithm==='groove-v5';
 const {source:dense,routed:denseRouted}=densePattern(pattern);
 const roleOf=(hit:Hit)=>hit.generatedDrumRole??hit.role;
 const weights=new Map<Role,number>(ROLES.map(role=>[role,Math.max(1,denseRouted.events.filter(hit=>roleOf(hit)===role).length+all.filter(hit=>hit.trackId&&hit.generatedDrumRole===role).length)]));
 const totalWeight=[...weights.values()].reduce((sum,value)=>sum+value,0);
 const protectedHit=(hit:Hit)=>hit.anchor||hit.mapped?.instrumentId==='think-passage2-uh'||hit.manual===true||lockedIds.includes(hit.id)||!hit.trackId&&lockedRoles.includes(hit.role)||!!hit.trackId&&!hit.generatedDrumRole;
 const protectedCount=all.filter(protectedHit).length;
 if(target<protectedCount)throw Error(`Exact hits needs at least ${protectedCount} notes for protected anchors, locks, manual hits and the Think vocal. Raise the target or unlock notes.`);
 const importance=(hit:Hit)=>{
  const role=hit.generatedDrumRole??hit.role;
  const base=role==='snare'?2.5:role==='kick'?2:role==='hat'?1.5:1;
  const beat=position(hit)%(4*PPQ);
  return base+hit.gain*2+(beat%PPQ===0?1:0)+(hit.mapped?.instrumentId==='think-passage2-uh'?1.5:0)-(hit.id.startsWith('exact-')?1:0)
   +((v5?v5Chance:v4Chance)(s,'exact-rank',hit.id)*.35);
 };
 const choose=(pool:Hit[],initial:Hit[],count:number):Hit[]=>{
  const chosen:Hit[]=[],remaining=[...pool],roleCounts=new Map<Role,number>(ROLES.map(role=>[role,initial.filter(hit=>roleOf(hit)===role).length]));
  const barCounts=Array.from({length:s.bars},(_,bar)=>initial.filter(hit=>Math.floor(hit.baseTick/(4*PPQ))===bar).length);
  while(chosen.length<count&&remaining.length){
   let best=-Infinity,index=-1;
   for(let i=0;i<remaining.length;i++){
    const hit=remaining[i]!,role=roleOf(hit),bar=Math.min(s.bars-1,Math.floor(hit.baseTick/(4*PPQ)));
    const roleDeficit=target*weights.get(role)!/totalWeight-roleCounts.get(role)!;
    const barDeficit=target/s.bars-barCounts[bar]!;
    const score=importance(hit)+roleDeficit*1.8+barDeficit*.8;
    if(score>best){best=score;index=i;}
   }
   const [hit]=remaining.splice(index,1);chosen.push(hit!);
   const role=roleOf(hit!),bar=Math.min(s.bars-1,Math.floor(hit!.baseTick/(4*PPQ)));
   roleCounts.set(role,roleCounts.get(role)!+1);barCounts[bar]!++;
  }
  return chosen;
 };
 if(all.length>target){
  const optional=all.filter(hit=>!protectedHit(hit));
  const keep=new Set(choose(optional,all.filter(protectedHit),target-protectedCount).map(hit=>hit.id));
  pattern.events=pattern.events.filter(hit=>!drum(hit)||protectedHit(hit)||keep.has(hit.id));
 }
 if(pattern.events.filter(drum).length>=target)return;
 const usedIds=new Set(pattern.events.map(hit=>hit.id));
 const usedPlaces=new Set(pattern.events.filter(drum).map(hit=>`${lane(hit)}:${hit.baseTick}`));
 const reservoir:Hit[]=[];
 const add=(hit:Hit)=>{
  if(usedIds.has(hit.id)||usedPlaces.has(`${lane(hit)}:${hit.baseTick}`))return;
  usedIds.add(hit.id);usedPlaces.add(`${lane(hit)}:${hit.baseTick}`);reservoir.push(hit);
 };
 // First use real genre vocabulary at maximum detail. The hit target, not
 // Complexity, decides how many notes are admitted from this reservoir.
 for(const hit of v5?availableV5Hits(pattern,denseRouted):denseRouted.events.filter(hit=>!hit.anchor))add(hit);
 // V5's exact target uses only its own profile vocabulary. A target beyond
 // that reservoir fails explicitly instead of quietly inserting V4 notes.
 if(v5){
  const needed=target-pattern.events.filter(drum).length;
  if(reservoir.length<needed)throw Error(`Exact hits cannot reach ${target} with the Groove V5 profile and enabled lanes. Maximum available: ${target-needed+reservoir.length}.`);
  pattern.events.push(...choose(reservoir,pattern.events.filter(drum),needed));
  pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||a.id.localeCompare(b.id));
  return;
 }
 // Complete the pool with genre-ranked sixteenth slots when the profile alone
 // cannot reach the requested count. A lane never receives two notes on a slot.
 const rule=V3_RULES[s.genre];
 const extras:Hit[]=[];
 for(let bar=0;bar<s.bars;bar++)for(let step=0;step<16;step++)for(const role of ROLES){
  if(s.enabledRoles&&!s.enabledRoles.includes(role)||s.laneDensity?.[role]===0)continue;
  const tick=bar*4*PPQ+step*PPQ/4;
  const id=`exact-${role}-${tick}`;
  const hit:Hit={id,role,sourceId:`kit.${role}`,sourceKind:'oneShot',baseTick:tick,offsetTick:0,
   gain:role==='snare'?.28:role==='kick'?.45:role==='hat'?.35:.3,pan:0,anchor:false,ghost:role==='snare',
   articulation:{durationTicks:PPQ/2,mode:'natural',...(role==='hat'?{chokeGroup:'hat' as const}:{})},
   reason:`A ${role} detail fills the requested hit count while following the ${s.genre} groove.`};
  grooveV4Timing(hit,s);
  const preferred=role==='hat'?rule.hats.includes(step)||rule.hatDetails.includes(step):role==='snare'?rule.ghosts.includes(step):role==='kick'?rule.pickups.includes(step):rule.percussion.includes(step);
  const rank=(preferred?4:0)+(role==='hat'?2:role==='percussion'?1:0)+(step%4===0?.5:0)+v4Chance(s,'exact-fill',id);
  (hit as Hit&{_rank?:number})._rank=rank;
  extras.push(hit);
 }
 extras.sort((a,b)=>(b as Hit&{_rank?:number})._rank!-(a as Hit&{_rank?:number})._rank!||a.id.localeCompare(b.id));
 for(const hit of extras)delete (hit as Hit&{_rank?:number})._rank;
 for(const hit of routeGeneratedDrums({...dense,events:extras},pattern).events)add(hit);
 const needed=target-pattern.events.filter(drum).length;
 if(reservoir.length<needed)throw Error(`Exact hits cannot reach ${target} with the enabled lanes and current pattern. Maximum available: ${target-needed+reservoir.length}.`);
 pattern.events.push(...choose(reservoir,pattern.events.filter(drum),needed));
 pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||a.id.localeCompare(b.id));
}
