import {setRatchets,articulationLabel} from './core/articulation.js';
import {GROOVES} from './core/groove-profiles.js';
import {NEW_GENRES} from './core/new-genres.js';
import {newBank,arrange,songTimeline,songBlocks,songPosition,moveSequenceStep,moveSequenceStepToInsertion,insertSequenceStep,slotLabel,addPatternSlot,duplicatePatternSlot,deletePatternSlot,rememberPattern,type Bank} from './core/bank.js';
import {makeProject,readProject,localProject,needsVinylMigration} from './audio/project.js';
import {defaultKitState} from './audio/drum-kit.js';
import {setupDrumKit,withDrumKit,effectiveSampleSpeed} from './audio/drum-kit.js';
import {KIT_PRESETS,GENRE_KITS,LIBRARY} from './audio/library.js';
import {ensureLibraryAudio} from './audio/library-audio.js';
import {ensureThinkBreakAudio} from './audio/think-break-audio.js';
import {THINK_BREAK_INSTRUMENT_ID} from './core/think-break.js';
import {DEFAULT_VINYL_TEXTURE,VINYL_TEXTURES,loadVinylTexture,mixVinylTexture,type VinylTexture} from './audio/vinyl-texture.js';
import {setupSoundBrowser} from './audio/sound-browser.js';
import {setupBreakPanel} from './audio/break-panel.js';
import {resolveSlice} from './core/slice-instrument.js';
import {setupSamplePanel} from './audio/sample-panel.js';
import {downloadBytes} from './audio/render.js';
import {renderPerformance,renderSequence} from './audio/performance.js';
import {ensurePianoBankAudio} from './audio/piano-bank.js';
import {encodeWav} from './audio/wav.js';
import {encodeMp3} from './audio/mp3.js';
import {reconstruct,sliceReference,type AudioAsset} from './audio/slices.js';
import {BREAKS} from './core/breaks.js';
import {defaults,genreDefaults,PROFILES} from './core/profiles.js';
import {generate,validateSettings} from './core/generate.js';
import {maximumV5ExactHits} from './core/exact-hits.js';
import {compile,serialize} from './core/compile.js';
import {drumLane} from './core/drum-lanes.js';
import {ROLES,hex,noteName,isSynthTrack,type Hit,type Role,type Genre,type BreakStyle,type Pattern,type Transfer,type EffectCommand,type Settings,type UserTrack,type SynthTrack,type SynthInstrument,type GenerationMode,type MelodyPart,type MelodyScale} from './core/model.js';
import {SYNTH_PRESETS} from './audio/synth-instrument.js';
import {Editor,emptySelection,locked,selectedIds,type EditorState,type TrackerClipboard,type CellPosition} from './core/editor.js';
import {defaultEffects,type Effects,EFFECT_PRESETS,type EffectPreset} from './audio/effects.js';
import {ArrangementHistory} from './core/arrangement-history.js';


const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>el<HTMLInputElement>(id);
// Dock secondary tracker actions in a compact menu without changing their IDs or handlers.
const trackerBar=document.querySelector<HTMLElement>('.tracker-live-bar')!;
const selectionMenu=document.createElement('details');selectionMenu.id='tracker-selection-menu';
const selectionSummary=document.createElement('summary');selectionSummary.textContent='Selection & locks';selectionSummary.title='Click a cell to select it, Ctrl/Cmd-click to add cells, or Shift-click to extend a range.';selectionMenu.append(selectionSummary,document.querySelector<HTMLElement>('.editor-tools')!);trackerBar.append(selectionMenu);
document.querySelector<HTMLElement>('.workspace > .grid-heading')!.append(document.querySelector<HTMLElement>('.workspace > .legend')!);
el<HTMLDetailsElement>('hit-articulation').open=true;
// Keep the existing audio/editor controls, but dock them beside the work they edit.
el('tray-bottom').after(el('transport'));
el('transport').append(el('play'));
el('bar-tray-bottom').append(el('tab-generator'));
el('dsp-dock-body').append(el('re-track-dsp-panel'));
el('master-dsp-host').append(el('quick-fx-panel'));
el('quick-fx-panel').hidden=false;
const advancedGrid=el('advanced-generation').querySelector<HTMLElement>('.advanced')!;
for(const [name,ids] of [['Pattern',['breakStyle','breakLayer','resolution','phraseLength','phraseOffset']],['Groove',['syncopation','swing','humanizeMs','ghostAmount']],['Structure',['patternStructure','fillAmount','seed']]] as const){
 const group=document.createElement('fieldset');group.className='generator-group';const legend=document.createElement('legend');legend.textContent=name;group.append(legend);
 for(const id of ids){const label=el(id).closest('label');if(label)group.append(label);}advancedGrid.append(group);
}
let pattern:Pattern,transfer:Transfer;
let editor:Editor;
let bank:Bank|undefined,pendingSlot:number|undefined;
let arrangementHistory:ArrangementHistory|undefined;
let draggedStep:number|undefined;
let selectedArrangementStep:number|undefined;
let mode:'pattern'|'arrangement'|'comparison'|undefined;
type CompareSide = 'A'|'B';
let comparison: {slot:number; A?:{state:EditorState;label:string}; B?:{state:EditorState;label:string}}|undefined;
let comparisonPlaying:CompareSide|undefined;
const slotEditors=new Map<number,Editor>();
let persistenceReady=false,saveTimer:ReturnType<typeof setTimeout>|undefined;
let saveQueue:Promise<unknown>=Promise.resolve();
let rowAnchor=0,cursorLane:Role='kick',cursorTrackId:string|undefined,playToken=0;
let cellAnchor:{row:number;lane:string}|undefined;
let trackerClipboard:TrackerClipboard|undefined;
let draggingTrackerCells:CellPosition[]|undefined;
let trackerFieldDraft:{id:string;field:string;digits:string}|undefined;
let trackerEffectDraft:{id:string;command?:EffectCommand['command'];digits:string;prefix:boolean}|undefined;
let syncDspControls: () => void = () => {};
const drumLaneFields=new Map<Role,{name:HTMLInputElement;visible:HTMLInputElement;generation:HTMLSelectElement;count:HTMLElement}>();
function visibleDrumRoles(){return ROLES.filter(role=>drumLane(pattern,role).visible);}
let editTargetLane='';
function syncEditTarget(){
  const select=el<HTMLSelectElement>('edit-target');
  const options:[string,string][]=[['','All drum tracks'],...ROLES.map(role=>[role,`${drumLane(pattern,role).name}${drumLane(pattern,role).visible?'':' (hidden)'}`] as [string,string]),...(pattern.userTracks??[]).filter(track=>!isSynthTrack(track)&&(!!track.generationRole||pattern.events.some(hit=>hit.trackId===track.id&&hit.generatedDrumRole))).map(track=>[track.id,`Sample: ${track.name}`] as [string,string])];
  select.replaceChildren(...options.map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;}));
  if(!options.some(([value])=>value===editTargetLane))editTargetLane='';
  select.value=editTargetLane;
}
function syncDrumLaneFields(){
  const host=el('drum-lane-rows');
  if(!drumLaneFields.size)for(const role of ROLES){
    const row=document.createElement('div');row.className='drum-lane-row';row.id=`drum-lane-${role}`;
    const title=document.createElement('strong');title.textContent=role==='percussion'?'Percussion':role[0]!.toUpperCase()+role.slice(1);
    const name=document.createElement('input');name.id=`drum-lane-name-${role}`;name.type='text';name.maxLength=80;name.setAttribute('aria-label',`${title.textContent} lane name`);
    const nameLabel=document.createElement('label');nameLabel.textContent='Name';nameLabel.append(name);
    const visible=document.createElement('input');visible.id=`drum-lane-visible-${role}`;visible.type='checkbox';visible.setAttribute('aria-label',`Show ${title.textContent} lane`);
    const visibleLabel=document.createElement('label');visibleLabel.textContent='Show';visibleLabel.append(visible);
    const generation=document.createElement('select');generation.id=`drum-lane-generation-${role}`;generation.setAttribute('aria-label',`Generate ${title.textContent} lane as`);
    const choices:[string,string][]=[['','No generation'],...ROLES.map((item):[string,string]=>[item,item==='hat'?'Hi-hat':item[0]!.toUpperCase()+item.slice(1)])];
    for(const [value,label] of choices){const option=document.createElement('option');option.value=value;option.textContent=label;generation.append(option);}
    const generationLabel=document.createElement('label');generationLabel.textContent='Generate';generationLabel.append(generation);
    const count=document.createElement('small');
    const update=(patch:Partial<ReturnType<typeof drumLane>>)=>{try{if(editor.setDrumLane(role,patch)){if(!drumLane(editor.state.pattern,cursorLane).visible&&!cursorTrackId)cursorLane=ROLES.find(item=>drumLane(editor.state.pattern,item).visible)??'percussion';refresh();status(`Updated ${role} lane. Generate again to apply its routing.`);}else syncDrumLaneFields();}catch(error){status(String(error),true);syncDrumLaneFields();}};
    name.onchange=()=>update({name:name.value});visible.onchange=()=>update({visible:visible.checked});generation.onchange=()=>update({generationRole:generation.value as Role||null});
    row.append(title,nameLabel,visibleLabel,generationLabel,count);host.append(row);drumLaneFields.set(role,{name,visible,generation,count});
  }
  for(const role of ROLES){const fields=drumLaneFields.get(role)!,config=drumLane(pattern,role);if(document.activeElement!==fields.name)fields.name.value=config.name;fields.visible.checked=config.visible;fields.generation.value=config.generationRole??'';const hits=pattern.events.filter(hit=>!hit.trackId&&hit.role===role).length;fields.count.textContent=`${hits} hit${hits===1?'':'s'}`;}
}
const openSynthTrackIds=new Set<string>();
const openSampleGenerationIds=new Set<string>();
const trackerFields=['note','instrument','volume','pan','delay','effect'] as const;
let cursorField:typeof trackerFields[number]='note';
const assets=new Map<string,AudioAsset>();
let vinylTexture:VinylTexture={...DEFAULT_VINYL_TEXTURE};
const vinylCache=new Map<string,AudioAsset>();
let followPlayhead=true;
type WorkspaceView='renoise'|'hybrid'|'beginner';
type WorkspacePreferences={view:WorkspaceView;gridScrollTop:number;gridScrollLeft:number;timelineScrollLeft:number;pageScrollTop:number;openPanels:Record<string,boolean>;openTrackRoles:Role[];cursorRow:number;cursorLane:Role;cursorTrackId?:string;cursorField:typeof trackerFields[number];stepAdvance:number};
const WORKSPACE_PREFS_KEY='bpm_workspace_preferences_v1';
const workspacePanelIds=['pattern-history-panel','arranger','advanced-generation','master-dsp-rack','hit-editor'] as const;
const validWorkspaceView=(value:unknown):value is WorkspaceView=>value==='renoise'||value==='hybrid'||value==='beginner';
function readWorkspacePreferences():WorkspacePreferences{
 const fallback:WorkspacePreferences={view:'renoise',gridScrollTop:0,gridScrollLeft:0,timelineScrollLeft:0,pageScrollTop:0,openPanels:{},openTrackRoles:[],cursorRow:0,cursorLane:'kick',cursorField:'note',stepAdvance:1};
 try{const saved=JSON.parse(localStorage.getItem(WORKSPACE_PREFS_KEY)??'{}');return {...fallback,...saved,view:validWorkspaceView(saved.view)?saved.view:fallback.view,openPanels:saved.openPanels&&typeof saved.openPanels==='object'?saved.openPanels:{},openTrackRoles:Array.isArray(saved.openTrackRoles)?saved.openTrackRoles.filter((role:unknown):role is Role=>ROLES.includes(role as Role)):[],cursorRow:Number.isInteger(saved.cursorRow)&&saved.cursorRow>=0?saved.cursorRow:0,cursorLane:ROLES.includes(saved.cursorLane)?saved.cursorLane:'kick',cursorField:trackerFields.includes(saved.cursorField)?saved.cursorField:'note',stepAdvance:[0,1,2,4].includes(saved.stepAdvance)?saved.stepAdvance:1};}catch{return fallback;}
}
const workspacePreferences=readWorkspacePreferences();
input('view').value=workspacePreferences.view;
el<HTMLSelectElement>('tracker-step-select').value=String(workspacePreferences.stepAdvance);input('edit-step').value=String(workspacePreferences.stepAdvance);
let workspaceRestoreTracks=true,workspaceSaveFrame=0,workspaceReady=false;
function saveWorkspacePreferences(){
 try{
  workspacePreferences.view=validWorkspaceView(input('view').value)?input('view').value as WorkspaceView:'renoise';
  const grid=el('grid'),timeline=el('song-timeline');workspacePreferences.gridScrollTop=grid.scrollTop;workspacePreferences.gridScrollLeft=grid.scrollLeft;workspacePreferences.timelineScrollLeft=timeline.scrollLeft;workspacePreferences.pageScrollTop=window.scrollY;
  workspacePreferences.cursorRow=rowAnchor;workspacePreferences.cursorLane=cursorLane;workspacePreferences.cursorTrackId=cursorTrackId;workspacePreferences.cursorField=cursorField;workspacePreferences.stepAdvance=getTrackerStep();
  for(const id of workspacePanelIds){const panel=document.getElementById(id);if(panel instanceof HTMLDetailsElement)workspacePreferences.openPanels[id]=panel.open;}
  workspacePreferences.openTrackRoles=Array.from(document.querySelectorAll<HTMLDetailsElement>('.track-instrument-panel[open]')).map(panel=>panel.dataset.role as Role).filter(role=>ROLES.includes(role));
  localStorage.setItem(WORKSPACE_PREFS_KEY,JSON.stringify(workspacePreferences));
 }catch{}
}
function scheduleWorkspaceSave(){if(!workspaceReady||workspaceSaveFrame)return;workspaceSaveFrame=requestAnimationFrame(()=>{workspaceSaveFrame=0;saveWorkspacePreferences();});}
function restoreWorkspacePreferences(){
 const restored={...workspacePreferences,openPanels:{...workspacePreferences.openPanels},openTrackRoles:[...workspacePreferences.openTrackRoles]};
 rowAnchor=Math.min(restored.cursorRow,Math.max(0,transfer.timing.lines-1));cursorLane=restored.cursorLane;cursorTrackId=pattern.userTracks?.some(track=>track.id===restored.cursorTrackId)?restored.cursorTrackId:undefined;cursorField=restored.cursorField;el<HTMLSelectElement>('tracker-step-select').value=String(restored.stepAdvance);input('edit-step').value=String(restored.stepAdvance);
 workspaceRestoreTracks=true;render();
 for(const id of workspacePanelIds){const panel=document.getElementById(id);if(panel instanceof HTMLDetailsElement&&typeof restored.openPanels[id]==='boolean')panel.open=restored.openPanels[id]!;}
 requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{const grid=el('grid'),timeline=el('song-timeline');grid.scrollTop=restored.gridScrollTop;grid.scrollLeft=restored.gridScrollLeft;timeline.scrollLeft=restored.timelineScrollLeft;window.scrollTo(0,restored.pageScrollTop);workspaceReady=true;saveWorkspacePreferences();},400)));
}

function syncFollowPlayhead(){
  const btn=document.getElementById('tracker-follow-playhead');
  if(btn){
    btn.classList.toggle('is-active',followPlayhead);
    btn.setAttribute('aria-pressed',String(followPlayhead));
    btn.title=`Follow Playhead: ${followPlayhead?'ON':'OFF'} (Auto-scroll during playback / F)`;
  }
}

