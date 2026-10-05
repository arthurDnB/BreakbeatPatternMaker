import {bounded,type SynthInstrument,type SynthPreset,type SynthPresetDefinition} from './model.js';
import {validateSynthPatch} from './synth-modules.js';

// Synth preset *catalogue and validation* live in core so headless compilation
// never imports from the audio layer. Pure PCM rendering stays in
// src/audio/synth-instrument.ts, which re-exports these names.
export const SYNTH_PRESET_CATALOG:Record<SynthPreset,SynthPresetDefinition>={
  bass:{id:'bass',name:'Basic Bass',category:'Bass',description:'Punchy general-purpose sawtooth bass',waveform:'saw',attack:.006,decay:.16,sustain:.55,release:.12,lowpassHz:1400},
  reese:{id:'reese',name:'Classic Reese',category:'Bass',description:'Warm detuned saw motion for jungle and drum & bass',waveform:'saw',attack:.008,decay:.35,sustain:.75,release:.22,lowpassHz:920},
  acid303:{id:'acid303',name:'Acid 303',category:'Bass',description:'Resonant snappy squelch for acid house and techno',waveform:'saw',attack:.003,decay:.26,sustain:.18,release:.14,lowpassHz:1850},
  sub808:{id:'sub808',name:'Sub 808',category:'Bass',description:'Deep, clean sub-bass punch',waveform:'sine',attack:.002,decay:.72,sustain:.38,release:.35,lowpassHz:240},
  donk:{id:'donk',name:'Donk / Solid',category:'Bass',description:'Punchy transient bass for UK garage and bounce',waveform:'triangle',attack:.002,decay:.14,sustain:.42,release:.08,lowpassHz:1650},
  'neuro-wobble':{id:'neuro-wobble',name:'Neuro Wobble',category:'Bass',description:'Aggressive filtered grit for neurofunk',waveform:'square',attack:.005,decay:.32,sustain:.62,release:.18,lowpassHz:2100},
  'dub-sub':{id:'dub-sub',name:'Dub Sub',category:'Bass',description:'Heavy, warm low-end for dub and halftime',waveform:'square',attack:.012,decay:.45,sustain:.7,release:.25,lowpassHz:380},

  supersaw:{id:'supersaw',name:'Supersaw Anthem',category:'Lead',description:'Bright, energetic singing lead',waveform:'saw',attack:.004,decay:.4,sustain:.75,release:.32,lowpassHz:9500},
  chiptune:{id:'chiptune',name:'Chiptune 8-Bit',category:'Lead',description:'Snappy retro arcade pulse',waveform:'square',attack:.001,decay:.18,sustain:.68,release:.08,lowpassHz:14000},
  'sync-lead':{id:'sync-lead',name:'Sync Scream',category:'Lead',description:'Piercing harmonic lead that cuts through breaks',waveform:'saw',attack:.002,decay:.3,sustain:.7,release:.22,lowpassHz:6500},
  'vocal-lead':{id:'vocal-lead',name:'Vocal Formant',category:'Lead',description:'Vowel-character resonant lead',waveform:'saw',attack:.012,decay:.38,sustain:.65,release:.28,lowpassHz:3200},
  'sine-whistle':{id:'sine-whistle',name:'Sine Whistle',category:'Lead',description:'Smooth singing high-register melody tone',waveform:'sine',attack:.025,decay:.5,sustain:.8,release:.35,lowpassHz:8000},

  pad:{id:'pad',name:'Basic Pad',category:'Pad',description:'Gentle sustained chord pad',waveform:'saw',attack:.14,decay:.45,sustain:.62,release:.75,lowpassHz:2300},
  'lush-pad':{id:'lush-pad',name:'Lush Ambient',category:'Pad',description:'Slow-evolving warm atmospheric bed',waveform:'saw',attack:.45,decay:.8,sustain:.78,release:1.6,lowpassHz:2600},
  'dark-drone':{id:'dark-drone',name:'Dark Drone',category:'Pad',description:'Ominous cinematic drone for tension and intros',waveform:'triangle',attack:.6,decay:1.2,sustain:.85,release:1.8,lowpassHz:1100},
  'warm-strings':{id:'warm-strings',name:'Warm Strings',category:'Pad',description:'Subtractive string-ensemble starting point',waveform:'saw',attack:.22,decay:.65,sustain:.72,release:1.1,lowpassHz:4200},
  'ethereal-pad':{id:'ethereal-pad',name:'Ethereal Shimmer',category:'Pad',description:'Airy, sparkling high-frequency atmosphere',waveform:'triangle',attack:.35,decay:.9,sustain:.68,release:1.4,lowpassHz:6800},

  pluck:{id:'pluck',name:'Basic Pluck',category:'Keys & Pluck',description:'Sharp percussive melodic transient',waveform:'triangle',attack:.003,decay:.22,sustain:.12,release:.14,lowpassHz:5200},
  'bell-pluck':{id:'bell-pluck',name:'FM Bells',category:'Keys & Pluck',description:'Metallic bell transient with sparkling decay',waveform:'sine',attack:.002,decay:.45,sustain:.08,release:.65,lowpassHz:8500},
  'rhodes-keys':{id:'rhodes-keys',name:'Electric Piano (Tine)',category:'Keys & Pluck',description:'Warm electric piano with soft percussive tines',waveform:'triangle',attack:.004,decay:.85,sustain:.28,release:.45,lowpassHz:4800},
  'house-organ':{id:'house-organ',name:'House Organ',category:'Keys & Pluck',description:'Classic 90s percussive house and garage organ',waveform:'square',attack:.002,decay:.28,sustain:.35,release:.12,lowpassHz:5400},
  piano:{id:'piano',name:'Upright Piano',category:'Keys & Pluck',description:'Acoustic piano tone and CC0 Upright Piano KW sample bank',waveform:'sine',attack:.004,decay:1.4,sustain:.12,release:.8,lowpassHz:12000},

  'laser-zap':{id:'laser-zap',name:'Laser Zap',category:'FX',description:'Fast downward pitch zap for turnarounds',waveform:'saw',attack:.001,decay:.11,sustain:.02,release:.06,lowpassHz:7500},
  'noise-sweep':{id:'noise-sweep',name:'Noise Sweep',category:'FX',description:'Textured buildup sweep',waveform:'square',attack:.5,decay:.6,sustain:.4,release:.8,lowpassHz:3500},
  'scifi-sweep':{id:'scifi-sweep',name:'Sci-Fi Resonant',category:'FX',description:'Resonant harmonic sci-fi transition',waveform:'triangle',attack:.15,decay:.45,sustain:.5,release:.55,lowpassHz:4400},
};

