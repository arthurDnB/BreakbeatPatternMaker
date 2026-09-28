import {analyzeBreak,type BreakAnalysisOptions} from './break-analysis.js';
const worker=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(data:unknown)=>void};
worker.onmessage=event=>{
  const {channels,rate,options}=event.data as {channels:Float32Array[];rate:number;options:BreakAnalysisOptions};
  try{worker.postMessage({result:analyzeBreak(channels,rate,options,value=>worker.postMessage({progress:value}))});}
  catch(error){worker.postMessage({error:(error as Error).message});}
};
