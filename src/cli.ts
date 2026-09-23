import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {parseArgs} from 'node:util';
import {defaults} from './core/profiles.js';
import {generate} from './core/generate.js';
import {compile,serialize} from './core/compile.js';
import type {Genre,Settings,Source,BreakStyle} from './core/model.js';

async function main() {
  const {values}=parseArgs({options:{break:{type:'string'},genre:{type:'string'},seed:{type:'string'},bpm:{type:'string'},bars:{type:'string'},
    resolution:{type:'string'},complexity:{type:'string'},syncopation:{type:'string'},swing:{type:'string'},
    humanize:{type:'string'},ghosts:{type:'string'},fill:{type:'string'},lpb:{type:'string'},
    sources:{type:'string'},out:{type:'string'},help:{type:'boolean'}}});
  if(values.help){console.log(`Breakbeat Pattern Maker\n\nnode dist/cli.js --genre jungle --seed break-042 --bpm 165 --out exports/jungle.bbpattern\n\nGenres: jungle, dnb, hiphop, trap, rap, drill, breakcore, idm, hardcore, experimental, breaks, bigbeat, nuskoolbreaks, electrobreaks, breakbeathardcore, raggajungle, atmosphericjungle, footworkjungle. --bars 1..4 --resolution 8|16|32|64\n--complexity/--syncopation/--ghosts/--fill 0..1 --swing .50..67\n--humanize 0..10 (ms) --lpb 1..32 --sources mapping.json\nBreak: --break genre|amen|think|apache|funkyDrummer|hotPants. BPM: 32..999. Files are JSON for the Lua importer, not native clipboard data.`);return;}
  const s=defaults((values.genre??'jungle') as Genre);
  if(values.break!==undefined)s.breakStyle=values.break as BreakStyle;
  if(values.seed!==undefined)s.seed=values.seed;
  for(const [arg,key] of Object.entries({bpm:'bpm',bars:'bars',resolution:'resolution',complexity:'complexity',syncopation:'syncopation',swing:'swing',humanize:'humanizeMs',ghosts:'ghostAmount',fill:'fillAmount'})) {
    const v=values[arg as keyof typeof values];
    if(typeof v==='string') (s as unknown as Record<string,unknown>)[key]=v.trim()===''?NaN:Number(v);
  }
  const sources:Source[]|undefined=values.sources?JSON.parse(await readFile(values.sources,'utf8')):undefined;
  const output=compile(generate(s as Settings),sources,values.lpb===undefined?undefined:Number(values.lpb));
  const filename=values.out??'exports/pattern.bbpattern';
  await mkdir(dirname(filename),{recursive:true}); await writeFile(filename,serialize(output));
  console.log(`Saved ${filename}: ${output.notes.length} notes, ${output.timing.lines} rows, ${output.timing.bpm} BPM, LPB ${output.timing.lpb}.`);
  for(const warning of output.warnings)console.warn(warning);
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
