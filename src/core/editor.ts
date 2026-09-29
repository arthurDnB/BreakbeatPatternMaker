import {resolveSlice} from './slice-instrument.js';
import {generate} from './generate.js';
import {grooveFill,grooveTiming} from './groove.js';
import {grooveV3Fill,grooveV3Timing} from './groove-v3.js';
import {grooveV4Fill,grooveV4Timing} from './groove-v4.js';
import {V3_RULES} from './groove-v3-profiles.js';
import {GROOVES} from './groove-profiles.js';
import {compile} from './compile.js';
import {random} from './random.js';
import {generateMelody} from './melody.js';
import {generatePiano} from './piano.js';
import {validateSettings} from './settings.js';
import {SYNTH_PRESETS} from '../audio/synth-instrument.js';
import {drumLane,routeGeneratedDrums} from './drum-lanes.js';
import {PPQ, ROLES, isSynthTrack, type Pattern, type Role, type Hit, type EffectCommand, type SynthInstrument, type SynthTrack, type MelodyPart, type Settings} from './model.js';

export interface CellPosition {row:number;lane:string}
export interface TrackerClipCell extends CellPosition {column?:number;hits:Hit[]}
export interface TrackerClipboard {sliceInstruments?:Pattern['sliceInstruments'];width:number;height:number;resolution:number;lpb:number;cells:TrackerClipCell[]}
export interface Selection {ids: string[]; rows: [number, number] | null; cells?:CellPosition[]}
export interface EditorState {pattern: Pattern; lockedIds: string[]; lockedRoles: Role[]; selection: Selection; revision: number}
const copy = <T>(v:T):T => structuredClone(v);
export const emptySelection = ():Selection => ({ids:[],rows:null});
const rowTicks = (pattern:Pattern) => PPQ / compile(pattern).timing.lpb;
const laneIds = (pattern:Pattern):string[] => [...ROLES,...(pattern.userTracks??[]).map(track=>track.id)];
const roleForLane = (pattern:Pattern,lane:string):Role|undefined => ROLES.includes(lane as Role)?lane as Role:pattern.userTracks?.find(track=>track.id===lane)?.role;
export function locked(state:EditorState, hit:Pattern['events'][number]):boolean {
  return state.lockedIds.includes(hit.id)||!hit.trackId&&state.lockedRoles.includes(hit.role);
}
export function selectedIds(state:EditorState):Set<string> {
  if(state.selection.cells?.length){const cells=new Set(state.selection.cells.map(c=>`${c.row}:${c.lane}`));return new Set(compile(state.pattern).notes.filter(n=>cells.has(`${n.row}:${n.lane}`)).map(n=>n.id));}
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
  setTempo(bpm:number){if(!Number.isFinite(bpm)||bpm<32||bpm>999)throw Error('Tempo must be between 32 and 999 BPM.');const next=copy(this.state);next.pattern.settings.bpm=bpm;next.revision++;return this.commit(next,'Change BPM');}
  setResolution(resolution:8|16|32|64){const next=copy(this.state);next.pattern.settings.resolution=resolution;next.pattern.settings.lpb=(resolution/4) as 2|4|8|16;next.revision++;return this.commit(next,'Change tracker resolution');}
  setLpb(lpb:1|2|3|4|6|8|12|16|24|32){const next=copy(this.state);next.pattern.settings.lpb=lpb;next.revision++;return this.commit(next,'Change tracker LPB');}
  setDrumLane(role:Role,patch:Partial<ReturnType<typeof drumLane>>):boolean{
    const next=copy(this.state),current=drumLane(next.pattern,role),updated={...current,...patch};
    updated.name=updated.name.trim();
    if(!updated.name||updated.name.length>80)throw Error('Lane name must contain 1–80 characters.');
    if(updated.visible===false&&!next.pattern.userTracks?.length&&!ROLES.some(other=>other!==role&&drumLane(next.pattern,other).visible))throw Error('Show at least one tracker lane.');
    if(JSON.stringify(updated)===JSON.stringify(current))return false;
    (next.pattern.drumLanes??={})[role]=updated;
    if(!updated.visible&&(next.selection.cells?.some(cell=>cell.lane===role)||next.selection.ids.some(id=>next.pattern.events.some(hit=>hit.id===id&&!hit.trackId&&hit.role===role))))next.selection=emptySelection();
    next.revision++;return this.commit(next,'Change drum lane');
  }
  setSampleTrackGeneration(id:string,generationRole:Role|null):boolean{
    const next=copy(this.state),track=next.pattern.userTracks?.find(item=>item.id===id);
    if(!track||isSynthTrack(track))throw Error('Select an uploaded sample track.');
    if(generationRole!==null&&!ROLES.includes(generationRole))throw Error('Invalid beat part.');
    if((track.generationRole??null)===generationRole)return false;
    track.generationRole=generationRole;next.revision++;
    return this.commit(next,'Assign sample track beat part');
  }
  updateSliceInstrument(instrument:NonNullable<Pattern['sliceInstruments']>[number]){
    const next=copy(this.state),index=next.pattern.sliceInstruments?.findIndex(i=>i.id===instrument.id)??-1;
    if(index<0)throw Error('This instrument is no longer in the active pattern.');
    const old=next.pattern.sliceInstruments![index]!;
    for(const hit of next.pattern.events.filter(h=>h.mapped?.instrumentId===instrument.id)){
      const before=old.slices.find(s=>s.note===hit.mapped!.note),after=instrument.slices.find(s=>s.note===hit.mapped!.note);
      if(!after)throw Error('A deleted slice still has tracker notes. Delete those notes first, or undo the marker deletion.');
      if(locked(next,hit)&&(JSON.stringify(before)!==JSON.stringify(after)||old.loopFadeMs!==instrument.loopFadeMs||old.assetId!==instrument.assetId||old.sampleRate!==instrument.sampleRate))throw Error('Unlock affected hits before changing their slices.');
    }
    next.pattern.sliceInstruments![index]=copy(instrument);next.revision++;return this.commit(next,'Edit slice instrument');
  }
  restore(saved:EditorState){const next=copy(saved);next.selection=emptySelection();return this.commit(next,'Restore pattern history');}
  unlockHit(id:string){const next=copy(this.state),hit=next.pattern.events.find(h=>h.id===id);if(!hit)return false;next.lockedIds=next.lockedIds.filter(x=>x!==id);next.lockedRoles=next.lockedRoles.filter(r=>r!==hit.role);return this.commit(next,'Unlock hit and lane');}
  toggleRole(role:Role){const next=copy(this.state);next.lockedRoles=next.lockedRoles.includes(role)?next.lockedRoles.filter(r=>r!==role):[...next.lockedRoles,role];return this.commit(next,`Toggle ${role} lock`);}
  toggleSelectedLocks(){
    const ids=selectedIds(this.state);if(!ids.size)return false;
    const next=copy(this.state),all=[...ids].every(id=>next.lockedIds.includes(id));
    next.lockedIds=all?next.lockedIds.filter(id=>!ids.has(id)):[...new Set([...next.lockedIds,...ids])];
    return this.commit(next,all?'Unlock selected hits':'Lock selected hits');
  }
  replace(pattern:Pattern,label='Generate',melody?:{part:MelodyPart;track:SynthTrack;notes:Hit[]}){
    const next=copy(this.state),old=next.pattern;
    const hasLocks=next.lockedIds.length>0||next.lockedRoles.length>0;
    if(hasLocks&&(['bars','bpm','resolution'] as const).some(key=>old.settings[key]!==pattern.settings[key]))throw Error('Unlock hits and drum lanes before changing BPM, bars or resolution.');
    const kept=old.events.filter(h=>!h.trackId&&locked(next,h));
    const regeneratingDrums=pattern.settings.generationMode!=='melody';
    const userHits=old.events.filter(h=>!!h.trackId&&(!regeneratingDrums||!h.generatedDrumRole||locked(next,h)));
    const protectedUserHits=userHits.filter(h=>h.generatedDrumRole&&locked(next,h));
    if(pattern.settings.generationMode!=='melody'&&kept.some(h=>pattern.settings.enabledRoles&&!pattern.settings.enabledRoles.includes(h.role)))throw Error('An excluded instrument has locked hits. Unlock them or include that instrument before generating.');
    const preservedIds=new Set(kept.map(h=>h.id));
    next.pattern=copy(pattern);
    if(old.drumLanes&&!next.pattern.drumLanes)next.pattern.drumLanes=copy(old.drumLanes);
    if(old.userTracks?.length){next.pattern.userTracks=copy(old.userTracks);const scale=pattern.settings.bars/old.settings.bars;for(const hit of userHits){hit.baseTick=Math.min(pattern.settings.bars*4*PPQ-1,Math.round(hit.baseTick*scale));hit.offsetTick=Math.round(hit.offsetTick*scale);}next.pattern.events=next.pattern.events.filter(h=>!userHits.some(saved=>h.id===saved.id)&&!protectedUserHits.some(held=>h.trackId===held.trackId&&h.baseTick===held.baseTick));next.pattern.events.push(...userHits);}
    for(const instrument of old.sliceInstruments??[])if(kept.some(h=>h.mapped?.instrumentId===instrument.id)&&!next.pattern.sliceInstruments?.some(i=>i.id===instrument.id))(next.pattern.sliceInstruments??=[]).push(copy(instrument));
    next.pattern.events=next.pattern.events.filter(h=>!!h.trackId||!next.lockedRoles.includes(h.role)&&!preservedIds.has(h.id)&&!kept.some(k=>k.role===h.role&&k.baseTick===h.baseTick)).concat(kept);
    if(melody){
      next.pattern.userTracks??=[];
      if(!next.pattern.userTracks.some(track=>track.id===melody.track.id))next.pattern.userTracks.push(copy(melody.track));
      const held=next.pattern.events.filter(hit=>hit.trackId===melody.track.id&&next.lockedIds.includes(hit.id));
      const rowTicks=PPQ/(pattern.settings.lpb??pattern.settings.resolution/4);
      const heldRows=new Set(held.map(hit=>Math.floor((hit.baseTick+hit.offsetTick)/rowTicks)));
      next.pattern.events=next.pattern.events.filter(hit=>hit.trackId!==melody.track.id||next.lockedIds.includes(hit.id));
      const used=new Set(next.pattern.events.map(hit=>hit.id));
      next.pattern.events.push(...melody.notes.filter(hit=>!used.has(hit.id)&&!heldRows.has(Math.floor((hit.baseTick+hit.offsetTick)/rowTicks))));
    }
    next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    next.selection=emptySelection();next.revision++;
    return this.commit(next,label);
  }
  /** Compose selected layers in one history entry; manually created synth tracks are never targeted. */
  generateComposition(settings:Settings,label='Generate',preserveAnchors=false):boolean{
    validateSettings(settings);
    const mode=settings.generationMode??'drums',old=this.state.pattern;
    const pattern:Pattern=mode==='melody'?{...copy(old),settings:copy(settings),events:copy(old.events.filter(hit=>!hit.trackId))}:routeGeneratedDrums(generate(settings),old);
    if(mode==='melody'&&settings.bars!==old.settings.bars){
      const scale=settings.bars/old.settings.bars;
      for(const hit of pattern.events){hit.baseTick=Math.min(settings.bars*4*PPQ-1,Math.round(hit.baseTick*scale));hit.offsetTick=Math.max(-hit.baseTick,Math.min(PPQ,hit.offsetTick));}
    }
    if(preserveAnchors&&mode!=='melody'){
      const anchors=old.events.filter(hit=>hit.anchor&&(!hit.trackId||!!hit.generatedDrumRole));
      pattern.events=pattern.events.filter(hit=>!hit.anchor&&!anchors.some(anchor=>anchor.id===hit.id||anchor.trackId===hit.trackId&&anchor.role===hit.role&&anchor.baseTick===hit.baseTick)).concat(copy(anchors));
    }
    if(mode==='drums')return this.replace(pattern,label);
    const part=settings.melodyPart??'bassline';
    const existing=old.userTracks?.find(track=>isSynthTrack(track)&&track.generatedPart===part) as SynthTrack|undefined;
    let id=existing?.id??`melody-${part}`,suffix=2;
    while(!existing&&old.userTracks?.some(track=>track.id===id))id=`melody-${part}-${suffix++}`;
    const names={bassline:'Generated Bassline',lead:'Generated Lead',piano:'Generated Piano'} as const;
    const track:SynthTrack=existing??{id,name:names[part],kind:'synth',generatedPart:part,role:'percussion',instrument:copy(SYNTH_PRESETS[part==='bassline'?'bass':part==='lead'?'pluck':'piano']),level:1,pan:0,mute:false,solo:false};
    const bassPresent=old.userTracks?.some(item=>isSynthTrack(item)&&item.generatedPart==='bassline'&&old.events.some(hit=>hit.trackId===item.id))??false;
    return this.replace(pattern,label,{part,track,notes:part==='piano'?generatePiano(settings,id,bassPresent):generateMelody(settings,id)});
  }
  addUserTrack(track:NonNullable<Pattern['userTracks']>[number]):boolean{
    const next=copy(this.state);if(next.pattern.userTracks?.some(item=>item.id===track.id))throw Error('Track ID already exists.');(next.pattern.userTracks??=[]).push(copy(track));next.revision++;return this.commit(next,isSynthTrack(track)?'Add synth track':'Add sample track');
  }
  renameUserTrack(id:string,name:string):boolean{
    const next=copy(this.state),track=next.pattern.userTracks?.find(item=>item.id===id);if(!track)throw Error('Track no longer exists.');if(!name.trim()||name.trim().length>80)throw Error('Track name must contain 1–80 characters.');if(track.name===name.trim())return false;track.name=name.trim();next.revision++;return this.commit(next,'Rename sample track');
  }
  reorderUserTrack(id:string,delta:-1|1):boolean{
    const next=copy(this.state),tracks=next.pattern.userTracks??[],index=tracks.findIndex(track=>track.id===id),target=index+delta;if(index<0||target<0||target>=tracks.length)return false;[tracks[index],tracks[target]]=[tracks[target]!,tracks[index]!];next.revision++;return this.commit(next,'Reorder sample tracks');
  }
  setUserTrackMixer(id:string,patch:Partial<Pick<NonNullable<Pattern['userTracks']>[number],'level'|'pan'|'mute'|'solo'>>):boolean{
    const next=copy(this.state),track=next.pattern.userTracks?.find(item=>item.id===id);if(!track)throw Error('Track no longer exists.');Object.assign(track,patch);
    if(!Number.isFinite(track.level)||track.level<0||track.level>2||!Number.isFinite(track.pan)||track.pan< -1||track.pan>1)throw Error('Invalid track mixer value.');next.revision++;return this.commit(next,'Change sample track mixer');
  }
  setSynthInstrument(id:string,instrument:SynthInstrument):boolean{
    const next=copy(this.state),track=next.pattern.userTracks?.find(item=>item.id===id);
    if(!isSynthTrack(track))throw Error('Select a synth track.');
    track.instrument=copy(instrument);next.revision++;return this.commit(next,'Edit synth instrument');
  }
  deleteUserTrack(id:string):boolean{
    const next=copy(this.state),tracks=next.pattern.userTracks??[],track=tracks.find(item=>item.id===id);if(!track)return false;
    if(next.pattern.events.some(hit=>hit.trackId===id&&locked(next,hit)))throw Error('Unlock this track’s hits before deleting it.');
    next.pattern.events=next.pattern.events.filter(hit=>hit.trackId!==id);next.pattern.userTracks=tracks.filter(item=>item.id!==id);next.selection=emptySelection();next.revision++;return this.commit(next,'Delete sample track');
  }
  variation(){
    const original=this.state.pattern;
    const algorithm=original.settings.algorithm;
    if(original.settings.generationMode&&original.settings.generationMode!=='drums')return this.generateComposition({...original.settings,algorithm:algorithm==='groove-v4'?'groove-v4':algorithm==='groove-v3'?'groove-v3':'groove-v2',variation:(original.settings.variation??0)+1},'Generate variation',true);
    const next=routeGeneratedDrums(generate({...original.settings,algorithm:algorithm==='groove-v4'?'groove-v4':algorithm==='groove-v3'?'groove-v3':'groove-v2',variation:(original.settings.variation??0)+1}),original);
    const anchors=original.events.filter(h=>h.anchor&&(!h.trackId||!!h.generatedDrumRole));
    next.events=next.events.filter(h=>!h.anchor&&!anchors.some(a=>a.id===h.id||(a.trackId===h.trackId&&a.role===h.role&&a.baseTick===h.baseTick))).concat(copy(anchors));
    return this.replace(next,'Generate variation');
  }
  write(hit:Hit,replaceId?:string){
    const next=copy(this.state),prior=next.pattern.events.find(h=>h.id===replaceId);
    if(!hit.trackId&&next.lockedRoles.includes(hit.role)||(prior&&locked(next,prior)))return false;
    if(replaceId&&!prior)throw Error('Select an existing hit to edit.');
    next.pattern.events=next.pattern.events.filter(h=>h.id!==replaceId);const manual=copy(hit);delete manual.generatedDrumRole;next.pattern.events.push(manual);
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
  copySelection():TrackerClipboard {
    const notes=compile(this.state.pattern).notes,selection=this.state.selection;
    const order=laneIds(this.state.pattern),positions=selection.cells?.length?selection.cells:selection.rows?Array.from({length:selection.rows[1]-selection.rows[0]+1},(_,index)=>selection.rows![0]+index).flatMap(row=>order.map(lane=>({row,lane}))):notes.filter(n=>selection.ids.includes(n.id)).map(n=>({row:n.row,lane:n.lane}));
    if(!positions.length)throw Error('Select tracker cells or rows to copy.');
    const top=Math.min(...positions.map(c=>c.row)),left=Math.min(...positions.map(c=>order.indexOf(c.lane)));
    const unique=new Map(positions.map(c=>[`${c.row}:${c.lane}`,c]));
    const ids=selection.cells?.length||selection.rows?undefined:new Set(selection.ids);
    const cells=[...unique.values()].map(c=>({row:c.row-top,lane:c.lane,column:order.indexOf(c.lane)-left,hits:notes.filter(n=>n.row===c.row&&n.lane===c.lane&&(!ids||ids.has(n.id))).map(n=>copy(this.state.pattern.events.find(h=>h.id===n.id)!))}));
    return {sliceInstruments:copy(this.state.pattern.sliceInstruments),width:Math.max(...positions.map(c=>order.indexOf(c.lane)))-left+1,height:Math.max(...positions.map(c=>c.row))-top+1,resolution:this.state.pattern.settings.resolution,lpb:compile(this.state.pattern).timing.lpb,cells};
  }
  pasteCells(clip:TrackerClipboard,row:number,lane:string):boolean {
    const next=copy(this.state),lines=compile(next.pattern).timing.lines,step=rowTicks(next.pattern),order=laneIds(next.pattern),laneIndex=order.indexOf(lane);
    if(!Number.isInteger(row)||row<0||laneIndex<0||!clip.cells.length)throw Error('Choose a valid destination cell.');
    if(clip.resolution!==next.pattern.settings.resolution||clip.lpb!==compile(next.pattern).timing.lpb)throw Error('Copy and destination patterns must use the same resolution and LPB.');
    for(const instrument of clip.sliceInstruments??[]){const existing=next.pattern.sliceInstruments?.find(i=>i.id===instrument.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(instrument))throw Error('Instrument mapping differs. Import into another pattern.');if(!existing)(next.pattern.sliceInstruments??=[]).push(copy(instrument));}
    const destination=clip.cells.map(c=>({row:row+c.row,lane:order[laneIndex+(c.column??order.indexOf(c.lane))]??'',source:c}));
    if(destination.some(c=>c.row>=lines||!c.lane))throw Error('Paste would extend beyond the pattern.');
    const notes=compile(next.pattern).notes,remove=new Set<string>();
    for(const target of destination){
      if(ROLES.includes(target.lane as Role)&&next.lockedRoles.includes(target.lane as Role))throw Error(`Unlock the ${target.lane} lane before pasting.`);
      for(const note of notes.filter(n=>n.row===target.row&&n.lane===target.lane)){
        const hit=next.pattern.events.find(h=>h.id===note.id)!;
        if(locked(next,hit))throw Error('Paste would replace a locked hit.');
        remove.add(hit.id);
      }
    }
    next.pattern.events=next.pattern.events.filter(h=>!remove.has(h.id));
    let serial=0;
    for(const target of destination)for(const source of target.source.hits){
      const oldNote=compile({...next.pattern,events:[source]}).notes[0]!;
      const moved=copy(source),tickDelta=(target.row-oldNote.row)*step;
      moved.id=`paste-${next.revision+1}-${serial++}`;
      while(next.pattern.events.some(h=>h.id===moved.id))moved.id=`paste-${next.revision+1}-${serial++}`;
      const targetLane=String(target.lane),role=roleForLane(next.pattern,targetLane);if(!role)throw Error('Paste destination track no longer exists.');
      if(!!moved.synthNote!==isSynthTrack(next.pattern.userTracks?.find(t=>t.id===targetLane)))throw Error('Copy synth notes only to synth tracks and sample hits only to sample or drum tracks.');
      moved.role=role;if(ROLES.includes(targetLane as Role))delete moved.trackId;else moved.trackId=targetLane;moved.sourceId='kit.'+role;moved.baseTick+=tickDelta;moved.anchor=false;delete moved.generatedDrumRole;
      if(moved.baseTick<0||moved.baseTick>=next.pattern.settings.bars*4*PPQ)throw Error('Paste timing would extend beyond the pattern.');
      next.pattern.events.push(moved);
    }
    next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    next.selection={ids:[],rows:null,cells:destination.map(c=>({row:c.row,lane:String(c.lane)}))};next.revision++;
    return this.commit(next,'Paste tracker cells');
  }
  moveCells(cells:CellPosition[],row:number,lane:string):boolean {
    const order=laneIds(this.state.pattern);if(!cells.length||!Number.isInteger(row)||!order.includes(lane))throw Error('Select a valid tracker destination.');
    const next=copy(this.state),notes=compile(next.pattern).notes,lines=compile(next.pattern).timing.lines;
    const source=[...new Map(cells.map(c=>[`${c.row}:${c.lane}`,c])).values()];
    const top=Math.min(...source.map(c=>c.row)),left=Math.min(...source.map(c=>order.indexOf(c.lane)));
    const rowShift=row-top,laneShift=order.indexOf(lane)-left,step=rowTicks(next.pattern);
    if(!rowShift&&!laneShift)return false;
    const destinations=source.map(c=>({row:c.row+rowShift,lane:order[order.indexOf(c.lane)+laneShift]??''}));
    if(destinations.some(c=>c.row<0||c.row>=lines||!c.lane))throw Error('Move would extend beyond the pattern.');
    const sourceKeys=new Set(source.map(c=>`${c.row}:${c.lane}`));
    const moving=new Map(notes.filter(n=>sourceKeys.has(`${n.row}:${n.lane}`)).map(n=>[n.id,n]));
    for(const note of moving.values()){const hit=next.pattern.events.find(h=>h.id===note.id)!;if(locked(next,hit))throw Error('Unlock selected hits and lanes before moving.');}
    const overwritten=new Set<string>();
    for(const target of destinations){
      const role=roleForLane(next.pattern,target.lane!);if(!role)throw Error('Move destination track no longer exists.');if(ROLES.includes(target.lane as Role)&&next.lockedRoles.includes(role))throw Error(`Unlock the ${target.lane} lane before moving.`);
      for(const note of notes.filter(n=>n.row===target.row&&n.lane===target.lane&&!moving.has(n.id))){
        const hit=next.pattern.events.find(h=>h.id===note.id)!;
        if(locked(next,hit))throw Error('Move would replace a locked hit.');
        overwritten.add(hit.id);
      }
    }
    next.pattern.events=next.pattern.events.filter(h=>!overwritten.has(h.id));
    for(const hit of next.pattern.events){if(!moving.has(hit.id))continue;const old=notes.find(n=>n.id===hit.id)!,target=order[order.indexOf(old.lane)+laneShift]!,role=roleForLane(next.pattern,target);if(!role)throw Error('Move destination track no longer exists.');
      if(!!hit.synthNote!==isSynthTrack(next.pattern.userTracks?.find(t=>t.id===target)))throw Error('Move synth notes only to synth tracks and sample hits only to sample or drum tracks.');
      hit.baseTick+=rowShift*step;hit.role=role;if(ROLES.includes(target as Role))delete hit.trackId;else hit.trackId=target;hit.sourceId='kit.'+hit.role;delete hit.generatedDrumRole;if(hit.baseTick<0||hit.baseTick>=next.pattern.settings.bars*4*PPQ)throw Error('Move timing exceeds the pattern.');}
    next.pattern.events.sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    next.selection={ids:[...moving.keys()],rows:null,cells:destinations.map(c=>({row:c.row,lane:c.lane}))};next.revision++;
    return this.commit(next,'Move tracker cells');
  }
  editTrackerValue(id:string,field:'note'|'volume'|'pan'|'delay',value:number):boolean {
    const next=copy(this.state),hit=next.pattern.events.find(h=>h.id===id);
    if(!hit)throw Error('Select a hit to edit.');if(locked(next,hit))throw Error('Unlock this hit before editing.');
    const note=compile(next.pattern).notes.find(n=>n.id===id)!;
    if(!Number.isInteger(value))throw Error('Enter a whole-number tracker value.');
    if(field==='note'&&hit.synthNote){if(value<0||value>119)throw Error('Notes must be C-0 through B-9.');hit.synthNote.note=value;}
    else if(field==='note'&&hit.mapped){hit.mapped.note=value;resolveSlice(next.pattern,hit);}
    else if(field==='note'){if(value<0||value>96)throw Error('Notes must be C-0 through C-8.');hit.pitch=value-48;}
    else if(field==='volume'){if(value<0||value>128)throw Error('Volume must be 00–80 hex.');hit.gain=value/128;}
    else if(field==='pan'){if(value<0||value>128)throw Error('Pan must be 00–80 hex.');hit.pan=value/64-1;}
    else {if(value<0||value>255)throw Error('Delay must be 00–FF hex.');const tick=(note.row+value/256)*rowTicks(next.pattern);hit.baseTick=Math.floor(tick);hit.fineOffset=tick-Math.floor(tick);hit.offsetTick=0;}
    delete hit.generatedDrumRole;
    next.selection={ids:[id],rows:null,cells:[{row:note.row,lane:note.lane}]};next.revision++;
    return this.commit(next,`Edit tracker ${field}`);
  }
  setSynthNoteDuration(id:string,durationTicks:number):boolean{
    const next=copy(this.state),hit=next.pattern.events.find(h=>h.id===id);
    if(!hit?.synthNote)throw Error('Select a synth note.');if(locked(next,hit))throw Error('Unlock this note before editing.');
    hit.synthNote.durationTicks=durationTicks;next.revision++;return this.commit(next,'Change synth note length');
  }
  editTrackerEffect(id:string,effect?:EffectCommand):boolean {
    const next=copy(this.state),hit=next.pattern.events.find(h=>h.id===id);
    if(!hit)throw Error('Select a hit to edit.');
    if(locked(next,hit))throw Error('Unlock this hit before editing.');
    if(effect)hit.effect=copy(effect);else delete hit.effect;
    delete hit.generatedDrumRole;
    next.revision++;
    return this.commit(next,effect?'Edit tracker FX':'Clear tracker FX');
  }
  mutate(){
    const next=copy(this.state),scope=selectedIds(next);
    const scoped=next.selection.rows!==null||next.selection.ids.length>0||!!next.selection.cells?.length;
    const eligible=next.pattern.events.filter(h=>!h.trackId&&!h.anchor&&!locked(next,h)&&(!scoped||scope.has(h.id)));
    if(!eligible.length)return false;
    const rng=random(next.pattern.settings.seed,`mutate:${next.revision}`);
    // Fisher-Yates, avoiding engine-dependent random sort comparators.
    for(let i=eligible.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[eligible[i],eligible[j]]=[eligible[j]!,eligible[i]!];}
    const changedHits=eligible.slice(0,Math.max(1,Math.ceil(eligible.length*.2)));
    for(const hit of changedHits){
      const step=rowTicks(next.pattern);
      let target=hit.baseTick+(rng()<.5?-step:step);
      if(['groove-v2','groove-v3','groove-v4'].includes(next.pattern.settings.algorithm??'')){
        const rule=GROOVES[next.pattern.settings.genre],origin=Math.floor(hit.baseTick/(4*PPQ))*4*PPQ;
        const v3=['groove-v3','groove-v4'].includes(next.pattern.settings.algorithm??'')?V3_RULES[next.pattern.settings.genre]:undefined;
        const positions=v3?(hit.role==='kick'?v3.pickups:hit.role==='snare'?v3.ghosts:hit.role==='hat'?[...v3.hats,...v3.hatDetails]:v3.percussion):(hit.role==='kick'?rule.kickExtras:hit.role==='snare'?rule.response:[1,3,5,7,9,11,13,15]);
        const choices=positions.map(n=>origin+(v3?n*240:Math.round(n*240/step)*step)).filter(t=>t!==hit.baseTick&&Math.abs(t-hit.baseTick)<=(v3?480:step*2));
        target=choices.length?choices[Math.floor(rng()*choices.length)]!:hit.baseTick;
      }
      const row=Math.floor(Math.max(0,Math.round((target+hit.offsetTick)/step*256))/256);
      const range=next.selection.rows;
      if(rng()<.65&&target>=0&&target<next.pattern.settings.bars*PPQ*4&&(!range||(row>=range[0]&&row<=range[1]))&&!next.pattern.events.some(e=>e.id!==hit.id&&e.role===hit.role&&e.baseTick===target)){
        hit.baseTick=target;if(['groove-v2','groove-v3','groove-v4'].includes(next.pattern.settings.algorithm??''))(next.pattern.settings.algorithm==='groove-v4'?grooveV4Timing:next.pattern.settings.algorithm==='groove-v3'?grooveV3Timing:grooveTiming)(hit,next.pattern.settings);if(range)hit.offsetTick=Math.max(range[0]*step-hit.baseTick,Math.min((range[1]+1)*step-1-hit.baseTick,hit.offsetTick));hit.reason='This variation moves an ornament to a neighboring subdivision while retaining the main backbeat.';
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
    const scoped=next.selection.rows!==null||next.selection.ids.length>0||!!next.selection.cells?.length;
    const eligible=next.pattern.events.filter(h=>!h.trackId&&!h.anchor&&!locked(next,h)&&(!scoped||scope.has(h.id)));
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
    if(!['groove-v3','groove-v4'].includes(next.pattern.settings.algorithm??''))return;
    const ticksPerRow=rowTicks(next.pattern);
    const end=Math.min(next.pattern.settings.bars*4*PPQ,range?(range[1]+1)*ticksPerRow:Infinity);
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
    if(['groove-v2','groove-v3','groove-v4'].includes(next.pattern.settings.algorithm??'')){
      const step=rowTicks(next.pattern),start=range[0]*step,end=(range[1]+1)*step;
      const additions=(next.pattern.settings.algorithm==='groove-v4'?grooveV4Fill:next.pattern.settings.algorithm==='groove-v3'?grooveV3Fill:grooveFill)({...next.pattern.settings,variation:next.revision},start,end);
      let changed=false;
      for(const hit of additions){
        if(next.lockedRoles.includes(hit.role))continue;
    const occupied=next.pattern.events.filter(h=>!h.trackId&&h.role===hit.role&&Math.abs(h.baseTick+h.offsetTick-hit.baseTick-hit.offsetTick)<step*.5);
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
    const step=rowTicks(next.pattern);
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