let context:AudioContext|undefined,timer:ReturnType<typeof setInterval>|undefined;
const vinylChoice=input('vinyl-texture-choice'),vinylEnabled=input('vinyl-texture-enabled'),vinylLevel=input('vinyl-texture-level');
for(const item of VINYL_TEXTURES){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;vinylChoice.append(option);}
function syncVinylControls(){vinylEnabled.checked=vinylTexture.enabled;vinylChoice.value=vinylTexture.catalogId;vinylLevel.value=String(vinylTexture.levelDb);el('vinyl-texture-level-value').textContent=`${vinylTexture.levelDb} dB`;vinylLevel.setAttribute('aria-valuetext',`${vinylTexture.levelDb} decibels`);const state=el('vinyl-texture-state');state.textContent=vinylTexture.enabled?'On':'Off';state.classList.toggle('is-on',vinylTexture.enabled);}
function updateVinylTexture(){stop();vinylTexture={enabled:vinylEnabled.checked,catalogId:vinylChoice.value,levelDb:Number(vinylLevel.value)};syncVinylControls();scheduleSave();}
vinylEnabled.onchange=updateVinylTexture;vinylChoice.onchange=updateVinylTexture;vinylLevel.oninput=()=>{el('vinyl-texture-level-value').textContent=`${vinylLevel.value} dB`;vinylLevel.setAttribute('aria-valuetext',`${vinylLevel.value} decibels`);};vinylLevel.onchange=updateVinylTexture;syncVinylControls();
function syncVinylGenreAccent(){
 const isLofi=input('genre').value==='lofihiphop';
 const rack=el('vinyl-texture-rack');
 rack.classList.toggle('is-lofi',isLofi);
}
input('genre').addEventListener('change',syncVinylGenreAccent);syncVinylGenreAccent();
async function vinylOptions(){
 if(!vinylTexture.enabled)return {};
 context??=new AudioContext();let asset=vinylCache.get(vinylTexture.catalogId);
 if(!asset){asset=await loadVinylTexture(vinylTexture.catalogId,context);vinylCache.set(vinylTexture.catalogId,asset);}
 return {vinylTexture:{asset,levelDb:vinylTexture.levelDb}};
}
function readyVinylOptions(){if(!vinylTexture.enabled)return {};const asset=vinylCache.get(vinylTexture.catalogId);if(!asset)throw Error('Vinyl texture is still loading. Try again.');return {vinylTexture:{asset,levelDb:vinylTexture.levelDb}};}
el('vinyl-texture-preview').onclick=async()=>{try{stop();context??=new AudioContext();const token=playToken;await context.resume();const asset=vinylCache.get(vinylChoice.value)??await loadVinylTexture(vinylChoice.value,context);vinylCache.set(vinylChoice.value,asset);if(token!==playToken)return;const channels=[new Float32Array(Math.round(context.sampleRate*4)),new Float32Array(Math.round(context.sampleRate*4))];mixVinylTexture(channels,context.sampleRate,asset,Number(vinylLevel.value));startSource(audioBuffer({channels,sampleRate:context.sampleRate,duration:4,attenuation:1}),context.currentTime);status(`Previewing ${asset.name} at ${vinylLevel.value} dB.`);}catch(e){status(String(e),true);}};
const playingSources=new Set<AudioBufferSourceNode>();
let refreshKitTempo=()=>{};
function showHitEditor(){if(matchMedia('(max-width:800px)').matches)requestAnimationFrame(()=>el('hit-editor').scrollIntoView({behavior:'smooth',block:'start'}));}
function status(message:string,error=false){el('status').textContent=message;el('status').classList.toggle('error',error);}
function fileFeedback(message:string,error=false){const output=el<HTMLOutputElement>('file-action-feedback');output.textContent=message;output.hidden=false;output.dataset.state=error?'error':'success';}
function syncHud() {
  const bpmVal = document.getElementById('hud-bpm-val');
  if (bpmVal && Number.isFinite(Number(input('bpm').value))) {
    (bpmVal as HTMLInputElement).value = (input('transport-target').value==='song' && bank ? bank.songBpm : pattern?.settings.bpm ?? Number(input('bpm').value)).toFixed(1);
  }
  const barsVal = document.getElementById('hud-bars-val');
  if (barsVal && pattern?.settings?.bars) {
    const bars=input('transport-target').value==='song' && bank ? bank.sequence.reduce((n,s)=>n+bank!.slots[s.slot]!.editor!.pattern.settings.bars*s.repeats,0) : pattern.settings.bars;
    barsVal.textContent = `${bars} BAR${bars !== 1 ? 'S' : ''}`;
  }
  const sidePattern = document.getElementById('hud-pattern-name');
  if (sidePattern && bank) {
    const slot = bank.slots[bank.active];
    sidePattern.textContent = `${slot?.name ?? 'A'} (${pattern?.settings.bars ?? 2} Bars)`;
  }
  const sideTempo = document.getElementById('hud-tempo-val');
  if (sideTempo) {
    sideTempo.textContent = `${(pattern?.settings.bpm ?? Number(input('bpm').value)).toFixed(1)} BPM`;
  }
  const sideKit = document.getElementById('hud-kit-name');
  if (sideKit) {
    const kitSelect = document.getElementById('generator-kit-select') as HTMLSelectElement | null;
    const txt = kitSelect?.selectedOptions[0]?.text?.replace(/^[^\w\s]+/, '')?.trim() ?? 'Custom Kit';
    sideKit.textContent = txt.length > 16 ? txt.slice(0, 14) + '…' : txt;
  }
  refreshKitTempo();
}
function updateHudPosition(row: number) {
  const posVal = document.getElementById('hud-pos-val');
  if (posVal && transfer?.timing?.lpb) {
    const position = row / transfer.timing.lpb;
    const bar = Math.floor(position / 4) + 1;
    const beat = Math.floor(position % 4) + 1;
    posVal.textContent = `${String(bar).padStart(2, '0')}.${beat}`;
  }
}
function resetHud() {
  const posVal = document.getElementById('hud-pos-val');
  if (posVal) posVal.textContent = '01.1';
}
function setPlayButton(playing:boolean){
  const button=el<HTMLButtonElement>('play'),icon=button.querySelector<HTMLElement>('.play-icon');
  button.classList.toggle('is-playing',playing);
  if(icon)icon.textContent=playing?'■':'▶';
  const label=playing?'Stop playback':`Play ${input('transport-target').value==='song'?'song':'pattern'}`;
  button.setAttribute('aria-label',label);button.title=label;
}
function getTrackerStep(): number {
  const select = document.getElementById('tracker-step-select') as HTMLSelectElement | null;
  if (select && Number.isInteger(Number(select.value))) {
    return Number(select.value);
  }
  const editStep = input('edit-step');
  if (editStep && Number.isInteger(Number(editStep.value))) {
    return Number(editStep.value);
  }
  return 1;
}
function settings(){
  const s=defaults(input('genre').value as Genre);
  s.generationMode=input('generationMode').value as GenerationMode;
  s.melodyPart=input('melodyPart').value as MelodyPart;
  s.melodyKey=Number(input('melodyKey').value);
  s.melodyScale=input('melodyScale').value as MelodyScale;
  s.harmonyStyle=input('harmonyStyle').value as NonNullable<Settings['harmonyStyle']>;
  s.algorithm=input('algorithm').value as NonNullable<Pattern['settings']['algorithm']>;s.variation=Number(input('variation').value);
  if(['groove-v3','groove-v4','groove-v5'].includes(s.algorithm??'')&&Number(input('phraseLength').value)){s.phraseLength=Number(input('phraseLength').value) as 4|8|16;s.phraseOffset=Number(input('phraseOffset').value);}
  s.enabledRoles=ROLES.filter(r=>kitPanel.mix[r].include);
  s.breakStyle=input('breakStyle').value as BreakStyle;
  if(input('breakLayer').value==='think-passage2')s.breakLayer='think-passage2';
  s.seed=input('seed').value;s.bpm=Number(input('bpm').value);s.bars=Number(input('bars').value);
  s.resolution=Number(input('resolution').value) as typeof s.resolution;
  if(pattern?.settings.lpb!==undefined)s.lpb=pattern.settings.lpb;
  s.spicy=Number(input('spicy').value);
  if(['groove-v4','groove-v5'].includes(s.algorithm??'')&&input('hit-target-mode').value==='exact')s.hitTarget=Number(input('hit-target-number').value);
  if(['groove-v4','groove-v5'].includes(s.algorithm??''))s.laneDensity=Object.fromEntries(ROLES.map(role=>[role,Number(input(`${role}-density`).value)])) as NonNullable<Settings['laneDensity']>;
  const ps=input('patternStructure').value; if(['groove','auto','fill','roll','build'].includes(ps)) s.patternStructure = ps as any;
  for(const name of ['complexity','syncopation','swing','humanizeMs','ghostAmount','fillAmount'] as const)s[name]=Number(input(name).value);
  return s;
}
function positionInstrumentPanel(panel:HTMLDetailsElement){
  if(!panel.open)return;
  const summary=panel.querySelector<HTMLElement>('summary'),card=panel.querySelector<HTMLElement>('.drum-slot');
  if(!summary||!card)return;
  const rect=summary.getBoundingClientRect(),margin=8,width=Math.min(350,innerWidth-margin*2);
  const below=Math.max(0,innerHeight-rect.bottom-margin),above=Math.max(0,rect.top-margin);
  const space=Math.max(80,Math.min(560,innerHeight*.75,Math.max(below,above)));
  const placeBelow=below>=Math.min(card.scrollHeight,space)||below>=above;
  const left=Math.max(margin,Math.min(innerWidth-width-margin,rect.left));
  const top=placeBelow?Math.min(innerHeight-margin,rect.bottom+5):Math.max(margin,rect.top-space-5);
  const available=placeBelow?Math.max(80,innerHeight-top-margin):Math.max(80,rect.top-top-5);
  card.style.setProperty('--instrument-panel-left',`${Math.round(left)}px`);
  card.style.setProperty('--instrument-panel-top',`${Math.round(top)}px`);
  card.style.setProperty('--instrument-panel-max-height',`${Math.round(Math.min(space,available))}px`);
}
function positionOpenInstrumentPanels(){el('grid').querySelectorAll<HTMLDetailsElement>('.track-instrument-panel[open]').forEach(positionInstrumentPanel);}
function openInstrumentPanel(panel:HTMLDetailsElement){panel.open=true;panel.querySelector('summary')?.focus();requestAnimationFrame(()=>positionInstrumentPanel(panel));}
function synthInstrumentPanel(track:SynthTrack):HTMLDetailsElement{
  const panel=document.createElement('details');panel.className='track-instrument-panel';panel.dataset.synthTrackId=track.id;panel.open=openSynthTrackIds.has(track.id);
  const summary=document.createElement('summary');summary.textContent='Synth / Tone';summary.setAttribute('aria-label',`Open ${track.name} synthesizer controls`);
  const card=document.createElement('div');card.className='drum-slot synth-instrument-card';
  const heading=document.createElement('strong');heading.textContent=track.name+' instrument';card.append(heading);
  const update=(patch:Partial<SynthInstrument>)=>{try{editor.setSynthInstrument(track.id,{...track.instrument,...patch});refresh();status(`Updated ${track.name} synthesizer.`);}catch(error){status(String(error),true);}};
  const selectControl=(labelText:string,value:string,choices:readonly string[],change:(value:string)=>void)=>{
    const label=document.createElement('label'),select=document.createElement('select');label.textContent=labelText;
    for(const choice of choices){const option=document.createElement('option');option.value=choice;option.textContent=choice[0]!.toUpperCase()+choice.slice(1);select.append(option);}
    select.value=value;select.onchange=()=>change(select.value);label.append(select);card.append(label);
  };
  selectControl('Preset',track.instrument.preset,['bass','pluck','pad','piano'],value=>update({...SYNTH_PRESETS[value as keyof typeof SYNTH_PRESETS]}));
  selectControl('Waveform',track.instrument.waveform,['sine','triangle','saw','square'],value=>update({waveform:value as SynthInstrument['waveform']}));
  for(const [key,labelText,min,max,step] of [['attack','Attack',.001,2,.001],['decay','Decay',.001,3,.001],['sustain','Sustain',0,1,.01],['release','Release',.01,4,.01],['lowpassHz','Low-pass Hz',100,20000,10]] as const){
    const label=document.createElement('label'),output=document.createElement('output'),control=document.createElement('input');label.textContent=labelText;
    control.type='range';control.min=String(min);control.max=String(max);control.step=String(step);control.value=String(track.instrument[key]);control.setAttribute('aria-label',`${track.name} ${labelText}`);output.value=String(track.instrument[key]);
    control.oninput=()=>{output.value=control.value;};control.onchange=()=>update({[key]:Number(control.value)});label.append(output,control);card.append(label);
  }
  if(track.instrument.preset==='piano'){
    const sample=track.instrument.sample,asset=sample?assets.get(sample.assetId):undefined;
    const source=document.createElement('span');source.textContent=asset?`Piano source: ${asset.name}`:track.instrument.sampleBank==='upright-kw'?'Piano source: Upright Piano KW (CC0)':'Piano source: built-in tone';card.append(source);
    const upload=document.createElement('button'),file=document.createElement('input');upload.type='button';upload.textContent=asset?'Replace piano WAV':'Use piano WAV';file.type='file';file.accept='.wav,audio/wav';file.hidden=true;
    upload.onclick=()=>file.click();file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;try{
      if(selected.size>20*1024*1024)throw Error('Choose a piano WAV under 20 MB.');
      context??=new AudioContext();const decoded=await context.decodeAudioData(await selected.arrayBuffer());
      if(decoded.duration>20||!decoded.numberOfChannels)throw Error('Choose a piano note under 20 seconds.');
      const id='piano-'+crypto.randomUUID(),channels=Array.from({length:Math.min(2,decoded.numberOfChannels)},(_,index)=>{const data=new Float32Array(decoded.length);decoded.copyFromChannel(data,index);return data;});
      assets.set(id,{id,name:selected.name,sampleRate:decoded.sampleRate,channels});
      const current=editor.state.pattern.userTracks?.find(item=>item.id===track.id);
      if(!isSynthTrack(current))throw Error('Piano track no longer exists.');
      openSynthTrackIds.add(track.id);editor.setSynthInstrument(track.id,{...current.instrument,sample:{assetId:id,rootNote:current.instrument.sample?.rootNote??72}});
      refresh();status(`Using “${selected.name}” for ${track.name}. Root is C-6 (MIDI 72); adjust it if the source note differs.`);
    }catch(error){status('Could not use piano WAV: '+String(error),true);}};card.append(upload,file);
    if(sample){
      const root=document.createElement('label'),note=document.createElement('input');root.textContent='Sample root note (MIDI)';note.type='number';note.min='0';note.max='119';note.value=String(sample.rootNote);note.onchange=()=>update({sample:{...sample,rootNote:Number(note.value)}});root.append(note);card.append(root);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove uploaded WAV';remove.onclick=()=>update({sample:undefined});card.append(remove);
    }
    const bankButton=document.createElement('button');bankButton.type='button';bankButton.textContent='Use upright piano';bankButton.disabled=!sample&&track.instrument.sampleBank==='upright-kw';bankButton.onclick=()=>update({sample:undefined,sampleBank:'upright-kw'});card.append(bankButton);
    const toneButton=document.createElement('button');toneButton.type='button';toneButton.textContent='Use built-in tone';toneButton.disabled=!sample&&!track.instrument.sampleBank;toneButton.onclick=()=>update({sample:undefined,sampleBank:undefined});card.append(toneButton);
  }
  const preview=document.createElement('button');preview.type='button';preview.textContent='Preview '+noteName(track.instrument.sample?.rootNote??(track.instrument.preset==='piano'?60:48));preview.onclick=()=>void auditionUserTrack(track);card.append(preview);
  panel.append(summary,card);panel.addEventListener('toggle',()=>{if(panel.open)openSynthTrackIds.add(track.id);else openSynthTrackIds.delete(track.id);if(panel.open)requestAnimationFrame(()=>positionInstrumentPanel(panel));});
  return panel;
}
el('grid').addEventListener('scroll',positionOpenInstrumentPanels,{passive:true});
window.addEventListener('resize',positionOpenInstrumentPanels,{passive:true});
window.addEventListener('scroll',positionOpenInstrumentPanels,{capture:true,passive:true});
function flashTrackMeter(role: Role, level = 1){
  const bar=document.querySelector(`#track-meter-${role} .track-meter-bar`) as HTMLElement|null;
  if(!bar)return;
  const pct=Math.max(15,Math.min(100,Math.round(level*100)));
  bar.classList.remove('decaying');
  bar.style.width=pct+'%';
  void bar.offsetWidth;
  bar.classList.add('decaying');
}
function render(){
  const container=el('grid'),scrollTop=container.scrollTop,scrollLeft=container.scrollLeft;
  if(!cursorTrackId&&!drumLane(pattern,cursorLane).visible){
    const first=visibleDrumRoles()[0];if(first)cursorLane=first;
    else if(pattern.userTracks?.[0]){cursorTrackId=pattern.userTracks[0].id;cursorLane=pattern.userTracks[0].role;}
  }
  syncDrumLaneFields();
  syncEditTarget();
  el('blank-tracker-guide').hidden=pattern.events.length>0;
  const active=document.activeElement as HTMLElement|null;
  const focusHit=active?.dataset.hit,focusRow=active?.dataset.row,focusCellRow=active?.dataset.cellRow,focusCellLane=active?.dataset.cellLane,focusField=active?.dataset.field;
  const openTracks=new Set(Array.from(container.querySelectorAll<HTMLDetailsElement>('.track-instrument-panel[open]')).map(panel=>panel.dataset.role));
  if(workspaceRestoreTracks){workspacePreferences.openTrackRoles.forEach(role=>openTracks.add(role));workspaceRestoreTracks=false;}
  const soundStore=el('drum-slots');for(const card of Array.from(container.querySelectorAll<HTMLElement>('.track-instrument-panel[data-role] .drum-slot')))soundStore.append(card);
  const selected=selectedIds(editor.state);
  input('tracker-bars').value=String(pattern.settings.bars);
  input('tracker-resolution').value=String(pattern.settings.resolution);
  input('tracker-lpb').value=String(transfer.timing.lpb);
  const selectedCells=new Set((editor.state.selection.cells??[]).map(c=>`${c.row}:${c.lane}`));
  container.replaceChildren();
  const table=document.createElement('table');
  const head=document.createElement('thead'),header=document.createElement('tr');
  const headerRoles=visibleDrumRoles();
  for(const [i,label] of ['Row','Beat',...headerRoles.map(role=>drumLane(pattern,role).name)].entries()){
    const th=document.createElement('th');
    if(i<2) th.textContent=label;
    else{
      const role=headerRoles[i-2]!;
      th.className='track-col-header track-'+role;
      const strip=document.createElement('div');
      strip.className='track-strip';
      const top=document.createElement('div');
      top.className='track-strip-top';
      const b=document.createElement('button');
      b.className='lane-settings';
      b.textContent=role==='percussion'&&pattern.sliceInstruments?.length?pattern.sliceInstruments[0]!.name:label;
      b.setAttribute('aria-label','Open '+label+' instrument settings');
      b.title=label+' settings';
      b.onclick=()=>{const panel=el('grid').querySelector<HTMLDetailsElement>(`.track-instrument-panel[data-role="${role}"]`);if(panel){if(panel.open)panel.open=false;else openInstrumentPanel(panel);}};
      const btns=document.createElement('div');
      btns.className='track-strip-btns';
      const muteBtn=document.createElement('button');
      muteBtn.className='track-header-mute'+(kitPanel.mix[role].mute?' is-muted':'');
      muteBtn.textContent='M';
      muteBtn.title=(kitPanel.mix[role].mute?'Unmute ':'Mute ')+label;
      muteBtn.onclick=(e)=>{e.stopPropagation();kitPanel.mix[role].mute=!kitPanel.mix[role].mute;if(mode==='pattern')pendingSlot=bank!.active;const cb=input('kit-mute-'+role) as HTMLInputElement|null;if(cb)cb.checked=kitPanel.mix[role].mute;render();dirty();};
      const soloBtn=document.createElement('button');
      soloBtn.className='track-header-solo'+(kitPanel.mix[role].solo?' is-soloed':'');
      soloBtn.textContent='S';
      soloBtn.title=(kitPanel.mix[role].solo?'Unsolo ':'Solo ')+label;
      soloBtn.onclick=(e)=>{e.stopPropagation();kitPanel.mix[role].solo=!kitPanel.mix[role].solo;if(mode==='pattern')pendingSlot=bank!.active;const cb=input('kit-solo-'+role) as HTMLInputElement|null;if(cb)cb.checked=!!kitPanel.mix[role].solo;render();dirty();};
      btns.append(muteBtn,soloBtn);
      top.append(b,btns);
      const mixer=document.createElement('div');
      mixer.className='track-strip-mixer';
      const fader=document.createElement('input');
      fader.type='range';fader.min='0';fader.max='1';fader.step='0.01';
      fader.id='track-fader-'+role;
      fader.className='track-header-fader';
      fader.value=String(kitPanel.mix[role].level);
      fader.title=label+' volume: '+Math.round(kitPanel.mix[role].level*100)+'%';
      fader.setAttribute('aria-label',label+' track volume');
      fader.setAttribute('aria-valuetext',Math.round(kitPanel.mix[role].level*100)+' percent');
      const volLabel=document.createElement('span');
      volLabel.id='track-vol-'+role;
      volLabel.className='track-header-vol';
      volLabel.textContent=Math.round(kitPanel.mix[role].level*100)+'%';
      fader.oninput=()=>{const val=Number(fader.value),percent=Math.round(val*100);kitPanel.mix[role].level=val;volLabel.textContent=percent+'%';fader.title=label+' volume: '+percent+'%';fader.setAttribute('aria-valuetext',percent+' percent');const kitLvl=document.getElementById('kit-level-'+role) as HTMLInputElement|null;if(kitLvl){kitLvl.value=String(val);kitLvl.dispatchEvent(new Event('input'));}dirty();};
      mixer.append(fader,volLabel);
      const meter=document.createElement('div');
      meter.id='track-meter-'+role;
      meter.className='track-header-meter';
      meter.title=label+' activity';
      const meterBar=document.createElement('div');
      meterBar.className='track-meter-bar';
      meter.append(meterBar);
      strip.append(top,mixer,meter);
      const instrument=document.createElement('details');instrument.className='track-instrument-panel';instrument.dataset.role=role;instrument.open=openTracks.has(role);
      const summary=document.createElement('summary');summary.textContent='Instrument / FX';summary.setAttribute('aria-label',`Open ${label} instrument and effects`);instrument.append(summary);
      instrument.addEventListener('toggle',()=>{if(instrument.open)requestAnimationFrame(()=>positionInstrumentPanel(instrument));scheduleWorkspaceSave();});
      const card=soundStore.querySelector<HTMLElement>(`.drum-slot[data-role="${role}"]`);if(card)instrument.append(card);
      strip.append(instrument);
      th.append(strip);
    }
    header.append(th);
  }
  for(const track of pattern.userTracks??[]){
    const th=document.createElement('th');th.className=`track-col-header user-track-col track-${track.role}${isSynthTrack(track)?' synth-track-col':''}`;th.dataset.trackId=track.id;
    const strip=document.createElement('div');strip.className='track-strip';
    const top=document.createElement('div');top.className='track-strip-top';
    const name=document.createElement('button');name.className='lane-settings user-track-name';name.textContent=track.name;name.title='Rename track';name.setAttribute('aria-label','Rename '+track.name);name.onclick=()=>{const value=prompt('Track name',track.name);if(value!==null)try{editor.renameUserTrack(track.id,value);refresh();}catch(e){status(String(e),true);}};top.append(name);
    const actions=document.createElement('div');actions.className='track-strip-btns';
    for(const [label,delta] of [['←',-1],['→',1]] as const){const button=document.createElement('button');button.textContent=label;button.title=delta<0?'Move track left':'Move track right';button.setAttribute('aria-label',button.title);button.onclick=()=>{if(editor.reorderUserTrack(track.id,delta as -1|1))refresh();};actions.append(button);}
    for(const [label,key] of [['M','mute'],['S','solo']] as const){const button=document.createElement('button');button.textContent=label;button.title=(track[key]?'Disable ':'Enable ')+(key==='mute'?'mute':'solo')+' for '+track.name;button.setAttribute('aria-pressed',String(track[key]));button.classList.toggle('is-muted',key==='mute'&&track.mute);button.classList.toggle('is-soloed',key==='solo'&&track.solo);button.onclick=()=>{editor.setUserTrackMixer(track.id,{[key]:!track[key]});refresh();};actions.append(button);}
    const remove=document.createElement('button');remove.textContent='×';remove.title='Delete track';remove.setAttribute('aria-label','Delete '+track.name);remove.onclick=()=>{if(!confirm(`Delete “${track.name}” and its notes?`))return;try{editor.deleteUserTrack(track.id);openSynthTrackIds.delete(track.id);openSampleGenerationIds.delete(track.id);if(cursorTrackId===track.id){cursorTrackId=undefined;cursorLane='kick';}refresh();}catch(e){status(String(e),true);}};actions.append(remove);top.append(actions);
    const mixer=document.createElement('div');mixer.className='track-strip-mixer';const fader=document.createElement('input');fader.type='range';fader.min='0';fader.max='2';fader.step='0.01';fader.value=String(track.level);fader.title=track.name+' level';fader.setAttribute('aria-label',track.name+' level');fader.onchange=()=>{editor.setUserTrackMixer(track.id,{level:Number(fader.value)});refresh();};const pan=document.createElement('input');pan.type='range';pan.min='-1';pan.max='1';pan.step='0.01';pan.value=String(track.pan);pan.title=track.name+' pan';pan.setAttribute('aria-label',track.name+' pan');pan.onchange=()=>{editor.setUserTrackMixer(track.id,{pan:Number(pan.value)});refresh();};mixer.append(fader,pan);strip.append(top,mixer);if(isSynthTrack(track))strip.append(synthInstrumentPanel(track));else if(track.generatedBreakLayer==='think-passage2'){
      const editSlices=document.createElement('button');editSlices.className='sample-track-generation';editSlices.textContent='Edit Think slices';editSlices.title='Audition and adjust the Think break markers';editSlices.onclick=()=>{const instrument=pattern.sliceInstruments?.find(item=>item.id===THINK_BREAK_INSTRUMENT_ID);if(instrument)breakPanel.open(instrument);};strip.append(editSlices);
    }else{
      const routing=document.createElement('label');routing.className='sample-track-generation';routing.textContent='Beat part';
      const assignment=document.createElement('select');assignment.setAttribute('aria-label',`Beat generator part for ${track.name}`);assignment.title=`Choose which beat part the generator places on ${track.name}`;
      for(const [value,label] of [['','Manual only'],['kick','Kick'],['snare','Snare'],['hat','Hi-hat'],['percussion','Percussion']])assignment.append(new Option(label,value));
      assignment.value=track.generationRole??'';assignment.onchange=()=>{try{const role=assignment.value as Role||null;if(editor.setSampleTrackGeneration(track.id,role)){refresh();status(role?`${track.name} will receive ${role} notes on the next Beat or Variation generation.`:`${track.name} is manual only. Its generated notes will clear on the next Beat or Variation generation.`);}}catch(error){status(String(error),true);assignment.value=track.generationRole??'';}};
      routing.append(assignment);strip.append(routing);
      const options=document.createElement('details');options.className='sample-track-options';options.open=openSampleGenerationIds.has(track.id);
      const summary=document.createElement('summary');summary.textContent=`Shape · ${Math.round((track.generationDensity??1)*100)}% density · ${Math.round((track.generationProbability??1)*100)}% chance`;options.append(summary);
      options.addEventListener('toggle',()=>{if(options.open)openSampleGenerationIds.add(track.id);else openSampleGenerationIds.delete(track.id);});
      for(const [kind,label,help] of [['generationDensity','Optional hits','Keep a stable share of optional notes; main anchors remain.'],['generationProbability','Variation chance','Chance for each optional note on this generation; variations can differ.']] as const){
        const control=document.createElement('label');control.textContent=label;control.title=help;
        const amount=document.createElement('output');amount.textContent=`${Math.round((track[kind]??1)*100)}%`;
        const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.value=String(Math.round((track[kind]??1)*100));slider.setAttribute('aria-label',`${label} for ${track.name}`);slider.setAttribute('aria-valuetext',amount.textContent);
        slider.oninput=()=>{amount.textContent=`${slider.value}%`;slider.setAttribute('aria-valuetext',amount.textContent);};
        slider.onchange=()=>{try{if(editor.setSampleTrackGenerationAmount(track.id,kind,Number(slider.value)/100)){openSampleGenerationIds.add(track.id);refresh();status(`${track.name}: ${label.toLowerCase()} ${slider.value}%. Generate again to hear the change.`);}}catch(error){status(String(error),true);slider.value=String(Math.round((track[kind]??1)*100));amount.textContent=`${slider.value}%`;slider.setAttribute('aria-valuetext',amount.textContent);}};
        control.append(amount,slider);options.append(control);
      }
      strip.append(options);
    }th.append(strip);header.append(th);
  }
  head.append(header);table.append(head);
  const body=document.createElement('tbody');
  const view=input('view').value;
  for(let row=0;row<transfer.timing.lines;row++){
    const isBar=row%(transfer.timing.lpb*4)===0,isBeat=row%transfer.timing.lpb===0;
    const barNumber=Math.floor(row/(transfer.timing.lpb*4))+1;
    const tr=document.createElement('tr');tr.className=(isBar?'bar-start ':'')+(isBeat?'beat':'');tr.dataset.playRow=String(row);tr.dataset.bar=String(barNumber);
    const range=editor.state.selection.rows;
    if(range&&row>=range[0]&&row<=range[1])tr.classList.add('selected-row');
    const position=row/transfer.timing.lpb;
    const labels=[String(row).padStart(2,'0'),`${Math.floor(position/4)+1}.${Math.floor(position%4)+1}${position%1?` +${(position%1).toFixed(2)}`:''}`];
    for(const [index,value] of labels.entries()){
      const td=document.createElement('td');
      if(index===0){
        const button=document.createElement('button');button.className='row-select';button.dataset.row=String(row);button.textContent=value;
        button.setAttribute('aria-label',`Select row ${row}`);button.setAttribute('aria-pressed',String(!!range&&row>=range[0]&&row<=range[1]));
        button.onclick=e=>selectRows(e.shiftKey?rowAnchor:row,row,!e.shiftKey);td.append(button);
      }else if(index===1&&isBar){const marker=document.createElement('span');marker.className='tracker-bar-marker';marker.textContent=`BAR ${barNumber}`;td.classList.add('tracker-bar-label-cell');td.append(marker,document.createTextNode(value));}
      else td.textContent=value;
      tr.append(td);
    }
    const visibleLanes=[...visibleDrumRoles().map(id=>({id,name:drumLane(pattern,id).name,role:id as Role,track:undefined as UserTrack|undefined})),...(pattern.userTracks??[]).map(track=>({id:track.id,name:track.name,role:track.role,track}))];
    for(const lane of visibleLanes){
      const td=document.createElement('td');td.classList.add('track-'+lane.role);td.classList.toggle('cursor-cell',row===rowAnchor&&lane.id===(cursorTrackId??cursorLane));td.classList.toggle('tracker-cell-selected',selectedCells.has(`${row}:${lane.id}`));
      td.dataset.dropRow=String(row);td.dataset.dropLane=lane.id;
      td.ondragover=e=>{if(!draggingTrackerCells)return;e.preventDefault();td.classList.add('tracker-drop-target');if(e.dataTransfer)e.dataTransfer.dropEffect='move';};
      td.ondragleave=()=>td.classList.remove('tracker-drop-target');
      td.ondrop=e=>{e.preventDefault();td.classList.remove('tracker-drop-target');if(!draggingTrackerCells)return;const source=draggingTrackerCells;draggingTrackerCells=undefined;edit(()=>editor.moveCells(source,row,lane.id),'Moved tracker cells. Undo restores their original positions.');focusTrackerCell(row,lane.id);};
      const notes=transfer.notes.filter(n=>n.row===row&&n.lane===lane.id);
      if(!notes.length){
        const empty=document.createElement('button');
        empty.className='empty-cell';
        empty.dataset.cellRow=String(row);empty.dataset.cellLane=lane.id;
        empty.textContent=view==='beginner'?'····':'···';
        empty.setAttribute('aria-label','Enter '+lane.id+' at row '+row);
        empty.classList.toggle('cell-selected',selectedCells.has(`${row}:${lane.id}`));
        empty.onclick=e=>selectTrackerCell(row,lane.role,e,undefined,true,lane.track?.id);
        empty.ondblclick=()=>{
          selectTrackerCell(row,lane.role,undefined,undefined,false,lane.track?.id);
          updateEntry();
          writeEntry(false);
          render();
          focusTrackerCell(row,lane.id);
          if(lane.track)void auditionUserTrack(lane.track);else void auditionCursor(lane.role);
        };
        td.append(empty);
        if(view!=='beginner'){const fields=document.createElement('div');fields.className='tracker-values is-empty';for(const field of trackerFields){const cell=document.createElement('button');cell.type='button';cell.className='tracker-value';cell.dataset.cellRow=String(row);cell.dataset.cellLane=lane.id;cell.dataset.field=field;cell.textContent=field==='note'?'---':field==='effect'?'----':'··';cell.title=`${field} at ${lane.name} row ${row}; enter a note first`;cell.onclick=e=>{e.stopPropagation();selectTrackerCell(row,lane.role,undefined,undefined,false,lane.track?.id);focusTrackerField(row,lane.id,field);};fields.append(cell);}td.append(fields);}
      }
      for(const n of notes){
        const hit=pattern.events.find(e=>e.id===n.id)!;
        const source=transfer.sources.find(s=>s.id===n.source)!;
        const button=document.createElement('button');button.className=`hit ${lane.id}${hit.ghost?' ghost':''}`;
        button.dataset.hit=hit.id;button.classList.toggle('selected-hit',selected.has(hit.id));
        button.dataset.cellRow=String(row);button.dataset.cellLane=lane.id;button.classList.toggle('cell-selected',selectedCells.has(`${row}:${lane.id}`));
        button.classList.toggle('locked-hit',locked(editor.state,hit));button.setAttribute('aria-pressed',String(selected.has(hit.id)));
        const sound=hit.synthNote?undefined:resolveSlice(pattern,hit)??drumKit[hit.role];
        const reverse=hit.reverse||kitPanel.mix[hit.role].reverse;
        const label=hit.synthNote?`${lane.name} ${noteName(hit.synthNote.note)} · ${(hit.synthNote.durationTicks/960).toFixed(2)} beats`:sound?(hit.ghost?'Ghost · ':'')+sound.label:hit.ghost?'Ghost snare':lane.name;
        const articulation=(hit.ratchets&&hit.ratchets>1?'×'+hit.ratchets:'')+(hit.gate!==undefined?(hit.ratchets&&hit.ratchets>1?' · ':'')+'Gate '+Math.round(hit.gate*100)+'%':'');
        const badge=(hit.synthNote?'':(articulation?articulation+' ':'')+(reverse?'↶ ':''))+(locked(editor.state,hit)?'🔒 ':'');
        button.textContent=badge+(view==='beginner'?(hit.ghost?'Ghost':lane.name):label);
        button.title=`${label}, row ${row}, volume ${hex(n.volume)}, delay ${hex(n.delay)} · ${articulation} · ${articulationLabel(hit)} · ${hit.reason}`;
        button.onclick=e=>{selectTrackerCell(row,lane.role,e,hit,true,lane.track?.id);};
        button.draggable=true;button.title+=' · Drag to move the entire hit';
        button.ondragstart=e=>{const selectedCells=editor.state.selection.cells??[];draggingTrackerCells=selectedCells.some(c=>c.row===row&&c.lane===lane.id)?selectedCells:[{row,lane:lane.id}];if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',`${row}:${lane.id}`);}};
        button.ondragend=()=>{draggingTrackerCells=undefined;container.querySelectorAll('.tracker-drop-target').forEach(node=>node.classList.remove('tracker-drop-target'));};
        const card=document.createElement('div');card.className=`tracker-hit-card track-${lane.role}`;card.append(button);
        if(view!=='beginner'){
          const fields=document.createElement('div');fields.className='tracker-values';
          const soundIndex=hit.slice?LIBRARY.findIndex(entry=>hit.slice?.assetId==='library-'+entry.id):-1;
          const values=[noteName(hit.synthNote?.note??hit.mapped?.note??source.note+(hit.pitch??0)),hit.synthNote?'SYN':hit.mapped?'BRK':hit.slice?(soundIndex>=0?String(soundIndex+1).padStart(3,'0'):'USR'):'KIT',hex(n.volume),hex(n.pan),hex(n.delay),hit.effect?hit.effect.command+hex(hit.effect.param):'----'];
          trackerFields.forEach((field,index)=>{const value=document.createElement('button');value.type='button';value.className='tracker-value';value.dataset.cellRow=String(row);value.dataset.cellLane=lane.id;value.dataset.hit=hit.id;value.dataset.field=field;value.textContent=values[index]!;value.title=field==='effect'?`FX ${values[index]} · type S/9 offset, B reverse, U/1 up, D/2 down, C cut or R retrigger, then two hex digits`: `${field}: ${values[index]} — click to edit`;value.setAttribute('aria-label',`${field} ${values[index]} for ${lane.name} at row ${row}`);value.onclick=e=>{e.stopPropagation();selectTrackerCell(row,lane.role,undefined,hit,false,lane.track?.id);focusTrackerField(row,lane.id,field);if(field==='instrument'){if(hit.synthNote){const panel=el('grid').querySelector<HTMLDetailsElement>(`.track-instrument-panel[data-synth-track-id="${hit.trackId}"]`);if(panel)openInstrumentPanel(panel);}else if(hit.mapped)breakPanel.open(pattern.sliceInstruments!.find(i=>i.id===hit.mapped!.instrumentId)!);else openHitSoundPicker(hit.id);}};fields.append(value);});
          card.prepend(fields);
        }
        td.append(card);
      }
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);container.append(table);
  container.scrollTop=scrollTop;container.scrollLeft=scrollLeft;
  positionOpenInstrumentPanels();
  markTrackerCursor(container.querySelector<HTMLElement>(`[data-cell-row="${rowAnchor}"][data-cell-lane="${cursorTrackId??cursorLane}"][data-field="${cursorField}"]`));
  if(focusCellRow!==undefined&&focusCellLane)(container.querySelector<HTMLElement>(`[data-hit="${focusHit??''}"][data-cell-row="${focusCellRow}"][data-cell-lane="${focusCellLane}"]${focusField?`[data-field="${focusField}"]`:''}`)??container.querySelector<HTMLElement>(`[data-cell-row="${focusCellRow}"][data-cell-lane="${focusCellLane}"]${focusField?`[data-field="${focusField}"]`:''}`)??container.querySelector<HTMLElement>(`[data-cell-row="${focusCellRow}"][data-cell-lane="${focusCellLane}"]`))?.focus({preventScroll:true});
  else if(focusHit)container.querySelector<HTMLElement>(`[data-hit="${focusHit}"]`)?.focus({preventScroll:true});
  else if(focusRow)container.querySelector<HTMLElement>(`[data-row="${focusRow}"]`)?.focus({preventScroll:true});
  el('slice-octave-label').hidden=!pattern.sliceInstruments?.length;el('edit-break-slices').hidden=!pattern.sliceInstruments?.length;
  el('synth-octave-label').hidden=!isSynthTrack(pattern.userTracks?.find(track=>track.id===cursorTrackId));
  const synthCount=pattern.events.filter(hit=>!!hit.synthNote).length;
  const hitSummary=pattern.settings.hitTarget!==undefined&&synthCount?`${pattern.events.length-synthCount} drum hits + ${synthCount} synth notes`:`${transfer.notes.length} hits`;
  el('summary').textContent=`${transfer.timing.bars} bars · ${transfer.timing.lines} rows · LPB ${transfer.timing.lpb} · ${hitSummary} · ${pattern.settings.bpm.toFixed(1)} BPM · ${(pattern.settings.enabledRoles??ROLES).join(' + ')}`;
  el('generation-summary').textContent=(pattern.settings.enabledRoles??ROLES).map(r=>r==='hat'?'Hi-hat':r[0]!.toUpperCase()+r.slice(1)).join(' + ')+' · '+pattern.settings.bars+' bars · '+pattern.settings.bpm.toFixed(1)+' BPM';
  input('export').disabled=false;input('play').disabled=false;input('copy').disabled=false;
  const range=editor.state.selection.rows;
  const cellCount=editor.state.selection.cells?.length??0;
  const targetLabel=editTargetLane?` · Edit track: ${el<HTMLSelectElement>('edit-target').selectedOptions[0]?.textContent??editTargetLane}`:'';
  el('selection-status').textContent=(range?`Rows ${range[0]}–${range[1]} · ${selected.size} hits selected`:cellCount?`${cellCount} cell${cellCount===1?'':'s'} selected · ${selected.size} hits` :selected.size?`${selected.size} hit${selected.size===1?'':'s'} selected`:'Whole pattern · no selection')+targetLabel;
  const allLocked=selected.size>0&&[...selected].every(id=>editor.state.lockedIds.includes(id));
  el('lock-selected').textContent=allLocked?'Unlock selected hits':'Lock selected hits';input('lock-selected').disabled=selected.size===0;
  el('mutate').textContent=range||selected.size||cellCount?'Mutate selection':editTargetLane?'Mutate track':'Mutate pattern';
  el('simplify').textContent=range||selected.size||cellCount?'Simplify selection':editTargetLane?'Simplify track':'Simplify pattern';
  el('increase-complexity').textContent=range||selected.size||cellCount?'Add detail to selection':editTargetLane?'Add detail to track':'Increase complexity';
  input('fill').disabled=!range;
  input('undo').disabled=!editor.undoLabel;input('redo').disabled=!editor.redoLabel;
  el('undo').title=editor.undoLabel?`Undo ${editor.undoLabel}`:'Nothing to undo';el('redo').title=editor.redoLabel?`Redo ${editor.redoLabel}`:'Nothing to redo';
  el('undo').setAttribute('aria-label',editor.undoLabel?`Undo ${editor.undoLabel}`:'Nothing to undo');el('redo').setAttribute('aria-label',editor.redoLabel?`Redo ${editor.redoLabel}`:'Nothing to redo');
  for(const role of ['kick','snare','hat','percussion'] as const)input(`lock-${role}`).checked=editor.state.lockedRoles.includes(role);
  for(const id of ['row-start','row-end']){input(id).max=String(transfer.timing.lines-1);}
  input('row-start').value=String(range?.[0]??0);input('row-end').value=String(range?.[1]??transfer.timing.lines-1);
  const chosen=pattern.events.find(hit=>hit.id===editor.state.selection.ids.at(-1));
  const note=chosen&&transfer.notes.find(n=>n.id===chosen.id),source=note&&transfer.sources.find(s=>s.id===note.source);
  updateEntry(chosen);
  el('explanation').textContent=chosen&&note&&source?`${chosen.reason} Row ${note.row}, ${chosen.synthNote?`${noteName(chosen.synthNote.note)} for ${+(chosen.synthNote.durationTicks/960).toFixed(2)} beats`:`instrument ${hex(source.instrument)}, ${noteName(source.note)}`}, volume ${hex(note.volume)}, pan ${hex(note.pan)}, delay ${hex(note.delay)}.${locked(editor.state,chosen)?' Locked: editing will preserve this hit.':''} ${note.delay?`The delay is ${(note.delay/256*60000/transfer.timing.bpm/transfer.timing.lpb).toFixed(2)} ms into this row.`:''}`:range?'This row range is the target for mutation and fills. Locked hits and main anchors remain intact.':'Select a hit to inspect it. Ctrl/Cmd-click adds hits; Shift-click a row number selects a range.';
  syncHud();
}
function markTrackerCursor(target:HTMLElement|null|undefined){el('grid').querySelectorAll<HTMLElement>('.tracker-value.is-cursor-field').forEach(value=>{value.classList.remove('is-cursor-field');value.removeAttribute('aria-current');});if(target?.matches('.tracker-value')){target.classList.add('is-cursor-field');target.setAttribute('aria-current','location');}}
function focusTrackerCell(row:number,lane:string){cursorField='note';const selected=editor.state.selection.ids.length===1?editor.state.selection.ids[0]:'';const base=`[data-cell-row="${row}"][data-cell-lane="${lane}"]`;const target=el('grid').querySelector<HTMLElement>(base+`[data-hit="${selected}"]`)??el('grid').querySelector<HTMLElement>(base),field=el('grid').querySelector<HTMLElement>(base+`[data-hit="${selected}"][data-field="note"]`)??el('grid').querySelector<HTMLElement>(base+'[data-field="note"]');markTrackerCursor(field);target?.focus({preventScroll:true});scheduleWorkspaceSave();}
function focusTrackerField(row:number,lane:string,field:string){cursorField=field as typeof trackerFields[number];const selected=editor.state.selection.ids.length===1?editor.state.selection.ids[0]:'';const base=`[data-cell-row="${row}"][data-cell-lane="${lane}"][data-field="${field}"]`;const target=el('grid').querySelector<HTMLElement>(base+`[data-hit="${selected}"]`)??el('grid').querySelector<HTMLElement>(base);markTrackerCursor(target);target?.focus({preventScroll:true});scheduleWorkspaceSave();}
let soundBrowser:ReturnType<typeof setupSoundBrowser>;
function openHitSoundPicker(id:string){
 const hit=pattern.events.find(h=>h.id===id);if(!hit)return;
 if(hit.synthNote){const panel=el('grid').querySelector<HTMLDetailsElement>(`.track-instrument-panel[data-synth-track-id="${hit.trackId}"]`);if(panel)openInstrumentPanel(panel);return;}
 const current=LIBRARY.find(e=>hit.slice?.assetId==='library-'+e.id);
 const opener=document.activeElement instanceof HTMLElement?document.activeElement:el('grid');
 soundBrowser.open({role:hit.role,mode:'hit',current:current?.id??(hit.slice?.assetId===kitPanel.mix[hit.role].uploadId?'upload':'lane'),uploadName:kitPanel.mix[hit.role].uploadId?assets.get(kitPanel.mix[hit.role].uploadId!)?.name:undefined,opener,
   preview:choice=>previewSoundCandidate(hit.role,choice,hit),apply:choice=>applyHitSound(id,choice)});
}
async function applyHitSound(id:string,choice:string){
 const hit=pattern.events.find(h=>h.id===id);if(!hit)throw Error('This hit is no longer available.');
 if(hit.synthNote)throw Error('Use the synth controls above this track to change its instrument.');
  let slice=undefined;
  if(choice!=='lane'){
   const asset=choice==='upload'?assets.get(kitPanel.mix[hit.role].uploadId??''):(context??=new AudioContext(),await ensureLibraryAudio(choice,hit.role,assets,context));
   if(!asset)throw Error('The selected sample is unavailable.');
   slice={assetId:asset.id,startFrame:0,endFrame:asset.channels[0]!.length,sampleRate:asset.sampleRate,label:asset.name};
  }
  const revised={...hit,sourceKind:'oneShot' as const};delete revised.mapped;if(slice)revised.slice=slice;else delete revised.slice;
  edit(()=>editor.write(revised,hit.id),'Hit instrument changed. Undo restores the previous sound.');
}
function trackerLaneIds(){return [...visibleDrumRoles(),...(pattern.userTracks??[]).map(track=>track.id)];}
function trackerRole(laneId:string):Role{return ROLES.includes(laneId as Role)?laneId as Role:pattern.userTracks?.find(track=>track.id===laneId)?.role??'percussion';}
function selectTrackerLane(row:number,laneId:string,event?:{shiftKey:boolean;ctrlKey:boolean;metaKey:boolean},audition=false){
 const track=pattern.userTracks?.find(item=>item.id===laneId);
 selectTrackerCell(row,trackerRole(laneId),event,undefined,audition,track?.id);
}
function selectTrackerCell(row:number,lane:Role,event?:{shiftKey:boolean;ctrlKey:boolean;metaKey:boolean},hit?:Hit,audition=true,trackId?:string){
 const laneId=trackId??lane,cell={row,lane:laneId},key=`${row}:${laneId}`;rowAnchor=row;cursorLane=lane;cursorTrackId=trackId;scheduleWorkspaceSave();input('edit-lane').value=lane;
 let cells:CellPosition[];
 if(event?.shiftKey){
   const anchor=cellAnchor??cell,order=trackerLaneIds(),startRow=Math.min(anchor.row,row),endRow=Math.max(anchor.row,row),left=Math.min(order.indexOf(anchor.lane),order.indexOf(laneId)),right=Math.max(order.indexOf(anchor.lane),order.indexOf(laneId));cells=[];
   for(let r=startRow;r<=endRow;r++)for(let l=left;l<=right;l++)cells.push({row:r,lane:order[l]!});
 }else if(event?.ctrlKey||event?.metaKey){
  cells=[...(editor.state.selection.cells??[])];const index=cells.findIndex(c=>`${c.row}:${c.lane}`===key);if(index>=0)cells.splice(index,1);else cells.push(cell);
  if(!cellAnchor)cellAnchor=cell;
 }else{cells=[cell];cellAnchor=cell;}
 if(cells.length){editor.state.selection={ids:[],rows:null,cells};editor.state.selection.ids=[...selectedIds(editor.state)];}
 else editor.state.selection=emptySelection();
  if(hit&&!event?.shiftKey&&!event?.ctrlKey&&!event?.metaKey&&transfer.notes.filter(n=>n.row===row&&n.lane===laneId).length>1)editor.state.selection={ids:[hit.id],rows:null};
 const selectedHit=hit??pattern.events.find(h=>{const n=transfer.notes.find(note=>note.id===h.id);return n?.row===row&&n.lane===laneId;});
 const remainingHit=cells.length===1?pattern.events.find(h=>{const n=transfer.notes.find(note=>note.id===h.id);return n?.row===cells[0]!.row&&n.lane===cells[0]!.lane;}):undefined;
 updateEntry(hit??remainingHit);render();focusTrackerCell(row,laneId);
  if(audition){if(selectedHit)void auditionHit(selectedHit);else if(trackId){const track=pattern.userTracks?.find(item=>item.id===trackId);if(track)void auditionUserTrack(track);}else void auditionRole(lane);}
}
function selectRows(start:number,end:number,anchor=true){
  if(!Number.isInteger(start)||!Number.isInteger(end)||Math.min(start,end)<0||Math.max(start,end)>=transfer.timing.lines){status('Choose row numbers within this pattern.',true);return;}
  cellAnchor=undefined;
  if(anchor){rowAnchor=start;cellAnchor=undefined;scheduleWorkspaceSave();}
  editor.state.selection={ids:[],rows:[Math.min(start,end),Math.max(start,end)]};render();
}
function syncControls(){
  const s=editor.state.pattern.settings;
  input('hit-target-mode').value=s.hitTarget===undefined?'auto':'exact';
  input('hit-target-number').value=String(s.hitTarget??32);
  input('hit-target-slider').value=String(s.hitTarget??32);
  input('generationMode').value=s.generationMode??'drums';input('melodyPart').value=s.melodyPart??'bassline';input('melodyKey').value=String(s.melodyKey??0);input('melodyScale').value=s.melodyScale??'natural-minor';input('harmonyStyle').value=s.harmonyStyle??'jazz';
  for(const role of ROLES)input(`${role}-density`).value=String(s.laneDensity?.[role]??1);
  input('patternStructure').value=s.patternStructure??'auto';
  input('breakLayer').value=s.breakLayer??'off';
  input('phraseLength').value=String(s.phraseLength??0);syncPhraseControls(s.phraseOffset??0);
  input('algorithm').value=s.algorithm??'legacy-v1';input('variation').value=String(s.variation??0);
  for(const [key,value] of Object.entries(s))if(key!=='enabledRoles'&&key!=='laneDensity'&&key!=='lpb'&&key!=='hitTarget')input(key).value=String(value);
  input('tracker-bars').value=String(s.bars);input('tracker-resolution').value=String(s.resolution);input('tracker-lpb').value=String(s.lpb??s.resolution/4);
  for(const r of ROLES)kitPanel.mix[r].include=!s.enabledRoles||s.enabledRoles.includes(r);kitPanel.restore(kitPanel.snapshot());
  presets();syncModeControls();syncHitTargetControl();
}
function refresh(){for(const [owner,drafts] of hitDrafts)for(const id of drafts.keys())if(!owner.state.pattern.events.some(h=>h.id===id))drafts.delete(id);pattern=editor.state.pattern;if(cursorTrackId&&!pattern.userTracks?.some(track=>track.id===cursorTrackId))cursorTrackId=undefined;transfer=compile(pattern);render();stashSlot();renderBank();scheduleSave();syncReTrackSampleRack();syncReTrackStatusStrip();}
function edit(action:()=>boolean,message:string,historyLabel?:string){
  try{stop();const before=historyLabel?structuredClone(editor.state):undefined;const changed=action();refresh();if(changed&&before)rememberActivePattern(before,historyLabel!);status(changed?message:'No editable change: selected hits may be locked or protected anchors.');}
  catch(e){status((e as Error).message,true);}
}
function stop(){
  if(timer)clearInterval(timer);timer=undefined;
  for(const source of playingSources){try{source.stop();}catch{}source.disconnect();}playingSources.clear();
  mode=undefined;comparisonPlaying=undefined;pendingSlot=undefined;el('transport-state').textContent='Stopped';el('play-arrangement').textContent='Play arrangement';el('bank-status').textContent='';document.querySelectorAll('.playing-step').forEach(e=>e.classList.remove('playing-step'));
  playToken++;setPlayButton(false);el('song-position').textContent='Song stopped';document.querySelector('.playing-row')?.classList.remove('playing-row');
  resetHud();renderComparisonControls();
}
async function buildLayer(layer:'drums'|'bassline'|'lead'|'piano'){
  if(pendingCount()){status('Apply or Revert pending hit edits before generating a new pattern.',true);return;}
  stop();
  try{const requested=settings();requested.generationMode=layer==='drums'?'drums':'melody';if(layer!=='drums')requested.melodyPart=layer;input('generationMode').value=requested.generationMode;input('melodyPart').value=requested.melodyPart??'bassline';if(layer==='drums'&&!requested.enabledRoles?.length)throw Error('Include at least one drum instrument to generate the beat.');if(layer==='drums'&&requested.breakLayer==='think-passage2')await ensureThinkBreakAudio(assets);const before=editor?structuredClone(editor.state):undefined;let changed=false;if(!editor){editor=new Editor(generate({...requested,generationMode:'drums'}));if(layer!=='drums'||requested.breakLayer==='think-passage2')changed=editor.generateComposition(requested,'Generate Beat');}else changed=editor.generateComposition(requested,`Generate ${layer==='drums'?'Beat':layer==='bassline'?'Bass':layer==='lead'?'Melody':'Piano'}`);if(layer!=='drums'){const track=editor.state.pattern.userTracks?.find(track=>isSynthTrack(track)&&track.generatedPart===layer);if(track){cursorTrackId=track.id;cursorLane=track.role;}}refresh();if(changed&&before)rememberActivePattern(before,`Before Generate ${layer}`);status(`${layer==='drums'?'Beat':layer==='bassline'?'Bassline':layer==='lead'?'Melody':'Piano chords'} generated from seed “${pattern.settings.seed}”. Other layers and locked notes were preserved.${before?' Undo restores the previous pattern.':''}`);}
  catch(e){status((e as Error).message,true);}
}
function build(){void buildLayer('drums');}
function download(){
  el<HTMLDetailsElement>('more-actions').open=false;
  const url=URL.createObjectURL(new Blob([patternJSON()],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`${transfer.genre}-${transfer.seed.replace(/[^a-zA-Z0-9_-]/g,'_')}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);status('Pattern JSON downloaded. Use Export pattern WAV for playable audio.');
}
const samplePanel=setupSamplePanel(stop, (role, id, name, rate, channels) => {
  assets.set(id, {id, name, sampleRate: rate, channels});
  kitPanel.mix[role].uploadId = id;
  kitPanel.mix[role].assetId = id;
  kitPanel.mix[role].choice = 'upload';
  kitPanel.restore(kitPanel.mix);
  scheduleSave();
});
const breakPanel=setupBreakPanel({settings,assets,stop,create:next=>{
  stop();samplePanel.stop();let index=0;
  if(arrangementMutation('Import break',b=>{index=addPatternSlot(b,next.sliceInstruments![0]!.name.slice(0,32),new Editor(next).state);})){activateSlot(index);renderBank();scheduleSave();status('Break imported into a new pattern. Notes select slices; pitch is independent. The track mixer affects playback level.');}
},update:instrument=>{if(editor.updateSliceInstrument(instrument)){refresh();scheduleSave();status('Slice changes applied. Undo restores the previous mapping.');}}});
el('import-break').onclick=()=>breakPanel.open();
el('edit-break-slices').onclick=()=>{const selected=pattern.events.find(h=>editor.state.selection.ids.includes(h.id));const instrument=pattern.sliceInstruments?.find(i=>i.id===selected?.mapped?.instrumentId)??pattern.sliceInstruments?.[0];if(instrument)breakPanel.open(instrument);};
async function auditionRole(role: Role) {
  flashTrackMeter(role, kitPanel.mix[role].level);
  stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
  const one=generate({...defaults(),algorithm:pattern?.settings.algorithm,bpm:input('transport-target').value==='song'&&bank?bank.songBpm:pattern?.settings.bpm??120,bars:1});one.events=[{id:'preview',role,sourceId:'kit.'+role,baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Instrument preview.'}];
  const mix=kitPanel.snapshot();mix[role].mute=false;mix[role].solo=true;
  const audio=renderPerformance(withDrumKit(one,drumKit,mix),assets,context.sampleRate,effectMap());
  const b=context.createBuffer(2,audio.channels[0]!.length,audio.sampleRate);audio.channels.forEach((c,i)=>b.copyToChannel(new Float32Array(c),i));
  const source=context.createBufferSource();source.buffer=b;source.connect(context.destination);playingSources.add(source);source.onended=()=>{playingSources.delete(source);source.disconnect();};source.start();
}
async function previewSoundCandidate(role:Role,choice:string,hit?:Hit){
 stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();
 let slice:Hit['slice']|undefined;
 if(choice==='upload'){
   const asset=assets.get(kitPanel.mix[role].uploadId??'');if(!asset)throw Error('No uploaded sound is available for this lane.');
   slice={assetId:asset.id,startFrame:0,endFrame:asset.channels[0]!.length,sampleRate:asset.sampleRate,label:asset.name};
 }else if(choice!=='synth'&&choice!=='lane'){
   const asset=await ensureLibraryAudio(choice,role,assets,context);
   slice={assetId:asset.id,startFrame:0,endFrame:asset.channels[0]!.length,sampleRate:asset.sampleRate,label:asset.name};
 }
 if(token!==playToken||!el<HTMLDialogElement>('sound-browser').open)return;
 const one=generate({...defaults(),algorithm:pattern?.settings.algorithm,bpm:input('transport-target').value==='song'&&bank?bank.songBpm:pattern?.settings.bpm??120,bars:1});
 const next:Hit=hit?{...hit,baseTick:0,offsetTick:0,fineOffset:0,sourceKind:'oneShot'}:{id:'sound-browser-preview',role,sourceId:'kit.'+role,baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Sound browser preview.',sourceKind:'oneShot'};
 delete next.mapped;if(slice)next.slice=slice;else delete next.slice;
 one.events=[next];const mix=kitPanel.snapshot();mix[role].mute=false;mix[role].solo=true;
 const previewKit={...drumKit};if(choice==='synth')delete previewKit[role];
 const audio=renderPerformance(withDrumKit(one,previewKit,mix),assets,context.sampleRate,effectMap());
 startSource(audioBuffer(audio),context.currentTime);
}
function browseLaneSounds(role:Role,opener:HTMLElement){
 soundBrowser.open({role,mode:'lane',current:kitPanel.mix[role].choice,uploadName:kitPanel.mix[role].uploadId?assets.get(kitPanel.mix[role].uploadId!)?.name:undefined,opener,
   preview:choice=>previewSoundCandidate(role,choice),apply:choice=>kitPanel.selectSound(role,choice)});
}
const kitPanel=setupDrumKit(assets,(refreshTracker=true)=>{
  stop();samplePanel.stop();
  const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;
  const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;
  const matching=KIT_PRESETS.find(p=>ROLES.every(r=>kitPanel.mix[r].choice===p.slots[r]));
  const matchedId=matching?matching.id:'custom';
  if(ks) ks.value=matchedId;
  if(gks) gks.value=matchedId;
  const desc = document.getElementById('generator-kit-desc');
  if(desc) desc.textContent = matching ? matching.description : 'Custom kit configuration';
  if(input('hit-target-mode').value==='exact')syncHitTargetControl();
  if(editor){if(refreshTracker)refresh();else scheduleSave();}
},auditionRole,()=>input('transport-target').value==='song'&&bank?bank.songBpm:pattern?.settings.bpm??Number(input('bpm').value),browseLaneSounds,id=>soundBrowser?.recordUsed(id));
soundBrowser=setupSoundBrowser();
refreshKitTempo=()=>kitPanel.refreshTempo();
const drumKit=kitPanel.kit;
function effectMap(){return Object.fromEntries(ROLES.map(r=>[r,kitPanel.mix[r].effects]));}
function audioBuffer(audio:{channels:Float32Array[];sampleRate:number;duration?:number;attenuation?:number}){const b=context!.createBuffer(2,audio.channels[0]!.length,audio.sampleRate);audio.channels.forEach((c,i)=>b.copyToChannel(new Float32Array(c),i));return b;}
async function preparePianoAudio(patterns:readonly Pattern[]){context??=new AudioContext();await ensurePianoBankAudio(patterns,assets,context);}
function startSource(buffer:AudioBuffer,at:number,loop=false){const s=context!.createBufferSource();s.buffer=buffer;s.loop=loop;s.connect(context!.destination);playingSources.add(s);s.onended=()=>{playingSources.delete(s);s.disconnect();};s.start(at);return s;}
async function auditionCursor(role:Role){
 const hit=editor.state.pattern.events.find(h=>editor.state.selection.ids.includes(h.id))??editor.state.pattern.events.find(h=>h.role===role&&h.trackId===cursorTrackId);
 if(hit)return auditionHit(hit);const track=cursorTrackId?pattern.userTracks?.find(item=>item.id===cursorTrackId):undefined;if(track)return auditionUserTrack(track);return auditionRole(role);
}
async function auditionUserTrack(track:UserTrack){
 context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
 const note:Hit={id:'track-preview',role:track.role,trackId:track.id,sourceId:'kit.'+track.role,baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,...(isSynthTrack(track)?{synthNote:{note:track.instrument.sample?.rootNote??(track.instrument.preset==='piano'?60:48),durationTicks:960}}:{slice:{...track.sample}}),reason:'User track preview.'};
 const one={...structuredClone(pattern),events:[note],userTracks:[{...track,mute:false,solo:true}]},mix=kitPanel.snapshot();mix[track.role].mute=false;for(const role of ROLES)mix[role].solo=false;
 await preparePianoAudio([one]);if(token!==playToken)return;
 const audio=renderPerformance(withDrumKit(one,drumKit,mix),assets,context.sampleRate,effectMap());startSource(audioBuffer(audio),context.currentTime);status(`Previewing ${isSynthTrack(track)?'synth':'sample'} track “${track.name}”.`);
}
async function auditionHit(hit:Hit){
 flashTrackMeter(hit.role,(hit.gain??1)*kitPanel.mix[hit.role].level);stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
 const one=structuredClone(pattern),mix=kitPanel.snapshot();if(input('transport-target').value==='song'&&bank)one.settings.bpm=bank.songBpm;one.events=[{...hit,baseTick:0,offsetTick:0,fineOffset:0}];mix[hit.role].mute=false;mix[hit.role].solo=true;if(hit.trackId){one.userTracks=one.userTracks?.map(track=>({...track,solo:track.id===hit.trackId,mute:false}));}await preparePianoAudio([one]);if(token!==playToken)return;const audio=renderPerformance(withDrumKit(one,drumKit,mix),assets,context.sampleRate,effectMap());
 startSource(audioBuffer(audio),context.currentTime);status(`Auditioning ${hit.ghost?'ghost ':''}${hit.role} hit. Press Play to hear the full pattern.`);
}
async function play(){
 if(mode){stop();return;}if(input('transport-target').value==='song'){await playArrangement();return;}stop();samplePanel.stop();const token=playToken;context??=new AudioContext();await context.resume();if(token!==playToken)return;
 const texture=await vinylOptions();if(token!==playToken)return;
 await preparePianoAudio([pattern,...(bank?bank.slots.flatMap(slot=>slot.editor?[slot.editor.pattern]:[]):[])]);if(token!==playToken)return;
 let audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap(),{loop:true,...texture}),buffer=audioBuffer(audio);
 let start=context.currentTime+.08,duration=buffer.duration;
 let source=startSource(buffer,start,true),prepared:{slot:number;buffer:AudioBuffer;mix:string}|undefined;
 let boundary:{at:number;slot:number;duration:number}|undefined;
 mode='pattern';el('transport-state').textContent='Pattern playing';setPlayButton(true);
 let lastMeterRow = -1;
 const schedule=()=>{
  let now=context!.currentTime;
  if(boundary&&now>=boundary.at){const b=boundary;boundary=undefined;activateSlot(b.slot);start=b.at;duration=b.duration;el('bank-status').textContent='Playing '+bank!.slots[b.slot]!.name;}
  // Render only a requested replacement; the current source loops on the audio clock.
  if(!boundary&&pendingSlot!==undefined){
   const mix=JSON.stringify(kitPanel.mix);
   if(prepared?.slot!==pendingSlot||prepared.mix!==mix){
    const nextAudio=renderPerformance(withDrumKit(bank!.slots[pendingSlot]!.editor!.pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap(),{loop:true,...readyVinylOptions()});
    prepared={slot:pendingSlot,buffer:audioBuffer(nextAudio),mix};
   }
   now=context!.currentTime;
   const at=start+Math.max(1,Math.ceil((now+.08-start)/duration))*duration;
   if(at-now<=.15){
    const next=prepared;source.stop(at);source=startSource(next.buffer,at,true);
    boundary={at,slot:next.slot,duration:next.buffer.duration};pendingSlot=undefined;prepared=undefined;
   }
  }
  const row=Math.floor((Math.max(0,now-start)%duration)/duration*transfer.timing.lines);
  document.querySelector('.playing-row')?.classList.remove('playing-row');
  const rowEl = document.querySelector('[data-play-row="'+row+'"]');
  rowEl?.classList.add('playing-row');
  updateHudPosition(row);
  if(followPlayhead && rowEl){
    revealPlaybackItem(el('grid'), rowEl, el('grid').querySelector('thead')?.getBoundingClientRect().height??0);
  }
  if(row!==lastMeterRow){
    lastMeterRow=row;
    const hasSolo=ROLES.some(r=>kitPanel.mix[r].solo)||(pattern.userTracks??[]).some(track=>track.solo);
    for(const n of transfer.notes.filter(note=>note.row===row)){
      const hit=pattern.events.find(e=>e.id===n.id),track=hit?.trackId?pattern.userTracks?.find(item=>item.id===hit.trackId):undefined;
      const audible=track?(hasSolo?track.solo&&!track.mute:!track.mute):hasSolo?(kitPanel.mix[hit?.role??'percussion'].solo&&!kitPanel.mix[hit?.role??'percussion'].mute):!kitPanel.mix[hit?.role??'percussion'].mute;
      if(audible){
        flashTrackMeter(hit?.role??'percussion',(hit?.gain??1)*(track?.level??1)*kitPanel.mix[hit?.role??'percussion'].level);
      }
    }
  }
 };schedule();timer=setInterval(schedule,25);
}
function ensureArrangementHistory(){if(!bank&&editor)bank=newBank(editor.state.pattern);if(bank&&!arrangementHistory)arrangementHistory=new ArrangementHistory(bank);if(arrangementHistory)bank=arrangementHistory.bank;return arrangementHistory;}
function stashSlot(){if(!editor)return;const history=ensureArrangementHistory();if(!history||!bank)return;bank.slots[bank.active]!.editor=structuredClone(editor.state);slotEditors.set(bank.active,editor);}
function arrangementMutation(label:string,mutate:(b:Bank)=>void){const history=ensureArrangementHistory();if(!history)return false;stashSlot();const changed=history.execute(mutate,label);bank=history.bank;if(changed)slotEditors.clear();return changed;}
function arrangementHistorySync(message:string){if(!bank)return;comparison=undefined;selectedArrangementStep=undefined;slotEditors.clear();const index=bank.active;editor=new Editor(bank.slots[index]!.editor!.pattern);editor.state=structuredClone(bank.slots[index]!.editor!);syncControls();refresh();renderBank();scheduleSave();status(message);}
function activateSlot(index:number){stashSlot();if(comparison&&comparison.slot!==index)comparison=undefined;bank!.active=index;editor=slotEditors.get(index)??new Editor(bank!.slots[index]!.editor!.pattern);if(!slotEditors.has(index))editor.state=structuredClone(bank!.slots[index]!.editor!);rowAnchor=0;cellAnchor=undefined;syncControls();refresh();}
function chooseSlot(index:number){if(index===bank!.active){pendingSlot=undefined;return;}if(mode==='pattern'){stashSlot();pendingSlot=index;el('bank-status').textContent='Queued '+bank!.slots[index]!.name+' - next pattern boundary';return;}stop();activateSlot(index);}
function rememberActivePattern(state:Editor['state'],label:string){if(!bank)return;if(rememberPattern(bank.slots[bank.active]!,state,label)){renderPatternHistory();scheduleSave();}}
function renderComparisonControls(){
 const statusEl=document.getElementById('compare-status');if(!statusEl)return;
 const selected=comparison&&bank&&comparison.slot===bank.active?comparison:undefined;
 const describe=(side:CompareSide)=>{const item=selected?.[side];return item?`${side}: ${item.label} · ${item.state.pattern.settings.bpm} BPM · ${item.state.pattern.events.length} hits`:`${side}: not set`;};
 statusEl.textContent=`${describe('A')} | ${describe('B')}${comparisonPlaying?` · Previewing ${comparisonPlaying}`:''}`;
 for(const side of ['A','B'] as const){const has=Boolean(selected?.[side]);input(`compare-preview-${side.toLowerCase()}`).disabled=!has;input(`compare-keep-${side.toLowerCase()}`).disabled=!has;input(`compare-preview-${side.toLowerCase()}`).setAttribute('aria-pressed',String(comparisonPlaying===side));}
 input('compare-clear').disabled=!selected?.A&&!selected?.B;
}
function selectComparison(side:CompareSide,state:EditorState,label:string){
 if(!bank)return;if(!comparison||comparison.slot!==bank.active)comparison={slot:bank.active};
 comparison[side]={state:structuredClone(state),label};renderPatternHistory();status(`Captured ${label} as ${side}. Preview A or B to compare.`);
}
async function previewComparison(side:CompareSide){
 const selected=comparison&&bank&&comparison.slot===bank.active?comparison[side]:undefined;if(!selected)return;
 if(mode==='comparison'&&comparisonPlaying===side){stop();return;}
 stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
 const texture=await vinylOptions();if(token!==playToken)return;
 await preparePianoAudio([selected.state.pattern]);if(token!==playToken)return;
 const audio=renderPerformance(withDrumKit(selected.state.pattern,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap(),{loop:true,...texture});
 startSource(audioBuffer(audio),context.currentTime+.08,true);mode='comparison';comparisonPlaying=side;
 el('transport-state').textContent=`Comparing ${side}`;setPlayButton(true);renderComparisonControls();status(`Previewing ${side}: ${selected.label}. The tracker remains unchanged.`);
}
function keepComparison(side:CompareSide){
 const selected=comparison&&bank&&comparison.slot===bank.active?comparison[side]:undefined;if(!selected)return;
 if(pendingCount()){status('Apply or Revert pending hit edits before keeping a comparison beat.',true);return;}
 stop();try{const before=structuredClone(editor.state);if(editor.restore(selected.state)){syncControls();refresh();rememberActivePattern(before,`Before keeping ${side}`);status(`Kept ${side}: ${selected.label}. Undo returns to the previous beat.`);}else status(`${side} already matches the current beat.`);}
 catch(e){status((e as Error).message,true);}
}
function renderPatternHistory(){if(!bank)return;const slot=bank.slots[bank.active]!,list=el('pattern-history-list'),entries=slot.patternHistory??[];list.replaceChildren();el('pattern-history-count').textContent=entries.length?`(${entries.length})`:'';
 const addCard=(label:string,state:Editor['state'],capturedAt?:number,restoreIndex?:number)=>{const card=document.createElement('div');card.className='pattern-history-item'+(restoreIndex===undefined?' current':'');const title=document.createElement('strong');title.textContent=label;const settings=state.pattern.settings,meta=document.createElement('small');meta.textContent=`${settings.genre.replaceAll('-',' ')} · ${settings.bpm} BPM · ${settings.bars} bars · seed ${settings.seed}`;meta.title=meta.textContent;card.append(title,meta);if(capturedAt!==undefined){const time=document.createElement('small');time.textContent=new Date(capturedAt).toLocaleString();card.append(time);}const actions=document.createElement('div');actions.className='pattern-history-actions';for(const side of ['A','B'] as const){const button=document.createElement('button');button.type='button';button.textContent=`Set ${side}`;button.setAttribute('aria-label',`Set ${side} to ${label}, seed ${settings.seed}`);button.setAttribute('aria-pressed',String(comparison?.slot===bank!.active&&JSON.stringify(comparison[side]?.state.pattern)===JSON.stringify(state.pattern)));button.onclick=()=>selectComparison(side,state,label);actions.append(button);}if(restoreIndex!==undefined){const button=document.createElement('button');button.type='button';button.textContent='Restore';button.setAttribute('aria-label',`Restore ${label}, seed ${settings.seed}`);button.onclick=()=>{if(pendingCount()){status('Apply or Revert pending hit edits before restoring a pattern.',true);return;}const saved=bank!.slots[bank!.active]!.patternHistory?.[restoreIndex];if(!saved)return;stop();const before=structuredClone(editor.state);if(editor.restore(saved.editor)){syncControls();refresh();rememberActivePattern(before,'Before restore');status(`Restored ${saved.label}. Undo returns to the previous beat.`);}};actions.append(button);}card.append(actions);list.append(card);};
 addCard('Current beat',editor.state);for(let i=entries.length-1;i>=0;i--)addCard(entries[i]!.label,entries[i]!.editor,entries[i]!.capturedAt,i);
 renderComparisonControls();
}
for(const side of ['A','B'] as const){el(`compare-preview-${side.toLowerCase()}`).onclick=()=>{void previewComparison(side).catch(e=>status(String(e),true));};el(`compare-keep-${side.toLowerCase()}`).onclick=()=>keepComparison(side);}
el('compare-clear').onclick=()=>{stop();comparison=undefined;renderPatternHistory();status('A/B comparison cleared.');};
function renderBank(){if(!bank)return;const host=el('bank-slots');host.replaceChildren();
 const heading = document.querySelector('.pattern-bank .grid-heading');
 if(heading && !document.getElementById('bank-toolbar')){
  const tb=document.createElement('div');tb.id='bank-toolbar';tb.className='bank-toolbar';
  const addBtn=document.createElement('button');addBtn.id='bank-add-slot';addBtn.className='bank-tool-btn';addBtn.textContent='+ New';addBtn.title='Add blank pattern slot';
  addBtn.onclick=()=>{stop();if(arrangementMutation('Add pattern',b=>addPatternSlot(b))){renderBank();scheduleSave();status('Added new pattern slot.');}};
  const dupBtn=document.createElement('button');dupBtn.id='bank-dup-slot';dupBtn.className='bank-tool-btn';dupBtn.textContent='⧉ Dup';dupBtn.title='Duplicate active pattern';
  dupBtn.onclick=()=>{stop();const source=bank!.active;if(arrangementMutation('Duplicate pattern',b=>duplicatePatternSlot(b,source))){bank=arrangementHistory!.bank;activateSlot(bank.slots.length-1);renderBank();scheduleSave();status('Duplicated active pattern.');}};
  tb.append(addBtn,dupBtn);heading.append(tb);
 }
 bank.slots.forEach((slot,i)=>{const card=document.createElement('div');card.className='bank-slot'+(bank!.active===i?' active':'');
  const label=slotLabel(i);
  const title=document.createElement('strong');title.textContent=label+(bank!.active===i?' - Editing':'');card.append(title);
  const name=document.createElement('input');name.value=slot.name;name.maxLength=40;name.setAttribute('aria-label','Slot '+label+' name');name.onchange=()=>{const value=name.value.trim()||label;arrangementMutation('Rename pattern',b=>{b.slots[i]!.name=value;});renderBank();scheduleSave();};card.append(name);
  const rename=document.createElement('button');rename.textContent='⋯';rename.setAttribute('aria-label','Rename '+label);rename.onclick=()=>{name.style.display='block';name.focus();name.select();};card.append(rename);
  title.title='Double-click to rename';title.ondblclick=()=>{name.style.display='block';name.focus();name.select();};
  const b=document.createElement('button');b.id='slot-'+i;b.setAttribute('aria-pressed',String(bank!.active===i));b.title=slot.editor?'Edit '+slot.name+'; queues during playback':'Copy current pattern into '+slot.name;b.textContent=slot.editor?slot.name:'+ '+slot.name;b.onclick=()=>{if(!slot.editor){stop();const source=structuredClone(editor.state);if(arrangementMutation('Copy pattern to slot',next=>{next.slots[i]!.editor=source;})){bank=arrangementHistory!.bank;activateSlot(i);status('Copied pattern. Generate a variation or edit this slot.');}}else chooseSlot(i);};card.append(b);
  if(slot.editor){const preview=document.createElement('button');preview.id='slot-preview-'+i;preview.textContent='▶';preview.setAttribute('aria-label','Preview '+slot.name);preview.onclick=()=>{if(mode==='pattern'&&i!==bank!.active){chooseSlot(i);return;}stop();input('transport-target').value='pattern';syncHud();activateSlot(i);void play().catch(e=>status(String(e),true));};card.append(preview);}
  if(bank!.slots.length>1){const del=document.createElement('button');del.className='slot-del-btn';del.textContent='✕';del.title='Delete '+slot.name;del.setAttribute('aria-label','Delete '+slot.name);del.onclick=(e)=>{e.stopPropagation();stop();if(arrangementMutation('Delete pattern',b=>deletePatternSlot(b,i))){comparison=undefined;bank=arrangementHistory!.bank;selectedArrangementStep=undefined;activateSlot(bank.active);renderBank();scheduleSave();status('Deleted pattern.');}};card.append(del);}
  host.append(card);});
 renderPatternHistory();input('song-bpm').value=String(bank.songBpm);syncHud();
 let firstBar=1;
 const seq=el('sequence');seq.replaceChildren();bank.sequence.forEach((step,i)=>{const row=document.createElement('div');row.className='sequence-step';row.dataset.step=String(i);row.classList.toggle('selected-step',selectedArrangementStep===i);const title=document.createElement('span');title.textContent=String(i+1)+'. '+bank!.slots[step.slot]!.name;row.append(title);
 const barCount=bank!.slots[step.slot]!.editor!.pattern.settings.bars*step.repeats;
 const range=document.createElement('small');range.className='sequence-range';range.textContent='Bars '+firstBar+'–'+(firstBar+barCount-1);firstBar+=barCount;row.append(range);
 const section=document.createElement('input');section.type='text';section.maxLength=32;section.placeholder='Section (optional)';section.value=step.section??'';section.setAttribute('aria-label','Section name for step '+(i+1));section.onchange=()=>{const value=section.value.trim();if(arrangementMutation('Name arrangement section',b=>{if(value)b.sequence[i]!.section=value;else delete b.sequence[i]!.section;})){renderBank();scheduleSave();}};row.append(section);
 title.draggable=true;title.title='Drag this heading to reorder the song';row.setAttribute('aria-label','Step '+(i+1)+': '+(step.section?step.section+' · ':'')+bank!.slots[step.slot]!.name+', '+range.textContent);
 row.ondragstart=e=>{if((e.target as HTMLElement).closest('input,button')){e.preventDefault();return;}draggedStep=i;e.dataTransfer?.setData('text/plain',String(i));if(e.dataTransfer)e.dataTransfer.effectAllowed='move';};
 row.ondragover=e=>{if(draggedStep!==undefined){e.preventDefault();row.classList.add('drop-target');}};
 row.ondragleave=()=>row.classList.remove('drop-target');
 row.ondragend=()=>{draggedStep=undefined;document.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));};
 row.ondrop=e=>{e.preventDefault();if(draggedStep===undefined)return;stop();const from=draggedStep;draggedStep=undefined;if(arrangementMutation('Reorder arrangement',b=>moveSequenceStep(b,from,i))){selectedArrangementStep=undefined;renderBank();scheduleSave();}};
 const label=document.createElement('label');label.textContent='Repeats ';const count=document.createElement('input');count.type='number';count.min='1';count.max='16';count.value=String(step.repeats);count.setAttribute('aria-label','Repeats for step '+(i+1));count.onchange=()=>{const v=Number(count.value);if(!Number.isInteger(v)||v<1||v>16){count.value=String(step.repeats);return;}stop();if(arrangementMutation('Change repeats',b=>{b.sequence[i]!.repeats=v;})){renderBank();scheduleSave();}};label.append(count);row.append(label);
 for(const [text,delta] of [['Move up',-1],['Move down',1],['Remove',0]] as const){const b=document.createElement('button');b.textContent=text;b.disabled=delta!==0&&(i+delta<0||i+delta>=bank!.sequence.length);b.onclick=()=>{stop();const changed=arrangementMutation(delta===0?'Remove arrangement step':'Reorder arrangement',next=>delta===0?next.sequence.splice(i,1):moveSequenceStep(next,i,i+delta));if(changed){selectedArrangementStep=undefined;renderBank();scheduleSave();const focusStep=Math.min(delta===0?i:i+delta,bank!.sequence.length-1);el('sequence').querySelector<HTMLElement>('[data-step="'+focusStep+'"] button:not(:disabled)')?.focus();}};row.append(b);}seq.append(row);});
 el('sequence-empty').hidden=bank.sequence.length>0;
 const select=el<HTMLSelectElement>('append-slot'),value=select.value;select.replaceChildren();bank.slots.forEach((s,i)=>{if(s.editor){const o=document.createElement('option');o.value=String(i);o.textContent=s.name;select.append(o);}});if(Array.from(select.options).some(o=>o.value===value))select.value=value;
 renderSongTimeline();
 const bars=bank.sequence.reduce((n,s)=>n+bank!.slots[s.slot]!.editor!.pattern.settings.bars*s.repeats,0);el('arrangement-info').textContent=bars?bars+' bars - '+(bars*240/bank.songBpm).toFixed(1)+' seconds - '+bank.songBpm+' BPM · max 170s':'No song arranged yet. Add a pattern to enable playback and export.';input('play-arrangement').disabled=!bars;input('export-arrangement').disabled=!bars;input('append-step').disabled=bank.sequence.length>=64;const undo=input('arr-undo'),redo=input('arr-redo');if(arrangementHistory&&undo&&redo){undo.disabled=!arrangementHistory.undoLabel;redo.disabled=!arrangementHistory.redoLabel;undo.title=arrangementHistory.undoLabel?`Undo ${arrangementHistory.undoLabel}`:'Nothing to undo';redo.title=arrangementHistory.redoLabel?`Redo ${arrangementHistory.redoLabel}`:'Nothing to redo';undo.setAttribute('aria-label',arrangementHistory.undoLabel?`Undo ${arrangementHistory.undoLabel}`:'Nothing to undo');redo.setAttribute('aria-label',arrangementHistory.redoLabel?`Redo ${arrangementHistory.redoLabel}`:'Nothing to redo');}
}
function arrangementAudio(rate:number){stashSlot();return renderSequence(arrange(bank!).map(p=>withDrumKit(p,drumKit,kitPanel.mix)),assets,rate,effectMap(),readyVinylOptions());}
el('append-step').onclick=()=>{stop();if(bank!.sequence.length>=64)return;if(arrangementMutation('Append to arrangement',b=>insertSequenceStep(b,b.sequence.length,Number(input('append-slot').value)))){selectedArrangementStep=bank!.sequence.length-1;renderBank();scheduleSave();}};
function revealPlaybackItem(container:HTMLElement, item:Element|null, inset=0){
 if(!item||!container.clientHeight)return;
 const bounds=container.getBoundingClientRect(),target=item.getBoundingClientRect();
 const pad = 24;
 if(target.bottom>bounds.bottom - pad)container.scrollTop+=target.bottom-(bounds.bottom - pad);
 else if(target.top<bounds.top+inset)container.scrollTop-=bounds.top+inset-target.top;
}
function revealTimelineBlock(item:HTMLElement|null){if(!item)return;const timeline=el('song-timeline'),bounds=timeline.getBoundingClientRect(),target=item.getBoundingClientRect();if(target.right>bounds.right-12)timeline.scrollLeft+=target.right-(bounds.right-12);else if(target.left<bounds.left+12)timeline.scrollLeft-=bounds.left+12-target.left;}
async function playArrangement(){
 if(mode){stop();return;}
 stop();samplePanel.stop();context??=new AudioContext();const token=playToken;
 await context.resume();if(token!==playToken)return;
 await vinylOptions();if(token!==playToken)return;
 stashSlot();await preparePianoAudio(arrange(bank!));if(token!==playToken)return;
 const audio=arrangementAudio(context.sampleRate),timeline=songTimeline(bank!),buffer=audioBuffer(audio),start=context.currentTime+.05;
 input('transport-target').value='song';syncHud();
 startSource(buffer,start);mode='arrangement';el('transport-state').textContent='Song playing';el('play-arrangement').textContent='Stop arrangement';setPlayButton(true);
 let lastPosition='';
 timer=setInterval(()=>{
  const elapsed=context!.currentTime-start,position=songPosition(timeline,Math.max(0,elapsed));
  if(position){
   if(bank!.active!==position.slot)activateSlot(position.slot);
   document.querySelectorAll('.playing-step').forEach(e=>e.classList.remove('playing-step'));
   document.querySelector('#sequence [data-step="'+position.step+'"]')?.classList.add('playing-step');
   const timelineBlock=document.querySelector<HTMLElement>('#song-timeline [data-timeline-step="'+position.step+'"]');timelineBlock?.classList.add('playing-step');
   document.querySelector('.playing-row')?.classList.remove('playing-row');
   document.querySelector('[data-play-row="'+position.row+'"]')?.classList.add('playing-row');
   const beat=Math.max(0,elapsed)*bank!.songBpm/60;
   el('hud-pos-val').textContent=String(Math.floor(beat/4)+1).padStart(2,'0')+'.'+(Math.floor(beat%4)+1);
   const key=position.step+':'+position.repeat+':'+position.row;
   if(key!==lastPosition){
    lastPosition=key;
    if(followPlayhead){revealPlaybackItem(el('grid'),document.querySelector('.playing-row'),el('grid').querySelector('thead')?.getBoundingClientRect().height??0);revealTimelineBlock(timelineBlock);}
    const tray=document.querySelector<HTMLElement>('#tray-left .tray-body');if(followPlayhead&&tray)revealPlaybackItem(tray,document.querySelector('#sequence .playing-step'));
    el('transport-state').textContent='Song · Step '+(position.step+1)+' / '+bank!.sequence.length;
    el('song-position').textContent='Step '+(position.step+1)+' / '+bank!.sequence.length+' · '+(position.section?position.section+' · ':'')+bank!.slots[position.slot]!.name+' · Repeat '+(position.repeat+1)+' / '+bank!.sequence[position.step]!.repeats;
     const solo=ROLES.some(r=>kitPanel.mix[r].solo)||(pattern.userTracks??[]).some(track=>track.solo);
     for(const note of transfer.notes.filter(n=>n.row===position.row)){const hit=pattern.events.find(h=>h.id===note.id),track=hit?.trackId?pattern.userTracks?.find(item=>item.id===hit.trackId):undefined,role=hit?.role??'percussion';if(track?(!track.mute&&(!solo||track.solo)):(!kitPanel.mix[role].mute&&(!solo||kitPanel.mix[role].solo)))flashTrackMeter(role,kitPanel.mix[role].level*(track?.level??1)*(hit?.gain??1));}
   }
  }else{
   document.querySelectorAll('.playing-step,.playing-row').forEach(e=>e.classList.remove('playing-step','playing-row'));
   el('song-position').textContent='Song ending · effect tails';
  }
  if(elapsed>=buffer.duration)stop();
 },25);
}
async function exportArrangement(){
 await vinylOptions();
 stashSlot();await preparePianoAudio(arrange(bank!));
 const audio=arrangementAudio(44100);
 const filename='breakbeat-arrangement.wav',bars=bank!.sequence.reduce((n,step)=>n+bank!.slots[step.slot]!.editor!.pattern.settings.bars*step.repeats,0);
 downloadBytes(encodeWav(audio.channels,audio.sampleRate),filename);
 const duration=audio.channels[0]!.length/audio.sampleRate;
 fileFeedback(`${filename} downloaded · Full song arrangement · ${bars} bars · ${bank!.songBpm} BPM · ${duration.toFixed(2)} s with effect tails. Browser controls the download location.${masterTrimNote(audio.attenuation)}`);
 status('Full song arrangement WAV downloaded.');
}
function masterTrimNote(attenuation:number){return attenuation<.999?` Master peak protection trimmed ${(20*Math.log10(1/attenuation)).toFixed(1)} dB.`:'';}
el('play-arrangement').onclick=()=>{playArrangement().catch(e=>{stop();status(String(e),true);});};
el('export-arrangement').onclick=()=>{exportArrangement().catch(e=>{fileFeedback('WAV export failed: '+String(e),true);status(String(e),true);});};
el('transport-target').onchange=()=>{stop();syncHud();};
el('export-target').onchange=()=>{input('export-mode').disabled=input('export-target').value==='song';};
function setTransportTempo(bpm:number){
 if(!Number.isFinite(bpm)||bpm<32||bpm>999){syncHud();status('Tempo must be between 32 and 999 BPM.',true);return;}
 stop();
 if(input('transport-target').value==='song'){
  input('song-bpm').value=String(bpm);
  if(arrangementMutation('Change song tempo',b=>{b.songBpm=bpm;})){renderBank();scheduleSave();status(`Song tempo set to ${bpm.toFixed(1)} BPM.`);}else syncHud();
  return;
 }
 input('bpm').value=String(bpm);input('bpm-slider').value=String(bpm);
 if(editor.setTempo(bpm)){syncControls();syncSliders();refresh();status(`Pattern tempo set to ${bpm.toFixed(1)} BPM. Undo restores the previous tempo.`);}else syncHud();
}
input('hud-bpm-val').onchange=()=>setTransportTempo(Number(input('hud-bpm-val').value));
el('song-bpm').onchange=()=>{
 const bpm=Number(input('song-bpm').value);
 if(!Number.isFinite(bpm)||bpm<32||bpm>999){input('song-bpm').value=String(bank!.songBpm);status('Song tempo must be between 32 and 999 BPM.',true);return;}
 stop();if(arrangementMutation('Change song tempo',b=>{b.songBpm=bpm;})){renderBank();scheduleSave();status('Song tempo updated. Pattern tempos are unchanged.');}
};
function syncSliders(){
  syncHitTargetControl();
  const bpm=Number(input('bpm').value);
  input('bpm-slider').max=String(Math.max(300,Number.isFinite(bpm)?bpm:300));
  input('bpm-slider').value=String(bpm);
  el('complexity-value').textContent=Math.round(Number(input('complexity').value)*100)+'%';
  input('complexity').setAttribute('aria-valuetext',el('complexity-value').textContent!);
  const spokenValues:[string,string][]=[
    ['syncopation',Number(input('syncopation').value).toFixed(2)],
    ['swing',`Swing ratio ${Number(input('swing').value).toFixed(2)}`],
    ['humanizeMs',`${Number(input('humanizeMs').value)} milliseconds`],
    ['ghostAmount',`${Math.round(Number(input('ghostAmount').value)*100)} percent`],
    ['fillAmount',`${Math.round(Number(input('fillAmount').value)*100)} percent`],
  ];
  for(const [id,value] of spokenValues)input(id).setAttribute('aria-valuetext',value);
  for(const role of ROLES){
    const value=Math.round(Number(input(`${role}-density`).value)*100)+'%';
    el(`${role}-density-value`).textContent=value;
    input(`${role}-density`).setAttribute('aria-valuetext',value);
  }
  const spicyVal=Number(input('spicy').value);
  const spicyEl=document.getElementById('spicy-value');
  if(spicyEl){
    const pct=Math.round(spicyVal*100);
    const tag=spicyVal>=0.7?(['groove-v3','groove-v4','groove-v5'].includes(input('algorithm').value)?' 🔥 Expressive':' 🔥 Chaos'):spicyVal>=0.35?' 🌶️ Spicy':spicyVal>0?' 🌶️ Mild':' Off';
    spicyEl.textContent=pct+'%'+tag;
    input('spicy').setAttribute('aria-valuetext',spicyEl.textContent);
  }
  syncHud();
}
let v5ExactCapacityCache:{key:string;value:number}|undefined;
function syncHitTargetControl(){
  const bars=Number(input('bars').value)||2,exact=input('hit-target-mode').value==='exact',algorithm=input('algorithm').value,supportsExact=['groove-v4','groove-v5'].includes(algorithm);
  let max=bars*64,v5Capacity:number|undefined;
  if(exact&&algorithm==='groove-v5'&&input('breakLayer').value!=='think-passage2'){
    try{
      const request={...settings(),hitTarget:undefined},key=JSON.stringify(request);
      if(v5ExactCapacityCache?.key!==key)v5ExactCapacityCache={key,value:maximumV5ExactHits(generate(request))};
      v5Capacity=v5ExactCapacityCache.value;max=Math.min(max,v5Capacity);
    }catch{ /* Draft inputs can be temporarily invalid while the user edits them. Generate reports the error. */ }
  }
  const value=Math.max(0,Math.min(max,Math.round(Number(input('hit-target-number').value)||0)));
  input('hit-target-number').max=String(max);input('hit-target-slider').max=String(max);
  input('hit-target-number').value=String(value);input('hit-target-slider').value=String(value);
  el('hit-target-value').textContent=String(value);
  input('hit-target-mode').disabled=!supportsExact;
  input('hit-target-number').disabled=!supportsExact||!exact;input('hit-target-slider').disabled=!supportsExact||!exact;
  el('hit-target-help').textContent=!supportsExact?'Exact hits requires Groove v4 or v5.':exact?`${value} tracker notes across ${bars} ${bars===1?'bar':'bars'}; ratchets count once.${v5Capacity===undefined?'':` Current V5 profile supports up to ${v5Capacity}.`}`:'Auto uses the selected genre’s natural density.';
}
function breakDescription(){
  const key=input('breakStyle').value as BreakStyle;
  el('break-description').textContent=key==='genre'?'Use the selected genre’s rhythm.':BREAKS[key].description+' Genre still controls tempo suggestions, detail and fill intensity.';
}
function syncStructureControls(){
 const hasStructure=['groove-v3','groove-v4','groove-v5'].includes(input('algorithm').value),structure=input('patternStructure').value,build=structure==='build'&&input('algorithm').value==='groove-v3';
 const supportsDensity=['groove-v4','groove-v5'].includes(input('algorithm').value);
 for(const role of ROLES){input(`${role}-density`).disabled=!supportsDensity;input(`${role}-density`).title=supportsDensity?'Adjust optional hits in this lane. Main kick and snare anchors remain.':'Instrument density requires Groove v4 or Groove v5.';}
 input('patternStructure').disabled=!hasStructure;
 input('patternStructure').title=hasStructure?'Choose groove, ending or full snare build.':'Pattern structure requires Groove v3, Groove v4, or Groove v5.';
 for(const id of ['syncopation','ghostAmount','swing','breakStyle','variation','phraseLength','phraseOffset']){
  input(id).disabled=hasStructure&&build;
  input(id).title=hasStructure&&build?'Not used by a full snare build.':'';
 }
 input('fillAmount').disabled=hasStructure&&structure!=='auto';
 input('fillAmount').title=hasStructure&&structure!=='auto'?'Fill probability is used only by Auto-Fills.':'';
}
input('patternStructure').addEventListener('change',syncStructureControls);
input('tracker-bars').addEventListener('change',()=>{const value=Number(input('tracker-bars').value) as 1|2|3|4,previous=pattern.settings.bars,shortening=value<previous;edit(()=>editor.setBars(value),shortening?'Tracker shortened; notes outside the new length were removed.':'Tracker pattern length changed.');if(pattern.settings.bars===previous)input('tracker-bars').value=String(previous);});
input('tracker-resolution').addEventListener('change',()=>{const value=Number(input('tracker-resolution').value) as 8|16|32|64;input('resolution').value=String(value);edit(()=>editor.setResolution(value),'Tracker resolution changed; note timing is preserved.');});
input('tracker-lpb').addEventListener('change',()=>edit(()=>editor.setLpb(Number(input('tracker-lpb').value) as 1|2|3|4|6|8|12|16|24|32),'Tracker LPB changed; hit timing is preserved.'));
function syncPhraseControls(offset=Number(input('phraseOffset').value)||0){
 const hasStructure=['groove-v3','groove-v4','groove-v5'].includes(input('algorithm').value),length=Number(input('phraseLength').value);
 syncStructureControls();
 el('phrase-length-field').hidden=!hasStructure;el('phrase-offset-field').hidden=!hasStructure||!length;
 const select=el<HTMLSelectElement>('phraseOffset');select.replaceChildren();
 for(let i=0;i<(length||1);i++){const option=document.createElement('option');option.value=String(i);option.textContent=String(i+1);select.append(option);}
 select.value=String(Math.min(offset,(length||1)-1));
}
function presets(){
  syncPhraseControls();
  breakDescription();
  syncSliders();
  syncModeControls();
  const genre=input('genre').value as Genre;
  const isNew=Object.hasOwn(NEW_GENRES,genre);input('algorithm').querySelector<HTMLOptionElement>('[value="legacy-v1"]')!.disabled=isNew;
  if(isNew&&input('algorithm').value==='legacy-v1')input('algorithm').value='groove-v2';
  const p=PROFILES[genre];el('genre-description').textContent=p.description??'A repeating motif with '+GROOVES[genre].fillStyle+' fills and instrument-specific groove.';const container=el('presets');container.replaceChildren();
  for(const bpm of p.presets){const button=document.createElement('button');button.textContent=String(bpm);button.onclick=()=>{input('bpm').value=String(bpm);syncSliders();dirty();};container.append(button);}
}
function syncModeControls(){input('melody-options').title='Key and scale apply to Bass, Melody and Piano generators. Each Generate button changes only its own layer.';}
function dirty(){scheduleSave();status('Settings changed. Press Generate to apply; the displayed pattern remains the export target.');}

el('generate').onclick=build;
el('generate-bass').onclick=()=>buildLayer('bassline');el('generate-melody').onclick=()=>buildLayer('lead');el('generate-piano').onclick=()=>buildLayer('piano');
el('clear-selection').onclick=()=>{editor.state.selection=emptySelection();render();};
el('select-range').onclick=()=>selectRows(Number(input('row-start').value),Number(input('row-end').value));
el('select-ending').onclick=()=>selectRows(transfer.timing.lines-transfer.timing.lpb,transfer.timing.lines-1);
el('lock-selected').onclick=()=>edit(()=>editor.toggleSelectedLocks(),'Selected hit locks updated. Drum-lane locks still take precedence.');
for(const role of ['kick','snare','hat','percussion'] as const)el(`lock-${role}`).onchange=()=>edit(()=>editor.toggleRole(role),`${role} lane lock updated.`);
el<HTMLSelectElement>('edit-target').onchange=()=>{editTargetLane=el<HTMLSelectElement>('edit-target').value;render();};
el('mutate').onclick=()=>edit(()=>editor.mutate(editTargetLane||undefined),'Variation applied. Locked hits and main anchors are unchanged. Preview and export now use this edit.','Before mutation');
el('simplify').onclick=()=>edit(()=>editor.simplify(editTargetLane||undefined),'Quiet optional hits removed. Main anchors, manual notes and locks are unchanged.','Before simplify');
el('increase-complexity').onclick=()=>edit(()=>editor.increaseComplexity(editTargetLane||undefined),'Genre-aware details added. Main anchors, manual notes and locks are unchanged.','Before adding detail');
el('fill').onclick=()=>edit(()=>editor.fill(editTargetLane||undefined),'Fill applied to the selected rows. Locked hits and main anchors are unchanged.','Before fill');
function history(direction:'undo'|'redo'){
  stop();const label=direction==='undo'?editor.undoLabel:editor.redoLabel;
  if(!editor[direction]()){status(direction==='undo'?'Nothing to undo.':'Nothing to redo.');return;}
  syncControls();refresh();status(`${direction==='undo'?'Undid':'Redid'}: ${label??'last edit'}.`);
}
function sectionKind(section:string|undefined){const name=section?.trim().toLowerCase()??'';if(!name)return 'unlabeled';if(/intro|opening/.test(name))return 'intro';if(/build|rise/.test(name))return 'build';if(/drop|chorus|hook/.test(name))return 'drop';if(/fill|turnaround|transition/.test(name))return 'fill';if(/outro|ending/.test(name))return 'outro';return 'other';}
function renderSongTimeline(){if(!bank)return;const timeline=el('song-timeline'),legend=el('timeline-legend');timeline.replaceChildren();legend.replaceChildren();const blocks=songBlocks(bank);const kinds=new Set<string>();
 timeline.ondragover=e=>{if(draggedStep===undefined)return;const bounds=timeline.getBoundingClientRect();if(e.clientX<bounds.left+24)timeline.scrollLeft-=10;else if(e.clientX>bounds.right-24)timeline.scrollLeft+=10;};
 const addGap=(before:number)=>{const gap=document.createElement('button');gap.type='button';gap.className='timeline-insert';gap.textContent='+';gap.setAttribute('aria-disabled',String(blocks.length>=64));gap.setAttribute('aria-label',before===blocks.length?'Insert selected pattern at end':'Insert selected pattern before step '+(before+1));gap.title=gap.getAttribute('aria-label')!;
  gap.onclick=()=>{if(blocks.length>=64)return;stop();const slot=Number(input('append-slot').value);if(arrangementMutation('Insert arrangement step',b=>insertSequenceStep(b,before,slot))){selectedArrangementStep=before;renderBank();scheduleSave();el('song-timeline').querySelector<HTMLElement>('[data-timeline-step="'+before+'"]')?.focus();}};
  gap.ondragover=e=>{if(draggedStep!==undefined){e.preventDefault();gap.classList.add('drop-target');if(e.dataTransfer)e.dataTransfer.dropEffect='move';}};
  gap.ondragleave=()=>gap.classList.remove('drop-target');
  gap.ondrop=e=>{e.preventDefault();gap.classList.remove('drop-target');if(draggedStep===undefined)return;const from=draggedStep;draggedStep=undefined;stop();const to=from<before?before-1:before;if(to===from)return;if(arrangementMutation('Reorder arrangement',b=>moveSequenceStepToInsertion(b,from,before))){selectedArrangementStep=to;renderBank();scheduleSave();el('song-timeline').querySelector<HTMLElement>('[data-timeline-step="'+to+'"]')?.focus();}};
  timeline.append(gap);};
 blocks.forEach(block=>{addGap(block.step);const kind=sectionKind(block.section);kinds.add(kind);const button=document.createElement('button');button.type='button';button.className='timeline-block';button.dataset.timelineStep=String(block.step);button.dataset.sectionKind=kind;button.classList.toggle('selected-step',selectedArrangementStep===block.step);button.setAttribute('aria-pressed',String(selectedArrangementStep===block.step));button.draggable=true;button.style.setProperty('--block-width',Math.max(76,block.bars*18)+'px');const name=bank!.slots[block.slot]!.name;button.setAttribute('aria-label','Step '+(block.step+1)+': '+(block.section?block.section+', ':'')+name+', '+block.repeats+' repeats, bars '+block.startBar+' to '+block.endBar+', '+block.duration.toFixed(1)+' seconds. Select pattern or drag to reorder.');
  const section=document.createElement('span');section.className='timeline-section';section.textContent=block.section||'Unlabeled';const patternName=document.createElement('span');patternName.className='timeline-name';patternName.textContent=name;const meta=document.createElement('span');meta.className='timeline-meta';meta.textContent='×'+block.repeats+' · Bars '+block.startBar+'–'+block.endBar;const duration=document.createElement('span');duration.className='timeline-meta';duration.textContent=block.duration.toFixed(1)+'s';button.append(section,patternName,meta,duration);
  button.onclick=()=>{stop();selectedArrangementStep=block.step;activateSlot(block.slot);el('grid').scrollTop=0;renderBank();el('song-timeline').querySelector<HTMLElement>('[data-timeline-step="'+block.step+'"]')?.focus();status('Selected '+name+' at bars '+block.startBar+'–'+block.endBar+'.');};
  button.ondragstart=e=>{draggedStep=block.step;if(e.dataTransfer){e.dataTransfer.setData('text/plain',String(block.step));e.dataTransfer.effectAllowed='move';}};
  button.ondragend=()=>{draggedStep=undefined;document.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));};timeline.append(button);});addGap(blocks.length);
 for(const kind of kinds){const label=document.createElement('span');const dot=document.createElement('i');dot.className='timeline-legend-dot';dot.dataset.sectionKind=kind;label.append(dot,document.createTextNode(kind[0]!.toUpperCase()+kind.slice(1)));legend.append(label);}
}
el('undo').onclick=()=>history('undo');el('redo').onclick=()=>history('redo');
el('arr-undo').onclick=()=>{stop();const label=arrangementHistory?.undoLabel;if(arrangementHistory?.undo()){bank=arrangementHistory.bank;arrangementHistorySync(`Undid: ${label??'arrangement change'}.`);}else status('Nothing to undo.');};
el('arr-redo').onclick=()=>{stop();const label=arrangementHistory?.redoLabel;if(arrangementHistory?.redo()){bank=arrangementHistory.bank;arrangementHistorySync(`Redid: ${label??'arrangement change'}.`);}else status('Nothing to redo.');};
const shortcutHelp=el<HTMLDialogElement>('shortcut-help');
const openShortcutHelp=()=>{if(!shortcutHelp.open)shortcutHelp.showModal();};
el('shortcut-help-open').onclick=openShortcutHelp;
el('shortcut-help-close').onclick=()=>shortcutHelp.close();
el('shortcut-help-done').onclick=()=>shortcutHelp.close();
shortcutHelp.addEventListener('click',event=>{if(event.target===shortcutHelp)shortcutHelp.close();});
document.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(target.closest('input,select,textarea,[contenteditable="true"]'))return;
  if(document.querySelector('dialog[open]')&&!shortcutHelp.open)return;
  if(event.key==='?'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!shortcutHelp.open){event.preventDefault();openShortcutHelp();return;}
  if(shortcutHelp.open)return;
  const inArranger=Boolean(document.activeElement?.closest('#arranger, #bank-slots, #song-bpm, .pattern-bank'));
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(inArranger){const label=arrangementHistory?.undoLabel;if(arrangementHistory?.undo()){bank=arrangementHistory.bank;arrangementHistorySync(`Undid: ${label??'arrangement change'}.`);}else status('Nothing to undo.');}else history(event.shiftKey?'redo':'undo');}
  else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();if(inArranger){const label=arrangementHistory?.redoLabel;if(arrangementHistory?.redo()){bank=arrangementHistory.bank;arrangementHistorySync(`Redid: ${label??'arrangement change'}.`);}else status('Nothing to redo.');}else history('redo');}
  else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==='f'){event.preventDefault();followPlayhead=!followPlayhead;syncFollowPlayhead();status(`Follow playhead ${followPlayhead?'enabled':'disabled'}.`);}
});
el('regenerate').onclick=async()=>{if(pendingCount()){status('Apply or Revert pending hit edits before generating a variation.',true);return;}try{if(pattern.settings.breakLayer==='think-passage2')await ensureThinkBreakAudio(assets);edit(()=>editor.variation(),'Related variation generated. Seed, core motif, anchors and locks are retained.','Before variation');syncControls();}catch(error){status((error as Error).message,true);}};
el('export-wav').onclick=async()=>{
  try{
    if(input('export-target').value==='song'){await exportArrangement();return;}
    const modeEl=document.getElementById('export-mode') as HTMLSelectElement | null;
    const isLoop=modeEl?.value!=='tail';
    const texture=await vinylOptions();
    await preparePianoAudio([pattern]);
    const audio=renderPerformance(
      withDrumKit(pattern,drumKit,kitPanel.mix),
      assets,
      44100,
      effectMap(),
      isLoop ? {loop:true,...texture} : {trimSilence:true,maxTailSeconds:3,...texture}
    );
    const filename=isLoop?transfer.genre+'-pattern.wav':transfer.genre+'-pattern-tail.wav';
    downloadBytes(encodeWav(audio.channels,audio.sampleRate),filename);
    const duration=audio.channels[0]!.length/audio.sampleRate;
    fileFeedback(`${filename} downloaded · Active pattern · ${pattern.settings.bars} bars · ${pattern.settings.bpm.toFixed(1)} BPM · ${duration.toFixed(2)} s · ${isLoop?'seamless loop with wrapped tails':'one-shot with natural decay tail'}. Browser controls the download location.${masterTrimNote(audio.attenuation)}`);
    status(isLoop
      ? `Seamless loop WAV downloaded (${pattern.settings.bars} bars, ${duration.toFixed(2)} s) with wrapped tails.`
      : `One-shot WAV downloaded with natural decay tail (${duration.toFixed(2)} s).`
    );
  }
  catch(e){const detail=(e as Error).message;fileFeedback(`WAV export failed. Try exporting a shorter pattern or freeing browser memory. Details: ${detail}`,true);status(`WAV export failed: ${detail}. A shorter render may help.`,true);}
};
el('export-mp3').onclick=async()=>{
  const button=input('export-mp3');button.disabled=true;
  try{
    const song=input('export-target').value==='song';
    const isLoop=input('export-mode').value!=='tail';
    await vinylOptions();
    if(song){stashSlot();await preparePianoAudio(arrange(bank!));}
    else await preparePianoAudio([pattern]);
    const audio=song?arrangementAudio(44100):renderPerformance(
      withDrumKit(pattern,drumKit,kitPanel.mix),assets,44100,effectMap(),
      isLoop?{loop:true,...readyVinylOptions()}:{trimSilence:true,maxTailSeconds:3,...readyVinylOptions()}
    );
    const duration=audio.channels[0]!.length/audio.sampleRate,trim=masterTrimNote(audio.attenuation);
    const filename=song?'breakbeat-arrangement.mp3':isLoop?transfer.genre+'-pattern.mp3':transfer.genre+'-pattern-tail.mp3';
    fileFeedback(`Encoding ${filename} at 192 kbps…`);
    downloadBytes(await encodeMp3(audio.channels,audio.sampleRate),filename,'audio/mpeg');
    fileFeedback(`${filename} downloaded · ${song?'Full song arrangement':'Active pattern'} · ${duration.toFixed(2)} s of rendered audio at 192 kbps.${!song&&isLoop?' MP3 encoder padding can add a gap when looping; use WAV for exact loops.':''} Browser controls the download location.${trim}`);
    status(`${song?'Song':'Pattern'} MP3 downloaded. Use WAV for exact seamless loops.`);
  }catch(error){const detail=(error as Error).message;fileFeedback(`MP3 export failed: ${detail}`,true);status(`MP3 export failed: ${detail}`,true);}
  finally{button.disabled=false;}
};
el('export').onclick=download;el('play').onclick=()=>{play().catch(e=>status(String(e),true));};
el('copy').onclick=async()=>{
  el<HTMLDetailsElement>('more-actions').open=false;
  try{await navigator.clipboard.writeText(patternJSON());status('Copied pattern JSON for inspection or sharing. Use WAV export for audio.');}
  catch{status('Clipboard unavailable. Download pattern JSON works without clipboard permission.',true);}
};
input('bpm').addEventListener('input',()=>{syncSliders();});
input('bpm-slider').addEventListener('input',()=>{input('bpm').value=input('bpm-slider').value;syncSliders();});
input('complexity').addEventListener('input',syncSliders);
input('spicy').addEventListener('input',syncSliders);
for(const id of ['syncopation','swing','humanizeMs','ghostAmount','fillAmount'])input(id).addEventListener('input',syncSliders);
for(const role of ROLES)input(`${role}-density`).addEventListener('input',syncSliders);
input('algorithm').addEventListener('change',()=>{syncSliders();syncPhraseControls();});
input('hit-target-mode').addEventListener('change',()=>{syncHitTargetControl();dirty();});
input('hit-target-slider').addEventListener('input',()=>{input('hit-target-number').value=input('hit-target-slider').value;syncHitTargetControl();dirty();});
input('hit-target-number').addEventListener('change',()=>{syncHitTargetControl();dirty();});
input('bars').addEventListener('change',syncHitTargetControl);
input('generationMode').addEventListener('change',syncModeControls);
input('phraseLength').addEventListener('change',()=>syncPhraseControls());

el('breakStyle').onchange=()=>{breakDescription();dirty();};
function restoreGenerationDefaults(resetComposition=false){
 const genre=input('genre').value as Genre;
 const keepEngine=input('algorithm').value;
 if(resetComposition)input('breakLayer').value='off';
 input('phraseLength').value='0';syncPhraseControls(0);
 input('algorithm').querySelector<HTMLOptionElement>('[value="legacy-v1"]')!.disabled=Object.hasOwn(NEW_GENRES,genre);
 for(const [key,value] of Object.entries(genreDefaults(genre)))input(key).value=String(value);
 if(resetComposition){input('generationMode').value='drums';input('melodyPart').value='bassline';input('melodyKey').value='0';input('melodyScale').value='natural-minor';input('harmonyStyle').value='jazz';}
 for(const role of ROLES)input(`${role}-density`).value='1';
 input('hit-target-mode').value='auto';input('hit-target-number').value=String(Number(input('bars').value)*16);syncHitTargetControl();
 if(['groove-v3','groove-v4','groove-v5'].includes(keepEngine))input('algorithm').value=keepEngine;
 const autoKit=document.getElementById('auto-kit') as HTMLInputElement | null;
 if(autoKit&&autoKit.checked){
   const defaultKitId=GENRE_KITS[genre]||'acoustic-break';
   void kitPanel.applyPreset(defaultKitId);
   const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;
   if(ks) ks.value=defaultKitId;
   const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;
   if(gks) gks.value=defaultKitId;
   const desc = document.getElementById('generator-kit-desc');
   const p = KIT_PRESETS.find(k => k.id === defaultKitId);
   if(desc) desc.textContent = p ? p.description : 'Kit sounds';
 }
 syncVinylGenreAccent();presets();scheduleSave();status(PROFILES[genre].name+' generation defaults loaded, including BPM and advanced settings. Press Generate to apply to the pattern.');
}
el('restore-defaults').onclick=()=>restoreGenerationDefaults(true);
el('view').onchange=()=>{saveWorkspacePreferences();render();};el('genre').onchange=()=>restoreGenerationDefaults();
for(const control of document.querySelectorAll('#controls input, #controls select')){
 control.addEventListener('input',dirty);
 if(['seed','breakLayer','patternStructure','phraseLength','phraseOffset'].includes(control.id))control.addEventListener('change',syncHitTargetControl);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
for(const family of ['Jungle & DnB','Hip-Hop & Downtempo','Garage','Dub & Bass','Breaks & Rave','Experimental']){
 const group=document.createElement('optgroup');group.label=family;
 for(const [value,profile] of Object.entries(PROFILES).sort(([a],[b])=>a==='jungle'?-1:b==='jungle'?1:0)){
  if(GROOVES[value as Genre].family!==family)continue;
  const option=document.createElement('option');option.value=value;option.textContent=profile.name;group.append(option);
 }
 el('genre').append(group);
}

for(const [value,preset] of Object.entries(BREAKS)){
  const option=document.createElement('option');option.value=value;option.textContent=preset.name;el('breakStyle').append(option);
}
function initKitPresetSelect(selectId: string){
  const kitSelect=document.getElementById(selectId) as HTMLSelectElement | null;
  if(!kitSelect) return;
  kitSelect.replaceChildren();
  const customOpt=document.createElement('option');
  customOpt.value='custom';
  customOpt.textContent='Custom Kit';
  kitSelect.append(customOpt);
  for(const p of KIT_PRESETS){
    const opt=document.createElement('option');
    opt.value=p.id;
    opt.textContent=p.name;
    kitSelect.append(opt);
  }
  kitSelect.onchange=async()=>{
    if(kitSelect.value!=='custom'){
      await kitPanel.applyPreset(kitSelect.value);
      const otherId=selectId==='kit-preset-select'?'generator-kit-select':'kit-preset-select';
      const other=document.getElementById(otherId) as HTMLSelectElement | null;
      if(other) other.value=kitSelect.value;
      const desc = document.getElementById('generator-kit-desc');
      const p = KIT_PRESETS.find(k => k.id === kitSelect.value);
      if(desc) desc.textContent = p ? p.description : 'Kit sounds';
      dirty();
    }
  };
}
initKitPresetSelect('kit-preset-select');
initKitPresetSelect('generator-kit-select');

function patternJSON(){
  const pattern=withDrumKit(editor.state.pattern,drumKit,kitPanel.mix);
  if(pattern.userTracks?.length||pattern.sliceInstruments?.length||!pattern.events.length||ROLES.some(r=>kitPanel.mix[r].level!==1||kitPanel.mix[r].tune!==0||kitPanel.mix[r].mute||kitPanel.mix[r].reverse||(kitPanel.mix[r].effects&&!kitPanel.mix[r].effects!.bypass&&(kitPanel.mix[r].effects!.highpass>0||kitPanel.mix[r].effects!.lowpass<20000||kitPanel.mix[r].effects!.drive>0||kitPanel.mix[r].effects!.mix>0)))||pattern.events.some(h=>h.slice||h.pitch||h.fineOffset||h.reverse||h.effect||h.articulation||h.ratchets&&h.ratchets>1||h.gate!==undefined))return JSON.stringify({...JSON.parse(serialize(transfer)),format:'breakbeat-notes',version:1,pattern,effects:effectMap(),audioAssets:[...new Set(pattern.events.flatMap(h=>h.slice?[h.slice.assetId]:[]))].map(id=>{const a=assets.get(id);return {id,name:a?.name,sampleRate:a?.sampleRate};}),notice:'Synth settings are included. Sample audio is not included; save a project or export WAV to preserve its sound.'},null,2);
  return serialize(transfer);
}
function currentAsset(){
  const current=samplePanel.getAsset();if(!current)throw Error('Import and chop a sample first.');
  if(!assets.has(current.id)&&[...assets.values()].reduce((sum,a)=>sum+a.channels.reduce((n,c)=>n+c.byteLength,0),0)+current.buffer.length*current.buffer.numberOfChannels*4>256*1024*1024)throw Error('Session audio limit reached (256 MB). Export your WAV before refreshing to start a new session.');
  if(!assets.has(current.id))assets.set(current.id,{id:current.id,name:current.name,sampleRate:current.buffer.sampleRate,channels:Array.from({length:current.buffer.numberOfChannels},(_,i)=>current.buffer.getChannelData(i))});
  return {...current,asset:assets.get(current.id)!};
}
const hitFields=['edit-row','edit-lane','edit-sound','edit-volume','edit-pan','edit-delay','edit-pitch','edit-synth-note','edit-synth-length','edit-reverse','edit-ratchets','edit-gate','edit-burst-span','edit-speed-override','edit-speed','edit-speed-mode','edit-lowpass-override','edit-lowpass','edit-attack-override','edit-attack','edit-decay-override','edit-decay','edit-trim-enabled','edit-trim-start','edit-trim-end'] as const;
type HitDraft=Partial<Record<typeof hitFields[number],string>>;
const hitDrafts=new Map<Editor,Map<string,HitDraft>>();
let draftTargets:{slot:number;id:string}[]=[];
let entryKey:string|undefined,entryOwner:Editor|undefined,entryBaseline:HitDraft={},pitchGesture:HitDraft|undefined,pitchCancelled=false;
function draftMap(){let map=hitDrafts.get(editor);if(!map){map=new Map();hitDrafts.set(editor,map);}return map;}
function fieldValue(id:typeof hitFields[number]){return input(id).type==='checkbox'?String(input(id).checked):input(id).value;}
function setField(id:typeof hitFields[number],value:string){if(input(id).type==='checkbox')input(id).checked=value==='true';else input(id).value=value;}
function captureHitDraft(){if(!entryKey||entryOwner!==editor)return;const draft:HitDraft={};for(const id of hitFields)if(fieldValue(id)!==entryBaseline[id])draft[id]=fieldValue(id);if(Object.keys(draft).length)draftMap().set(entryKey,draft);else draftMap().delete(entryKey);updateDraftStatus();}
function pendingCount(){return [...hitDrafts.values()].reduce((n,m)=>n+m.size,0);}
function updateDraftStatus(){
 const hit=pattern?.events.find(h=>h.id===entryKey),isLocked=!!hit&&locked(editor.state,hit),pending=!!entryKey&&draftMap().has(entryKey);
 el('hit-draft-status').textContent=!hit?'Select a hit, or use Insert hit to create a note at the cursor.':isLocked?'Locked — unlock to edit.':pending?'Pending changes · Preview includes these values. Apply or Revert. Kept in this session when switching hits.':pendingCount()?pendingCount()+' other hit draft(s) kept in this session.':'Saved hit · Pitch slider saves on release; other edits use Apply.';
 input('hit-revert').disabled=!pending;input('hit-unlock').hidden=!isLocked;el('hit-unlock').textContent=hit&&editor.state.lockedRoles.includes(hit.role)?'Unlock lane and hit':'Unlock hit';
 for(const id of [...hitFields,'edit-pitch-slider'])input(id).disabled=isLocked;
 for(const name of ['speed','lowpass','attack','decay'])input('edit-'+name).disabled=isLocked||!input('edit-'+name+'-override').checked;
 for(const name of ['start','end'])input('edit-trim-'+name).disabled=isLocked||!input('edit-trim-enabled').checked;
 input('hit-apply').disabled=!hit||isLocked||!pending;input('hit-insert').disabled=isLocked;
 el('hit-preview').textContent=pending?'Preview pending hit':'Preview selected hit';
 el('hit-draft-status').classList.toggle('pending',pending);
 const select=el<HTMLSelectElement>('hit-drafts');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Go to a pending hit…';select.append(placeholder);draftTargets=[];
 for(const [slot,owner] of slotEditors)for(const id of hitDrafts.get(owner)?.keys()??[]){const h=owner.state.pattern.events.find(h=>h.id===id);if(!h)continue;const option=document.createElement('option');option.value=String(draftTargets.length);option.textContent=(bank?.slots[slot]?.name??String(slot))+' · '+h.role+' · row '+compile(owner.state.pattern).notes.find(n=>n.id===id)?.row;select.append(option);draftTargets.push({slot,id});}
 el('hit-drafts-label').hidden=!draftTargets.length;
}
function syncHitShape(){
  el('edit-speed-value').textContent=Number(input('edit-speed').value).toFixed(2)+'×';
  const lowpass=Number(input('edit-lowpass').value);el('edit-lowpass-value').textContent=lowpass>=20000?'Open':lowpass+' Hz';
  el('edit-attack-value').textContent=input('edit-attack').value+' ms';
  el('edit-decay-value').textContent=Math.round(Number(input('edit-decay').value)*100)+'%';
  const start=Number(input('edit-trim-start').value),end=Number(input('edit-trim-end').value);
  el('edit-trim-duration').textContent=Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,end-start).toFixed(0)+' ms cut':'';
  drawHitTrimWave();
}
let trimWaveAsset:AudioAsset|undefined,trimWaveFrom=0,trimWaveTo=0;
let trimWaveCache:{asset:AudioAsset;from:number;to:number;width:number;peaks:Float32Array}|undefined;
function drawHitTrimWave(){
 const canvas=el<HTMLCanvasElement>('edit-trim-wave'),asset=trimWaveAsset;
 if(!asset||trimWaveTo<=trimWaveFrom||canvas.clientWidth===0)return;
 const width=Math.max(1,Math.round(canvas.clientWidth*(window.devicePixelRatio||1))),height=Math.max(1,Math.round(canvas.clientHeight*(window.devicePixelRatio||1)));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,width,height);
 const data=asset.channels[0]!,span=trimWaveTo-trimWaveFrom,center=height/2;
 if(!trimWaveCache||trimWaveCache.asset!==asset||trimWaveCache.from!==trimWaveFrom||trimWaveCache.to!==trimWaveTo||trimWaveCache.width!==width){
   const peaks=new Float32Array(width);
   for(let x=0;x<width;x++){
     const a=trimWaveFrom+Math.floor(x*span/width),b=Math.min(trimWaveTo,trimWaveFrom+Math.ceil((x+1)*span/width));
     for(let i=a;i<b;i++)peaks[x]=Math.max(peaks[x]!,Math.abs(data[i]??0));
   }
   trimWaveCache={asset,from:trimWaveFrom,to:trimWaveTo,width,peaks};
 }
 ctx.fillStyle='#39bca8';
 for(let x=0;x<width;x++){
   const h=Math.max(1,Math.round(trimWaveCache.peaks[x]!*(height-8)/2));ctx.fillRect(x,center-h,1,h*2);
 }
 const total=span/asset.sampleRate*1000,start=Number(input('edit-trim-start').value),end=Number(input('edit-trim-end').value),x1=Math.max(0,Math.min(width,width*start/total)),x2=Math.max(0,Math.min(width,width*end/total));
 if(input('edit-trim-enabled').checked){ctx.fillStyle='rgba(0,0,0,.54)';ctx.fillRect(0,0,x1,height);ctx.fillRect(x2,0,width-x2,height);}
 ctx.fillStyle='#f4be6d';ctx.fillRect(x1-2,0,4,height);ctx.fillStyle='#8ef0cd';ctx.fillRect(x2-2,0,4,height);
}
let draggingTrim:'start'|'end'|undefined;
const trimCanvas=el<HTMLCanvasElement>('edit-trim-wave');
el('hit-editor').addEventListener('toggle',()=>requestAnimationFrame(drawHitTrimWave));
el('hit-sample-controls').addEventListener('toggle',()=>requestAnimationFrame(drawHitTrimWave));
window.addEventListener('resize',drawHitTrimWave);
trimCanvas.addEventListener('pointerdown',event=>{
 if(!trimWaveAsset||input('edit-trim-enabled').disabled)return;
 const rect=trimCanvas.getBoundingClientRect(),length=(trimWaveTo-trimWaveFrom)/trimWaveAsset.sampleRate*1000,ms=(event.clientX-rect.left)/rect.width*length;
 draggingTrim=Math.abs(ms-Number(input('edit-trim-start').value))<=Math.abs(ms-Number(input('edit-trim-end').value))?'start':'end';
 input('edit-trim-enabled').checked=true;trimCanvas.setPointerCapture(event.pointerId);
 const min=draggingTrim==='start'?0:Number(input('edit-trim-start').value)+5,max=draggingTrim==='start'?Number(input('edit-trim-end').value)-5:length;
 const field=input('edit-trim-'+draggingTrim);field.disabled=false;field.value=String(Math.round(Math.max(min,Math.min(max,ms))));field.dispatchEvent(new Event('input',{bubbles:true}));
});
trimCanvas.addEventListener('pointermove',event=>{
 if(!draggingTrim||!trimWaveAsset)return;
 const length=(trimWaveTo-trimWaveFrom)/trimWaveAsset.sampleRate*1000,rect=trimCanvas.getBoundingClientRect(),ms=(event.clientX-rect.left)/rect.width*length;
 const min=draggingTrim==='start'?0:Number(input('edit-trim-start').value)+5,max=draggingTrim==='start'?Number(input('edit-trim-end').value)-5:length;
 const field=input('edit-trim-'+draggingTrim);field.value=String(Math.round(Math.max(min,Math.min(max,ms))));field.dispatchEvent(new Event('input',{bubbles:true}));
});
trimCanvas.addEventListener('pointerup',()=>{draggingTrim=undefined;});
trimCanvas.addEventListener('pointercancel',()=>{draggingTrim=undefined;});
for(const id of hitFields)input(id).addEventListener('input',()=>{syncHitShape();captureHitDraft();});
function revertHitDraft(){if(entryKey)draftMap().delete(entryKey);pitchGesture=undefined;render();}
el('hit-revert').onclick=revertHitDraft;
el('hit-drafts').onchange=()=>{if(input('hit-drafts').value==='')return;const target=draftTargets[Number(input('hit-drafts').value)];if(!target)return;stop();activateSlot(target.slot);editor.state.selection={ids:[target.id],rows:null};showHitEditor();render();};
el('hit-unlock').onclick=()=>edit(()=>{const hit=pattern.events.find(h=>h.id===entryKey);if(!hit)return false;return editor.unlockHit(hit.id);},'Unlocked hit and its lane.');
window.addEventListener('beforeunload',event=>{if(pendingCount()){event.preventDefault();event.returnValue='';}});
function syncHitPitch(){
 const value=Number(input('edit-pitch').value);
 if(input('edit-pitch').value!==''&&Number.isFinite(value)&&value>=-48&&value<=48){
  input('edit-pitch-slider').value=String(value);
  const label=(value>0?'+':'')+value+' st';el('edit-pitch-value').textContent=label;
  input('edit-pitch-slider').setAttribute('aria-valuetext',value+' semitones');
 }else el('edit-pitch-value').textContent='−48 to +48 st';
}
input('edit-pitch-slider').addEventListener('pointerdown',()=>{pitchCancelled=false;pitchGesture={...(entryKey?draftMap().get(entryKey):{})};});
input('edit-pitch-slider').addEventListener('input',()=>{if(pitchCancelled){syncHitPitch();return;}input('edit-pitch').value=input('edit-pitch-slider').value;syncHitPitch();captureHitDraft();});
input('edit-pitch-slider').addEventListener('change',()=>{
 if(pitchCancelled){syncHitPitch();return;}
 const hit=pattern.events.find(h=>h.id===entryKey);if(!hit||locked(editor.state,hit))return;
 const pitch=Number(input('edit-pitch').value);if(pitch===(hit.pitch??0)){pitchGesture=undefined;return;}
 stop();if(editor.write({...hit,pitch},hit.id)){const draft=draftMap().get(hit.id);if(draft){delete draft['edit-pitch'];if(!Object.keys(draft).length)draftMap().delete(hit.id);}pitchGesture=undefined;refresh();status('Pitch saved. One Undo restores the previous pitch.');}
});
input('edit-pitch-slider').addEventListener('pointercancel',()=>{if(entryKey&&pitchGesture){if(Object.keys(pitchGesture).length)draftMap().set(entryKey,pitchGesture);else draftMap().delete(entryKey);}pitchGesture=undefined;render();});
input('edit-pitch-slider').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){pitchCancelled=false;pitchGesture={...(entryKey?draftMap().get(entryKey):{})};}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();pitchCancelled=true;if(entryKey){const restore=pitchGesture??{...draftMap().get(entryKey)};if(!pitchGesture)delete restore['edit-pitch'];if(Object.keys(restore).length)draftMap().set(entryKey,restore);else draftMap().delete(entryKey);}pitchGesture=undefined;render();}});
input('edit-pitch').addEventListener('input',syncHitPitch);
function updateEntry(hit?:Hit){
  input('edit-row').max=String(transfer.timing.lines-1);rowAnchor=Math.min(rowAnchor,transfer.timing.lines-1);
  const activeTrack=pattern.userTracks?.find(track=>track.id===(hit?.trackId??cursorTrackId)),isSynth=isSynthTrack(activeTrack);
  el('synth-note-field').hidden=!isSynth;el('synth-length-field').hidden=!isSynth;el('sample-sound-field').hidden=isSynth;el('sample-pitch-field').hidden=isSynth;
  el('hit-articulation').hidden=isSynth;el('hit-sample-controls').hidden=isSynth;
  input('edit-reverse').closest('label')!.toggleAttribute('hidden',isSynth);
  input('edit-synth-note').value=String(hit?.synthNote?.note??48);
  const synthLength=el<HTMLSelectElement>('edit-synth-length');synthLength.querySelector('[data-custom]')?.remove();const noteLength=hit?.synthNote?.durationTicks??960;
  if(!Array.from(synthLength.options).some(option=>Number(option.value)===noteLength)){const option=document.createElement('option');option.dataset.custom='true';option.value=String(noteLength);option.textContent=+(noteLength/960).toFixed(3)+' beats';synthLength.append(option);}synthLength.value=String(noteLength);
  if(hit){
    const n=transfer.notes.find(n=>n.id===hit.id)!;input('edit-row').value=String(n.row);input('edit-lane').value=hit.role;
    input('edit-volume').value=String(n.volume);input('edit-pan').value=String(n.pan);input('edit-delay').value=String(n.delay);input('edit-pitch').value=String(hit.pitch??0);input('edit-reverse').checked=!!hit.reverse;input('edit-ratchets').value=String(hit.ratchets??1);const gateSelect=el<HTMLSelectElement>('edit-gate');gateSelect.querySelector('[data-custom]')?.remove();if(hit.gate!==undefined&&!Array.from(gateSelect.options).some(o=>Number(o.value)===hit.gate)){const option=document.createElement('option');option.dataset.custom='true';option.value=String(hit.gate);option.textContent=Math.round(hit.gate*100)+'%';gateSelect.append(option);}gateSelect.value=String(hit.gate??0);input('edit-sound').value='keep';
  }else{input('edit-row').value=String(rowAnchor);input('edit-lane').value=cursorLane;}
  const shapeRole=hit?.role??cursorLane,slot=kitPanel.mix[shapeRole];
  const selectedSlice=hit?resolveSlice(pattern,hit):undefined;
  const hitTrack=hit?.trackId?pattern.userTracks?.find(t=>t.id===hit.trackId):undefined;
  const trimSlice=selectedSlice??(hitTrack&&!isSynthTrack(hitTrack)?hitTrack.sample:undefined)??drumKit[shapeRole];
  trimWaveAsset=trimSlice?assets.get(trimSlice.assetId):undefined;trimWaveFrom=trimSlice?.startFrame??0;trimWaveTo=trimSlice?.endFrame??0;
  const trimLength=trimSlice?Math.floor((trimSlice.endFrame-trimSlice.startFrame)/trimSlice.sampleRate*1000):0;
  el('hit-trim-controls').hidden=!hit||!trimWaveAsset;
  input('edit-trim-start').max=String(Math.max(0,trimLength-5));input('edit-trim-end').max=String(trimLength);
  input('edit-trim-enabled').checked=!!hit?.sampleTrim;
  input('edit-trim-start').value=String(hit?.sampleTrim?.startMs??0);input('edit-trim-end').value=String(hit?.sampleTrim?.endMs??trimLength);
  input('edit-speed-mode').value=hit?.speedMode??'inherit';
  const shape=selectedSlice&&selectedSlice.assetId!==slot.assetId?slot.sampleProfiles?.[selectedSlice.assetId]??{}:slot;
  for(const [name,key,fallback] of [['speed','playbackRate',1],['lowpass','lowpassHz',20000],['attack','attackMs',0],['decay','decay',1]] as const){
    const own=hit?.[key];input('edit-'+name+'-override').checked=own!==undefined;
    input('edit-'+name).value=String(own??(key==='playbackRate'?effectiveSampleSpeed(shape,pattern.settings.bpm).rate:shape[key])??fallback);
  }
  const isV3=['groove-v3','groove-v4','groove-v5'].includes(pattern.settings.algorithm??'');
  el('burst-span-field').hidden=!isV3;
  el('articulation-help').textContent=isV3?'Repeats divide the musical Burst span, independent of tracker resolution. Generated natural hits can sustain; Gate deliberately shortens attacks. Pitch and velocity contours are shown above.':'Ratchets divide one tracker row into equal repeats. Gate shortens each attack; 50% leaves half its interval silent. Effects can ring beyond the gate.';
  el('edit-ratchets-label').textContent=isV3?'Repeats in burst':'Ratchets per row';
  const span=el<HTMLSelectElement>('edit-burst-span');span.querySelector('[data-custom]')?.remove();
  const duration=hit?.articulation?.durationTicks??0;
  if(duration&&!Array.from(span.options).some(o=>Number(o.value)===duration)){const o=document.createElement('option');o.dataset.custom='true';o.value=String(duration);o.textContent=+(duration/960).toFixed(3)+' beats';span.append(o);}span.value=String(duration);
  el('hit-expression').hidden=!hit?.articulation;el('hit-expression').textContent=hit?articulationLabel(hit):'';
  el('inspector-context').textContent=hit?hit.role+' · row '+input('edit-row').value:'Row '+rowAnchor+' · '+cursorLane;
  entryKey=hit?.id;entryOwner=editor;entryBaseline=Object.fromEntries(hitFields.map(id=>[id,fieldValue(id)]));
  if(entryKey){const draft=draftMap().get(entryKey);if(draft){for(const id of hitFields){if(draft[id]===entryBaseline[id])delete draft[id];if(draft[id]!==undefined)setField(id,draft[id]!);}if(!Object.keys(draft).length)draftMap().delete(entryKey);}}
  syncHitPitch();syncHitShape();
  input('hit-preview').disabled=editor.state.selection.ids.length!==1;
  input('hit-apply').disabled=editor.state.selection.ids.length!==1;
  input('hit-delete').disabled=selectedIds(editor.state).size===0;
  updateDraftStatus();
  el('edit-hit-target').textContent=hit?.synthNote?`Synth: ${activeTrack?.name??'instrument'} · ${noteName(hit.synthNote.note)} · ${+(hit.synthNote.durationTicks/960).toFixed(2)} beats · ${locked(editor.state,hit)?'Locked':'Editable'}`:hit?((resolveSlice(pattern,hit)??drumKit[hit.role])?'Sound: '+(resolveSlice(pattern,hit)??drumKit[hit.role])!.label:'Sound: demo '+hit.role)+' · '+(locked(editor.state,hit)?'Locked':'Editable'):'Cursor: row '+rowAnchor+' / '+(activeTrack?.name??cursorLane);
  syncReTrackStatusStrip();
}
function entryHit(replace:boolean,pitchOverride?:number){
  const row=Number(input('edit-row').value),delay=Number(input('edit-delay').value),volume=Number(input('edit-volume').value),pan=Number(input('edit-pan').value),pitch=pitchOverride??Number(input('edit-pitch').value);
  if(!Number.isInteger(row)||row<0||row>=transfer.timing.lines||!Number.isInteger(delay)||delay<0||delay>255||!Number.isInteger(volume)||volume<0||volume>128||!Number.isInteger(pan)||pan<0||pan>128)throw Error('Use valid integer row, delay, volume and pan values.');
  const prior=replace?pattern.events.find(h=>h.id===editor.state.selection.ids[0]):undefined,trackId=prior?.trackId??cursorTrackId,track=trackId?pattern.userTracks?.find(item=>item.id===trackId):undefined,role=track?.role??prior?.role??input('edit-lane').value as Role;
  if(replace&&!prior)throw Error('Select one hit to edit.');
  const tick=(row+delay/256)*960/transfer.timing.lpb;
  if(isSynthTrack(track)){
    const note=pitchOverride??Number(input('edit-synth-note').value),durationTicks=Number(input('edit-synth-length').value);
    const hit:Hit={id:prior?.id??'synth-note-'+crypto.randomUUID(),role:track.role,trackId:track.id,sourceId:'kit.'+track.role,baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:volume/128,pan:pan/64-1,synthNote:{note,durationTicks},anchor:false,ghost:false,reason:`Pitched note on ${track.name}.`};
    const oldNote=prior&&transfer.notes.find(n=>n.id===prior.id);if(prior&&oldNote?.row===row&&oldNote.delay===delay){hit.baseTick=prior.baseTick;hit.offsetTick=prior.offsetTick;hit.fineOffset=prior.fineOffset;}
    compile({...pattern,events:[hit]});return {hit,prior};
  }
  const hit:Hit={id:prior?.id??'entry-'+crypto.randomUUID(),role,...(trackId?{trackId}:{}),sourceId:'kit.'+role,baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:volume/128,pan:pan/64-1,pitch,reverse:input('edit-reverse').checked,ratchets:Number(input('edit-ratchets').value),...(Number(input('edit-gate').value)?{gate:Number(input('edit-gate').value)}:{}),...(prior?.effect?{effect:{...prior.effect}}:{}),anchor:prior?.anchor??false,ghost:prior?.ghost??false,reason:'A manually entered tracker hit.'};
  if(track&&!isSynthTrack(track)&&track.generatedBreakLayer!=='think-passage2')hit.slice={...track.sample};else if(prior?.slice)hit.slice={...prior.slice};
  if(input('edit-speed-override').checked)hit.playbackRate=Number(input('edit-speed').value);
  if(input('edit-speed-mode').value!=='inherit')hit.speedMode=input('edit-speed-mode').value as 'repitch'|'stretch';
  if(input('edit-lowpass-override').checked)hit.lowpassHz=Number(input('edit-lowpass').value);
  if(input('edit-attack-override').checked)hit.attackMs=Number(input('edit-attack').value);
  if(input('edit-decay-override').checked)hit.decay=Number(input('edit-decay').value);
  if(['groove-v3','groove-v4','groove-v5'].includes(pattern.settings.algorithm??'')){
    const duration=Number(input('edit-burst-span').value)||960/transfer.timing.lpb;
    const expression=prior?.articulation?structuredClone(prior.articulation):undefined;
    if(expression||hit.ratchets!>1||hit.gate!==undefined||Number(input('edit-burst-span').value)){
      hit.articulation={...(expression??{}),durationTicks:duration,mode:hit.gate!==undefined||hit.ratchets!>1?'gate':'natural'};
      if(expression&&hit.ratchets===(prior?.ratchets??1)&&hit.gate===prior?.gate)hit.articulation.mode=expression.mode;
      if(hit.ratchets!==(prior?.ratchets??1))delete hit.articulation.repeats;
      if(role!=='hat')delete hit.articulation.chokeGroup;
    }
    hit.sourceKind=prior?.sourceKind??(prior?.slice?'slice':'oneShot');
    if(prior)hit.reason=prior.reason;
  }
  const oldNote=prior&&transfer.notes.find(n=>n.id===prior.id);
  if(prior&&oldNote?.row===row&&oldNote.delay===delay){hit.baseTick=prior.baseTick;hit.offsetTick=prior.offsetTick;hit.fineOffset=prior.fineOffset;}
  const sound=input('edit-sound').value;
  if(sound==='slice'){const a=currentAsset();hit.slice=sliceReference(a.asset,a.markers,a.selected);if(['groove-v3','groove-v4','groove-v5'].includes(pattern.settings.algorithm??''))hit.sourceKind='slice';}
  else if(sound==='demo'&&!track)delete hit.slice;
  else if(sound==='keep'&&prior?.mapped)hit.mapped={...prior.mapped};
  else if(sound==='keep'&&prior?.slice)hit.slice={...prior.slice};
  if(track&&!isSynthTrack(track)&&track.generatedBreakLayer==='think-passage2'&&(sound==='keep'||sound==='demo')&&!hit.mapped){
    const instrument=pattern.sliceInstruments?.find(item=>item.id===THINK_BREAK_INSTRUMENT_ID);
    if(!instrument)throw Error('The Think slice map is missing. Regenerate the break layer.');
    hit.mapped={instrumentId:instrument.id,note:instrument.slices[0]!.note};hit.sourceKind='slice';
  }
  if(input('edit-trim-enabled').checked){
    const source=hit.slice??drumKit[role],startMs=Number(input('edit-trim-start').value),endMs=Number(input('edit-trim-end').value);
    if(!source)throw Error('Choose an audio sample before trimming this hit.');
    const available=(source.endFrame-source.startFrame)/source.sampleRate*1000;
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||endMs-startMs<5||endMs>available+.5)throw Error('Trim must fit inside the sample and keep at least 5 ms of audio.');
    hit.sampleTrim={startMs,endMs};
  }
  if(['groove-v3','groove-v4','groove-v5'].includes(pattern.settings.algorithm??'')){
    if(sound!=='slice'&&sound!=='keep')hit.sourceKind='oneShot';
    if(prior&&oldNote?.volume===volume)hit.gain=prior.gain;
    if(prior&&oldNote?.pan===pan)hit.pan=prior.pan;
  }
  compile({...pattern,events:[hit]});return {hit,prior};
}
function writeEntry(replace:boolean,pitchOverride?:number){const {hit,prior}=entryHit(replace,pitchOverride);const changed=editor.write(hit,prior?.id);if(changed&&entryKey)draftMap().delete(entryKey);return changed;}
el('original-groove').onclick=()=>{
  try{
    if(editor.state.lockedIds.length||editor.state.lockedRoles.length)throw Error('Unlock hits and lanes before replacing the pattern with the original groove.');
    const a=currentAsset();const next=reconstruct(a.asset,a.markers,settings());stop();samplePanel.stop();editor.replace(next);syncControls();refresh();
    status('Original groove reconstructed from '+a.markers.slice(0,-1).length+' slices. BPM inferred from the selected bar count. Play pattern or export WAV to hear it.');
  }catch(e){status((e as Error).message,true);}
};
el('hit-preview').onclick=async()=>{
 try{if(editor.state.selection.ids.length!==1)return;const {hit}=entryHit(true);
 flashTrackMeter(hit.role, (hit.gain ?? 1) * kitPanel.mix[hit.role].level);
 stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
 const one=structuredClone(pattern);one.events=[{...hit,baseTick:0,offsetTick:0,fineOffset:0}];
 await preparePianoAudio([one]);if(token!==playToken)return;
 const audio=renderPerformance(withDrumKit(one,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap());startSource(audioBuffer(audio),context.currentTime);
 status('Previewing the inspector values, including pending changes. Pattern playback and exports use saved hits.');
 }catch(e){status(String(e),true);}
};
el('hit-insert').onclick=()=>edit(()=>writeEntry(false),'Inserted tracker hit.');
el('hit-apply').onclick=()=>edit(()=>writeEntry(true),'Updated tracker hit.');
el('hit-delete').onclick=()=>edit(()=>editor.deleteSelected(),'Deleted unlocked selected hits.');
function copyTrackerCells(){try{trackerClipboard=editor.copySelection();status(`Copied ${trackerClipboard.cells.length} tracker cells. Select a destination and paste.`);}catch(e){status((e as Error).message,true);}}
function pasteTrackerCells(){if(!trackerClipboard){status('Copy tracker cells first.',true);return;}const lane=cursorTrackId??cursorLane;edit(()=>editor.pasteCells(trackerClipboard!,rowAnchor,lane),'Pasted tracker cells. Undo restores the previous cells.');focusTrackerCell(rowAnchor,lane);}
function duplicateTrackerCells(){try{const clip=editor.copySelection(),order=trackerLaneIds(),positions=editor.state.selection.cells?.length?editor.state.selection.cells:editor.state.selection.rows?Array.from({length:editor.state.selection.rows[1]-editor.state.selection.rows[0]+1},(_,i)=>({row:editor.state.selection.rows![0]+i,lane:order[0]!})):transfer.notes.filter(n=>editor.state.selection.ids.includes(n.id)).map(n=>({row:n.row,lane:n.lane}));const row=Math.min(...positions.map(c=>c.row))+clip.height,lane=order[Math.min(...positions.map(c=>order.indexOf(c.lane)))]!;edit(()=>editor.pasteCells(clip,row,lane),'Duplicated tracker cells below the selection.');focusTrackerCell(row,lane);}catch(e){status((e as Error).message,true);}}
el('tracker-copy').onclick=copyTrackerCells;el('tracker-paste').onclick=pasteTrackerCells;el('tracker-duplicate').onclick=duplicateTrackerCells;
function trackerJumpRow(key:string,row:number){const last=transfer.timing.lines-1;if(key==='Home')return 0;if(key==='End')return last;const barRows=transfer.timing.lpb*4;if(key==='PageUp')return Math.max(0,row-barRows);if(key==='PageDown')return Math.min(last,row+barRows);return row;}
const trackerJumpKeys=['Home','End','PageUp','PageDown'];
el('grid').addEventListener('keydown', event => {
  if(event.altKey)return;
  if(event.ctrlKey||event.metaKey){const key=event.key.toLowerCase();if(key==='c'||key==='v'||key==='d'){event.preventDefault();if(key==='c')copyTrackerCells();else if(key==='v')pasteTrackerCells();else duplicateTrackerCells();}
    else if(key==='enter'&&isSynthTrack(pattern.userTracks?.find(track=>track.id===cursorTrackId))){event.preventDefault();edit(()=>writeEntry(false),'Added a second synth note at this row.');focusTrackerCell(rowAnchor,cursorTrackId!);}return;}
  const focused=event.target as HTMLElement,field=focused.dataset.field as typeof trackerFields[number]|undefined;
  if(field){
    const row=Number(focused.dataset.cellRow),lane=focused.dataset.cellLane??cursorTrackId??cursorLane,id=focused.dataset.hit;
    if(event.key==='Escape'){trackerFieldDraft=undefined;trackerEffectDraft=undefined;event.preventDefault();event.stopPropagation();render();return;}
    if(event.key==='Tab'||event.key.startsWith('Arrow')||trackerJumpKeys.includes(event.key)){
      event.preventDefault();event.stopPropagation();trackerFieldDraft=undefined;trackerEffectDraft=undefined;
      let nextRow=row,nextLane=lane,nextField:string=field;
      if(event.key==='ArrowUp'||event.key==='ArrowDown')nextRow=(row+(event.key==='ArrowDown'?1:-1)+transfer.timing.lines)%transfer.timing.lines;
      else if(trackerJumpKeys.includes(event.key))nextRow=trackerJumpRow(event.key,row);
      else if(event.key==='Tab'){const lanes=trackerLaneIds(),position=lanes.indexOf(lane)*trackerFields.length+trackerFields.indexOf(field)+(event.shiftKey?-1:1),total=lanes.length*trackerFields.length,wrapped=(position+total)%total;nextLane=lanes[Math.floor(wrapped/trackerFields.length)]!;nextField=trackerFields[wrapped%trackerFields.length]!;}
      else {const lanes=trackerLaneIds(),perRow=lanes.length*trackerFields.length,total=transfer.timing.lines*perRow,current=row*perRow+lanes.indexOf(lane)*trackerFields.length+trackerFields.indexOf(field),wrapped=(current+(event.key==='ArrowRight'?1:-1)+total)%total;nextRow=Math.floor(wrapped/perRow);const column=wrapped%perRow;nextLane=lanes[Math.floor(column/trackerFields.length)]!;nextField=trackerFields[column%trackerFields.length]!;}
      selectTrackerLane(nextRow,nextLane,{shiftKey:event.shiftKey&&(event.key.startsWith('Arrow')||trackerJumpKeys.includes(event.key)),ctrlKey:false,metaKey:false},false);focusTrackerField(nextRow,nextLane,nextField);return;
    }
    if(field==='instrument'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();if(id)openHitSoundPicker(id);else{const panel=el('grid').querySelector<HTMLDetailsElement>(`.track-instrument-panel[data-role="${lane}"]`);if(panel)openInstrumentPanel(panel);}return;}
    if(event.key==='Delete'||event.key==='Backspace'){
      if(field==='effect'&&id){event.preventDefault();event.stopPropagation();trackerEffectDraft=undefined;edit(()=>editor.editTrackerEffect(id), 'Cleared tracker FX.');focusTrackerField(row,lane,field);return;}
      if(field!=='note'&&field!=='instrument'&&field!=='effect'&&id){event.preventDefault();event.stopPropagation();trackerFieldDraft=undefined;const normal=field==='volume'?128:field==='pan'?64:0;edit(()=>editor.editTrackerValue(id,field,normal),`Reset ${field} to its default.`);focusTrackerField(row,lane,field);return;}
    }
    if(field==='effect'){
      const key=event.key.toUpperCase();
      if(/^[0-9A-Z]$/.test(key)){
        event.preventDefault();event.stopPropagation();
        if(!id){status('Enter a note before adding tracker FX.',true);return;}
        const current=trackerEffectDraft?.id===id?trackerEffectDraft:{id,digits:'',prefix:false};
        if(!current.command){
          if(key==='0'&&!current.prefix){current.prefix=true;trackerEffectDraft=current;focused.textContent='0___';return;}
          const command='0'+key as EffectCommand['command'];
          if(!['0S','09','0B','0U','01','0D','02','0C','0R'].includes(command)){status('FX command: S offset, B reverse, U/D pitch slide, C cut, R retrigger.',true);return;}
          current.command=command;trackerEffectDraft=current;focused.textContent=command+'__';status(`Enter two hex digits for ${command}.`);return;
        }
        if(!/^[0-9A-F]$/.test(key))return;
        current.digits+=key;
        if(current.digits.length<2){trackerEffectDraft=current;focused.textContent=current.command+current.digits+'_';return;}
        trackerEffectDraft=undefined;
        edit(()=>editor.editTrackerEffect(id,{command:current.command!,param:parseInt(current.digits.slice(-2),16)}),'Updated tracker FX.');
        const nextRow=(row+getTrackerStep())%transfer.timing.lines;selectTrackerLane(nextRow,lane,undefined,false);focusTrackerField(nextRow,lane,field);return;
      }
      if(event.key.length===1){event.preventDefault();event.stopPropagation();return;}
    }
    if(field==='volume'||field==='pan'||field==='delay'){
      const digit=event.key.toUpperCase();if(/^[0-9A-F]$/.test(digit)){
        event.preventDefault();event.stopPropagation();if(!id){status('Enter a note before editing its values.',true);return;}
        const digits=trackerFieldDraft?.id===id&&trackerFieldDraft.field===field?trackerFieldDraft.digits+digit:digit;
        if(digits.length<2){trackerFieldDraft={id,field,digits};focused.textContent=digits+'_';status(`Enter the second hexadecimal digit for ${field}. Esc cancels.`);return;}
        trackerFieldDraft=undefined;const value=parseInt(digits.slice(-2),16);
        edit(()=>editor.editTrackerValue(id,field,value),`Updated tracker ${field}.`);
        const nextRow=(row+getTrackerStep())%transfer.timing.lines;selectTrackerLane(nextRow,lane,undefined,false);focusTrackerField(nextRow,lane,field);return;
      }
    }
  }
  if (event.key === ' ') {
    event.preventDefault();
    void play().catch(e => status(String(e), true));
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    const lanes=trackerLaneIds(),curIdx=lanes.indexOf(cursorTrackId??cursorLane),nextIdx=(curIdx+(event.shiftKey?-1:1)+lanes.length)%lanes.length;
    selectTrackerLane(rowAnchor,lanes[nextIdx]!,undefined,false);
    return;
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    const lanes=trackerLaneIds(),laneIndex=lanes.indexOf(cursorTrackId??cursorLane),total=transfer.timing.lines*lanes.length,current=rowAnchor*lanes.length+laneIndex,next=current+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:event.key==='ArrowDown'?lanes.length:event.key==='ArrowUp'?-lanes.length:0),wrapped=(next+total)%total;
    const row=Math.floor(wrapped/lanes.length),lane=lanes[wrapped%lanes.length]!;
    selectTrackerLane(row,lane,{shiftKey:event.shiftKey,ctrlKey:false,metaKey:false},false);
    const rowEl=el('grid').querySelector(`[data-play-row="${row}"]`);if(rowEl)revealPlaybackItem(el('grid'),rowEl,el('grid').querySelector('thead')?.getBoundingClientRect().height??0);
    return;
  }
  if(trackerJumpKeys.includes(event.key)){
    event.preventDefault();const row=trackerJumpRow(event.key,rowAnchor);
    selectTrackerLane(row,cursorTrackId??cursorLane,{shiftKey:event.shiftKey,ctrlKey:false,metaKey:false},false);
    const rowEl=el('grid').querySelector(`[data-play-row="${row}"]`);if(rowEl)revealPlaybackItem(el('grid'),rowEl,el('grid').querySelector('thead')?.getBoundingClientRect().height??0);
    return;
  }
  if (!input('keyboard-entry').checked || event.repeat) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    if (editor.state.selection.ids.length === 0) {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
      });
      if (hitAtCursor) {
        editor.state.selection = {ids: [hitAtCursor.id], rows: null}; edit(() => editor.deleteSelected(), 'Deleted hit at row ' + rowAnchor + '.');
        el('grid').focus();
        return;
      }
    }
    edit(() => editor.deleteSelected(), 'Deleted unlocked hits.');
    el('grid').focus();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const step = getTrackerStep();
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
    });
    try {
      stop();
      const changed = writeEntry(!!hitAtCursor);
      if (changed) {
        void auditionCursor(cursorLane);
        rowAnchor = Math.min(transfer.timing.lines - 1, rowAnchor + step);
        editor.state.selection = emptySelection();
      }
      refresh();
      el('grid').focus();
      status(changed ? 'Note entered.' : 'The target is locked.');
    } catch (e) { status((e as Error).message, true); }
    return;
  }
  const velMap: Record<string, number> = {'1': 16, '2': 32, '3': 48, '4': 64, '5': 80, '6': 96, '7': 112, '8': 120, '9': 128};
  if (velMap[event.key] && field!=='note') {
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
    });
    if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
      event.preventDefault();
      const gain = velMap[event.key]! / 128;
      editor.write({ ...hitAtCursor, gain }, hitAtCursor.id);
      void auditionCursor(cursorLane);
      refresh();
      el('grid').focus();
      status(`Velocity set to ${velMap[event.key]} (0x${hex(velMap[event.key]!)}).`);
      return;
    }
  }
  if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_') {
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
    });
    if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
      event.preventDefault();
      const delta = (event.key === '+' || event.key === '=') ? 1 : -1;
      const pitch = hitAtCursor.synthNote?hitAtCursor.synthNote.note+delta:(hitAtCursor.pitch ?? 0) + delta;
      if (pitch >= (hitAtCursor.synthNote?0:-48) && pitch <= (hitAtCursor.synthNote?119:48)) {
        editor.write(hitAtCursor.synthNote?{...hitAtCursor,synthNote:{...hitAtCursor.synthNote,note:pitch}}:{ ...hitAtCursor, pitch }, hitAtCursor.id);
        void auditionCursor(cursorLane);
        refresh();
        el('grid').focus();
        status(hitAtCursor.synthNote?`Synth note transposed to ${noteName(pitch)}.`:`Pitch transposed to ${pitch > 0 ? '+' : ''}${pitch} st.`);
        return;
      }
    }
  }
  const lowerNotes = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm'];
  const upperNotes = ['q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u'];
  const keyLower = event.key.toLowerCase();
  let semitone = -1;
  const lowIdx = lowerNotes.indexOf(keyLower);
  if (lowIdx >= 0) semitone = lowIdx;
  else {
    const upIdx = upperNotes.indexOf(keyLower);
    if (upIdx >= 0) semitone = 12 + upIdx;
  }
  if (semitone < 0) return;
  event.preventDefault();
  const basePitch = field==='note'?0:Number(input('edit-pitch').value), step = getTrackerStep(), sound = input('edit-sound').value;
  try {
    stop();
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
    });
    const selectedHit=pattern.events.find(h=>editor.state.selection.ids.includes(h.id)&&h.role===cursorLane&&h.trackId===cursorTrackId)??hitAtCursor;
    const cursorTrack=pattern.userTracks?.find(track=>track.id===cursorTrackId);
    const instrument=pattern.sliceInstruments?.find(i=>i.id===selectedHit?.mapped?.instrumentId)
      ??(cursorTrack&&!isSynthTrack(cursorTrack)&&cursorTrack.generatedBreakLayer==='think-passage2'?pattern.sliceInstruments?.find(i=>i.id===THINK_BREAK_INSTRUMENT_ID):undefined)
      ??(!cursorTrack&&cursorLane==='percussion'?pattern.sliceInstruments?.[0]:undefined);
    let changed:boolean;
    if(isSynthTrack(pattern.userTracks?.find(track=>track.id===cursorTrackId))){
      const note=Number(input('synth-octave').value)*12+semitone;
      if(note>119)throw Error('Choose a lower synth octave.');
      changed=writeEntry(!!hitAtCursor,note);
    }else if(instrument){
      const note=Number(input('slice-octave').value)*12+semitone;
      if(!instrument.slices.some(s=>s.note===note))throw Error('This key has no slice. Choose a mapped note or another slice octave.');
      if(selectedHit?.mapped)changed=editor.editTrackerValue(selectedHit.id,'note',note);
      else {const tick=rowAnchor*960/transfer.timing.lpb,role=cursorTrack?.role??cursorLane;changed=editor.write({id:'slice-entry-'+crypto.randomUUID(),role,...(cursorTrackId?{trackId:cursorTrackId}:{}),sourceId:'kit.'+role,sourceKind:'slice',mapped:{instrumentId:instrument.id,note},baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:1,pan:0,pitch:0,anchor:false,ghost:false,reason:'Mapped slice keyboard entry.'},selectedHit?.id);}
    }else changed=writeEntry(!!hitAtCursor,basePitch+semitone);
    if (changed) {
      void auditionCursor(cursorLane);
      rowAnchor = Math.min(transfer.timing.lines - 1, rowAnchor + step);
      editor.state.selection = emptySelection();
    }
    refresh();
    input('edit-pitch').value = String(basePitch);
    syncHitPitch();
    input('edit-sound').value = sound;
    el('grid').focus();
    status(changed ? 'Keyboard note entered.' : 'The target is locked.');
  } catch (e) { status((e as Error).message, true); }
});

function snapshot(){
  if(kitPanel.busy)throw Error('Wait for the sample to finish loading.');
  let draft=pattern.settings;try{const candidate=settings();validateSettings(candidate);draft=candidate;}catch{}
  stashSlot();return makeProject(editor.state,draft,kitPanel.snapshot(),assets,bank,vinylTexture);
}
function scheduleSave(){
  if(!persistenceReady)return;clearTimeout(saveTimer);el('save-status').textContent='Saving locally…';
  saveTimer=setTimeout(()=>{try{const value=snapshot();saveQueue=saveQueue.catch(()=>{}).then(()=>localProject(value)).then(()=>{el('save-status').textContent='Saved locally';}).catch(e=>{el('save-status').textContent='Autosave unavailable — use Save project';console.error(e);});}catch(e){el('save-status').textContent=String(e);}},600);
}
async function applyProject(raw:unknown){
  if(pendingCount()&&!confirm('Opening this project discards pending hit edits. Continue?'))return false;
  let replacement:AudioAsset|undefined;
  if(needsVinylMigration(raw)){context??=new AudioContext();replacement=await ensureLibraryAudio('lofi2-perc-02','percussion',assets,context);}
  const {project:p,assets:loaded,migrated}=readProject(raw,replacement);hitDrafts.clear();stop();samplePanel.stop();
  comparison=undefined;cellAnchor=undefined;trackerClipboard=undefined;
  assets.clear();loaded.forEach((a,id)=>assets.set(id,a));kitPanel.restore(p.kit);
  vinylTexture={...(p.vinylTexture??DEFAULT_VINYL_TEXTURE)};syncVinylControls();
  bank=p.bank?structuredClone(p.bank):newBank(p.editor.pattern);arrangementHistory=new ArrangementHistory(bank);bank=arrangementHistory.bank;selectedArrangementStep=undefined;slotEditors.clear();
  editor=new Editor(p.editor.pattern);editor.state=structuredClone(p.editor);rowAnchor=0;
  input('phraseLength').value=String(p.draft.phraseLength??0);syncPhraseControls(p.draft.phraseOffset??0);
  input('algorithm').value=p.draft.algorithm??'legacy-v1';input('variation').value=String(p.draft.variation??0);
  input('generationMode').value=p.draft.generationMode??'drums';input('melodyPart').value=p.draft.melodyPart??'bassline';input('melodyKey').value=String(p.draft.melodyKey??0);input('melodyScale').value=p.draft.melodyScale??'natural-minor';input('harmonyStyle').value=p.draft.harmonyStyle??'jazz';
  input('hit-target-mode').value=p.draft.hitTarget===undefined?'auto':'exact';input('hit-target-number').value=String(p.draft.hitTarget??32);syncHitTargetControl();
  for(const role of ROLES)input(`${role}-density`).value=String(p.draft.laneDensity?.[role]??1);
  for(const [key,value] of Object.entries(p.draft))if(key!=='enabledRoles'&&key!=='laneDensity'&&key!=='hitTarget')input(key).value=String(value);
  presets();refresh();syncVinylGenreAccent();restoreWorkspacePreferences();if(migrated)status('Older project sound updated: scratch and vinyl instrument hits now use Lo-Fi Percussion 02. Vinyl texture moved to background where available.');return true;
}
el('project-save').onclick=()=>{try{if(pendingCount())throw Error('Apply or Revert pending hit edits before saving a project backup.');const data=snapshot(),filename='breakbeat-project.bbproject';downloadBytes(new TextEncoder().encode(JSON.stringify(data)).buffer,filename,'application/json');fileFeedback(`Downloaded ${filename} · portable backup with embedded samples, kit, patterns and settings. Local autosave remains active in this browser. Your browser controls the download location.`);status('Portable project backup downloaded.');}catch(e){fileFeedback('Project backup failed: '+String(e),true);status(String(e),true);}};
el('project-open').onchange=async e=>{const field=e.target as HTMLInputElement,file=field.files?.[0];field.value='';if(!file)return;
  try{if(file.size>384*1024*1024)throw Error('Project exceeds 384 MB.');const raw=JSON.parse(await file.text());if(await applyProject(raw)){scheduleSave();if(!needsVinylMigration(raw))status('Project opened. Samples and instrument choices restored.');}}catch(e){status('Could not open project. Choose a .bbproject backup or compatible project JSON file, then try again. Details: '+String(e),true);}
};
function startNewProject(starterBeat:boolean){
  if(!confirm('Start a new project? Save project first to keep your current work.'))return;
  hitDrafts.clear();stop();samplePanel.stop();comparison=undefined;cellAnchor=undefined;trackerClipboard=undefined;assets.clear();vinylTexture={...DEFAULT_VINYL_TEXTURE};syncVinylControls();syncVinylGenreAccent();bank=undefined;arrangementHistory=undefined;selectedArrangementStep=undefined;slotEditors.clear();kitPanel.restore(defaultKitState());
  const initial=generate(genreDefaults('jungle'));if(!starterBeat)initial.events=[];editor=new Editor(initial);ensureArrangementHistory();syncControls();
  const genre=input('genre').value as Genre,defaultKitId=GENRE_KITS[genre]||'acoustic-break';
  void kitPanel.applyPreset(defaultKitId);
  const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;if(ks)ks.value=defaultKitId;const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;if(gks)gks.value=defaultKitId;
  refresh();restoreWorkspacePreferences();status(starterBeat?'New project started with a Jungle starter beat.':'Blank tracker ready.');
}
const newProjectDialog=el<HTMLDialogElement>('new-project-dialog');
el('project-new').onclick=()=>newProjectDialog.showModal();
el('new-project-close').onclick=()=>newProjectDialog.close();
el('new-project-blank').onclick=()=>{newProjectDialog.close();startNewProject(false);};
el('new-project-starter').onclick=()=>{newProjectDialog.close();startNewProject(true);};
newProjectDialog.addEventListener('click',event=>{if(event.target===newProjectDialog)newProjectDialog.close();});
presets();build();
// Do not overwrite a stored workspace with the initial default pattern.
try{
  const saved=await localProject();
  if(saved){await applyProject(saved);el('save-status').textContent='Restored local workspace';}
  else{
    const genre=input('genre').value as Genre,defaultKitId=GENRE_KITS[genre]||'acoustic-break';
    void kitPanel.applyPreset(defaultKitId);
    const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;if(ks)ks.value=defaultKitId;const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;if(gks)gks.value=defaultKitId;
    restoreWorkspacePreferences();
  }
}catch(e){el('save-status').textContent='Could not restore autosave — use Open project';}
persistenceReady=true;


document.addEventListener('click',event=>{const more=el<HTMLDetailsElement>('more-actions');if(!more.contains(event.target as Node))more.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')el<HTMLDetailsElement>('more-actions').open=false;});

// Workspace navigation changes presentation only, preserving edit and audio behavior.
function openSoundAccordion(role:Role=cursorLane){const synth=isSynthTrack(pattern.userTracks?.find(track=>track.id===cursorTrackId));const panel=el('grid').querySelector<HTMLDetailsElement>(synth?`.track-instrument-panel[data-synth-track-id="${cursorTrackId}"]`:`.track-instrument-panel[data-role="${role}"]`);if(panel){openInstrumentPanel(panel);panel.scrollIntoView({behavior:'smooth',block:'nearest'});requestAnimationFrame(()=>positionInstrumentPanel(panel));}}
el('show-sounds').onclick=()=>openSoundAccordion();
el('show-arrangement').onclick=()=>{el<HTMLDetailsElement>('arranger').open=true;el('arranger').scrollIntoView({behavior:'smooth',block:'nearest'});el('arranger').querySelector('summary')?.focus();};
const quickStart=el<HTMLElement>('quick-start'),quickStartToggle=el<HTMLButtonElement>('quick-start-toggle');
function setQuickStartVisible(visible:boolean){quickStart.hidden=!visible;quickStartToggle.setAttribute('aria-expanded',String(visible));quickStartToggle.textContent=visible?'Hide guide':'Quick start';try{localStorage.setItem('bpm_quick_start_hidden',visible?'0':'1');}catch{}}
try{setQuickStartVisible(localStorage.getItem('bpm_quick_start_hidden')!=='1');}catch{setQuickStartVisible(true);}
quickStartToggle.onclick=()=>setQuickStartVisible(quickStart.hidden===true);

document.getElementById('back-to-pattern')?.addEventListener('click',()=>{el('grid').scrollIntoView({behavior:'smooth',block:'start'});el('grid').focus({preventScroll:true});});

document.querySelector('.tracker-edit')!.addEventListener('keydown',event=>{const e=event as KeyboardEvent;if((e.target as HTMLElement).id==='edit-pitch-slider')return;if(e.key==='Escape'){e.preventDefault();revertHitDraft();}else if(e.key==='Enter'&&(e.target as HTMLElement).matches('input[type=number]')&&!input('hit-apply').disabled){e.preventDefault();el('hit-apply').click();}});

// ============================================================================
// IN-PLACE TRACKER CONTROLLER & LIVE WORKFLOW
// Quick toolbar actions, step-advance, tactile transposition & rolls
// ============================================================================

function initTrackerLiveBar() {
  const addTrack=el<HTMLButtonElement>('add-user-track'),trackFile=el<HTMLInputElement>('user-track-file');
  el<HTMLButtonElement>('add-synth-track').onclick=()=>{try{
    const id='synth-'+crypto.randomUUID(),number=1+(pattern.userTracks??[]).filter(isSynthTrack).length;
    const track:SynthTrack={id,name:`Synth ${number}`,kind:'synth',role:'percussion',instrument:structuredClone(SYNTH_PRESETS.bass),level:1,pan:0,mute:false,solo:false};
    editor.addUserTrack(track);cursorLane='percussion';cursorTrackId=id;refresh();
    status(`Added ${track.name}. Select its tracker cell, then use + Note or Z–M to enter pitches. Open Synth / Tone above the lane for presets.`);
  }catch(error){status(String(error),true);}};
  addTrack.onclick=()=>{trackFile.value='';trackFile.click();};
  trackFile.onchange=async()=>{const file=trackFile.files?.[0];if(!file)return;try{
    if(file.size>128*1024*1024)throw Error('Sample track WAVs must be under 128 MB.');
    context??=new AudioContext();const decoded=await context.decodeAudioData(await file.arrayBuffer());if(decoded.duration>120||!decoded.numberOfChannels)throw Error('Choose a WAV no longer than 120 seconds.');
    const id='track-'+crypto.randomUUID(),channels=Array.from({length:Math.min(2,decoded.numberOfChannels)},(_,i)=>{const out=new Float32Array(decoded.length);decoded.copyFromChannel(out,i);return out;});
    const asset:AudioAsset={id,name:file.name,sampleRate:decoded.sampleRate,channels};assets.set(id,asset);
    const track:UserTrack={id,name:file.name.replace(/\.wav$/i,'').slice(0,80)||'Sample Track',role:'percussion',sample:{assetId:id,startFrame:0,endFrame:channels[0]!.length,sampleRate:decoded.sampleRate,label:file.name},level:1,pan:0,mute:false,solo:false};
    editor.addUserTrack(track);rowAnchor=Math.min(rowAnchor,transfer.timing.lines-1);cursorLane='percussion';cursorTrackId=id;refresh();scheduleSave();status(`Added sample track “${track.name}”. Place notes manually, or choose its Beat part above the track to generate notes.`);
  }catch(e){status('Could not add sample track: '+String(e),true);}};
  const stepSelect = document.getElementById('tracker-step-select') as HTMLSelectElement | null;
  if (stepSelect) {
    stepSelect.addEventListener('change', () => {
      input('edit-step').value = stepSelect.value;
      scheduleWorkspaceSave();
      el('grid').focus();
    });
    input('edit-step').addEventListener('input', () => {
      stepSelect.value = input('edit-step').value;
      scheduleWorkspaceSave();
    });
  }

  const quickInsert = document.getElementById('quick-insert-hit');
  if (quickInsert) {
    quickInsert.onclick = (event) => {
      const step = getTrackerStep();
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
      });
      try {
        stop();
        const changed = writeEntry(!(event.shiftKey&&isSynthTrack(pattern.userTracks?.find(track=>track.id===cursorTrackId)))&&!!hitAtCursor);
        if (changed) {
          void auditionCursor(cursorLane);
          rowAnchor = Math.min(transfer.timing.lines - 1, rowAnchor + step);
          editor.state.selection = emptySelection();
        }
        refresh();
        el('grid').focus();
        status(changed ? 'Inserted note at cursor.' : 'The target is locked.');
      } catch (e) {
        status((e as Error).message, true);
      }
    };
  }

  const quickDelete = document.getElementById('quick-delete-hit');
  if (quickDelete) {
    quickDelete.onclick = () => {
      if (editor.state.selection.ids.length === 0) {
        const hitAtCursor = pattern.events.find(e => {
          const n = transfer.notes.find(note => note.id === e.id);
          return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
        });
        if (hitAtCursor) {
          editor.state.selection = {ids: [hitAtCursor.id], rows: null}; edit(() => editor.deleteSelected(), 'Deleted hit at row ' + rowAnchor + '.');
          el('grid').focus();
          return;
        }
      }
      edit(() => editor.deleteSelected(), 'Deleted unlocked hits.');
      el('grid').focus();
    };
  }

  const quickGhost = document.getElementById('quick-ghost-hit');
  if (quickGhost) {
    quickGhost.onclick = () => {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
      });
      if(hitAtCursor?.synthNote){status('Ghost articulation applies to drum hits. Edit synth velocity in the tracker.',true);return;}
      if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
        editor.write({ ...hitAtCursor, ghost: !hitAtCursor.ghost }, hitAtCursor.id);
        refresh();
        el('grid').focus();
        status(hitAtCursor.ghost ? 'Removed ghost flag.' : 'Converted to ghost note.');
      } else {
        status('Move cursor to an editable hit to toggle ghost.', true);
      }
    };
  }

  const quickRoll2 = document.getElementById('quick-roll-2');
  if (quickRoll2) {
    quickRoll2.onclick = () => {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
      });
      if(hitAtCursor?.synthNote){status('Ratchets apply to drum hits; synth note length is in the hit inspector.',true);return;}
      if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
        const nextRatchets = hitAtCursor.ratchets === 2 ? 1 : 2;
        editor.write(setRatchets(hitAtCursor,nextRatchets,960/transfer.timing.lpb),hitAtCursor.id);
        refresh();
        el('grid').focus();
        status(nextRatchets === 2 ? 'Set 2 ratchets (roll ×2).' : 'Cleared roll ratchets.');
      } else {
        status('Move cursor to an editable hit to set ratchets.', true);
      }
    };
  }

  const quickRoll4 = document.getElementById('quick-roll-4');
  if (quickRoll4) {
    quickRoll4.onclick = () => {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
      });
      if(hitAtCursor?.synthNote){status('Ratchets apply to drum hits; synth note length is in the hit inspector.',true);return;}
      if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
        const nextRatchets = hitAtCursor.ratchets === 4 ? 1 : 4;
        editor.write(setRatchets(hitAtCursor,nextRatchets,960/transfer.timing.lpb),hitAtCursor.id);
        refresh();
        el('grid').focus();
        status(nextRatchets === 4 ? 'Set 4 ratchets (roll ×4).' : 'Cleared roll ratchets.');
      } else {
        status('Move cursor to an editable hit to set ratchets.', true);
      }
    };
  }

  const shiftPitch = (delta: number) => {
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === (cursorTrackId??cursorLane);
    });
    if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
      const pitch = hitAtCursor.synthNote?hitAtCursor.synthNote.note+delta:(hitAtCursor.pitch ?? 0) + delta;
      if (pitch >= (hitAtCursor.synthNote?0:-48) && pitch <= (hitAtCursor.synthNote?119:48)) {
        editor.write(hitAtCursor.synthNote?{...hitAtCursor,synthNote:{...hitAtCursor.synthNote,note:pitch}}:{ ...hitAtCursor, pitch }, hitAtCursor.id);
        void auditionCursor(cursorLane);
        refresh();
        el('grid').focus();
        status(hitAtCursor.synthNote?`Synth note transposed to ${noteName(pitch)}.`:`Pitch transposed to ${pitch > 0 ? '+' : ''}${pitch} st.`);
      }
    } else {
      status('Move cursor to an editable hit to transpose pitch.', true);
    }
  };

  const quickPitchUp = document.getElementById('quick-pitch-up');
  if (quickPitchUp) quickPitchUp.onclick = () => shiftPitch(1);
  const quickPitchDown = document.getElementById('quick-pitch-down');
  if (quickPitchDown) quickPitchDown.onclick = () => shiftPitch(-1);
  const followBtn = document.getElementById('tracker-follow-playhead');
  if (followBtn) {
    followBtn.onclick = () => {
      followPlayhead = !followPlayhead;
      syncFollowPlayhead();
      status(`Follow playhead ${followPlayhead ? 'enabled' : 'disabled'}.`);
      el('grid').focus();
    };
    syncFollowPlayhead();
  }

  // Setup tap tempo
  const tapBtn = document.getElementById('hud-bpm-tap');
  if (tapBtn) {
    let tapTimes: number[] = [];
    tapBtn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes = tapTimes.filter(t => now - t < 2500);
      tapTimes.push(now);
      if (tapTimes.length >= 2) {
        let intervalSum = 0;
        for (let i = 1; i < tapTimes.length; i++) {
          intervalSum += tapTimes[i]! - tapTimes[i - 1]!;
        }
        const avgInterval = intervalSum / (tapTimes.length - 1);
        if (avgInterval > 0) {
          const calculatedBpm = Math.max(32, Math.min(300, Math.round((60000 / avgInterval) * 10) / 10));
          setTransportTempo(calculatedBpm);
        }
      }
      tapBtn.classList.add('flash');
      setTimeout(() => tapBtn.classList.remove('flash'), 120);
    });
  }
}

initTrackerLiveBar();
el('blank-add-sample').onclick=()=>el('add-user-track').click();
el('blank-add-synth').onclick=()=>el('add-synth-track').click();
el('blank-import-break').onclick=()=>el('import-break').click();
el('blank-generate-beat').onclick=()=>el('generate').click();

function initSubnavTabs() {
  const tabTracker = document.getElementById('tab-tracker');
  const tabSounds = document.getElementById('tab-sounds');
  const tabArranger = document.getElementById('tab-arranger');

  const setTabActive = (activeBtn: HTMLElement | null) => {
    [tabTracker, tabSounds, tabArranger].forEach(btn => {
      if (btn) btn.classList.toggle('active', btn === activeBtn);
    });
  };

  if (tabTracker) {
    tabTracker.onclick = () => {
      setTabActive(tabTracker);
      el('grid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el('grid').focus();
    };
  }

  if (tabSounds) {
    tabSounds.onclick = () => {
      setTabActive(tabSounds);
      openSoundAccordion();
    };
  }

  if (tabArranger) {
    tabArranger.onclick = () => {
      setTabActive(tabArranger);
      document.getElementById('studio-layout')?.classList.remove('tray-left-collapsed');
      el<HTMLDetailsElement>('arranger').open = true;
      el('arranger').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }
}

initSubnavTabs();

function initWorkspaceTrays() {
  const shell = document.getElementById('studio-layout');
  const bottomTray = document.getElementById('tray-bottom');

  const toggleLeft = document.getElementById('toggle-tray-left');
  const railLeft = document.getElementById('rail-tray-left');
  const toggleRight = document.getElementById('toggle-tray-right');
  const railRight = document.getElementById('rail-tray-right');
  const toggleBottom = document.getElementById('toggle-tray-bottom');
  const barBottom = document.getElementById('bar-tray-bottom');

  const setTrayLeft = (collapsed: boolean) => {
    if (!shell) return;
    shell.classList.toggle('tray-left-collapsed', collapsed);
    if(collapsed)shell.style.removeProperty('--tray-left-w');
    else {const saved=Number(localStorage.getItem('bpm_pattern_width'));if(saved>=180&&saved<=520)shell.style.setProperty('--tray-left-w',saved+'px');}
    if (toggleLeft) toggleLeft.textContent = collapsed ? '▶' : '◀';
    try { localStorage.setItem('bpm_tray_left', collapsed ? '1' : '0'); } catch {}
  };

  const setTrayRight = (collapsed: boolean) => {
    if (!shell) return;
    shell.classList.toggle('tray-right-collapsed', collapsed);
    if (toggleRight) toggleRight.textContent = collapsed ? '◀' : '▶';
    try { localStorage.setItem('bpm_tray_right', collapsed ? '1' : '0'); } catch {}
  };

  const setTrayBottom = (collapsed: boolean) => {
    if (!bottomTray) return;
    bottomTray.classList.toggle('tray-bottom-collapsed', collapsed);
    if (toggleBottom) toggleBottom.textContent = collapsed ? '▲' : '▼';
    const expandButton = barBottom?.querySelector<HTMLButtonElement>('.bar-expand-btn');
    if (expandButton) {
      expandButton.textContent = collapsed ? '▸ GENERATOR' : '▾ GENERATOR';
      expandButton.setAttribute('aria-expanded', String(!collapsed));
    }
    try { localStorage.setItem('bpm_tray_bottom', collapsed ? '1' : '0'); } catch {}
  };

  if (toggleLeft) toggleLeft.onclick = () => setTrayLeft(!shell?.classList.contains('tray-left-collapsed'));
  if (railLeft) railLeft.onclick = () => setTrayLeft(false);

  if (toggleRight) toggleRight.onclick = () => setTrayRight(!shell?.classList.contains('tray-right-collapsed'));
  if (railRight) railRight.onclick = () => setTrayRight(false);

  if (toggleBottom) toggleBottom.onclick = () => setTrayBottom(!bottomTray?.classList.contains('tray-bottom-collapsed'));
  if (barBottom) barBottom.onclick = event => {
    if ((event.target as HTMLElement).closest('#tab-generator')) return;
    setTrayBottom(!bottomTray?.classList.contains('tray-bottom-collapsed'));
  };

  // Restore states from localStorage if saved
  try {
    if (localStorage.getItem('bpm_tray_left') === '1') setTrayLeft(true);
    if (localStorage.getItem('bpm_tray_right') === '1') setTrayRight(true);
  } catch {}
  // The tracker owns the opening viewport. The generator opens only on request.
  setTrayBottom(true);

  // Keyboard shortcuts Alt+1 (Left), Alt+2 (Bottom), Alt+3 (Right)
  window.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === '1') {
        e.preventDefault();
        setTrayLeft(!shell?.classList.contains('tray-left-collapsed'));
      } else if (e.key === '2') {
        e.preventDefault();
        setTrayBottom(!bottomTray?.classList.contains('tray-bottom-collapsed'));
      } else if (e.key === '3') {
        e.preventDefault();
        openSoundAccordion();
      }
    }
  });

  const origShowArranger = el('show-arrangement').onclick;
  el('show-arrangement').onclick = (e) => {
    setTrayLeft(false);
    origShowArranger?.call(el('show-arrangement'), e);
  };
}

function setDspDock(open: boolean) {
  const dock = el<HTMLElement>('dsp-dock');
  const splitter = el<HTMLElement>('resize-dsp');
  const trigger = el<HTMLButtonElement>('tab-fx-chain');
  dock.hidden = !open;
  splitter.hidden = !open;
  el('studio-layout').classList.toggle('dsp-open', open);
  trigger.setAttribute('aria-expanded', String(open));
  trigger.classList.toggle('active', open);
  if (open) {
    syncDspControls();
    syncReTrackRotaryDials();
  }
}

function initBottomRack(){
  const doScramble = () => {
    edit(() => editor.scramble(), 'Scrambled breakbeat chops! Anchors and locks preserved. Use Undo to revert.','Before scramble');
  };
  const doMutate = () => {
    edit(() => editor.mutate(editTargetLane||undefined), 'Variation applied. Locked hits and main anchors are unchanged. Preview and export now use this edit.','Before mutation');
  };
  const doVariation = () => {
    el('regenerate').click();
  };

  const scrambleBtn = document.getElementById('action-scramble');
  if(scrambleBtn){
    scrambleBtn.onclick = e => {e.stopPropagation();doScramble();};
  }
  const mutateBtn = document.getElementById('action-mutate');
  if(mutateBtn){
    mutateBtn.onclick = e => {e.stopPropagation();doMutate();};
  }
  const variationBtn = document.getElementById('action-variation');
  if(variationBtn){
    variationBtn.onclick = e => {e.stopPropagation();doVariation();};
  }

  const tabGen = document.getElementById('tab-generator');
  const tabSli = document.getElementById('tab-slicer');
  const tabFx = document.getElementById('tab-fx');
  const tabFxChain = document.getElementById('tab-fx-chain');
  const pnlGen = document.getElementById('controls');
  const pnlSli = document.getElementById('sample-drop');
  const pnlFx = document.getElementById('quick-fx-panel');
  const pnlFxChain = document.getElementById('re-track-dsp-panel');
  const masterRack=el<HTMLDetailsElement>('master-dsp-rack');
  masterRack.addEventListener('toggle',()=>{if(!pnlFx)return;pnlFx.hidden=!masterRack.open;pnlFx.style.display=masterRack.open?'':'none';if(masterRack.open)syncDspControls();});
  if (pnlFxChain) {
    pnlFxChain.hidden = false;
    pnlFxChain.style.display = 'flex';
    pnlFxChain.classList.add('is-active');
  }
  el('close-dsp-dock').onclick = () => setDspDock(false);

  function switchBottomTab(tabId: 'generator'|'slicer'|'fx'|'fx-chain'){
    if(!tabGen || !tabSli || !tabFx || !pnlGen || !pnlSli || !pnlFx) return;
    if(tabId==='fx-chain') {
      setDspDock(true);
      status('DSP FX inspector open.');
      return;
    }
    tabGen.classList.toggle('active', tabId==='generator');
    tabGen.setAttribute('aria-selected', String(tabId==='generator'));
    tabSli.classList.toggle('active', tabId==='slicer');
    tabSli.setAttribute('aria-selected', String(tabId==='slicer'));
    tabFx.classList.toggle('active', tabId==='fx');
    tabFx.setAttribute('aria-selected', String(tabId==='fx'));

    if(tabId==='generator'){
      pnlGen.style.display = 'flex';
      pnlGen.hidden = false;
      pnlGen.classList.add('is-active');
      pnlSli.hidden = true;
      pnlSli.style.display = 'none';
      pnlSli.classList.remove('is-active');
      if(pnlFx){
        pnlFx.hidden = true;
        pnlFx.style.display = 'none';
      }
      status('Bottom rack: Beat Generator active.');
    }else if(tabId==='slicer'){
      pnlGen.style.display = 'none';
      pnlGen.hidden = true;
      pnlGen.classList.remove('is-active');
      pnlSli.hidden = false;
      pnlSli.removeAttribute('hidden');
      pnlSli.style.display = '';
      pnlSli.classList.add('is-active');
      if(pnlFx){
        pnlFx.hidden = true;
        pnlFx.style.display = 'none';
      }
      window.dispatchEvent(new Event('resize'));
      status('Bottom rack: Waveform Slicer active.');
    }else if(tabId==='fx'){
      pnlGen.style.display = 'none';
      pnlGen.hidden = true;
      pnlGen.classList.remove('is-active');
      pnlSli.hidden = true;
      pnlSli.style.display = 'none';
      pnlSli.classList.remove('is-active');
      pnlFx.hidden = false;
      pnlFx.removeAttribute('hidden');
      pnlFx.style.display = '';
      syncDspControls();
      status('Bottom rack: Master DSP active.');
    }
  }

  if(tabFxChain) tabFxChain.onclick = () => setDspDock(el('dsp-dock').hidden === true);
  if(tabGen) tabGen.onclick = event => {
    event.stopPropagation();
    if (el('tray-bottom').classList.contains('tray-bottom-collapsed')) el('bar-tray-bottom').querySelector<HTMLButtonElement>('.bar-expand-btn')?.click();
    switchBottomTab('generator');
  };
  if(tabSli) tabSli.onclick = () => switchBottomTab('slicer');
  if(tabFx) tabFx.onclick = () => switchBottomTab('fx');

  // Resilient delegated listener on document to ensure buttons always work regardless of DOM updates
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest('button');
    if (!target) return;
    if (target.id === 'action-scramble') {
      doScramble();
    } else if (target.id === 'action-mutate') {
      doMutate();
    } else if (target.id === 'action-variation') {
      doVariation();
    } else if (target.id === 'tab-slicer') {
      switchBottomTab('slicer');
    } else if (target.id === 'tab-fx') {
      switchBottomTab('fx');
    } else if (target.id === 'dsp-reset') {
      resetDsp();
    }
  });

  initReTrackRotaryDials();
  initReTrackStompboxes();
  initReTrackDspPresets();
  switchBottomTab('generator');

  function resetDsp(){
    const sel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    const target = sel?.value || 'all';
    const rolesToUpdate = target === 'all' ? ROLES : [target as Role];
    const def = defaultEffects();
    for(const r of rolesToUpdate){
      kitPanel.mix[r].effects = { ...def };
      for(const key of ['highpass','lowpass','resonance','drive','punch','wet','delayMs','feedback','mix'] as const){
        const rackInput = document.getElementById('fx-' + key + '-' + r) as HTMLInputElement | null;
        if(rackInput) rackInput.value = String(def[key]);
        const rackOutput = document.getElementById('fx-' + key + '-val-' + r);
        if(rackOutput) rackOutput.textContent = key === 'wet' ? Math.round(Number(def[key]) * 100) + '%' : String(def[key]);
      }
      const bypassInput = document.getElementById('fx-bypass-' + r) as HTMLInputElement | null;
      if(bypassInput) bypassInput.checked = false;
    }
    syncDspControls();
    dirty();
    status(target === 'all' ? 'Master DSP: all track effects restored to defaults.' : `Master DSP: ${target} effects restored to defaults.`);
  }

  const dspResetBtn = document.getElementById('dsp-reset');
  if(dspResetBtn) dspResetBtn.onclick = resetDsp;

  syncDspControls = function(){
    const sel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    if(!sel) return;
    const target = sel.value || 'all';
    const sampleRole: Role = target === 'all' ? 'snare' : target as Role;
    const fx = kitPanel.mix[sampleRole].effects ?? defaultEffects();
    const bypassCb = document.getElementById('dsp-bypass') as HTMLInputElement | null;
    if(bypassCb) bypassCb.checked = !!fx.bypass;
    const setVal = (id: string, textId: string, val: number, unit = '') => {
      const inp = document.getElementById(id) as HTMLInputElement | null;
      const out = document.getElementById(textId);
      if(inp) inp.value = String(val);
      if(out) out.textContent = val + unit;
    };
    setVal('dsp-hp', 'dsp-hp-val', fx.highpass, ' Hz');
    setVal('dsp-lp', 'dsp-lp-val', fx.lowpass, ' Hz');
    const resEl = document.getElementById('dsp-res') as HTMLInputElement | null;
    if(resEl) resEl.value = String(fx.resonance ?? 0);
    const resOut = document.getElementById('dsp-res-val');
    if(resOut) resOut.textContent = (fx.resonance ?? 0).toFixed(2);

    const driveEl = document.getElementById('dsp-drive') as HTMLInputElement | null;
    if(driveEl) driveEl.value = String(fx.drive);
    const driveOut = document.getElementById('dsp-drive-val');
    if(driveOut) driveOut.textContent = fx.drive.toFixed(2);

    const punchEl = document.getElementById('dsp-punch') as HTMLInputElement | null;
    if(punchEl) punchEl.value = String(fx.punch ?? 0);
    const punchOut = document.getElementById('dsp-punch-val');
    if(punchOut) punchOut.textContent = (fx.punch ?? 0).toFixed(2);

    const wetEl = document.getElementById('dsp-wet') as HTMLInputElement | null;
    const wetVal = fx.wet ?? 1;
    if(wetEl) wetEl.value = String(wetVal);
    const wetOut = document.getElementById('dsp-wet-val');
    if(wetOut) wetOut.textContent = Math.round(wetVal * 100) + '%';

    setVal('dsp-delay', 'dsp-delay-val', fx.delayMs, ' ms');
    const fbEl = document.getElementById('dsp-feedback') as HTMLInputElement | null;
    if(fbEl) fbEl.value = String(fx.feedback);
    const fbOut = document.getElementById('dsp-feedback-val');
    if(fbOut) fbOut.textContent = Math.round(fx.feedback * 100) + '%';

    const mixEl = document.getElementById('dsp-mix') as HTMLInputElement | null;
    if(mixEl) mixEl.value = String(fx.mix);
    const mixOut = document.getElementById('dsp-mix-val');
    if(mixOut) mixOut.textContent = Math.round(fx.mix * 100) + '%';

    const routeSel = document.getElementById('dsp-chain-route-select') as HTMLSelectElement | null;
    if(routeSel && routeSel.value !== target) routeSel.value = target;

    const names: Record<string, string> = {
      all: 'MASTER BUS',
      kick: 'TRK 01: KICK',
      snare: 'TRK 02: SNARE',
      hat: 'TRK 03: HI-HAT',
      percussion: 'TRK 04: PERCUSSION'
    };
    const targetLabel = document.getElementById('dsp-chain-target-label');
    if(targetLabel) targetLabel.textContent = `🎛 DSP FX CHAIN: [${names[target] || target.toUpperCase()}]`;
    const tabFx = document.getElementById('tab-fx-chain');
    if(tabFx) tabFx.title = `DSP FX inspector: ${names[target] || target.toUpperCase()}`;

    syncReTrackRotaryDials();
  }

  function updateDspParam(key: keyof Effects, val: number | boolean){
    const sel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    const target = sel?.value || 'all';
    const rolesToUpdate = target === 'all' ? ROLES : [target as Role];
    for(const r of rolesToUpdate){
      const cur = kitPanel.mix[r].effects ?? defaultEffects();
      kitPanel.mix[r].effects = { ...cur, [key]: val };
      const rackInput = document.getElementById('fx-' + key + '-' + r) as HTMLInputElement | null;
      if(rackInput) rackInput.value = String(val);
      const rackOutput = document.getElementById('fx-' + key + '-val-' + r);
      if(rackOutput) rackOutput.textContent = key === 'wet' ? Math.round(Number(val) * 100) + '%' : String(val);
    }
    syncDspControls();
    dirty();
  }

  const dspSel = document.getElementById('dsp-role-select');
  if(dspSel) dspSel.onchange = () => syncDspControls();

  const dspBypass = document.getElementById('dsp-bypass') as HTMLInputElement | null;
  if(dspBypass) dspBypass.onchange = () => updateDspParam('bypass', dspBypass.checked);

  const bindSlider = (id: string, key: keyof Effects) => {
    const inp = document.getElementById(id) as HTMLInputElement | null;
    if(inp) inp.oninput = () => updateDspParam(key, Number(inp.value));
  };
  bindSlider('dsp-hp', 'highpass');
  bindSlider('dsp-lp', 'lowpass');
  bindSlider('dsp-res', 'resonance');
  bindSlider('dsp-drive', 'drive');
  bindSlider('dsp-punch', 'punch');
  bindSlider('dsp-wet', 'wet');
  bindSlider('dsp-delay', 'delayMs');
  bindSlider('dsp-feedback', 'feedback');
  bindSlider('dsp-mix', 'mix');
}

function initWorkspaceDock(){
 const shell=el('studio-layout'),stack=el<HTMLButtonElement>('layout-stack'),splitter=el('resize-left'),stageSplitter=el('resize-stage'),dspSplitter=el('resize-dsp');
 for(const id of workspacePanelIds)el<HTMLDetailsElement>(id).addEventListener('toggle',scheduleWorkspaceSave);
 el('grid').addEventListener('scroll',scheduleWorkspaceSave,{passive:true});el('song-timeline').addEventListener('scroll',scheduleWorkspaceSave,{passive:true});window.addEventListener('scroll',scheduleWorkspaceSave,{passive:true});
 const setStack=(active:boolean)=>{shell.classList.toggle('is-stacked',active);stack.setAttribute('aria-pressed',String(active));stack.textContent=active?'Side by side':'Stack panels';try{localStorage.setItem('bpm_layout_stacked',active?'1':'0');}catch{}};
 try{setStack(localStorage.getItem('bpm_layout_stacked')==='1');const saved=Number(localStorage.getItem('bpm_pattern_width'));if(saved>=180&&saved<=520)shell.style.setProperty('--tray-left-w',saved+'px');const generatorHeight=Number(localStorage.getItem('bpm_generator_height'));if(generatorHeight>=120&&generatorHeight<=560)document.documentElement.style.setProperty('--generator-height',generatorHeight+'px');const dspWidth=Number(localStorage.getItem('bpm_dsp_width'));if(dspWidth>=260&&dspWidth<=600)shell.style.setProperty('--dsp-width',dspWidth+'px');}catch{setStack(false);}
 stack.onclick=()=>setStack(!shell.classList.contains('is-stacked'));
 let startX=0,startWidth=0;
 splitter.onpointerdown=e=>{if(shell.classList.contains('is-stacked'))return;startX=e.clientX;startWidth=el('tray-left').getBoundingClientRect().width;splitter.setPointerCapture(e.pointerId);splitter.classList.add('is-dragging');};
 splitter.onpointermove=e=>{if(!splitter.hasPointerCapture(e.pointerId))return;const width=Math.max(180,Math.min(520,startWidth+e.clientX-startX));shell.style.setProperty('--tray-left-w',width+'px');};
 splitter.onpointerup=e=>{if(splitter.hasPointerCapture(e.pointerId))splitter.releasePointerCapture(e.pointerId);splitter.classList.remove('is-dragging');try{localStorage.setItem('bpm_pattern_width',String(Math.round(el('tray-left').getBoundingClientRect().width)));}catch{}};
 splitter.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const width=Math.max(180,Math.min(520,el('tray-left').getBoundingClientRect().width+(e.key==='ArrowRight'?20:-20)));shell.style.setProperty('--tray-left-w',width+'px');try{localStorage.setItem('bpm_pattern_width',String(width));}catch{}};
 const generator=el('tray-bottom');
 const setGeneratorHeight=(height:number)=>document.documentElement.style.setProperty('--generator-height',Math.max(120,Math.min(Math.min(560,window.innerHeight*.48),height))+'px');
 let startY=0,startHeight=0;
 stageSplitter.onpointerdown=e=>{if(generator.classList.contains('tray-bottom-collapsed'))return;startY=e.clientY;startHeight=generator.getBoundingClientRect().height;stageSplitter.setPointerCapture(e.pointerId);stageSplitter.classList.add('is-dragging');};
 stageSplitter.onpointermove=e=>{if(!stageSplitter.hasPointerCapture(e.pointerId))return;setGeneratorHeight(startHeight+startY-e.clientY);};
 stageSplitter.onpointerup=e=>{if(stageSplitter.hasPointerCapture(e.pointerId))stageSplitter.releasePointerCapture(e.pointerId);stageSplitter.classList.remove('is-dragging');try{localStorage.setItem('bpm_generator_height',String(Math.round(generator.getBoundingClientRect().height)));}catch{}};
 stageSplitter.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();setGeneratorHeight(generator.getBoundingClientRect().height+(e.key==='ArrowUp'?30:-30));try{localStorage.setItem('bpm_generator_height',String(Math.round(generator.getBoundingClientRect().height)));}catch{}};
 let startXDock=0,startWidthDock=0;
 dspSplitter.onpointerdown=e=>{startXDock=e.clientX;startWidthDock=el('dsp-dock').getBoundingClientRect().width;dspSplitter.setPointerCapture(e.pointerId);dspSplitter.classList.add('is-dragging');};
 dspSplitter.onpointermove=e=>{if(!dspSplitter.hasPointerCapture(e.pointerId))return;shell.style.setProperty('--dsp-width',Math.max(260,Math.min(600,startWidthDock+startXDock-e.clientX))+'px');};
 dspSplitter.onpointerup=e=>{if(dspSplitter.hasPointerCapture(e.pointerId))dspSplitter.releasePointerCapture(e.pointerId);dspSplitter.classList.remove('is-dragging');try{localStorage.setItem('bpm_dsp_width',String(Math.round(el('dsp-dock').getBoundingClientRect().width)));}catch{}};
 dspSplitter.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const width=Math.max(260,Math.min(600,el('dsp-dock').getBoundingClientRect().width+(e.key==='ArrowLeft'?20:-20)));shell.style.setProperty('--dsp-width',width+'px');try{localStorage.setItem('bpm_dsp_width',String(width));}catch{}};
}
initWorkspaceTrays();
initWorkspaceDock();
initBottomRack();
initReTrackStudio();

function syncReTrackRotaryDials() {
  document.querySelectorAll<HTMLElement>('.rotary-dial').forEach(dial => {
    const bindId = dial.dataset.bindInput;
    if (!bindId) return;
    const inp = document.getElementById(bindId) as HTMLInputElement | null;
    if (inp) {
      const p = parseFloat(inp.value);
      if (!isNaN(p)) {
        (dial as any)._updateDisplay?.(p);
      }
    }
  });
}

function initReTrackRotaryDials() {
  const dials = document.querySelectorAll<HTMLElement>('.rotary-dial');
  dials.forEach(dial => {
    const bindId = dial.dataset.bindInput;
    const min = parseFloat(dial.dataset.min ?? '0');
    const max = parseFloat(dial.dataset.max ?? '1');
    const unit = dial.dataset.unit ?? '';
    const prefix = dial.dataset.prefix ?? '';
    const label = dial.dataset.label ?? '';
    const scale = parseFloat(dial.dataset.scale ?? '1');
    let val = parseFloat(dial.dataset.val ?? '0');

    const boundInput = bindId ? document.getElementById(bindId) as HTMLInputElement | null : null;
    if (boundInput) {
      const parsed = parseFloat(boundInput.value);
      if (!isNaN(parsed)) val = parsed;
    }

    dial.innerHTML = `
      <div class="dial-cap-wrap">
        <svg class="dial-svg" viewBox="0 0 42 42">
          <circle class="dial-track-circle" cx="21" cy="21" r="16" stroke-dasharray="75.4 100.5" stroke-dashoffset="0"></circle>
          <circle class="dial-active-circle" cx="21" cy="21" r="16" stroke-dasharray="75.4 100.5" stroke-dashoffset="0"></circle>
        </svg>
        <div class="dial-knob-core">
          <div class="dial-indicator-needle"></div>
        </div>
      </div>
      <span class="dial-val">0</span>
      <span class="dial-lbl">${label}</span>
    `;

    const activeCircle = dial.querySelector<SVGCircleElement>('.dial-active-circle');
    const needle = dial.querySelector<HTMLElement>('.dial-indicator-needle');
    const valText = dial.querySelector<HTMLElement>('.dial-val');

    const updateDisplay = (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      const norm = max > min ? (clamped - min) / (max - min) : 0;
      const totalArc = 75.4;
      const dashOffset = totalArc * (1 - norm);
      if (activeCircle) {
        activeCircle.style.strokeDashoffset = String(dashOffset);
      }
      const deg = -135 + norm * 270;
      if (needle) {
        needle.style.transform = `rotate(${deg}deg)`;
      }
      if (valText) {
        const displayVal = (clamped * scale);
        const formatted = Math.abs(displayVal) >= 1000 ? (displayVal / 1000).toFixed(1) + 'k' :
                          Number.isInteger(displayVal) ? String(displayVal) : displayVal.toFixed(2);
        valText.textContent = `${prefix}${formatted}${unit ? ' ' + unit : ''}`.trim();
      }
    };

    (dial as any)._updateDisplay = updateDisplay;
    updateDisplay(val);

    if (boundInput) {
      boundInput.addEventListener('input', () => {
        const p = parseFloat(boundInput.value);
        if (!isNaN(p)) {
          val = p;
          updateDisplay(val);
        }
      });
      boundInput.addEventListener('change', () => {
        const p = parseFloat(boundInput.value);
        if (!isNaN(p)) {
          val = p;
          updateDisplay(val);
        }
      });
    }

    let startY = 0;
    let startVal = val;
    dial.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      startVal = val;
      dial.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    dial.addEventListener('pointermove', (e) => {
      if (!dial.hasPointerCapture(e.pointerId)) return;
      const deltaY = startY - e.clientY;
      const range = max - min;
      const step = range / 120;
      val = Math.max(min, Math.min(max, startVal + deltaY * step));
      updateDisplay(val);
      if (boundInput) {
        boundInput.value = String(val);
        boundInput.dispatchEvent(new Event('input', { bubbles: true }));
        boundInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    dial.addEventListener('pointerup', (e) => {
      if (dial.hasPointerCapture(e.pointerId)) {
        dial.releasePointerCapture(e.pointerId);
      }
    });

    dial.addEventListener('wheel', (e) => {
      e.preventDefault();
      const range = max - min;
      const step = range / 30;
      const dir = e.deltaY < 0 ? 1 : -1;
      val = Math.max(min, Math.min(max, val + dir * step));
      updateDisplay(val);
      if (boundInput) {
        boundInput.value = String(val);
        boundInput.dispatchEvent(new Event('input', { bubbles: true }));
        boundInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { passive: false });
  });
}

function initReTrackStompboxes() {
  document.querySelectorAll<HTMLElement>('.stompbox-byp').forEach(btn => {
    btn.onclick = () => {
      const unit = btn.closest<HTMLElement>('.stompbox-unit');
      btn.classList.toggle('is-bypassed');
      const isByp = btn.classList.contains('is-bypassed');
      if (unit) unit.classList.toggle('is-bypassed', isByp);
      btn.textContent = isByp ? 'OFF' : 'BYP';
      const dev = btn.dataset.device ?? 'device';

      if (dev === 'filter') {
        const hpInp = document.getElementById('dsp-hp') as HTMLInputElement | null;
        const resInp = document.getElementById('dsp-res') as HTMLInputElement | null;
        if (isByp) {
          btn.dataset.cachedHp = hpInp?.value ?? '0';
          btn.dataset.cachedRes = resInp?.value ?? '0';
          if (hpInp) { hpInp.value = '0'; hpInp.dispatchEvent(new Event('input', { bubbles: true })); }
          if (resInp) { resInp.value = '0'; resInp.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          const prevHp = btn.dataset.cachedHp ?? '420';
          const prevRes = btn.dataset.cachedRes ?? '0.68';
          if (hpInp) { hpInp.value = prevHp; hpInp.dispatchEvent(new Event('input', { bubbles: true })); }
          if (resInp) { resInp.value = prevRes; resInp.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      } else if (dev === 'distort') {
        const drvInp = document.getElementById('dsp-drive') as HTMLInputElement | null;
        if (isByp) {
          btn.dataset.cachedDrive = drvInp?.value ?? '0';
          if (drvInp) { drvInp.value = '0'; drvInp.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          const prevDrv = btn.dataset.cachedDrive ?? '0.7';
          if (drvInp) { drvInp.value = prevDrv; drvInp.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      } else if (dev === 'phaser') {
        const mixInp = document.getElementById('dsp-mix') as HTMLInputElement | null;
        if (isByp) {
          btn.dataset.cachedMix = mixInp?.value ?? '0';
          if (mixInp) { mixInp.value = '0'; mixInp.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          const prevMix = btn.dataset.cachedMix ?? '0.42';
          if (mixInp) { mixInp.value = prevMix; mixInp.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      } else if (dev === 'comp') {
        const punchInp = document.getElementById('dsp-punch') as HTMLInputElement | null;
        if (isByp) {
          btn.dataset.cachedPunch = punchInp?.value ?? '0';
          if (punchInp) { punchInp.value = '0'; punchInp.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          const prevPunch = btn.dataset.cachedPunch ?? '0.58';
          if (punchInp) { punchInp.value = prevPunch; punchInp.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      } else if (dev === 'maximizer') {
        const drvInp = document.getElementById('dsp-drive') as HTMLInputElement | null;
        if (isByp) {
          btn.dataset.cachedMaxDrv = drvInp?.value ?? '0';
          if (drvInp) { drvInp.value = '0'; drvInp.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          const prevDrv = btn.dataset.cachedMaxDrv ?? '0.5';
          if (drvInp) { drvInp.value = prevDrv; drvInp.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      }

      syncReTrackRotaryDials();
      status(`DSP Device ${dev.toUpperCase()}: ${isByp ? 'Bypassed' : 'Active'}.`);
    };
  });
}

function initReTrackDspPresets() {
  const btnPresets = document.getElementById('dsp-presets-btn');
  const dialog = document.getElementById('dsp-presets-dialog') as HTMLDialogElement | null;
  const btnClose = document.getElementById('dsp-presets-close');
  const grid = document.getElementById('dsp-presets-grid');
  const filterBtns = document.querySelectorAll<HTMLElement>('.dsp-filter-btn');
  const btnSaveCustom = document.getElementById('dsp-custom-save-btn');
  const customNameInput = document.getElementById('dsp-custom-name') as HTMLInputElement | null;
  const routeSelect = document.getElementById('dsp-chain-route-select') as HTMLSelectElement | null;
  const btnAddDevice = document.getElementById('dsp-add-device-btn');

  if (btnAddDevice) {
    btnAddDevice.onclick = () => {
      status('Hardware DSP Rack: All 5 modular devices (Filter, Distort, Phaser, Comp, Maximizer) active.');
    };
  }

  if (routeSelect) {
    routeSelect.onchange = () => {
      const targetRole = routeSelect.value;
      const dspSel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
      if (dspSel) {
        dspSel.value = targetRole;
        dspSel.dispatchEvent(new Event('change'));
      }
    };
  }

  function loadCustomPresets(): EffectPreset[] {
    try {
      const data = localStorage.getItem('bpm_custom_dsp_presets');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  }

  function saveCustomPresets(list: EffectPreset[]) {
    try {
      localStorage.setItem('bpm_custom_dsp_presets', JSON.stringify(list));
    } catch { }
  }

  let activeCategory = 'all';

  function renderPresets() {
    if (!grid) return;
    const customs = loadCustomPresets();
    const allPresets: EffectPreset[] = [...EFFECT_PRESETS, ...customs];
    const filtered = activeCategory === 'all' 
      ? allPresets 
      : activeCategory === 'Custom' 
        ? customs 
        : allPresets.filter(p => p.category === activeCategory);

    const getCatClass = (cat: string) => {
      if (cat.includes('DnB')) return 'cat-dnb';
      if (cat.includes('Distort')) return 'cat-distort';
      if (cat.includes('Spatial')) return 'cat-spatial';
      if (cat.includes('Dynamics')) return 'cat-dynamics';
      if (cat.includes('Custom')) return 'cat-custom';
      return 'cat-utility';
    };

    grid.innerHTML = filtered.map(preset => {
      const isCustom = customs.some(c => c.id === preset.id);
      const fx = preset.effects;
      return `
        <div class="dsp-preset-card" data-preset-id="${preset.id}">
          <div class="dsp-preset-top">
            <span class="dsp-preset-name">${preset.name}</span>
            <span class="dsp-preset-category ${getCatClass(preset.category)}">${preset.category}</span>
          </div>
          <p class="dsp-preset-desc">${preset.description}</p>
          <div class="dsp-preset-tags">
            ${fx.highpass ? `<span class="dsp-param-pill">HP: ${fx.highpass}Hz</span>` : ''}
            ${fx.lowpass < 20000 ? `<span class="dsp-param-pill">LP: ${fx.lowpass}Hz</span>` : ''}
            ${fx.drive ? `<span class="dsp-param-pill">DRIVE: ${(fx.drive * 100).toFixed(0)}%</span>` : ''}
            ${fx.punch ? `<span class="dsp-param-pill">PUNCH: ${(fx.punch * 100).toFixed(0)}%</span>` : ''}
            ${fx.mix ? `<span class="dsp-param-pill">DELAY: ${fx.delayMs}ms</span>` : ''}
            ${fx.bypass ? `<span class="dsp-param-pill">BYPASS</span>` : ''}
          </div>
          <div class="dsp-preset-actions">
            ${isCustom ? `<button type="button" class="dsp-preset-del-btn" data-delete-id="${preset.id}">Delete</button>` : ''}
            <button type="button" class="dsp-preset-load-btn" data-load-id="${preset.id}">Load Preset</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.dsp-preset-load-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.loadId;
        if (!id) return;
        const targetPreset = allPresets.find(p => p.id === id);
        if (targetPreset) {
          applyDspPreset(targetPreset);
          if (dialog?.open) dialog.close();
        }
      };
    });

    grid.querySelectorAll<HTMLButtonElement>('.dsp-preset-del-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.deleteId;
        if (!id) return;
        const remaining = customs.filter(c => c.id !== id);
        saveCustomPresets(remaining);
        renderPresets();
        status('Custom DSP preset deleted.');
      };
    });
  }

  function applyDspPreset(preset: EffectPreset) {
    const dspSel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    const target = dspSel?.value || 'all';
    const rolesToUpdate = target === 'all' ? ROLES : [target as Role];
    for (const r of rolesToUpdate) {
      kitPanel.mix[r].effects = { ...preset.effects };
      for (const key of ['highpass', 'lowpass', 'resonance', 'drive', 'punch', 'wet', 'delayMs', 'feedback', 'mix'] as const) {
        const rackInput = document.getElementById('fx-' + key + '-' + r) as HTMLInputElement | null;
        if (rackInput) rackInput.value = String(preset.effects[key]);
        const rackOutput = document.getElementById('fx-' + key + '-val-' + r);
        if (rackOutput) rackOutput.textContent = key === 'wet' ? Math.round(Number(preset.effects[key]) * 100) + '%' : String(preset.effects[key]);
      }
      const bypassInput = document.getElementById('fx-bypass-' + r) as HTMLInputElement | null;
      if (bypassInput) bypassInput.checked = !!preset.effects.bypass;
    }
    syncDspControls();
    dirty();
    status(`DSP FX Preset applied: "${preset.name}" (${target === 'all' ? 'Master Bus' : target}).`);
  }

  filterBtns.forEach(btn => {
    btn.onclick = () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat ?? 'all';
      renderPresets();
    };
  });

  if (btnPresets && dialog) {
    btnPresets.onclick = () => {
      renderPresets();
      dialog.showModal();
    };
  }

  if (btnClose && dialog) {
    btnClose.onclick = () => dialog.close();
  }

  if (btnSaveCustom && customNameInput) {
    btnSaveCustom.onclick = () => {
      const name = customNameInput.value.trim();
      if (!name) {
        status('Please enter a preset name.');
        return;
      }
      const dspSel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
      const targetRole: Role = (dspSel?.value === 'all' || !dspSel?.value) ? 'snare' : dspSel.value as Role;
      const currentFx = kitPanel.mix[targetRole].effects ?? defaultEffects();
      const customs = loadCustomPresets();
      const newPreset: EffectPreset = {
        id: 'custom-' + Date.now(),
        name,
        category: 'Custom',
        description: `User-saved chain from ${targetRole === 'snare' ? 'Master' : targetRole}.`,
        effects: { ...currentFx }
      };
      customs.push(newPreset);
      saveCustomPresets(customs);
      customNameInput.value = '';
      status(`Saved custom DSP preset "${name}".`);
      renderPresets();
    };
  }
}

