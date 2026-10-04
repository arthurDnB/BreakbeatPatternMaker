import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {newBank,arrange,validateBank} from '../dist/core/bank.js';
import {generateSongMelody,songHarmonyConflicts} from '../dist/core/song-melody.js';
import {generateMelody} from '../dist/core/melody.js';
import {ArrangementHistory} from '../dist/core/arrangement-history.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
import {makeProject,readProject} from '../dist/audio/project.js';
import {renderPerformance,renderSequence} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';

const settings=(extra={})=>({...defaults('liquiddnb'),seed:'song-hook',bars:2,melodyPart:'lead',generationMode:'melody',melodyKey:2,melodyScale:'natural-minor',chordProgression:'I-V-vi-IV',...extra});
const leadNotes=pattern=>{const id=pattern.userTracks?.find(track=>track.generatedPart==='lead')?.id;return pattern.events.filter(hit=>hit.trackId===id)};

test('lead arc repeats a recognizable hook with rests, a response, and a scale-safe cadence',()=>{
 const s=settings({bars:4,complexity:.65,spicy:.3});
 const notes=generateMelody(s,'melody-lead');
 assert.deepEqual(notes,generateMelody(s,'melody-lead'));
 assert.ok(notes.some(hit=>hit.reason.includes('motif hook')));
 assert.ok(notes.some(hit=>hit.reason.includes('motif response')));
 assert.ok(notes.some(hit=>hit.reason.includes('motif cadence')));
 assert.ok(notes.some(hit=>hit.baseTick%(4*960)>0&&Math.floor(hit.baseTick/(4*960))===1),'answer should delay its entrance');
 assert.ok(notes.every(hit=>hit.synthNote.durationTicks>0&&hit.gain>0&&hit.gain<=1));
 const barPeaks=Array.from({length:4},(_,bar)=>Math.max(...notes.filter(hit=>Math.floor(hit.baseTick/(4*960))===bar).map(hit=>hit.synthNote.note)));
 assert.ok(barPeaks[2]>barPeaks[0]&&barPeaks[2]>barPeaks[1]&&barPeaks[2]>barPeaks[3],'third bar should contain the planned high point');
});

test('song generation develops repeated slots into editable variants without altering source or drums',()=>{
 const s=settings(),bank=newBank(generate(s));
 bank.sequence=[{slot:0,repeats:2,section:'Intro'},{slot:0,repeats:2,section:'Drop'}];
 const source=structuredClone(bank.slots[0].editor.pattern);
 const first=generateSongMelody(bank,s),again=generateSongMelody(bank,s);
 assert.deepEqual(first,again);
 assert.deepEqual(bank.slots[0].editor.pattern,source);
 assert.deepEqual(first.slots[0].editor.pattern,source);
 assert.equal(first.sequence.reduce((sum,step)=>sum+step.repeats,0),4);
 assert.ok(new Set(first.sequence.map(step=>step.slot)).size>=2);
 for(const pattern of arrange(first)){
  assert.ok(leadNotes(pattern).length);
  assert.deepEqual(pattern.events.filter(hit=>!hit.trackId),source.events.filter(hit=>!hit.trackId));
 }
 assert.ok(leadNotes(arrange(first)[2]).some(hit=>hit.reason.includes('song bar')));
 const rerun=generateSongMelody(first,s);
 assert.equal(rerun.slots.length,first.slots.length,'regeneration should reuse editable variant slots');
 validateBank(rerun);
});

test('manual and locked lead edits survive regeneration; one arrangement Undo restores the song',()=>{
 const s=settings(),editor=new Editor(generate(s));editor.generateComposition(s);
 const hit=leadNotes(editor.state.pattern)[0];
 editor.editTrackerValue(hit.id,'note',hit.synthNote.note+1);
 const edited=structuredClone(editor.state.pattern.events.find(item=>item.id===hit.id));
 const another=leadNotes(editor.state.pattern)[1];
 editor.state.selection={ids:[another.id],rows:null};editor.toggleSelectedLocks();
 const locked=structuredClone(editor.state.pattern.events.find(item=>item.id===another.id));
 const bank=newBank(editor.state.pattern);bank.slots[0].editor=structuredClone(editor.state);
 const next=generateSongMelody(bank,s),pattern=arrange(next)[0];
 assert.deepEqual(pattern.events.find(item=>item.id===edited.id),edited);
 assert.deepEqual(pattern.events.find(item=>item.id===locked.id),locked);
 const history=new ArrangementHistory(bank);
 assert.equal(history.execute(target=>Object.assign(target,next),'Generate song melody'),true);
 assert.equal(history.undo(),true);assert.deepEqual(history.bank,bank);
 assert.equal(history.redo(),true);assert.deepEqual(history.bank,next);
});

test('song variants survive project roundtrip and share pattern/song render and WAV path',()=>{
 const s=settings({bars:1}),bank=newBank(generate(s));bank.sequence=[{slot:0,repeats:2}];
 const song=generateSongMelody(bank,s),pattern=arrange(song)[0];
 const project=makeProject(song.slots[song.active].editor,s,defaultKitState(),new Map(),song);
 const restored=readProject(project).project.bank;
 assert.deepEqual(arrange(restored),arrange(song));
 const patternAudio=renderPerformance(pattern,new Map(),8000,{},{});
 const songAudio=renderSequence(arrange(restored),new Map(),8000);
 assert.ok(patternAudio.channels[0].some(value=>Math.abs(value)>.001));
 assert.ok(songAudio.channels[0].some(value=>Math.abs(value)>.001));
 assert.equal(new TextDecoder().decode(new Uint8Array(encodeWav(songAudio.channels,songAudio.sampleRate)).slice(0,4)),'RIFF');
});

test('conflicting bass or piano harmony is reported without changing those notes',()=>{
 const s=settings(),editor=new Editor(generate(s));
 editor.generateComposition({...s,melodyPart:'bassline'});
 const bank=newBank(editor.state.pattern);bank.slots[0].editor=editor.state;
 assert.deepEqual(songHarmonyConflicts(bank,{...s,melodyKey:4}),[0]);
 const bass=structuredClone(editor.state.pattern.events.filter(hit=>hit.synthNote));
 assert.deepEqual(arrange(generateSongMelody(bank,{...s,melodyKey:4}))[0].events.filter(hit=>hit.trackId===bass[0].trackId),bass);
});
