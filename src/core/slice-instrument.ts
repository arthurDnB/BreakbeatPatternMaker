import {bounded,identifier,text,type Pattern,type Hit,type SliceRef,type SliceInstrument} from './model.js';

export function validateSliceInstruments(pattern:Pattern):void {
  if(pattern.sliceInstruments===undefined)return;
  if(!Array.isArray(pattern.sliceInstruments)||pattern.sliceInstruments.length>32)throw Error('Invalid slice instruments.');
  const ids=new Set<string>();
  for(const instrument of pattern.sliceInstruments){
    identifier(instrument.id,'slice instrument');identifier(instrument.assetId,'slice asset');text(instrument.name,'instrument name');
    if(ids.has(instrument.id))throw Error('Duplicate slice instrument.');ids.add(instrument.id);
    bounded(instrument.sampleRate,8000,192000,'sample rate',true);
    bounded(instrument.startFrame,0,23040000,'region start',true);bounded(instrument.endFrame,instrument.startFrame+1,23040000,'region end',true);
    if(instrument.loopFadeMs!==undefined)bounded(instrument.loopFadeMs,0,10,'loop smoothing');
    if(!Array.isArray(instrument.slices)||!instrument.slices.length||instrument.slices.length>120)throw Error('A slice instrument needs 1–120 slices.');
    const notes=new Set<number>(),sliceIds=new Set<string>();let previous=instrument.startFrame;
    for(const slice of instrument.slices){
      identifier(slice.id,'slice ID');bounded(slice.note,0,119,'slice note',true);
      if(notes.has(slice.note)||sliceIds.has(slice.id))throw Error('Duplicate slice key or ID.');notes.add(slice.note);sliceIds.add(slice.id);
      if(slice.startFrame!==previous)throw Error('Slices must cover the region without gaps.');
      bounded(slice.endFrame,slice.startFrame+1,instrument.endFrame,'slice end',true);previous=slice.endFrame;
    }
    if(previous!==instrument.endFrame)throw Error('Slices must cover the whole region.');
  }
}
export function mappedInstrument(pattern:Pattern,hit:Hit):SliceInstrument|undefined {
  if(!hit.mapped)return undefined;
  identifier(hit.mapped.instrumentId,'mapped instrument');bounded(hit.mapped.note,0,119,'mapped note',true);
  const instrument=pattern.sliceInstruments?.find(i=>i.id===hit.mapped!.instrumentId);
  if(!instrument)throw Error('Missing mapped slice instrument.');return instrument;
}
export function resolveSlice(pattern:Pattern,hit:Hit):SliceRef|undefined {
  const instrument=mappedInstrument(pattern,hit);if(!instrument)return hit.slice;
  const slice=instrument.slices.find(s=>s.note===hit.mapped!.note);
  if(!slice)throw Error('This note has no mapped slice.');
  return {assetId:instrument.assetId,sampleRate:instrument.sampleRate,startFrame:slice.startFrame,endFrame:slice.endFrame,label:instrument.name+' / Slice '+(instrument.slices.indexOf(slice)+1)};
}
export function resolvePatternSlices(pattern:Pattern):Pattern {
  return {...pattern,events:pattern.events.map(hit=>hit.mapped?{...hit,slice:resolveSlice(pattern,hit),sourceKind:'slice'}:hit)};
}
