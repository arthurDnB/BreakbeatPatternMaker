import {bounded, PPQ, type Hit} from './model.js';

export function validateArticulation(hit:Hit):void {
  if(hit.sourceKind!==undefined&&!['oneShot','slice'].includes(hit.sourceKind))throw Error('Invalid sound source kind.');
  const a=hit.articulation;
  if(a===undefined)return;
  if(!a||typeof a!=='object'||!['natural','gate','chop'].includes(a.mode))throw Error('Invalid articulation mode.');
  bounded(a.durationTicks,1,4*PPQ,'articulation duration',true);
  if(a.chokeGroup!==undefined&&a.chokeGroup!=='hat')throw Error('Invalid choke group.');
  if(a.repeats!==undefined){
    if(!Array.isArray(a.repeats)||a.repeats.length!==(hit.ratchets??1)||a.repeats.length>8)throw Error('Repeat expression must match ratchets.');
    for(const r of a.repeats){
      if(!r||typeof r!=='object')throw Error('Invalid repeat expression.');
      bounded(r.gain,0,1,'repeat gain');
      if(r.pitch!==undefined)bounded(r.pitch,-24,24,'repeat pitch');
      if(r.glide!==undefined)bounded(r.glide,-24,24,'repeat glide');
      if(r.sourceOffset!==undefined)bounded(r.sourceOffset,0,.95,'repeat source offset');
      if(r.reverse!==undefined&&typeof r.reverse!=='boolean')throw Error('Invalid repeat reverse flag.');
    }
  }
}

/** Explicitly editing a repeat count starts a uniform gesture; unrelated edits keep expression. */
export function setRatchets(hit:Hit,count:number,rowTicks:number):Hit {
  const next=structuredClone(hit);next.ratchets=count;
  if(hit.articulation){
    next.articulation={...hit.articulation,mode:count>1?'gate':hit.gate===undefined?'natural':'gate',
      durationTicks:hit.articulation.durationTicks||rowTicks};
    delete next.articulation.repeats;
  }
  return next;
}

export function articulationLabel(hit:Hit):string {
  const a=hit.articulation;if(!a)return '';
  const parts=[a.mode==='natural'?'Natural tail':a.mode==='chop'?'Micro-chop':'Gated'];
  if((hit.ratchets??1)>1)parts.push(`${hit.ratchets} hits over ${+(a.durationTicks/PPQ).toFixed(3)} beat${a.durationTicks===PPQ?'':'s'}`);
  if(a.repeats?.some(r=>r.gain!==1))parts.push('velocity contour');
  if(a.repeats?.some(r=>r.pitch||r.glide))parts.push('pitch movement');
  if(a.repeats?.some(r=>r.reverse))parts.push('reverse accent');
  if(a.chokeGroup)parts.push('hat choke');
  return parts.join(' · ');
}
