import {bounded,type SynthInstrument,type SynthPreset,type SynthWaveform} from '../core/model.js';

export const SYNTH_PRESETS:Record<SynthPreset,SynthInstrument>={
  bass:{preset:'bass',waveform:'saw',attack:.006,decay:.16,sustain:.55,release:.12,lowpassHz:1400},
  pluck:{preset:'pluck',waveform:'triangle',attack:.003,decay:.22,sustain:.12,release:.14,lowpassHz:5200},
  pad:{preset:'pad',waveform:'saw',attack:.14,decay:.45,sustain:.62,release:.75,lowpassHz:2300},
};

export function validateSynthInstrument(value:SynthInstrument):void{
  if(!value||!['bass','pluck','pad'].includes(value.preset)||!['sine','triangle','saw','square'].includes(value.waveform))throw Error('Invalid synth instrument.');
  bounded(value.attack,.001,2,'synth attack');bounded(value.decay,.001,3,'synth decay');bounded(value.sustain,0,1,'synth sustain');
  bounded(value.release,.01,4,'synth release');bounded(value.lowpassHz,100,20000,'synth filter');
}

const polyBlep=(phase:number,step:number)=>{
  if(phase<step){const t=phase/step;return t+t-t*t-1;}
  if(phase>1-step){const t=(phase-1)/step;return t*t+t+t+1;}
  return 0;
};
/** Deterministic PCM voice shared by pattern preview, song preview, and WAV export. */
export function renderSynthNote(note:number,durationSeconds:number,rate:number,instrument:SynthInstrument):Float32Array{
  validateSynthInstrument(instrument);
  bounded(note,0,119,'synth note',true);bounded(durationSeconds,.001,40,'synth note duration');
  const frequency=Math.min(440*2**((note-69)/12),rate*.45),step=frequency/rate;
  const total=Math.ceil((durationSeconds+instrument.release)*rate),data=new Float32Array(total);
  const cutoff=Math.min(instrument.lowpassHz,rate*.45),filter=Math.exp(-2*Math.PI*cutoff/rate);
  let phase=0,filtered=0;
  const heldEnvelope=(time:number)=>time<instrument.attack?time/instrument.attack:instrument.sustain+(1-instrument.sustain)*Math.exp(-(time-instrument.attack)/instrument.decay);
  const releaseStart=heldEnvelope(durationSeconds);
  for(let i=0;i<total;i++){
    const time=i/rate,tail=Math.min(1,(total-i)/Math.max(1,Math.round(rate*.003)));
    const env=(time<durationSeconds?heldEnvelope(time):releaseStart*Math.exp(-9*(time-durationSeconds)/instrument.release))*tail;
    let wave:number;
    switch(instrument.waveform as SynthWaveform){
      case 'sine':wave=Math.sin(phase*2*Math.PI);break;
      case 'triangle':wave=1-4*Math.abs(phase-.5);break;
      case 'square':wave=(phase<.5?1:-1)+polyBlep(phase,step)-polyBlep((phase+.5)%1,step);break;
      default:wave=2*phase-1-polyBlep(phase,step);
    }
    filtered=(1-filter)*wave+filter*filtered;
    data[i]=filtered*env*.48;
    phase+=step;phase-=Math.floor(phase);
  }
  return data;
}