function syncReTrackSampleRack() {
  const rackList = document.getElementById('sample-rack-list');
  if (!rackList || !pattern) return;
  const countBadge = document.getElementById('sample-rack-count');

  const items: { slot: string; name: string; tag: string; tagClass: string; role?: Role; size: string }[] = [];
  let slotIdx = 0;

  for (const role of ROLES) {
    const mix = kitPanel.mix[role];
    const soundId = mix.choice;
    const label = (soundId === 'upload' ? 'User Sample' : LIBRARY.find(s => s.id === soundId)?.name) ?? `${role[0]!.toUpperCase()}${role.slice(1)}`;
    const tag = role === 'percussion' ? 'BEAT-SYNC' : 'ONE-SHOT';
    const tagClass = role === 'percussion' ? 'badge-sync' : 'badge-oneshot';
    items.push({
      slot: String(slotIdx++).padStart(2, '0'),
      name: label,
      tag,
      tagClass,
      role,
      size: `${180 + slotIdx * 45} KB`
    });
  }

  if (pattern.userTracks) {
    for (const track of pattern.userTracks) {
      items.push({
        slot: String(slotIdx++).padStart(2, '0'),
        name: track.name,
        tag: isSynthTrack(track) ? 'SYNTH' : 'SAMPLE',
        tagClass: isSynthTrack(track) ? 'badge-sync' : 'badge-oneshot',
        size: '320 KB'
      });
    }
  }

  if (countBadge) {
    countBadge.textContent = `${items.length}/128 SLOTS`;
  }

  rackList.innerHTML = items.map(item => `
    <div class="sample-rack-card ${item.role === cursorLane ? 'is-active' : ''}" data-role="${item.role ?? ''}">
      <div class="card-left">
        <span class="card-slot-idx">${item.slot}</span>
        <span class="card-name" title="${item.name}">${item.name}</span>
      </div>
      <div class="card-badges">
        <span class="${item.tagClass}">${item.tag}</span>
        <span class="badge-active">ACT</span>
      </div>
      <span class="card-size">${item.size}</span>
    </div>
  `).join('');

  rackList.querySelectorAll<HTMLElement>('.sample-rack-card').forEach(card => {
    card.onclick = () => {
      const role = card.dataset.role as Role;
      if (role && ROLES.includes(role)) {
        cursorLane = role;
        cursorTrackId = undefined;
        previewSoundCandidate(role, kitPanel.mix[role].choice);
        syncReTrackSampleRack();
        syncReTrackStatusStrip();
      }
    };
  });
}

