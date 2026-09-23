import {compile} from './compile.js';
import {Editor,type EditorState} from './editor.js';
import type {Pattern} from './model.js';
export const SLOT_IDS=['A','B','C','Fill'] as const;
export interface Bank {active:number;slots:{name:string;editor:EditorState|null}[];sequence:{slot:number;repeats:number}[]}
export function newBank(pattern:Pattern):Bank{return {active:0,slots:SLOT_IDS.map((name,i)=>({name,editor:i===0?new Editor(pattern).state:null})),sequence:[{slot:0,repeats:2}]};}
export function validateBank(bank:Bank){
 if(!bank||!Number.isInteger(bank.active)||bank.active<0||bank.active>3||!Array.isArray(bank.slots)||bank.slots.length!==4||!Array.isArray(bank.sequence)||bank.sequence.length>64)throw Error('Invalid pattern bank.');
 for(const s of bank.slots){if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>40)throw Error('Invalid slot name.');if(s.editor)validateEditor(s.editor);}
 if(!bank.slots[bank.active]!.editor)throw Error('Active slot is empty.');
 for(const step of bank.sequence)if(!step||!Number.isInteger(step.slot)||step.slot<0||step.slot>3||!bank.slots[step.slot]!.editor||!Number.isInteger(step.repeats)||step.repeats<1||step.repeats>16)throw Error('Invalid arrangement step.');
}
export function validateEditor(e:EditorState){
 compile(e.pattern);
 if(!Array.isArray(e.lockedIds)||e.lockedIds.some(x=>typeof x!=='string')||!Array.isArray(e.lockedRoles)||e.lockedRoles.some(x=>!['kick','snare','hat','percussion'].includes(x))||!Number.isInteger(e.revision)||e.revision<0||!e.selection||!Array.isArray(e.selection.ids)||e.selection.ids.some(x=>typeof x!=='string'))throw Error('Invalid slot editor.');
 const rows=e.selection.rows;if(rows!==null&&(!Array.isArray(rows)||rows.length!==2||rows.some(x=>!Number.isInteger(x)||x<0)||rows[0]>rows[1]||rows[1]>=e.pattern.settings.bars*e.pattern.settings.resolution))throw Error('Invalid slot selection.');
}
export function arrange(bank:Bank,bpm:number){validateBank(bank);if(!bank.sequence.length)throw Error('Add a pattern to the arrangement.');return bank.sequence.flatMap(step=>Array.from({length:step.repeats},()=>{const p=structuredClone(bank.slots[step.slot]!.editor!.pattern);p.settings.bpm=bpm;return p;}));}
