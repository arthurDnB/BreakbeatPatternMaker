import {generate} from './generate.js';
import {grooveFill,grooveTiming} from './groove.js';
import {grooveV3Fill,grooveV3Timing} from './groove-v3.js';
import {V3_RULES} from './groove-v3-profiles.js';
import {GROOVES} from './groove-profiles.js';
import {compile} from './compile.js';
import {random} from './random.js';
import {PPQ, ROLES, type Pattern, type Role, type Hit} from './model.js';

export interface Selection {ids: string[]; rows: [number, number] | null}
export interface EditorState {pattern: Pattern; lockedIds: string[]; lockedRoles: Role[]; selection: Selection; revision: number}
const copy = <T>(v:T):T => structuredClone(v);
export const emptySelection = ():Selection => ({ids:[],rows:null});
export function locked(state:EditorState, hit:Pattern['events'][number]):boolean {
  return state.lockedIds.includes(hit.id)||state.lockedRoles.includes(hit.role);
}
export function selectedIds(state:EditorState):Set<string> {
  if(!state.selection.rows)return new Set(state.selection.ids);
  const [start,end]=state.selection.rows;
  return new Set(compile(state.pattern).notes.filter(n=>n.row>=start&&n.row<=end).map(n=>n.id));
}
export class Editor {
  state:EditorState;
  private past:{state:EditorState;label:string}[]=[];
  private future:{state:EditorState;label:string}[]=[];
  constructor(pattern:Pattern){this.state={pattern:copy(pattern),lockedIds:[],lockedRoles:[],selection:emptySelection(),revision:0};}
  get undoLabel(){return this.past.at(-1)?.label;}
  get redoLabel(){return this.future.at(-1)?.label;}
  private commit(next:EditorState,label:string):boolean {
    if(JSON.stringify(next)===JSON.stringify(this.state))return false;
    compile(next.pattern); // Validate the whole result before publishing an edit.
    this.past.push({state:copy(this.state),label});if(this.past.length>100)this.past.shift();
    this.future=[];this.state=copy(next);return true;
  }
  undo(){const item=this.past.pop();if(!item)return false;this.future.push({state:copy(this.state),label:item.label});this.state=item.state;return true;}
  redo(){const item=this.future.pop();if(!item)return false;this.past.push({state:copy(this.state),label:item.label});this.state=item.state;return true;}
  restore(saved:EditorState){const next=copy(saved);next.selection=emptySelection();return this.commit(next,'Restore pattern history');}
  unlockHit(id:string){const next=copy(this.state),hit=next.pattern.events.find(h=>h.id===id);if(!hit)return false;next.lockedIds=next.lockedIds.filter(x=>x!==id);next.lockedRoles=next.lockedRoles.filter(r=>r!==hit.role);return this.commit(next,'Unlock hit and lane');}
  toggleRole(role:Role){const next=copy(this.state);next.lockedRoles=next.lockedRoles.includes(role)?next.lockedRoles.filter(r=>r!==role):[...next.lockedRoles,role];return this.commit(next,`Toggle ${role} lock`);}
  toggleSelectedLocks(){
    const ids=selectedIds(this.state);if(!ids.size)return false;
    const next=copy(this.state),all=[...ids].every(id=>next.lockedIds.includes(id));
    next.lockedIds=all?next.lockedIds.filter(id=>!ids.has(id)):[...new Set([...next.lockedIds,...ids])];
    return this.commit(next,all?'Unlock selected hits':'Lock selected hits');
  }
  replace(pattern:Pattern,label='Generate'){
    const next=copy(this.state),old=next.pattern;
    const hasLocks=next.lockedIds.length>0||next.lockedRoles.length>0;
    if(hasLocks&&(['bars','bpm','resolution'] as const).some(key=>old.settings[key]!==pattern.settings[key]))throw Error('Unlock hits and drum lanes before changing BPM, bars or resolution.');
    const kept=old.events.filter(h=>locked(next,h));
    if(kept.some(h=>pattern.settings.enabledRoles&&!pattern.settings.enabledRoles.includes(h.role)))throw Error('An excluded instrument has locked hits. Unlock them or include that instrument before generating.');
    const preservedIds=new Set(kept.map(h=>h.id));
    next.pattern=copy(pattern);
    next.pattern.events=next.pattern.events.filter(h=>!next.lockedRoles.includes(h.role)&&!preservedIds.has(h.id)&&!kept.some(k=>k.role===h.role&&k.baseTick===h.baseTick)).concat(kept);
    next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    next.selection=emptySelection();next.revision++;
    return this.commit(next,label);
  }
  variation(){
    const original=this.state.pattern;
    const next=generate({...original.settings,algorithm:original.settings.algorithm==='groove-v3'?'groove-v3':'groove-v2',variation:(original.settings.variation??0)+1});
    const anchors=original.events.filter(h=>h.anchor);
    next.events=next.events.filter(h=>!h.anchor&&!anchors.some(a=>a.id===h.id||(a.role===h.role&&a.baseTick===h.baseTick))).concat(copy(anchors));
    return this.replace(next,'Generate variation');
  }
  write(hit:Hit,replaceId?:string){
    const next=copy(this.state),prior=next.pattern.events.find(h=>h.id===replaceId);
    if(next.lockedRoles.includes(hit.role)||(prior&&locked(next,prior)))return false;
    if(replaceId&&!prior)throw Error('Select an existing hit to edit.');
    next.pattern.events=next.pattern.events.filter(h=>h.id!==replaceId);next.pattern.events.push(copy(hit));
    next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    next.selection={ids:[hit.id],rows:null};next.revision++;
    return this.commit(next,replaceId?'Edit hit':'Insert hit');
  }
  deleteSelected(){
    const next=copy(this.state),ids=selectedIds(next);
    const events=next.pattern.events.filter(h=>!ids.has(h.id)||locked(next,h));
    if(events.length===next.pattern.events.length)return false;
    next.pattern.events=events;next.selection=emptySelection();next.revision++;return this.commit(next,'Delete hits');
  }
  mutate(){
    const next=copy(this.state),scope=selectedIds(next);
    const scoped=next.selection.rows!==null||next.selection.ids.length>0;
    const eligible=next.pattern.events.filter(h=>!h.anchor&&!locked(next,h)&&(!scoped||scope.has(h.id)));
    if(!eligible.length)return false;
    const rng=random(next.pattern.settings.seed,`mutate:${next.revision}`);
    // Fisher-Yates, avoiding engine-dependent random sort comparators.
    for(let i=eligible.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[eligible[i],eligible[j]]=[eligible[j]!,eligible[i]!];}
    const changedHits=eligible.slice(0,Math.max(1,Math.ceil(eligible.length*.2)));
    for(const hit of changedHits){
      const step=PPQ*4/next.pattern.settings.resolution;
      let target=hit.baseTick+(rng()<.5?-step:step);
      if(['groove-v2','groove-v3'].includes(next.pattern.settings.algorithm??'')){
        const rule=GROOVES[next.pattern.settings.genre],origin=Math.floor(hit.baseTick/(4*PPQ))*4*PPQ;
        const v3=next.pattern.settings.algorithm==='groove-v3'?V3_RULES[next.pattern.settings.genre]:undefined;
        const positions=v3?(hit.role==='kick'?v3.pickups:hit.role==='snare'?v3.ghosts:hit.role==='hat'?[...v3.hats,...v3.hatDetails]:v3.percussion):(hit.role==='kick'?rule.kickExtras:hit.role==='snare'?rule.response:[1,3,5,7,9,11,13,15]);
        const choices=positions.map(n=>origin+(v3?n*240:Math.round(n*240/step)*step)).filter(t=>t!==hit.baseTick&&Math.abs(t-hit.baseTick)<=(v3?480:step*2));
        target=choices.length?choices[Math.floor(rng()*choices.length)]!:hit.baseTick;
      }
      const row=Math.floor(Math.max(0,Math.round((target+hit.offsetTick)/step*256))/256);
      const range=next.selection.rows;
      if(rng()<.65&&target>=0&&target<next.pattern.settings.bars*PPQ*4&&(!range||(row>=range[0]&&row<=range[1]))&&!next.pattern.events.some(e=>e.id!==hit.id&&e.role===hit.role&&e.baseTick===target)){
        hit.baseTick=target;if(['groove-v2','groove-v3'].includes(next.pattern.settings.algorithm??''))(next.pattern.settings.algorithm==='groove-v3'?grooveV3Timing:grooveTiming)(hit,next.pattern.settings);if(range)hit.offsetTick=Math.max(range[0]*step-hit.baseTick,Math.min((range[1]+1)*step-1-hit.baseTick,hit.offsetTick));hit.reason='This variation moves an ornament to a neighboring subdivision while retaining the main backbeat.';
      }else{
        hit.gain=Math.round(Math.max(.08,Math.min(hit.ghost?.35:.85,hit.gain+(hit.gain>(hit.ghost?.27:.55)?-.12:.12)))*10000)/10000;
        hit.reason=hit.ghost?'This ghost snare has a revised quiet accent; the main backbeat stays in place.':'This variation changes the accent strength while preserving the rhythm.';
      }
    }
    this.boundGestures(next,changedHits,next.selection.rows);
    next.revision++;return this.commit(next,scoped?'Mutate selection':'Mutate pattern');
  }
  scramble(){
    const next=copy(this.state),scope=selectedIds(next);
    const scoped=next.selection.rows!==null||next.selection.ids.length>0;
    const eligible=next.pattern.events.filter(h=>!h.anchor&&!locked(next,h)&&(!scoped||scope.has(h.id)));
    if(eligible.length<2)return false;
    const rng=random(next.pattern.settings.seed,`scramble:${next.revision}`);
    const hasSlices=eligible.filter(h=>h.slice);
    if(hasSlices.length>=2){
      const slices=hasSlices.map(h=>structuredClone(h.slice));
      for(let i=slices.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[slices[i],slices[j]]=[slices[j]!,slices[i]!];}
      hasSlices.forEach((h,idx)=>{h.slice=slices[idx];h.reason='Scrambled break slice mapping.';});
    }else{
      const ticks=eligible.map(h=>({baseTick:h.baseTick,offsetTick:h.offsetTick,fineOffset:h.fineOffset,reverse:h.reverse}));
      for(let i=ticks.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ticks[i],ticks[j]]=[ticks[j]!,ticks[i]!];}
      eligible.forEach((h,idx)=>{
        h.baseTick=ticks[idx]!.baseTick;
        h.offsetTick=ticks[idx]!.offsetTick;
        if(ticks[idx]!.fineOffset!==undefined)h.fineOffset=ticks[idx]!.fineOffset;
        if(ticks[idx]!.reverse!==undefined)h.reverse=ticks[idx]!.reverse;
        h.reason='Scrambled breakbeat chop timing.';
      });
      next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    }
    this.boundGestures(next,eligible,next.selection.rows);
    next.revision++;return this.commit(next,scoped?'Scramble selection':'Scramble break');
  }
  private boundGestures(next:EditorState,hits:Hit[],range:[number,number]|null){
    if(next.pattern.settings.algorithm!=='groove-v3')return;
    const rowTicks=PPQ*4/next.pattern.settings.resolution;
    const end=Math.min(next.pattern.settings.bars*4*PPQ,range?(range[1]+1)*rowTicks:Infinity);
    for(const h of hits){
      if(!h.articulation||h.anchor||locked(next,h))continue;
      const start=h.baseTick+h.offsetTick+(h.fineOffset??0);
      const stop=next.pattern.events.filter(k=>k.id!==h.id&&k.role===h.role&&(k.anchor||locked(next,k)))
        .map(k=>k.baseTick+k.offsetTick+(k.fineOffset??0)).filter(t=>t>start).reduce((a,b)=>Math.min(a,b),end);
      h.articulation.durationTicks=Math.max(1,Math.min(h.articulation.durationTicks,Math.floor(stop-start)));
    }
  }
  fill(){
    const next=copy(this.state),range=next.selection.rows;
    if(!range)throw Error('Select an ending using row numbers or Select last beat.');
    if(['groove-v2','groove-v3'].includes(next.pattern.settings.algorithm??'')){
      const step=PPQ*4/next.pattern.settings.resolution,start=range[0]*step,end=(range[1]+1)*step;
      const additions=(next.pattern.settings.algorithm==='groove-v3'?grooveV3Fill:grooveFill)({...next.pattern.settings,variation:next.revision},start,end);
      let changed=false;
      for(const hit of additions){
        if(next.lockedRoles.includes(hit.role))continue;
        const occupied=next.pattern.events.filter(h=>h.role===hit.role&&Math.abs(h.baseTick+h.offsetTick-hit.baseTick-hit.offsetTick)<step*.5);
        if(occupied.some(h=>h.anchor||locked(next,h)||h.baseTick+h.offsetTick<start||h.baseTick+h.offsetTick>=end))continue;
        next.pattern.events=next.pattern.events.filter(h=>!occupied.includes(h));
        // Timing moves can leave an existing ID at a different position.
        hit.id='fill-'+next.revision+'-'+hit.id;while(next.pattern.events.some(h=>h.id===hit.id))hit.id+='x';
        this.boundGestures(next,[hit],range);
        next.pattern.events.push(hit);changed=true;
      }
      if(!changed)return false;
      next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
      next.selection.ids=[];next.revision++;return this.commit(next,'Generate genre fill');
    }
    if(next.pattern.settings.enabledRoles&&!next.pattern.settings.enabledRoles.includes('snare'))throw Error('Snare is excluded from this pattern. Include it and Generate before adding a fill.');
    if(next.lockedRoles.includes('snare'))return false;
    const step=PPQ*4/next.pattern.settings.resolution;
    const start=range[0]*step,end=(range[1]+1)*step;
    const notes=compile(next.pattern).notes;
    const inRange=new Set(notes.filter(n=>n.row>=range[0]&&n.row<=range[1]).map(n=>n.id));
    next.pattern.events=next.pattern.events.filter(h=>h.role!=='snare'||!inRange.has(h.id)||h.anchor||locked(next,h));
    const rng=random(next.pattern.settings.seed,`fill:${next.revision}`);
    // Denser phrase endings, with a limit of 32 new attacks for long selections.
    const spacing=Math.max(120,step,Math.ceil((end-start)/32/120)*120);
    let added=0;
    for(let tick=start;tick<end;tick+=spacing){
      if(next.pattern.events.some(h=>h.role==='snare'&&Math.abs(h.baseTick+h.offsetTick-tick)<spacing*.5))continue;
      let id=`fill-${next.revision}-${tick}`;while(next.pattern.events.some(h=>h.id===id))id+='x';
      next.pattern.events.push({id,role:'snare',sourceId:'kit.snare',baseTick:tick,offsetTick:0,gain:Math.round((.3+.3*(tick-start)/Math.max(1,end-start)+rng()*.07)*10000)/10000,pan:0,anchor:false,ghost:false,reason:'This snare develops the selected ending into a fill, rising in strength toward the return.'});added++;
    }
    if(!added)return false;
    next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    next.selection.ids=[];next.revision++;return this.commit(next,'Generate fill');
  }
}