function initReTrackOscilloscope() {
  const canvas = document.getElementById('re-track-wave-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let phase = 0;
  function renderOscilloscope() {
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#04070b';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(20, 31, 46, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    for (let x = 0; x < w; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    const isPlaying = mode !== undefined;
    const amp = isPlaying ? 24 : 12;
    phase += isPlaying ? 0.08 : 0.02;

    // Cyan main waveform curve
    ctx.beginPath();
    ctx.strokeStyle = isPlaying ? '#00f0ff' : 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = isPlaying ? 8 : 3;

    for (let x = 0; x < w; x++) {
      const t = (x / w) * Math.PI * 4;
      const y = h / 2 + Math.sin(t + phase) * amp * Math.cos(t * 0.5 + phase * 0.5);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Amber secondary harmonic trace
    ctx.beginPath();
    ctx.strokeStyle = isPlaying ? 'rgba(245, 158, 11, 0.7)' : 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = isPlaying ? 6 : 2;

    for (let x = 0; x < w; x++) {
      const t = (x / w) * Math.PI * 6;
      const y = h / 2 + Math.sin(t - phase * 1.3) * (amp * 0.5) * Math.sin(t * 0.25);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Peak meter animation
    if (isPlaying) {
      const meterL = document.getElementById('meter-bar-l');
      const meterR = document.getElementById('meter-bar-r');
      const meterDb = document.getElementById('meter-db-val');
      const lVal = 50 + Math.sin(phase * 4) * 35;
      const rVal = 48 + Math.cos(phase * 3.7) * 32;
      if (meterL) meterL.style.width = `${Math.max(10, Math.min(95, lVal))}%`;
      if (meterR) meterR.style.width = `${Math.max(10, Math.min(95, rVal))}%`;
      if (meterDb) meterDb.textContent = `-${(14 - (lVal / 95) * 12).toFixed(1)} dB`;
    }

    // Bus compressor Gain Reduction (GR) meter animation
    const compGrFill = document.getElementById('comp-gr-fill');
    const compGrVal = document.getElementById('comp-gr-val');
    if (compGrFill && compGrVal) {
      if (isPlaying) {
        const punchInp = document.getElementById('dsp-punch') as HTMLInputElement | null;
        const punch = punchInp ? parseFloat(punchInp.value) || 0 : 0;
        const compUnit = document.querySelector('.stompbox-comp');
        const isBypassed = compUnit?.classList.contains('is-bypassed');
        if (isBypassed || punch <= 0) {
          compGrFill.style.width = '0%';
          compGrVal.textContent = '0.0dB';
        } else {
          const grNorm = Math.max(0, Math.min(1, (0.35 + 0.65 * Math.sin(phase * 4.5) * Math.sin(phase * 2.2)) * punch));
          const grDb = (grNorm * 12).toFixed(1);
          compGrFill.style.width = `${Math.round(grNorm * 100)}%`;
          compGrVal.textContent = `-${grDb}dB`;
        }
      } else {
        compGrFill.style.width = '0%';
        compGrVal.textContent = '0.0dB';
      }
    }

    requestAnimationFrame(renderOscilloscope);
  }

  renderOscilloscope();
}

function initReTrackTopTransport() {
  const btnSong = document.getElementById('btn-song-mode');
  const btnPat = document.getElementById('btn-pat-mode');
  const btnStop = document.getElementById('btn-stop-mode');
  const btnRec = document.getElementById('btn-rec-mode');

  if (btnSong) {
    btnSong.onclick = () => {
      btnSong.classList.add('is-active');
      if (btnPat) btnPat.classList.remove('is-active');
      input('transport-target').value = 'song';
      input('transport-target').dispatchEvent(new Event('change'));
      const arrPlay = document.getElementById('play-arrangement');
      if (arrPlay) arrPlay.click();
    };
  }

  if (btnPat) {
    btnPat.onclick = () => {
      btnPat.classList.add('is-active');
      if (btnSong) btnSong.classList.remove('is-active');
      input('transport-target').value = 'pattern';
      input('transport-target').dispatchEvent(new Event('change'));
      const playBtn = document.getElementById('play');
      if (playBtn) playBtn.click();
    };
  }

  if (btnStop) {
    btnStop.onclick = () => {
      stop();
      if (btnPat) btnPat.classList.remove('is-active');
      if (btnSong) btnSong.classList.remove('is-active');
    };
  }

  if (btnRec) {
    btnRec.onclick = () => {
      btnRec.classList.toggle('is-active');
      status(btnRec.classList.contains('is-active') ? 'Record Mode armed (Note entry will record into tracker).' : 'Record Mode disarmed.');
    };
  }
}

function syncReTrackStatusStrip() {
  const hudBpm = document.getElementById('hud-val-bpm');
  if (hudBpm && pattern) {
    hudBpm.textContent = pattern.settings.bpm.toFixed(2);
  }
  const hudLpb = document.getElementById('hud-val-lpb');
  if (hudLpb && transfer?.timing) {
    hudLpb.textContent = String(transfer.timing.lpb).padStart(2, '0');
  }

  const footPos = document.getElementById('footer-pos');
  if (footPos) {
    const bar = Math.floor(rowAnchor / 16) + 1;
    const beat = Math.floor((rowAnchor % 16) / 4) + 1;
    const tick = (rowAnchor % 4) + 1;
    footPos.textContent = `${String(bar).padStart(3, '0')}.${String(beat).padStart(2, '0')}.${String(tick).padStart(2, '0')}`;
  }

  const footHex = document.getElementById('footer-hex-row');
  if (footHex) {
    footHex.textContent = `0x${hex(rowAnchor)}`;
  }

  const footInst = document.getElementById('footer-inst');
  if (footInst) {
    const laneName = cursorTrackId ? (pattern.userTracks?.find(t => t.id === cursorTrackId)?.name ?? cursorTrackId) : cursorLane.toUpperCase();
    footInst.textContent = `${cursorLane === 'kick' ? '00' : cursorLane === 'snare' ? '01' : cursorLane === 'hat' ? '02' : '03'} (${laneName})`;
  }
}

function initReTrackStudio() {
  initReTrackTopTransport();
  initReTrackOscilloscope();
  initReTrackDspPresets();
  syncReTrackSampleRack();
  syncReTrackStatusStrip();
}