export const SYNTH_PRESETS:Record<SynthPreset,SynthInstrument>=Object.fromEntries(
  Object.entries(SYNTH_PRESET_CATALOG).map(([key,def])=>[
    key as SynthPreset,
    {
      preset:def.id,
      waveform:def.waveform,
      attack:def.attack,
      decay:def.decay,
      sustain:def.sustain,
      release:def.release,
      lowpassHz:def.lowpassHz,
      ...(def.id==='piano'?{sampleBank:'upright-kw' as const}:{}),
    }
  ])
) as Record<SynthPreset,SynthInstrument>;

export function validateSynthInstrument(value:SynthInstrument):void{
  if(!value||!Object.hasOwn(SYNTH_PRESETS,value.preset)||!['sine','triangle','saw','square'].includes(value.waveform))throw Error('Invalid synth instrument.');
  bounded(value.attack,.001,2,'synth attack');bounded(value.decay,.001,3,'synth decay');bounded(value.sustain,0,1,'synth sustain');
  bounded(value.release,.01,4,'synth release');bounded(value.lowpassHz,100,20000,'synth filter');
  if(value.sampleBank!==undefined&&(value.preset!=='piano'||value.sampleBank!=='upright-kw'))throw Error('Invalid piano sample bank.');
  if(value.sample){
    if(typeof value.sample.assetId!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(value.sample.assetId))throw Error('Invalid synth sample.');
    bounded(value.sample.rootNote,0,119,'synth sample root',true);
  }
  if(value.patch){
    validateSynthPatch(value.patch);
    if(value.patch.nodes.some(node=>node.type==='sample')&&!value.sample&&!value.sampleBank)throw Error('Choose a piano sample before using a Sample module.');
  }
}
