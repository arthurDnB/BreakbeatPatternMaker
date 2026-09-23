import {DEFAULT_SOURCES, PPQ, ROLES, bounded, identifier, text, type Pattern, type Source, type Transfer} from './model.js';
import {validateSettings} from './generate.js';

export function compile(pattern: Pattern, sources: Source[] = DEFAULT_SOURCES, lpb = pattern.settings.resolution / 4): Transfer {
  validateSettings(pattern.settings);
  if(pattern.ppq!==PPQ) throw new Error('Unsupported PPQ.');
  bounded(lpb,1,32,'LPB',true);
  if (!Array.isArray(pattern.events) || pattern.events.length>4096) throw new Error('Too many events.');
  const lines=pattern.settings.bars*4*lpb;
  if(lines>512) throw new Error('This exporter supports at most 512 rows.');
  const sourceMap=new Map<string, Source>();
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
    timing:{bpm:pattern.settings.bpm,lpb,tpl:12,bars:pattern.settings.bars,beatsPerBar:4,lines},
    sources:[],lanes:[],notes:[],warnings:[]};
  const usedSources=new Set<string>(), counts=new Map<string,number>(), columns=new Map<string,number>(), ids=new Set<string>();
  const notes=pattern.events.map(hit=>{
    if(hit.reverse!==undefined&&typeof hit.reverse!=='boolean')throw Error('Invalid reverse flag.');
    if(hit.ratchets!==undefined)bounded(hit.ratchets,1,8,'ratchets',true);
    if(hit.gate!==undefined)bounded(hit.gate,.05,1,'gate');
    if(hit.pitch!==undefined)bounded(hit.pitch,-48,48,'pitch',true);
    if(hit.fineOffset!==undefined)bounded(hit.fineOffset,0,.9999999999,'fine offset');
    if(hit.slice){identifier(hit.slice.assetId,'audio asset');bounded(hit.slice.startFrame,0,23040000,'slice start',true);bounded(hit.slice.endFrame,hit.slice.startFrame+1,23040000,'slice end',true);bounded(hit.slice.sampleRate,8000,192000,'sample rate',true);}
    identifier(hit.id,'event ID');
    if(ids.has(hit.id)) throw new Error('Duplicate event ID.'); ids.add(hit.id);
    if(!ROLES.includes(hit.role)) throw new Error('Unsupported event role.');
    const source=sourceMap.get(hit.sourceId);
    if(!source || source.role!==hit.role) throw new Error(`Missing or mismatched source ${hit.sourceId}.`);
    bounded(hit.baseTick,0,pattern.settings.bars*4*PPQ-1,'baseTick',true);
    bounded(hit.offsetTick,-PPQ,PPQ,'offsetTick',true);
    bounded(hit.gain,0,1,'gain'); bounded(hit.pan,-1,1,'pan');
    let position=Math.round((hit.baseTick+hit.offsetTick+(hit.fineOffset??0))*lpb/PPQ*256);
    const clamped=Math.max(0,Math.min(lines*256-1,position));
    if(clamped!==position)out.warnings.push(`${hit.id}: timing clamped at the pattern boundary.`);
    position=clamped; usedSources.add(source.id);
    return {id:hit.id,lane:hit.role,source:source.id,row:Math.floor(position/256),column:0,
      volume:Math.round(hit.gain*128),pan:Math.round((hit.pan+1)*64),delay:position%256};
  }).sort((a,b)=>a.row-b.row||a.delay-b.delay||ROLES.indexOf(a.lane)-ROLES.indexOf(b.lane)||(a.id<b.id?-1:a.id>b.id?1:0));
  for(const note of notes) {
    // One event per row/column even when the delays differ. Never overwrite.
    const key=`${note.lane}:${note.row}`;
    note.column=counts.get(key)??0;
    if(note.column>=12) throw new Error(`More than 12 notes in ${note.lane} row ${note.row}.`);
    counts.set(key,note.column+1); columns.set(note.lane,Math.max(columns.get(note.lane)??1,note.column+1));
  }
  out.notes=notes;
  out.sources=sources.filter(x=>usedSources.has(x.id)).map(({id,role,kind,label,note,instrument})=>({id,role,kind,label,note,instrument}));
  out.lanes=ROLES.filter(x=>columns.has(x)).map(id=>({id,name:id[0]!.toUpperCase()+id.slice(1),columns:columns.get(id)!}));

  return out;
}
export function serialize(transfer:Transfer):string {return JSON.stringify(transfer,null,2)+'\n';}
