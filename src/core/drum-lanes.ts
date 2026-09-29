import {ROLES,type DrumLane,type Hit,type Pattern,type Role} from './model.js';

const DEFAULT_NAMES:Record<Role,string>={kick:'Kick',snare:'Snare',hat:'Hat',percussion:'Percussion'};

export function drumLane(pattern:Pattern,role:Role):DrumLane{
  return pattern.drumLanes?.[role]??{name:DEFAULT_NAMES[role],visible:true,generationRole:role};
}

function routedId(id:string,lane:Role):string{
  let hash=2166136261;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return `${lane}-${id.slice(0,60)}-${hash.toString(16).padStart(8,'0')}`;
}

/** Route generator roles into visible sample lanes without changing those lanes' audio identities. */
export function routeGeneratedDrums(generated:Pattern,layout:Pattern):Pattern{
  if(!layout.drumLanes)return generated;
  const targets=new Map<Role,Role[]>(ROLES.map(role=>[role,ROLES.filter(lane=>{
    const config=drumLane(layout,lane);
    return config.visible&&config.generationRole===role;
  })]));
  const events=generated.events.flatMap((hit):Hit[]=>{
    if(hit.trackId)return [hit];
    return targets.get(hit.role)!.map(lane=>({...hit,
      id:lane===hit.role?hit.id:routedId(hit.id,lane),role:lane,sourceId:`kit.${lane}`,
      reason:`${hit.reason} Routed to ${drumLane(layout,lane).name}.`
    }));
  });
  if(generated.events.some(hit=>!hit.trackId)&&!events.length)throw Error('Assign a generation role to at least one visible drum lane before generating a beat.');
  return {...generated,drumLanes:structuredClone(layout.drumLanes),events};
}
