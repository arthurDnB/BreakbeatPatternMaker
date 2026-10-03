import {PPQ,type Settings} from './model.js';
import {meterGroups,parseTimeSignature} from './meter.js';
import type {V5AnchorMotif,V5Profile,V5LayerNote} from './groove-v5-contract.js';

/** Expand the authored vocabulary over additive groups, without wrapping over the bar. */
export function adaptV51Profile(profile:V5Profile,s:Settings):V5Profile{
 const meter=parseTimeSignature(s.timeSignature);
 if(meter.numerator===4&&meter.denominator===4)return profile;
 const length=meter.stepsPerBar,groups=meterGroups(s.timeSignature),unit=16/meter.denominator;
 const mapNotes=(notes:readonly V5LayerNote[],cadence=false):V5LayerNote[]=>{
  if(cadence)return notes.map(note=>({...note,step:Math.max(0,length-Math.min(8,length)+(note.step-8)/8*Math.min(8,length))})).filter(note=>note.step<length);
  // Repeat the original pulse at its original subdivision. Short measures are
  // cropped; the final partial phrase still receives its separately mapped cadence.
  const result:V5LayerNote[]=[];
  for(let offset=0;offset<length;offset+=16)for(const note of notes)if(offset+note.step<length)result.push({...note,step:offset+note.step});
  // Keep very long custom bars within the transfer's event budget. Admission
  // remains independent of Complexity, and covers the whole bar evenly.
  const budget=Math.max(1,Math.floor(700/Math.max(1,profile.layers.length)));
  return result.length<=budget?result:Array.from({length:budget},(_,i)=>result[Math.floor(i*result.length/budget)]!);
 };
 const anchorNotes:V5AnchorMotif['notes'][number][]=[];
 let start=0;
 for(const [index,group] of groups.entries()){
  anchorNotes.push({bar:0,step:start*unit,role:'kick',gain:index===0?.95:.84});
  // A denominator beat is the unit of grouping; compound 6/8 places the
  // backbeat on the second dotted-quarter pulse, rather than on beat two.
  const snare=meter.denominator===8&&meter.numerator%3===0
   ? (index%2===1?start*unit:undefined)
   : (start+(group===1?.5:group===3?1.5:1))*unit;
  if(snare!==undefined&&snare<length)anchorNotes.push({bar:0,step:snare,role:'snare',gain:.91});
  start+=group;
 }
 // Familiar triple-meter backbeat; 5/4 is explicitly grouped 3+2.
 if(meter.numerator===3&&meter.denominator===4){anchorNotes.splice(0,anchorNotes.length,{bar:0,step:0,role:'kick',gain:.95},{bar:0,step:8,role:'snare',gain:.92});}
 return {...profile,anchors:[{id:`meter-${meter.numerator}-${meter.denominator}`,bars:1,notes:anchorNotes}],
  layers:profile.layers.map(layer=>({...layer,notes:mapNotes(layer.notes)})),
  cadences:profile.cadences.map(cadence=>({...cadence,notes:mapNotes(cadence.notes,true)}))};
}

/** Named break presets are authored in 4/4 too; fit them without crossing bar ends. */
export function fitV51BreakMotif(motif:V5AnchorMotif,s:Settings):V5AnchorMotif{
 const factor=parseTimeSignature(s.timeSignature).barTicks/(PPQ*4);
 return factor===1?motif:{...motif,notes:motif.notes.map(note=>({...note,step:note.step*factor}))};
}
