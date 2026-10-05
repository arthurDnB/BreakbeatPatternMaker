import {trackerTiming,patternTicks} from './meter.js';
import {DEFAULT_SOURCES, PPQ, ROLES, bounded, identifier, isSynthTrack, text, type Pattern, type Source, type Transfer} from './model.js';
import {validateArticulation} from './articulation.js';
import {validateSynthInstrument} from './synth-presets.js';
import {validateSettings} from './generate.js';
import {validateSliceInstruments,resolveSlice} from './slice-instrument.js';
import {drumLane} from './drum-lanes.js';

export function compile(pattern: Pattern, sources: Source[] = DEFAULT_SOURCES, lpb = pattern.settings.lpb ?? pattern.settings.resolution / 4): Transfer {
  validateSettings(pattern.settings);
  validateSliceInstruments(pattern);
  if(pattern.ppq!==PPQ) throw new Error('Unsupported PPQ.');
  bounded(lpb,1,32,'LPB',true);
  if (!Array.isArray(pattern.events) || pattern.events.length>4096) throw new Error('Too many events.');
  const {lines,numerator,denominator}=trackerTiming(pattern.settings,lpb);
  if(lines>512) throw new Error('This exporter supports at most 512 rows.');
  const sourceMap=new Map<string, Source>();
  const trackMap=new Map((pattern.userTracks??[]).map(track=>[track.id,track]));
  if(pattern.drumLanes!==undefined){
    if(!pattern.drumLanes||typeof pattern.drumLanes!=='object'||Array.isArray(pattern.drumLanes)||Object.keys(pattern.drumLanes).some(role=>!ROLES.includes(role as typeof ROLES[number])))throw Error('Invalid drum lane layout.');
    for(const role of ROLES){
      const lane=pattern.drumLanes[role];if(lane===undefined)continue;
      if(!lane||typeof lane!=='object')throw Error('Invalid drum lane layout.');
      text(lane.name,'drum lane name',80);
      if(typeof lane.visible!=='boolean'||lane.generationRole!==null&&!ROLES.includes(lane.generationRole))throw Error('Invalid drum lane visibility or generation role.');
    }
    if(!ROLES.some(role=>drumLane(pattern,role).visible)&&!(pattern.userTracks?.length))throw Error('Show at least one tracker lane.');
  }
  if(!Array.isArray(pattern.userTracks??[])||(pattern.userTracks?.length??0)>128)throw Error('A pattern supports up to 128 user tracks.');
  for(const track of pattern.userTracks??[]){
    identifier(track.id,'track ID');text(track.name,'track name',80);
    if(trackMap.size!==(pattern.userTracks?.length??0)||ROLES.includes(track.id as typeof ROLES[number])||!ROLES.includes(track.role))throw Error('Invalid or duplicate user track.');
    if(isSynthTrack(track)){
      validateSynthInstrument(track.instrument);
      if(track.generatedPart!==undefined&&!['bassline','lead','piano'].includes(track.generatedPart))throw Error('Invalid generated melody track.');
      if(track.generatedPart&&(pattern.userTracks??[]).filter(other=>isSynthTrack(other)&&other.generatedPart===track.generatedPart).length>1)throw Error('Duplicate generated melody track.');
    }
    else {if(track.kind!==undefined&&track.kind!=='sample')throw Error('Invalid track type.');if(track.generatedBreakLayer!==undefined&&track.generatedBreakLayer!=='think-passage2')throw Error('Invalid generated break track.');if(track.generatedBreakLayer&&(pattern.userTracks??[]).filter(other=>!isSynthTrack(other)&&other.generatedBreakLayer===track.generatedBreakLayer).length>1)throw Error('Duplicate generated break track.');if(track.generationRole!==undefined&&track.generationRole!==null&&!ROLES.includes(track.generationRole))throw Error('Invalid sample track generation role.');if(track.generationDensity!==undefined)bounded(track.generationDensity,0,1,'sample track density');if(track.generationProbability!==undefined)bounded(track.generationProbability,0,1,'sample track probability');bounded(track.sample.startFrame,0,23040000,'track sample start',true);bounded(track.sample.endFrame,track.sample.startFrame+1,23040000,'track sample end',true);bounded(track.sample.sampleRate,8000,192000,'track sample rate',true);
      identifier(track.sample.assetId,'track sample asset');text(track.sample.label,'track sample label',120);}
    bounded(track.level,0,2,'track level');bounded(track.pan,-1,1,'track pan');
    if(typeof track.mute!=='boolean'||typeof track.solo!=='boolean')throw Error('Invalid user track mixer state.');
  }
  if(!Array.isArray(sources) || sources.length<1 || sources.length>32) throw new Error('Expected 1–32 sources.');
  for(const source of sources) {
    identifier(source.id,'source ID'); text(source.label,'source label',80);
    if(sourceMap.has(source.id)) throw new Error('Duplicate source ID.');
    if(!ROLES.includes(source.role) || !['slice','oneShot'].includes(source.kind)) throw new Error('Invalid source role/kind.');
    bounded(source.note,0,119,'note',true); bounded(source.instrument,0,254,'instrument',true);
    sourceMap.set(source.id,source);
  }
  text(pattern.engineVersion,'engineVersion',32);
  const out:Transfer={format:'breakbeat-pattern',version:1,engineVersion:pattern.engineVersion,
    name:`${pattern.settings.genre}${pattern.settings.breakStyle&&pattern.settings.breakStyle!=='genre'?' / '+pattern.settings.breakStyle:''} ${pattern.settings.seed}`,genre:pattern.settings.genre,seed:pattern.settings.seed,
    timing:{bpm:pattern.settings.bpm,lpb,tpl:12,bars:pattern.settings.bars,beatsPerBar:numerator,...(denominator!==4?{beatUnit:denominator}:{}),lines},
    sources:[],lanes:[],notes:[],warnings:[]};
  const usedSources=new Set<string>(), counts=new Map<string,number>(), columns=new Map<string,number>(), ids=new Set<string>();
  const laneOrder=(lane:string)=>{const standard=ROLES.indexOf(lane as typeof ROLES[number]);if(standard>=0)return standard;const custom=(pattern.userTracks??[]).findIndex(track=>track.id===lane);return ROLES.length+Math.max(0,custom);};
  const notes=pattern.events.map(hit=>{
    if(hit.mapped)resolveSlice(pattern,hit);
    validateArticulation(hit);
    if(hit.effect){
      if(!['0S','09','0B','0U','01','0D','02','0C','0R'].includes(hit.effect.command))throw Error('Unsupported tracker FX command.');
      bounded(hit.effect.param,0,255,'tracker FX parameter',true);
      if(hit.effect.command==='0B'&&hit.effect.param>1)throw Error('0B direction must be 00 (reverse) or 01 (forward).');
      out.warnings.push(`${hit.id}: tracker FX is available in the full pattern/project file, not the legacy Renoise transfer.`);
    }
    if(hit.reverse!==undefined&&typeof hit.reverse!=='boolean')throw Error('Invalid reverse flag.');
    if(hit.phaseInvert!==undefined&&typeof hit.phaseInvert!=='boolean')throw Error('Invalid phase invert flag.');
    if(hit.manual!==undefined&&typeof hit.manual!=='boolean')throw Error('Invalid manual hit flag.');
    if(hit.ratchets!==undefined)bounded(hit.ratchets,1,8,'ratchets',true);
    if(hit.gate!==undefined)bounded(hit.gate,.05,1,'gate');
    if(hit.decay!==undefined)bounded(hit.decay,.02,1,'decay');
    if(hit.playbackRate!==undefined)bounded(hit.playbackRate,.5,2,'sample speed');
    if(hit.speedMode!==undefined&&!['repitch','stretch'].includes(hit.speedMode))throw Error('Invalid hit speed mode.');
    if(hit.stretchRate!==undefined)bounded(hit.stretchRate,.5,2,'time-stretch speed');
    if(hit.sampleTrim){bounded(hit.sampleTrim.startMs,0,20000,'sample trim start');bounded(hit.sampleTrim.endMs,hit.sampleTrim.startMs+5,20000,'sample trim end');}
    if(hit.lowpassHz!==undefined)bounded(hit.lowpassHz,200,20000,'sample low-pass');
    if(hit.attackMs!==undefined)bounded(hit.attackMs,0,50,'sample attack');
    if(hit.pitch!==undefined)bounded(hit.pitch,-48,48,'pitch',true);
    if(hit.renderGain!==undefined)bounded(hit.renderGain,0,2,'render gain');
    if(hit.fineOffset!==undefined)bounded(hit.fineOffset,0,.9999999999,'fine offset');
    if(hit.slice){identifier(hit.slice.assetId,'audio asset');bounded(hit.slice.startFrame,0,23040000,'slice start',true);bounded(hit.slice.endFrame,hit.slice.startFrame+1,23040000,'slice end',true);bounded(hit.slice.sampleRate,8000,192000,'sample rate',true);}
    identifier(hit.id,'event ID');
    if(ids.has(hit.id)) throw new Error('Duplicate event ID.'); ids.add(hit.id);
    if(!ROLES.includes(hit.role)) throw new Error('Unsupported event role.');
    const userTrack=hit.trackId?trackMap.get(hit.trackId):undefined;
    if(hit.trackId&&(!userTrack||userTrack.role!==hit.role))throw new Error('Missing or mismatched user track.');
    if(hit.generatedDrumRole!==undefined&&(!userTrack||isSynthTrack(userTrack)||!ROLES.includes(hit.generatedDrumRole)))throw Error('Invalid generated sample-track hit.');
    if(isSynthTrack(userTrack)){
      if(!hit.synthNote||hit.slice||hit.mapped||hit.effect||hit.ratchets!==undefined||hit.gate!==undefined||hit.articulation||hit.reverse||hit.playbackRate!==undefined||hit.speedMode!==undefined||hit.stretchRate!==undefined||hit.sampleTrim||hit.pitch!==undefined||hit.ghost)throw Error('Synth tracks require pitched notes without sample or sample FX data.');
      bounded(hit.synthNote.note,0,119,'synth note',true);bounded(hit.synthNote.durationTicks,1,Math.max(PPQ*16,patternTicks(pattern.settings)),'synth note length',true);
    }else if(hit.synthNote)throw Error('A pitched synth note requires a synth track.');
    const source=sourceMap.get(hit.sourceId);
    if(!source || source.role!==hit.role) throw new Error(`Missing or mismatched source ${hit.sourceId}.`);
    bounded(hit.baseTick,0,patternTicks(pattern.settings)-1,'baseTick',true);
    bounded(hit.offsetTick,-PPQ,PPQ,'offsetTick',true);
    bounded(hit.gain,0,1,'gain'); bounded(hit.pan,-1,1,'pan');
    let position=Math.round((hit.baseTick+hit.offsetTick+(hit.fineOffset??0))*lpb/PPQ*256);
    const clamped=Math.max(0,Math.min(lines*256-1,position));
    if(clamped!==position)out.warnings.push(`${hit.id}: timing clamped at the pattern boundary.`);
    position=clamped; usedSources.add(source.id);
    return {id:hit.id,lane:userTrack?.id??hit.role,source:source.id,row:Math.floor(position/256),column:0,
      volume:Math.round(hit.gain*128),pan:Math.round((hit.pan+1)*64),delay:position%256};
  }).sort((a,b)=>a.row-b.row||a.delay-b.delay||laneOrder(a.lane)-laneOrder(b.lane)||(a.id<b.id?-1:a.id>b.id?1:0));
  for(const note of notes) {
    // One event per row/column even when the delays differ. Never overwrite.
    const key=`${note.lane}:${note.row}`;
    note.column=counts.get(key)??0;
    if(note.column>=12) throw new Error(`More than 12 notes in ${note.lane} row ${note.row}.`);
    counts.set(key,note.column+1); columns.set(note.lane,Math.max(columns.get(note.lane)??1,note.column+1));
  }
  out.notes=notes;
  if(notes.some(note=>{const track=trackMap.get(note.lane);return track&&!isSynthTrack(track);}))out.warnings.push('Custom sample-track audio is not embedded in tracker JSON. Use Download project + samples to preserve the WAV data.');
  if(notes.some(note=>isSynthTrack(trackMap.get(note.lane))))out.warnings.push('Use the full pattern/project file to preserve synth note pitches, lengths, and instrument settings.');
  out.sources=sources.filter(x=>usedSources.has(x.id)).map(({id,role,kind,label,note,instrument})=>({id,role,kind,label,note,instrument}));
  out.lanes=[...ROLES.filter(x=>columns.has(x)).map(id=>({id,name:drumLane(pattern,id).name,columns:columns.get(id)!})),...(pattern.userTracks??[]).filter(track=>columns.has(track.id)).map(track=>({id:track.id,name:track.name,columns:columns.get(track.id)!}))];

  return out;
}
export function serialize(transfer:Transfer):string {return JSON.stringify(transfer,null,2)+'\n';}
