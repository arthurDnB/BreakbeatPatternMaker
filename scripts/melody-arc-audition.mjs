import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {generateLegacyMelody} from '../dist/core/melody.js';
import {patternTicks} from '../dist/core/meter.js';
import {renderPerformance} from '../dist/audio/performance.js';
import {encodeWav} from '../dist/audio/wav.js';
import {
 DECISION_RULE_TEXT,
 GRID_TICKS,
 METRIC_DEFINITIONS,
 METRIC_IDS,
 RATINGS_FILE_NAME,
 RATING_AXES,
 RATING_MAX,
 RATING_MIN,
 RATING_SCALE,
 SCHEMA_VERSION,
 SIDE_LABELS,
 SIDES,
 SIGN_OFF_REQUIREMENT,
 melodyMetrics,
 melodySequenceFromPattern,
} from './melody-arc-report.mjs';

const ALL_GENRES=['jungle','liquiddnb','boombap','atmosphericbreakcore'];
const DEFAULT_SEED='melody-arc-audition';
const output=resolve('test-results/melody-arc-audition');
const args=process.argv.slice(2);

if(args.includes('--help')||args.includes('-h')){
 console.log(`Usage: node scripts/melody-arc-audition.mjs [options]

Renders the previous/arc lead A/B pairs as WAVs and writes a local rating page to
${output}/index.html. Rate every case on the four axes, name the listener, then
download ${RATINGS_FILE_NAME} and run:
  node scripts/melody-arc-report.mjs

Options:
  --smoke            Render only the first genre (jungle) as a fast smoke run.
  --genres=a,b       Render an explicit comma-separated genre subset.
  -h, --help         Show this help without rendering anything.`);
 process.exit(0);
}
const genreArgs=args.find(item=>item.startsWith('--genres='));
const genres=args.includes('--smoke')
 ?ALL_GENRES.slice(0,1)
 :genreArgs
  ?genreArgs.slice('--genres='.length).split(',').map(item=>item.trim()).filter(Boolean)
  :ALL_GENRES;
if(!genres.length){console.error('No genres selected; pass --genres=jungle,boombap or omit the flag.');process.exit(1);}

const metricDisplay=value=>Number.isFinite(value)?String(Math.round(value*1000)/1000):'n/a';
const escapeHtml=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ratingName=(caseId,side,axis)=>`${caseId}-${side}-${axis}`;

const radioGroup=(caseId,side,axis)=>{
 const axisSpec=RATING_AXES.find(item=>item.id===axis);
 const options=[];
 for(let value=RATING_MIN;value<=RATING_MAX;value++){
  options.push(`<label><input type="radio" name="${ratingName(caseId,side,axis)}" value="${value}"> ${value}</label>`);
 }
 return `<fieldset class="axis"><legend>${escapeHtml(axisSpec.label)}${axisSpec.id==='unwantedRepetition'?' <span class="hint">lower is better</span>':''}</legend><div class="scale">${options.join('')}</div><p class="hint">${RATING_MIN} = ${escapeHtml(axisSpec.low)}; ${RATING_MAX} = ${escapeHtml(axisSpec.high)}</p></fieldset>`;
};

await mkdir(output,{recursive:true});
const cases=[];
for(const genre of genres){
 const settings={...defaults(genre),bars:4,seed:DEFAULT_SEED,complexity:.65,spicy:.35,melodyPart:'lead',generationMode:'melody',melodyKey:2,melodyScale:'natural-minor'};
 const editor=new Editor(generate(settings));editor.generateComposition(settings);
 const newer=editor.state.pattern,track=newer.userTracks.find(item=>item.generatedPart==='lead');
 const older=structuredClone(newer);
 older.events=older.events.filter(hit=>hit.trackId!==track.id).concat(generateLegacyMelody(settings,track.id));
 const patterns={A:older,B:newer};
 const metrics={};
 const renders={};
 for(const side of SIDES){
  const label=side==='A'?'previous':'arc';
  renders[side]={label,audio:renderPerformance(patterns[side],new Map(),22050,{},{})};
 }
 // Duration-match the pair: keep every natural note tail from both renders and
 // pad the shorter side with silence so A and B last exactly the same number of
 // frames. Without this the arc side is systematically 21-146 ms shorter and the
 // perceived "tighter" ending contaminates hook recall and phrasing ratings.
 const frames=Math.max(...SIDES.map(side=>renders[side].audio.channels[0].length));
 const matchedSeconds=frames/renders.A.audio.sampleRate;
 for(const side of SIDES){
  const {label,audio}=renders[side];
  const channels=audio.channels.map(channel=>{
   if(channel.length===frames)return channel;
   const padded=new Float32Array(frames);padded.set(channel.subarray(0,Math.min(channel.length,frames)));return padded;
  });
  await writeFile(resolve(output,`${genre}-${label}.wav`),Buffer.from(encodeWav(channels,audio.sampleRate)));
 }
 for(const side of SIDES){
  metrics[side]=melodyMetrics(melodySequenceFromPattern(patterns[side],track.id),{gridTicks:GRID_TICKS,totalTicks:patternTicks(settings)});
 }
 const rawSeconds=Object.fromEntries(SIDES.map(side=>[side,renders[side].audio.channels[0].length/renders[side].audio.sampleRate]));
 const caseId=`${genre}-lead`;
 cases.push({caseId,genre,part:'lead',audio:{A:`${genre}-previous.wav`,B:`${genre}-arc.wav`},metrics,duration:{matchedSeconds,rawSeconds}});
 const summary=METRIC_IDS.map(id=>`${id} A=${metricDisplay(metrics.A[id])} B=${metricDisplay(metrics.B[id])}`).join(', ');
 console.log(`${caseId}: ${summary}`);
 console.log(`${caseId}: rendered ${matchedSeconds.toFixed(3)}s both sides (raw A=${rawSeconds.A.toFixed(3)}s B=${rawSeconds.B.toFixed(3)}s, padded to equal length)`);
}

