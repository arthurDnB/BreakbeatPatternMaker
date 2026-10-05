import {bounded,type SynthInstrument,type SynthWaveform} from '../core/model.js';
import type {AudioAsset} from './slices.js';
import {validateSynthInstrument} from '../core/synth-presets.js';
import {renderModularSynthNote} from './modular-synth.js';
export {SYNTH_PRESET_CATALOG,SYNTH_PRESETS,validateSynthInstrument} from '../core/synth-presets.js';

// Renderer only: the preset catalogue and validation were moved to ../core/synth-presets.js.
/** Pitch a user piano note without BPM stretching; preview and export call this same renderer. */
export function renderSampledPianoNote(note:number,durationSeconds:number,rate:number,instrument:SynthInstrument,asset:AudioAsset):Float32Array[]{
  if(!instrument.sample||instrument.sample.assetId!==asset.id)throw Error('Missing piano sample.');
  const ratio=2**((note-instrument.sample.rootNote)/12),step=asset.sampleRate/rate*ratio;
  const length=Math.max(1,Math.min(Math.ceil((durationSeconds+instrument.release)*rate),Math.ceil(asset.channels[0]!.length/step)));
  const output=asset.channels.map(()=>new Float32Array(length));
  const fadeIn=Math.max(1,Math.round(rate*.006)),fadeOut=Math.max(1,Math.round(rate*.012));
  for(let i=0;i<length;i++){
    const source=i*step,index=Math.floor(source),fraction=source-index,time=i/rate;
    const release=time<durationSeconds?1:Math.exp(-7*(time-durationSeconds)/instrument.release);
    const edge=Math.min(1,i/fadeIn,(length-1-i)/fadeOut);
    for(let channel=0;channel<output.length;channel++){
      const data=asset.channels[channel]!;
      output[channel]![i]=((data[index]??0)*(1-fraction)+(data[Math.min(data.length-1,index+1)]??0)*fraction)*release*Math.max(0,edge)*.58;
    }
  }
  return output;
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
  if(instrument.patch)return renderModularSynthNote(note,durationSeconds,rate,instrument.patch);
  if(instrument.preset==='piano')return renderPianoNote(note,durationSeconds,rate,instrument);
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

/** Lightweight deterministic piano voice: inharmonic partials decay at different rates like struck strings. */
function renderPianoNote(note:number,durationSeconds:number,rate:number,instrument:SynthInstrument):Float32Array{
  const frequency=Math.min(440*2**((note-69)/12),rate*.42),total=Math.ceil((durationSeconds+instrument.release)*rate);
  const data=new Float32Array(total),partials=[1,.62,.39,.27,.19,.14,.105,.078,.058],decays=[2.2,1.35,.92,.69,.53,.42,.34,.28,.23];
  const phases=partials.map(()=>0),steps=partials.map((_,i)=>frequency*(i+1)*Math.sqrt(1+.00016*(i+1)**2)/rate);
  const cutoff=Math.min(instrument.lowpassHz,rate*.45),filter=Math.exp(-2*Math.PI*cutoff/rate);let filtered=0;
  for(let i=0;i<total;i++){
    const time=i/rate,release=time<durationSeconds?1:Math.exp(-7*(time-durationSeconds)/instrument.release);
    let string=0;
    for(let partial=0;partial<partials.length;partial++){
      const step=steps[partial]!;if(step>=.5)continue;
      const phase=phases[partial]!;string+=Math.sin(phase*2*Math.PI)*partials[partial]!*Math.exp(-time/decays[partial]!);
      phases[partial]=phase+step-Math.floor(phase+step);
    }
    filtered=(1-filter)*string+filter*filtered;
    const hammer=1+.28*Math.exp(-time/.006),edge=Math.min(1,(total-i)/Math.max(1,rate*.004));
    data[i]=filtered*.235*release*hammer*edge;
  }
  return data;
}
