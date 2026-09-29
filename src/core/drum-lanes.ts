import {ROLES,isSynthTrack,type DrumLane,type Hit,type Pattern,type Role,type SampleTrack} from './model.js';
import {random} from './random.js';

const DEFAULT_NAMES:Record<Role,string>={kick:'Kick',snare:'Snare',hat:'Hat',percussion:'Percussion'};

export function drumLane(pattern:Pattern,role:Role):DrumLane{
  return pattern.drumLanes?.[role]??{name:DEFAULT_NAMES[role],visible:true,generationRole:role};
}

function routedId(id:string,lane:string):string{
  let hash=2166136261;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return `${lane}-${id.slice(0,60)}-${hash.toString(16).padStart(8,'0')}`;
}

/** Keep strong optional hits consistently; variation chance then changes their membership per variation. */
function admittedHits(generated:Pattern,track:SampleTrack):Set<string>{
  const source=generated.events.filter(hit=>!hit.trackId&&hit.role===track.generationRole);
  const anchors=source.filter(hit=>hit.anchor);
  const optional=source.filter(hit=>!hit.anchor);
  const density=track.generationDensity??1,probability=track.generationProbability??1;
  const ranked=density<1?optional.map(hit=>({hit,score:hit.gain-(hit.ghost?.35:0)+random(generated.settings.seed,`track-density:${track.id}:${hit.id}`)()*.15}))
    .sort((a,b)=>b.score-a.score||a.hit.baseTick-b.hit.baseTick||(a.hit.id<b.hit.id?-1:a.hit.id>b.hit.id?1:0))
    .slice(0,Math.round(optional.length*density)).map(item=>item.hit):optional;
  return new Set([...anchors,...ranked.filter(hit=>probability>=1||random(generated.settings.seed,`track-chance:${track.id}:${generated.settings.variation??0}:${hit.id}`)()<probability)].map(hit=>hit.id));
}

/** Route generator roles into visible sample lanes without changing those lanes' audio identities. */
export function routeGeneratedDrums(generated:Pattern,layout:Pattern):Pattern{
  if(!layout.drumLanes&&!(layout.userTracks??[]).some(track=>!isSynthTrack(track)&&track.generationRole))return generated;
  const targets=new Map<Role,{id:string;role:Role;name:string;custom:boolean}[]>(ROLES.map(role=>[role,[...ROLES.filter(lane=>{
    const config=drumLane(layout,lane);
    return config.visible&&config.generationRole===role;
  }).map(lane=>({id:lane,role:lane,name:drumLane(layout,lane).name,custom:false})),...(layout.userTracks??[]).filter(track=>!isSynthTrack(track)&&track.generationRole===role).map(track=>({id:track.id,role:track.role,name:track.name,custom:true}))]]));
  if(generated.events.some(hit=>!hit.trackId)&&![...targets.values()].some(lanes=>lanes.length))throw Error('Assign a generation role to at least one drum or sample track before generating a beat.');
  const admitted=new Map((layout.userTracks??[]).filter((track):track is SampleTrack=>!isSynthTrack(track)&&!!track.generationRole).map(track=>[track.id,admittedHits(generated,track)]));
  const events=generated.events.flatMap((hit):Hit[]=>{
    if(hit.trackId)return [hit];
    return targets.get(hit.role)!.filter(lane=>!lane.custom||admitted.get(lane.id)?.has(hit.id)).map(lane=>({...hit,
      id:lane.id===hit.role&&!lane.custom?hit.id:routedId(hit.id,lane.id),role:lane.role,sourceId:`kit.${lane.role}`,
      ...(lane.custom?{trackId:lane.id,generatedDrumRole:hit.role}:{}),
      reason:`${hit.reason} Routed to ${lane.name}.`
    }));
  });
  return {...generated,drumLanes:structuredClone(layout.drumLanes),events};
}
