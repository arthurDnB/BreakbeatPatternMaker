import {ROLES,isSynthTrack,type DrumLane,type Hit,type Pattern,type Role} from './model.js';

const DEFAULT_NAMES:Record<Role,string>={kick:'Kick',snare:'Snare',hat:'Hat',percussion:'Percussion'};

export function drumLane(pattern:Pattern,role:Role):DrumLane{
  return pattern.drumLanes?.[role]??{name:DEFAULT_NAMES[role],visible:true,generationRole:role};
}

function routedId(id:string,lane:string):string{
  let hash=2166136261;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return `${lane}-${id.slice(0,60)}-${hash.toString(16).padStart(8,'0')}`;
}

/** Route generator roles into visible sample lanes without changing those lanes' audio identities. */
export function routeGeneratedDrums(generated:Pattern,layout:Pattern):Pattern{
  if(!layout.drumLanes&&!(layout.userTracks??[]).some(track=>!isSynthTrack(track)&&track.generationRole))return generated;
  const targets=new Map<Role,{id:string;role:Role;name:string;custom:boolean}[]>(ROLES.map(role=>[role,[...ROLES.filter(lane=>{
    const config=drumLane(layout,lane);
    return config.visible&&config.generationRole===role;
  }).map(lane=>({id:lane,role:lane,name:drumLane(layout,lane).name,custom:false})),...(layout.userTracks??[]).filter(track=>!isSynthTrack(track)&&track.generationRole===role).map(track=>({id:track.id,role:track.role,name:track.name,custom:true}))]]));
  const events=generated.events.flatMap((hit):Hit[]=>{
    if(hit.trackId)return [hit];
    return targets.get(hit.role)!.map(lane=>({...hit,
      id:lane.id===hit.role&&!lane.custom?hit.id:routedId(hit.id,lane.id),role:lane.role,sourceId:`kit.${lane.role}`,
      ...(lane.custom?{trackId:lane.id,generatedDrumRole:hit.role}:{}),
      reason:`${hit.reason} Routed to ${lane.name}.`
    }));
  });
  if(generated.events.some(hit=>!hit.trackId)&&!events.length)throw Error('Assign a generation role to at least one drum or sample track before generating a beat.');
  return {...generated,drumLanes:structuredClone(layout.drumLanes),events};
}
