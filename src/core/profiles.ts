import {NEW_GENRES} from './new-genres.js';
import type {Genre, Settings} from './model.js';
export interface Profile {
  name:string; description?:string; presets:number[]; bpm:number; swing:number; kicks:number[][];
  hats:number; ghosts:number[]; fill:number;
  snares?:number[]; hatSteps?:number[]; percussion?:number[]; detail?:number;
  rolls?:boolean; fourFloor?:boolean;
}
export const PROFILES: Record<Genre,Profile> = {
  ...NEW_GENRES,
  jungle: {name: 'Jungle', presets: [160, 165, 170], bpm: 165, swing: .5,
    kicks: [[0, 8, 11], [0, 6, 10], [0, 7, 11]], hats: 2, ghosts: [3, 7, 15], fill: .7},
  dnb: {name: 'DnB Roller', presets: [170, 174, 176], bpm: 174, swing: .5,
    kicks: [[0, 10], [0, 6, 10]], hats: 2, ghosts: [7, 15], fill: .35},
  hiphop: {name: 'Hip-Hop Swing', presets: [80, 90, 95], bpm: 90, swing: .58,
    kicks: [[0, 6], [0, 10], [0, 7]], hats: 2, ghosts: [11, 15], fill: .2},
  trap: {name:'Trap',presets:[130,140,150],bpm:140,swing:.5,kicks:[[0,6,11],[0,3,14]],hats:2,ghosts:[7,15],fill:.5,snares:[8],rolls:true,detail:.65},
  rap: {name:'Rap',presets:[85,95,105],bpm:95,swing:.54,kicks:[[0,7],[0,10]],hats:4,ghosts:[11],fill:.15,snares:[4,12],detail:.15},
  drill: {name:'Drill',presets:[138,142,146],bpm:142,swing:.54,kicks:[[0,7,14],[0,3,10]],hats:2,hatSteps:[0,3,6,8,11,14],ghosts:[7,13],fill:.45,snares:[8],rolls:true,detail:.5},
  breakcore: {name:'Breakcore',presets:[180,200,220],bpm:200,swing:.5,kicks:[[0,3,9,14],[0,6,11,15]],hats:1,hatSteps:[0,1,3,4,6,7,8,10,11,13,14],ghosts:[2,7,10,15],fill:1,snares:[4,12],percussion:[3,10,15],rolls:true,detail:.95},
  idm: {name:'IDM',presets:[100,125,150],bpm:125,swing:.55,kicks:[[0,5,11],[0,7,13]],hats:2,hatSteps:[0,3,5,8,11,14],ghosts:[6,15],fill:.55,snares:[6,12],percussion:[2,7,10,15],rolls:true,detail:.7},
  hardcore: {name:'Hardcore',presets:[160,180,200],bpm:180,swing:.5,kicks:[[0,4,8,12]],hats:4,hatSteps:[2,6,10,14],ghosts:[11,15],fill:.65,snares:[4,12],fourFloor:true,detail:.4},
  experimental: {name:'Experimental Breakbeat',presets:[110,145,175],bpm:145,swing:.5,kicks:[[0,5,14],[0,7,10]],hats:2,hatSteps:[0,2,5,9,12,15],ghosts:[3,10,14],fill:.8,snares:[5,13],percussion:[1,6,11],rolls:true,detail:.8},
  breaks: {"name":"Classic Breaks","presets":[120,130,140],"bpm":130,"swing":0.52,"kicks":[[0,6,8,11],[0,3,8,10]],"hats":2,"ghosts":[3,7,15],"fill":0.45,"snares":[4,12],"percussion":[6,14],"detail":0.4,"description":"A repeating broken kick motif, steady backbeat and light percussion pickups."},
  bigbeat: {"name":"Big Beat","presets":[100,110,125],"bpm":110,"swing":0.53,"kicks":[[0,2,8,10],[0,3,8,14]],"hats":4,"hatSteps":[0,2,4,8,10,12,14],"ghosts":[7,11],"fill":0.55,"snares":[4,12],"percussion":[3,15],"detail":0.35,"description":"Weighty doubled kicks and a firm backbeat with spacious hat accents."},
  nuskoolbreaks: {"name":"Nu Skool Breaks","presets":[130,135,140],"bpm":135,"swing":0.5,"kicks":[[0,7,10],[0,6,11,14]],"hats":2,"hatSteps":[0,2,5,6,8,10,13,14],"ghosts":[3,15],"fill":0.6,"snares":[4,12],"percussion":[7,11],"rolls":true,"detail":0.6,"description":"Syncopated kick responses, displaced hats and short precision rolls."},
  electrobreaks: {"name":"Electro Breaks","presets":[120,130,140],"bpm":130,"swing":0.5,"kicks":[[0,3,8,14],[0,6,8,11]],"hats":2,"hatSteps":[0,2,4,6,8,10,12,14],"ghosts":[15],"fill":0.25,"snares":[4,12],"percussion":[3,6,11,14],"detail":0.3,"description":"A straight machine-like hat pulse with broken kicks and a percussion counter-rhythm."},
  breakbeathardcore: {"name":"Breakbeat Hardcore","presets":[140,150,160],"bpm":150,"swing":0.5,"kicks":[[0,4,8,11,12],[0,4,7,8,12]],"hats":2,"hatSteps":[2,3,6,10,11,14],"ghosts":[3,7,15],"fill":0.85,"snares":[4,12],"percussion":[7,15],"rolls":true,"detail":0.8,"description":"Driving kicks combined with broken pickups, offbeat hats and energetic fills."},
  raggajungle: {"name":"Ragga Jungle","presets":[160,165,175],"bpm":165,"swing":0.54,"kicks":[[0,6,11,14],[0,7,10]],"hats":2,"hatSteps":[0,2,3,6,8,10,11,14],"ghosts":[3,7,9,15],"fill":0.85,"snares":[4,12],"percussion":[5,13,15],"rolls":true,"detail":0.7,"description":"Rolling ghost snares and percussion responses around a syncopated jungle skeleton."},
  atmosphericjungle: {"name":"Atmospheric Jungle","presets":[155,160,170],"bpm":160,"swing":0.52,"kicks":[[0,10],[0,7]],"hats":2,"hatSteps":[0,2,6,8,10,14],"ghosts":[3,7,11,15],"fill":0.25,"snares":[4,12],"percussion":[13],"detail":0.25,"description":"Spacious kicks, restrained hats and quiet snare connections leave room around the groove."},
  footworkjungle: {"name":"Footwork Jungle","presets":[155,160,165],"bpm":160,"swing":0.5,"kicks":[[0,3,6,10,14],[0,3,7,10,13]],"hats":2,"hatSteps":[0,3,6,8,11,14],"ghosts":[5,7,13,15],"fill":0.75,"snares":[8,12],"percussion":[2,9,15],"rolls":true,"detail":0.75,"description":"Grouped kick bursts cross a half-time accent and a late snare response. A straight-grid hybrid starting point."},
};
export function defaults(genre: Genre = 'jungle'): Settings {
  if (!Object.hasOwn(PROFILES, genre)) throw new Error(`Unsupported genre. Choose ${Object.keys(PROFILES).join(', ')}.`);
  return {...(Object.hasOwn(NEW_GENRES,genre)?{algorithm:'groove-v2' as const}:{}),genre, breakStyle:'genre', seed: 'break-042', bpm: PROFILES[genre].bpm, bars: 2, resolution: 16,
    complexity: .45, syncopation: .4, swing: PROFILES[genre].swing, humanizeMs: 0,
    ghostAmount: .35, fillAmount: .4, spicy: 0};
}

