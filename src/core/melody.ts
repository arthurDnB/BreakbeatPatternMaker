import {PPQ,type Hit,type MelodyPart,type MelodyScale,type Settings} from './model.js';
import {melodyProfile} from './melody-profiles.js';
import {random} from './random.js';
import {validateSettings} from './settings.js';

export const MELODY_SCALES:Record<MelodyScale,{label:string;intervals:readonly number[]}>= {
  major:{label:'Major',intervals:[0,2,4,5,7,9,11]},
  'natural-minor':{label:'Natural Minor',intervals:[0,2,3,5,7,8,10]},
  'harmonic-minor':{label:'Harmonic Minor',intervals:[0,2,3,5,7,8,11]},
  'melodic-minor':{label:'Melodic Minor',intervals:[0,2,3,5,7,9,11]},
  dorian:{label:'Dorian',intervals:[0,2,3,5,7,9,10]},
  phrygian:{label:'Phrygian',intervals:[0,1,3,5,7,8,10]},
  lydian:{label:'Lydian',intervals:[0,2,4,6,7,9,11]},
  mixolydian:{label:'Mixolydian',intervals:[0,2,4,5,7,9,10]},
  locrian:{label:'Locrian',intervals:[0,1,3,5,6,8,10]},
  'major-pentatonic':{label:'Major Pentatonic',intervals:[0,2,4,7,9]},
  'minor-pentatonic':{label:'Minor Pentatonic',intervals:[0,3,5,7,10]},
  blues:{label:'Blues',intervals:[0,3,5,6,7,10]},
  'whole-tone':{label:'Whole Tone',intervals:[0,2,4,6,8,10]},
  diminished:{label:'Diminished',intervals:[0,2,3,5,6,8,9,11]},
  'double-harmonic':{label:'Double Harmonic',intervals:[0,1,4,5,7,8,11]},
  hirajoshi:{label:'Hirajoshi',intervals:[0,2,3,7,8]}
};
const BAR=4*PPQ,STEP=PPQ/4;
function chance(s:Settings,part:MelodyPart,stage:string,key:string,variation=true):number{
  return random(s.seed,`melody:${s.genre}:${part}:${stage}:${variation?s.variation??0:0}:${key}`)();
}
function scalePitch(key:number,scale:readonly number[],degree:number):number{
  const octave=Math.floor(degree/scale.length),index=((degree%scale.length)+scale.length)%scale.length;
  return key+12*octave+scale[index]!;
}
function harmonicRoot(progressionDegree:number,scale:readonly number[]):number{
  // Seven-degree genre templates remain usable in five-, six- and eight-note scales.
  return Math.round(progressionDegree*(scale.length-1)/6);
}
function functionalOffset(scale:readonly number[],rootDegree:number,token:number):number{
  if(token>=-1&&token<=1)return token;
  const target:Record<number,number>={2:3.5,3:5,4:7,5:9,6:11};
  const desired=target[Math.abs(token)];
  if(desired===undefined)return token;
  const direction=Math.sign(token),root=scalePitch(0,scale,rootDegree);
  let best=direction,bestError=Infinity;
  for(let distance=1;distance<=scale.length;distance++){
    const offset=distance*direction,semitones=Math.abs(scalePitch(0,scale,rootDegree+offset)-root);
    const error=Math.abs(semitones-desired);
    if(error<bestError){best=offset;bestError=error;}
  }
  return best;
}
function voiceLead(key:number,scale:readonly number[],degree:number,low:number,high:number,previous:number|undefined,part:MelodyPart):number{
  const pitchClass=((scalePitch(key,scale,degree)%12)+12)%12;
  const centre=(low+high)/2-(part==='bassline'?3:0);
  const candidates:number[]=[];
  for(let note=low;note<=high;note++)if(note%12===pitchClass)candidates.push(note);
  if(!candidates.length)throw Error('Melody register contains no note from the selected scale.');
  const target=previous??centre;
  return candidates.reduce((best,note)=>{
    const cost=(value:number)=>Math.abs(value-target)+(previous===undefined?.15:.08)*Math.abs(value-centre)+
      (previous!==undefined&&Math.abs(value-previous)>7?4:0);
    return cost(note)<cost(best)?note:best;
  });
}
function chordRole(offset:number):string{
  return offset===0?'root':offset===2?'third':offset===4?'fifth':'connecting tone';
}
function breakScaleRun(note:number,recent:readonly number[],key:number,scale:readonly number[],rootDegree:number,low:number,high:number):number{
  if(recent.length<3)return note;
  const a=recent[recent.length-3]!,b=recent[recent.length-2]!,c=recent[recent.length-1]!;
  if(!(a<b&&b<c&&c<note&&b-a<=4&&c-b<=4&&note-c<=4))return note;
  const choices:number[]=[];
  for(const tone of [0,2,4]){
    const pitchClass=((scalePitch(key,scale,rootDegree+functionalOffset(scale,rootDegree,tone))%12)+12)%12;
    for(let candidate=low;candidate<=high;candidate++)if(candidate%12===pitchClass&&candidate<=c&&candidate>=c-9)choices.push(candidate);
  }
  return choices.sort((x,y)=>Math.abs(x-c)-Math.abs(y-c))[0]??c;
}
/** Seeded phrase composition, independent of whichever drum engine is selected. */
export function generateMelody(settings:Settings,trackId:string):Hit[]{
  validateSettings(settings);
  const part=settings.melodyPart??'bassline',profile=melodyProfile(settings.genre,part);
  const key=settings.melodyKey??0,scale=MELODY_SCALES[settings.melodyScale??'natural-minor'].intervals;
  const progressions=profile.progressions,contours=profile.contours;
  // Harmony uses a part-independent stream so separately generated bass and lead agree.
  const harmonyIndex=Math.floor(random(settings.seed,`melody:harmony:${settings.genre}:${settings.variation??0}`)()*progressions.length);
  const progression=progressions[harmonyIndex]!;
  const motifIndex=Math.floor(chance(settings,part,'contour','phrase')*contours.length);
  const output:Hit[]=[];
  let previous:number|undefined;
  const recent:number[]=[];
  for(let bar=0;bar<settings.bars;bar++){
    const response=bar%2===1&&settings.complexity>=.3;
    const coreSteps=response?profile.response:profile.motif;
    const steps=[...coreSteps];
    const chordDegree=harmonicRoot(progression[Math.floor(bar*progression.length/settings.bars)]!,scale);
    const contour=contours[response&&settings.complexity>=.65?(motifIndex+1)%contours.length:motifIndex]!;
    for(const step of profile.details){
      if(!steps.includes(step)&&settings.complexity>=.35+.5*chance(settings,part,'detail-threshold',`${bar}:${step}`,false)&&chance(settings,part,'detail-density',`${bar}:${step}`)<settings.complexity)steps.push(step);
    }
    steps.sort((a,b)=>a-b);
    const details=new Set(profile.details);
    // One phrase-ending pickup leads into the final note; it does not pepper every bar.
    if(bar===settings.bars-1&&(settings.spicy??0)>=.35&&coreSteps.length>0){
      const target=coreSteps[coreSteps.length-1]!;
      const pickup=target>0?target-.5:target+.5;
      if(pickup>=0&&pickup<16&&!steps.includes(pickup)&&chance(settings,part,'pickup',String(bar))<(settings.spicy??0))steps.push(pickup);
      steps.sort((a,b)=>a-b);
    }
    for(const [index,step] of steps.entries()){
      const baseTick=Math.round(bar*BAR+step*STEP),nextTick=Math.round(bar*BAR+(steps[index+1]??16)*STEP);
      const ornament=!Number.isInteger(step),extra=details.has(step);
      const coreIndex=coreSteps.indexOf(step),following=coreSteps.findIndex(value=>value>=step);
      const nearIndex=following<0?coreSteps.length-1:following;
      let offset=contour[(coreIndex>=0?coreIndex:nearIndex)%contour.length]!;
      if(response&&step===coreSteps[coreSteps.length-1])offset=0;
      if(extra)offset+=chance(settings,part,'passing',`${bar}:${step}`)<.5?-1:1;
      if(ornament)offset+=chance(settings,part,'ornament',`${bar}:${step}`)<.5?-1:1;
      let note=voiceLead(key,scale,chordDegree+functionalOffset(scale,chordDegree,offset),profile.low,profile.high,previous,part);
      if(part==='lead'&&!ornament&&(settings.spicy??0)>.7&&index===1&&note+12<=profile.high&&chance(settings,part,'octave',`${bar}:${step}`)<settings.spicy!)note+=12;
      note=breakScaleRun(note,recent,key,scale,chordDegree,profile.low,profile.high);
      recent.push(note);if(recent.length>3)recent.shift();
      if(!ornament)previous=note;
      const swung=step%2===1?Math.round((settings.swing-.5)*2*STEP*.55):0;
      const humanize=Math.round((chance(settings,part,'timing',`${bar}:${step}`,false)*2-1)*settings.humanizeMs*settings.bpm*PPQ/60000);
      const offsetTick=Math.max(-baseTick,Math.min(settings.bars*BAR-1-baseTick,swung+humanize));
      const durationTicks=Math.max(1,Math.min(Math.round(Math.min(nextTick-baseTick,profile.maxBeats*PPQ)*profile.gate),settings.bars*BAR-baseTick));
      const gain=ornament?.42:extra?.58:step===0?.84:.68;
      const phrase=ornament?'phrase pickup':extra?'connecting detail':response?'motif response':'repeated motif';
      output.push({id:`melody-${part}-${baseTick}`,role:'percussion',trackId,sourceId:'kit.percussion',baseTick,offsetTick,gain,pan:0,anchor:false,ghost:false,synthNote:{note,durationTicks},reason:`${part==='bassline'?'Bassline':'Lead'} ${phrase}: ${chordRole(offset)} of the bar's degree ${chordDegree+1} harmony in ${MELODY_SCALES[settings.melodyScale??'natural-minor'].label}.`});
    }
  }
  return output;
}
