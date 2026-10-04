import {Editor} from './editor.js';
import {addPatternSlot,validateBank,type Bank} from './bank.js';
import {isSynthTrack,type Settings} from './model.js';

const MAX_EDITABLE_SLOTS=64;
const melodySettings=(base:Settings,master:Settings):Settings=>({...base,
 seed:master.seed,genre:master.genre,variation:master.variation,
 complexity:master.complexity,spicy:master.spicy,swing:master.swing,humanizeMs:master.humanizeMs,
 melodyKey:master.melodyKey,melodyScale:master.melodyScale,harmonyStyle:master.harmonyStyle,
 chordProgression:master.chordProgression,customChordProgression:master.customChordProgression,
 generationMode:'melody',melodyPart:'lead'});

export function songHarmonyConflicts(bank:Bank,settings:Settings):number[]{
 const fields=['melodyKey','melodyScale','harmonyStyle','chordProgression','customChordProgression'] as const;
 return [...new Set(bank.sequence.map(step=>step.slot))].filter(index=>{
  const pattern=bank.slots[index]?.editor?.pattern;
  if(!pattern)return false;
  const hasAccompaniment=pattern.userTracks?.some(track=>isSynthTrack(track)&&
   (track.generatedPart==='bassline'||track.generatedPart==='piano')&&pattern.events.some(hit=>hit.trackId===track.id));
  return hasAccompaniment&&fields.some(field=>pattern.settings[field]!==settings[field]);
 });
}

/** Return a new bank: every differing song occurrence becomes a normal editable pattern slot. */
export function generateSongMelody(bank:Bank,master:Settings):Bank{
 validateBank(bank);
 if(!bank.sequence.length)throw Error('Add a pattern to the arrangement before generating a song melody.');
 const next=structuredClone(bank),original=structuredClone(bank);
 const songBars=original.sequence.reduce((sum,step)=>sum+original.slots[step.slot]!.editor!.pattern.settings.bars*step.repeats,0);
 const sequence:Bank['sequence']=[],used=new Map<string,number>();
 let startBar=0,occurrence=0;
 for(const step of original.sequence)for(let repeat=0;repeat<step.repeats;repeat++){
  const slot=original.slots[step.slot]!,source=slot.songMelodySource??step.slot;
  const key=`${source}:${occurrence}`;
  const editor=new Editor(slot.editor!.pattern);editor.state=structuredClone(slot.editor!);
  const settings=melodySettings(editor.state.pattern.settings,master);
  editor.generateComposition(settings,'Generate song melody',false,{startBar,songBars,section:step.section});
  const signature=JSON.stringify({source,editor:editor.state.pattern,locks:editor.state.lockedIds});
  let target=used.get(signature);
  if(target===undefined){
   const existing=next.slots.findIndex(candidate=>candidate.songMelodyKey===key&&candidate.songMelodySource===source);
   if(existing>=0)target=existing;
   else{
    if(next.slots.length>=MAX_EDITABLE_SLOTS)throw Error('Song melody needs more than 64 editable pattern slots. Shorten or simplify the arrangement first.');
    target=addPatternSlot(next,`${original.slots[source]?.name??'Pattern'} · Melody ${occurrence+1}`.slice(0,40),editor.state);
   }
   next.slots[target]!.editor=structuredClone(editor.state);
   next.slots[target]!.songMelodySource=source;
   next.slots[target]!.songMelodyKey=key;
   used.set(signature,target);
  }
  const prior=sequence.at(-1);
  if(prior&&prior.slot===target&&prior.section===step.section&&prior.repeats<16)prior.repeats++;
  else sequence.push({slot:target,repeats:1,...(step.section?{section:step.section}:{})});
  if(sequence.length>64)throw Error('Song melody needs more than 64 arrangement steps. Shorten the arrangement first.');
  startBar+=slot.editor!.pattern.settings.bars;occurrence++;
 }
 next.sequence=sequence;
 validateBank(next);
 return next;
}
