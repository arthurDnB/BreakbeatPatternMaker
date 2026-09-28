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
function inRange(key:number,interval:number,low:number,high:number):number{
  let pitch=key+12*Math.ceil((low-key)/12)+interval;
  while(pitch>high)pitch-=12;
  while(pitch<low)pitch+=12;
  return pitch;
}
/** Genre-aware monophonic motifs, independent of whichever drum engine is selected. */
export function generateMelody(settings:Settings,trackId:string):Hit[]{
  validateSettings(settings);
  const part=settings.melodyPart??'bassline',profile=melodyProfile(settings.genre,part);
  const key=settings.melodyKey??0,scale=MELODY_SCALES[settings.melodyScale??'natural-minor'].intervals;
  const fifth=Math.max(0,scale.reduce((best,value,index)=>Math.abs(value-7)<Math.abs(scale[best]!-7)?index:best,0));
  const stable=part==='bassline'?[0,fifth,0,Math.min(2,scale.length-1)]:[0,Math.min(2,scale.length-1),fifth,Math.min(3,scale.length-1)];
  const output:Hit[]=[];
  for(let bar=0;bar<settings.bars;bar++){
    const response=bar%2===1&&settings.complexity>=.3;
    const steps=[...(response?profile.response:profile.motif)];
    for(const step of profile.details){
      if(settings.complexity>=.35+.5*chance(settings,part,'detail-threshold',`${bar}:${step}`,false)&&chance(settings,part,'detail-density',`${bar}:${step}`)<settings.complexity)steps.push(step);
    }
    steps.sort((a,b)=>a-b);
    const details=new Set(profile.details),baseCount=steps.length;
    if((settings.spicy??0)>=.35&&baseCount>0){
      const target=steps[baseCount-1]!;
      const pickup=target>0?target-.5:target+.5;
      if(pickup>=0&&pickup<16&&!steps.includes(pickup)&&chance(settings,part,'pickup',String(bar))<(settings.spicy??0))steps.push(pickup);
      steps.sort((a,b)=>a-b);
    }
    for(const [index,step] of steps.entries()){
      const baseTick=Math.round(bar*BAR+step*STEP),nextTick=Math.round(bar*BAR+(steps[index+1]??16)*STEP);
      const ornament=!Number.isInteger(step),extra=details.has(step);
      const originalIndex=profile.motif.indexOf(step),degreeIndex=originalIndex>=0?originalIndex:index;
      let degree=stable[degreeIndex%stable.length]!;
      if(response&&index===steps.length-1)degree=0;
      if(extra||ornament)degree=scale.length>3?Math.min(scale.length-1,degree+1):degree;
      const interval=scale[degree]!;
      let note=inRange(key,interval,profile.low,profile.high);
      if(part==='lead'&&!ornament&&(settings.spicy??0)>.7&&index===1&&note+12<=profile.high&&chance(settings,part,'octave',`${bar}:${step}`)<settings.spicy!)note+=12;
      const swung=step%2===1?Math.round((settings.swing-.5)*2*STEP*.55):0;
      const humanize=Math.round((chance(settings,part,'timing',`${bar}:${step}`,false)*2-1)*settings.humanizeMs*settings.bpm*PPQ/60000);
      const offsetTick=Math.max(-baseTick,Math.min(settings.bars*BAR-1-baseTick,swung+humanize));
      const durationTicks=Math.max(1,Math.min(Math.round(Math.min(nextTick-baseTick,profile.maxBeats*PPQ)*profile.gate),settings.bars*BAR-baseTick));
      const gain=ornament?.42:extra?.58:step===0?.84:.68;
      output.push({id:`melody-${part}-${baseTick}`,role:'percussion',trackId,sourceId:'kit.percussion',baseTick,offsetTick,gain,pan:0,anchor:false,ghost:false,synthNote:{note,durationTicks},reason:`${part==='bassline'?'Bassline':'Lead'} ${ornament?'pickup':extra?'detail':response?'response':'motif'} in ${MELODY_SCALES[settings.melodyScale??'natural-minor'].label}.`});
    }
  }
  return output;
}
