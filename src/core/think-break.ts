import {PPQ,isSynthTrack,type Hit,type Pattern,type Role,type SampleTrack,type SliceInstrument} from './model.js';
import {random} from './random.js';
import {applyReverseProbability} from './reverse-probability.js';

export const THINK_BREAK_ASSET_ID='think-passage2-raw';
export const THINK_BREAK_RATE=44100;
export const THINK_BREAK_FRAMES=69255;
export const THINK_BREAK_INSTRUMENT_ID='think-passage2-drums';
export const THINK_VOCAL_INSTRUMENT_ID='think-passage2-uh';
const TRACK_ID='think-break-layer';

// Detector candidates on the bundled 1.42x WAV, reduced to musically useful
// attacks. The longer "uh" region is the user's 0.690–1.445 s source cut,
// translated into the repitched file; it intentionally overlaps drum slices.
export const THINK_SLICE_FRAMES=[0,8272,16720,25080,29216,33176,37400,41096,49192,57288,THINK_BREAK_FRAMES] as const;
export const THINK_SLICE_ROLES:readonly Role[]=['kick','hat','snare','hat','percussion','hat','percussion','hat','snare','hat'];
export const THINK_VOCAL_FRAMES=[21429,44876] as const;

function instruments(old?:Pattern):SliceInstrument[]{
  const saved=old?.sliceInstruments??[];
  const drums=saved.find(item=>item.id===THINK_BREAK_INSTRUMENT_ID)??{
    id:THINK_BREAK_INSTRUMENT_ID,name:'Think Passage 2 · drum slices',assetId:THINK_BREAK_ASSET_ID,
    sampleRate:THINK_BREAK_RATE,startFrame:0,endFrame:THINK_BREAK_FRAMES,loopFadeMs:2,
    slices:THINK_SLICE_FRAMES.slice(0,-1).map((startFrame,note)=>({id:`think-${note}`,note,startFrame,endFrame:THINK_SLICE_FRAMES[note+1]!})),
  };
  const vocal=saved.find(item=>item.id===THINK_VOCAL_INSTRUMENT_ID)??{
    id:THINK_VOCAL_INSTRUMENT_ID,name:'Think Passage 2 · uh phrase',assetId:THINK_BREAK_ASSET_ID,
    sampleRate:THINK_BREAK_RATE,startFrame:THINK_VOCAL_FRAMES[0],endFrame:THINK_VOCAL_FRAMES[1],loopFadeMs:2,
    slices:[{id:'think-uh',note:48,startFrame:THINK_VOCAL_FRAMES[0],endFrame:THINK_VOCAL_FRAMES[1]}],
  };
  return [structuredClone(drums),structuredClone(vocal)];
}

/** Add a deterministic sliced break without changing the kit's generated hits. */
export function addThinkBreakLayer(pattern:Pattern,guide:Pattern,old?:Pattern):Pattern{
  if(pattern.settings.breakLayer!=='think-passage2')return pattern;
  const existing=old?.userTracks?.find(track=>!isSynthTrack(track)&&track.generatedBreakLayer==='think-passage2') as SampleTrack|undefined;
  let id=existing?.id??TRACK_ID,suffix=2;
  while(!existing&&(old?.userTracks??[]).some(track=>track.id===id))id=`${TRACK_ID}-${suffix++}`;
  const track:SampleTrack=existing?structuredClone(existing):{
    id,name:'Think Break',kind:'sample',role:'percussion',generatedBreakLayer:'think-passage2',generationRole:null,
    sample:{assetId:THINK_BREAK_ASSET_ID,startFrame:0,endFrame:THINK_BREAK_FRAMES,sampleRate:THINK_BREAK_RATE,label:'Think Passage 2 · 1.42x'},
    level:.68,pan:0,mute:false,solo:false,
  };
  track.generationRole=null;
  const mapped=instruments(old),available=mapped[0]!.slices.map(slice=>slice.note);
  const groups=new Map<Role,number[]>((['kick','snare','hat','percussion'] as Role[]).map(role=>{
    const choices=mapped[0]!.slices.filter(slice=>{
      const originalIndex=slice.note<THINK_SLICE_ROLES.length?slice.note:THINK_SLICE_FRAMES.findIndex((frame,index)=>index<THINK_SLICE_ROLES.length&&slice.startFrame>=frame&&slice.startFrame<THINK_SLICE_FRAMES[index+1]!);
      return THINK_SLICE_ROLES[Math.max(0,originalIndex)]===role;
    }).map(slice=>slice.note);
    return [role,choices.length?choices:available];
  }));
  const settings=pattern.settings,variation=settings.variation??0,barTicks=4*PPQ,events:Hit[]=[];
  for(let bar=0;bar<settings.bars;bar++){
    const start=bar*barTicks,end=start+barTicks;
    const candidates=guide.events.filter(hit=>!hit.trackId&&hit.baseTick+hit.offsetTick>=start&&hit.baseTick+hit.offsetTick<end)
      .sort((a,b)=>Number(b.anchor)-Number(a.anchor)||b.gain-a.gain||a.baseTick-b.baseTick||a.id.localeCompare(b.id));
    const used=new Set<number>();let count=0;
    for(const hit of candidates){
      const location=hit.baseTick+hit.offsetTick,step=Math.round((location-start)/(PPQ/4));
      if(used.has(step)||count>=9)continue;
      const take=hit.anchor||random(settings.seed,`think-keep:${variation}:${bar}:${hit.id}`)()<(.1+settings.complexity*.48+(settings.spicy??0)*.2);
      if(!take)continue;
      const pool=groups.get(hit.role)!;
      const note=hit.anchor&&hit.role==='snare'?pool[bar%pool.length]!:pool[Math.floor(random(settings.seed,`think-slice:${variation}:${bar}:${hit.id}`)()*pool.length)]!;
      events.push({id:`think-${id}-${hit.id}`,role:'percussion',trackId:id,generatedDrumRole:hit.role,sourceId:'kit.percussion',sourceKind:'slice',
        baseTick:hit.baseTick,offsetTick:hit.offsetTick,gain:Math.min(1,Math.max(.24,hit.gain*(hit.anchor?.85:.65))),pan:0,
        anchor:hit.anchor,ghost:hit.ghost,mapped:{instrumentId:THINK_BREAK_INSTRUMENT_ID,note},
        articulation:{durationTicks:PPQ/2,mode:'gate'},reason:`Think Passage 2 ${hit.role} slice supports this ${settings.genre} groove.`});
      used.add(step);count++;
    }
  }
  // Keep the complete user-identified vocal cut intact as a phrase accent.
  const vocalBar=settings.bars-1;
  events.push({id:`think-${id}-uh-${vocalBar}`,role:'percussion',trackId:id,generatedDrumRole:'percussion',sourceId:'kit.percussion',sourceKind:'slice',
    baseTick:vocalBar*barTicks+2*PPQ,offsetTick:0,gain:.7,pan:0,anchor:false,ghost:false,
    mapped:{instrumentId:THINK_VOCAL_INSTRUMENT_ID,note:mapped[1]!.slices[0]!.note},articulation:{durationTicks:2*PPQ,mode:'gate'},
    reason:'The intact Think “uh” phrase answers the final backbeat.'});
  applyReverseProbability(events,settings);
  return {...pattern,userTracks:[...(pattern.userTracks??[]),track],sliceInstruments:[...(pattern.sliceInstruments??[]),...mapped],events:[...pattern.events,...events]};
}