// UI starting points; keep defaults() stable for existing seeds, CLI and projects.
export function genreDefaults(genre:Genre):Settings {
  const base=defaults(genre),profile=PROFILES[genre];
  const overrides:Partial<Record<Genre,Partial<Settings>>>={
    jungle:{spicy:.35},dnb:{complexity:.5,ghostAmount:.25,fillAmount:.25,spicy:.25},
    hiphop:{complexity:.3,syncopation:.3,ghostAmount:.2,fillAmount:.15,humanizeMs:2,spicy:.1},
    rap:{complexity:.25,syncopation:.25,ghostAmount:.15,fillAmount:.15,humanizeMs:2,spicy:.1},
    trap:{complexity:.6,resolution:32,syncopation:.45,ghostAmount:.15,fillAmount:.45,spicy:.4},
    drill:{complexity:.6,resolution:32,syncopation:.65,ghostAmount:.2,fillAmount:.4,spicy:.45},
    breakcore:{complexity:.85,resolution:64,syncopation:.7,ghostAmount:.6,fillAmount:.8,spicy:.85},
    idm:{complexity:.65,resolution:32,syncopation:.7,ghostAmount:.4,fillAmount:.5,spicy:.65},
    hardcore:{complexity:.55,syncopation:.2,ghostAmount:.15,fillAmount:.5,spicy:.4},
    experimental:{complexity:.75,resolution:32,syncopation:.8,ghostAmount:.45,fillAmount:.65,spicy:.75},
    breaks:{complexity:.4,syncopation:.45,ghostAmount:.25,fillAmount:.3,spicy:.2},
    bigbeat:{complexity:.4,syncopation:.35,ghostAmount:.2,fillAmount:.4,spicy:.25},
    nuskoolbreaks:{complexity:.6,resolution:32,syncopation:.6,ghostAmount:.3,fillAmount:.5,spicy:.4},
    electrobreaks:{complexity:.35,syncopation:.45,ghostAmount:.1,fillAmount:.2,spicy:.2},
    breakbeathardcore:{complexity:.7,resolution:32,syncopation:.5,ghostAmount:.4,fillAmount:.7,spicy:.6},
    raggajungle:{complexity:.65,resolution:32,syncopation:.6,ghostAmount:.55,fillAmount:.65,spicy:.5},
    atmosphericjungle:{complexity:.35,syncopation:.35,ghostAmount:.45,fillAmount:.2,spicy:.2},
    downtempo:{complexity:.25,syncopation:.3,humanizeMs:3,ghostAmount:.15,fillAmount:.15},
    lofihiphop:{complexity:.3,syncopation:.4,humanizeMs:5,ghostAmount:.25,fillAmount:.2},
    boombap:{complexity:.45,syncopation:.5,humanizeMs:3,ghostAmount:.25,fillAmount:.35},
    mellowbeats:{complexity:.2,syncopation:.25,humanizeMs:3,ghostAmount:.1,fillAmount:.1},
    liquiddnb:{complexity:.45,syncopation:.4,ghostAmount:.45,fillAmount:.25,spicy:.15},
    jumpup:{complexity:.4,syncopation:.5,ghostAmount:.15,fillAmount:.45,spicy:.3},
    garage:{complexity:.5,syncopation:.45,ghostAmount:.2,fillAmount:.3,spicy:.2},
    speedgarage:{complexity:.55,syncopation:.5,ghostAmount:.15,fillAmount:.45,spicy:.35},
    twostepgarage:{complexity:.5,syncopation:.65,ghostAmount:.25,fillAmount:.35,humanizeMs:2,spicy:.2},
    dub:{complexity:.2,syncopation:.25,ghostAmount:.1,fillAmount:.15},
    psydub:{complexity:.6,syncopation:.65,ghostAmount:.25,fillAmount:.4,spicy:.4,resolution:32},
    dubstep:{complexity:.3,syncopation:.45,ghostAmount:.15,fillAmount:.3,spicy:.2},
    brostep:{complexity:.6,syncopation:.45,ghostAmount:.15,fillAmount:.65,spicy:.65,resolution:32},
    postdubstep:{complexity:.4,syncopation:.7,ghostAmount:.2,fillAmount:.25,humanizeMs:3},
    drumfunk:{complexity:.7,syncopation:.65,ghostAmount:.7,fillAmount:.65,spicy:.35,resolution:32},
    amenscience:{complexity:.95,syncopation:.85,ghostAmount:.85,fillAmount:.95,spicy:.95,resolution:64},
    atmosphericbreakcore:{complexity:.85,syncopation:.7,ghostAmount:.7,fillAmount:.85,spicy:.8,resolution:64},
    triphop:{complexity:.35,syncopation:.4,ghostAmount:.2,fillAmount:.25,humanizeMs:3},
    halftimednb:{complexity:.4,syncopation:.6,ghostAmount:.2,fillAmount:.35,spicy:.25},
    neurofunk:{complexity:.6,syncopation:.55,ghostAmount:.3,fillAmount:.5,spicy:.4,resolution:32},
    footworkjungle:{complexity:.7,resolution:32,syncopation:.7,ghostAmount:.35,fillAmount:.6,spicy:.6}
  };
  return {...base,...overrides[genre],algorithm:'groove-v3',variation:0,bpm:profile.bpm,swing:profile.swing};
}
