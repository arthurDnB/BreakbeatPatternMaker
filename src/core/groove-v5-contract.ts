import type {Genre,Role} from './model.js';

/** Positions are sixteenths within a 4/4 bar; quarters permit 64th-note detail. */
export type V5BarFunction='opening'|'continuation'|'response'|'turnaround';
export type V5Gesture='roll'|'chop'|'reverse'|'pitch'|'push';

export interface V5AnchorNote {
  /** Zero-based bar within the motif. */
  bar:number;step:number;role:'kick'|'snare';gain:number;
}
export interface V5AnchorMotif {
  id:string;bars:1|2;notes:readonly V5AnchorNote[];
}
export interface V5LayerNote {
  step:number;gain:number;ghost?:boolean;pan?:number;
  /** Optional short authored roll on this note; still one tracker hit. */
  rollRepeats?:2|3|4;
  /** Stable admission chance, independent of Complexity. */
  probability?:number;
  /** If true, Syncopation gates this optional note. */
  syncopated?:boolean;
}
export interface V5Layer {
  id:string;role:Role;
  /** First Complexity setting at which this musical layer is available. */
  minimum:number;
  /** Optional entry point within a phrase (0–1); two bars have opening/response. */
  minimumPhraseProgress?:number;
  /** Limit the layer to particular places in a phrase. Omit for every bar. */
  on?:readonly V5BarFunction[];
  notes:readonly V5LayerNote[];
}
export interface V5Cadence {
  id:string;role:Role;minimum:number;
  /** Notes are local to the ending bar, in sixteenths. */
  notes:readonly V5LayerNote[];
}
export interface V5Timing {
  /** Swing multiplier applied to offbeat sixteenths. */
  swing:number;
  /** Fixed acoustic pocket; anchors receive only this offset, never humanization. */
  dragMs:number;
}
export interface V5Spice {
  gestures:readonly V5Gesture[];
  roles:readonly Role[];
  maxPerBar:number;
  maxRepeats:2|3|4|6|8;
  minRepeatMs:number;
  pitchSteps:readonly number[];
}
/** Profile data only: no callbacks, mutable RNG, or audio assets. */
export interface V5Profile {
  genre:Genre;
  anchors:readonly V5AnchorMotif[];
  layers:readonly V5Layer[];
  cadences:readonly V5Cadence[];
  timing:Readonly<Record<Role,V5Timing>>;
  spice:V5Spice;
  /** Hold expressive gestures until this point in the phrase. */
  spiceMinimumPhraseProgress?:number;
  /** How readily the closing bar receives an automatic cadence. */
  responseWeight:number;
}
export interface V5BarPlan {
  bar:number;absoluteBar:number;phrasePosition:number;
  function:V5BarFunction;
  /** Phrase energy is descriptive; profiles decide actual notes. */
  energy:number;
  ending:boolean;
}
export interface V5PhrasePlan {
  motifId:string;
  bars:readonly V5BarPlan[];
}