const metricLegend=METRIC_IDS.map(id=>`<li><code>${id}</code>: ${escapeHtml(METRIC_DEFINITIONS[id])}</li>`).join('');
const sections=cases.map(item=>{
 const metricRows=METRIC_IDS.map(id=>`<tr><td><code>${id}</code></td><td>${metricDisplay(item.metrics.A[id])}</td><td>${metricDisplay(item.metrics.B[id])}</td></tr>`).join('');
 const sides=SIDES.map(side=>`<div class="side"><h3>${side} &middot; ${escapeHtml(SIDE_LABELS[side])}</h3><audio controls preload="none" src="${escapeHtml(item.audio[side])}"></audio>${RATING_AXES.map(axis=>radioGroup(item.caseId,side,axis.id)).join('')}</div>`).join('');
 return `<section class="case" data-case="${escapeHtml(item.caseId)}">
<h2>${escapeHtml(item.genre)} <span class="hint">${escapeHtml(item.part)}</span></h2>
<p class="hint">Rendered duration: both sides are ${item.duration.matchedSeconds.toFixed(3)} s. Natural note tails measured ${item.duration.rawSeconds.A.toFixed(3)} s (A) and ${item.duration.rawSeconds.B.toFixed(3)} s (B); the shorter side is padded with trailing silence so the two sides last exactly the same time and duration is not a listening cue.</p>
<table class="metrics"><caption>Objective metrics (deterministic for seed ${DEFAULT_SEED})</caption><thead><tr><th>metric</th><th>A ${escapeHtml(SIDE_LABELS.A)}</th><th>B ${escapeHtml(SIDE_LABELS.B)}</th></tr></thead><tbody>${metricRows}</tbody></table>
<div class="pair">${sides}</div>
<label class="notes">Notes for this case (optional)<textarea data-notes="${escapeHtml(item.caseId)}" rows="2"></textarea></label>
<p class="case-status" data-status="${escapeHtml(item.caseId)}">Not rated yet.</p>
</section>`;
}).join('');

const page=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Melody arc A/B</title>
<style>
body{font:16px system-ui;background:#101619;color:#e7faf5;max-width:960px;margin:auto;padding:32px}
h1{margin-bottom:4px}h2{margin:0 0 12px;text-transform:capitalize}
section{border:1px solid #42605a;border-radius:12px;margin:22px 0;padding:20px}
audio{display:block;width:100%;margin-bottom:12px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.side{border:1px solid #2c4741;border-radius:10px;padding:12px}
.axis{border:1px solid #2c4741;border-radius:8px;margin:10px 0;padding:8px}
.axis legend{padding:0 6px;font-weight:600}
.scale{display:flex;gap:12px;flex-wrap:wrap}
.scale label{display:flex;gap:4px;align-items:center}
.hint{color:#9fbdb5;font-size:13px;font-weight:400}
.metrics{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:14px}
.metrics th,.metrics td{border-bottom:1px solid #2c4741;padding:4px 8px;text-align:left}
.metrics caption{caption-side:top;text-align:left;color:#9fbdb5;font-size:13px;padding-bottom:4px}
.notes{display:block;margin-top:12px}.notes textarea{display:block;width:100%;margin-top:4px}
.case-status{font-size:14px;margin:10px 0 0}.case-status.done{color:#7fe3c4}
.toolbar{position:sticky;bottom:0;background:#101619;border-top:1px solid #42605a;padding:16px 0;margin-top:8px}
button{font:inherit;padding:10px 16px;border-radius:8px;border:1px solid #42605a;background:#1d3630;color:#e7faf5}
button:disabled{opacity:.45;cursor:not-allowed}
#status{font-size:15px;margin:8px 0}
#preview{display:none;width:100%;margin-top:12px;font:12px ui-monospace,monospace}
ul.legend{font-size:13px;color:#9fbdb5}
</style>
</head>
<body>
<h1>Melody arc A/B</h1>
<p>Same seed, drums, lead instrument, harmony, and four-bar length in each pair, and both sides of a pair are rendered to the identical duration (the longer natural ending; the shorter side gets trailing silence), so duration is not a usable cue. A is the <strong>previous</strong> lead generator, B is the <strong>song arc</strong>. Listen to both, then rate every case on all four axes with the ${RATING_MIN}-${RATING_MAX} scale. Everything stays in this browser: no network, no upload.</p>
<p class="hint">${escapeHtml(RATING_SCALE.meaning)}</p>
<label>Listener name/id <input id="listener" type="text" size="28" placeholder="e.g. arthur" autocomplete="off"></label>
<p id="status">Ratings complete: 0/${cases.length} cases.</p>
${sections}
<details><summary>Metric definitions and decision rule</summary><ul class="legend">${metricLegend}</ul><p class="hint">${escapeHtml(DECISION_RULE_TEXT)}</p><p class="hint">${escapeHtml(SIGN_OFF_REQUIREMENT)}</p></details>
<div class="toolbar">
<button id="export" type="button" disabled>Download ${RATINGS_FILE_NAME}</button>
<p class="hint">Export unlocks once every case is rated on all four axes and a listener name is entered. Then run <code>node scripts/melody-arc-report.mjs</code> to write verdict.json.</p>
<textarea id="preview" readonly rows="12" aria-label="ratings JSON"></textarea>
</div>
<script>
const DATA=${JSON.stringify({schemaVersion:SCHEMA_VERSION,seed:DEFAULT_SEED,cases:cases.map(item=>({caseId:item.caseId,genre:item.genre,part:item.part,metrics:item.metrics}))})};
const AXES=${JSON.stringify(RATING_AXES.map(axis=>({id:axis.id,label:axis.label})))};
const SIDES=${JSON.stringify(SIDES)};
const RATINGS_FILE_NAME=${JSON.stringify(RATINGS_FILE_NAME)};
const status=document.getElementById('status'),button=document.getElementById('export'),listener=document.getElementById('listener'),preview=document.getElementById('preview');
const rating=(caseId,side,axis)=>{const input=document.querySelector('input[name="'+caseId+'-'+side+'-'+axis+'"]:checked');return input?Number(input.value):null;};
const sideRatings=(caseId,side)=>{const out={};for(const axis of AXES)out[axis.id]=rating(caseId,side,axis.id);return out;};
const isComplete=side=>AXES.every(axis=>Number.isInteger(side[axis.id]));
const caseComplete=caseId=>SIDES.every(side=>isComplete(sideRatings(caseId,side)));
const caseNotes=caseId=>{const field=document.querySelector('textarea[data-notes="'+caseId+'"]');return field?field.value:'';};
const buildDocument=()=>({schemaVersion:DATA.schemaVersion,generatedAt:new Date().toISOString(),listener:listener.value.trim(),seed:DATA.seed,cases:DATA.cases.map(item=>({caseId:item.caseId,genre:item.genre,part:item.part,axisRatings:{A:sideRatings(item.caseId,'A'),B:sideRatings(item.caseId,'B')},notes:caseNotes(item.caseId),metrics:item.metrics}))});
const refresh=()=>{
 let done=0;
 for(const item of DATA.cases){
  const complete=caseComplete(item.caseId);
  if(complete)done+=1;
  const label=document.querySelector('[data-status="'+item.caseId+'"]');
  const [a,b]=SIDES.map(side=>sideRatings(item.caseId,side));
  const missing=complete?[]:SIDES.filter(side=>!isComplete(side==='A'?a:b)).map(side=>side);
  label.textContent=complete?'Rated on all four axes.':'Incomplete: still missing '+missing.join(' and ')+' rating(s).';
  label.classList.toggle('done',complete);
 }
 const named=listener.value.trim().length>0;
 status.textContent='Ratings complete: '+done+'/'+DATA.cases.length+' cases.'+(named?'':' Enter a listener name to export.');
 button.disabled=!(named&&done===DATA.cases.length);
};
document.addEventListener('input',refresh);
document.addEventListener('change',refresh);
button.addEventListener('click',()=>{
 const document_=buildDocument();
 const text=JSON.stringify(document_,null,2);
 preview.value=text;
 preview.style.display='block';
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const link=document.createElement('a');
 link.href=url;link.download=RATINGS_FILE_NAME;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
});
refresh();
</script>
</body>
</html>`;
await writeFile(resolve(output,'index.html'),page);
console.log(output);
