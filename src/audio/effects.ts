export interface Effects {bypass:boolean;highpass:number;lowpass:number;drive:number;delayMs:number;feedback:number;mix:number}
export const defaultEffects=():Effects=>({bypass:false,highpass:0,lowpass:20000,drive:0,delayMs:250,feedback:.3,mix:0});
export function validateEffects(f:Effects){
 if(!f||typeof f.bypass!=='boolean')throw Error('Invalid effects.');
 for(const [key,min,max] of [['highpass',0,2000],['lowpass',200,20000],['drive',0,1],['delayMs',30,1000],['feedback',0,.75],['mix',0,.6]] as const)if(!Number.isFinite(f[key])||f[key]<min||f[key]>max)throw Error('Invalid effect '+key);
 if(f.highpass>=f.lowpass)throw Error('High-pass must be below low-pass.');
}
export function effectTail(f?:Effects){if(!f||f.bypass||!f.mix)return 0;return Math.min(8,f.delayMs/1000*(f.feedback?Math.ceil(Math.log(.001)/Math.log(f.feedback))+1:1));}
export function processEffects(channels:Float32Array[],rate:number,f?:Effects){
 if(!f)return;validateEffects(f);if(f.bypass)return;
 const hp=Math.exp(-2*Math.PI*f.highpass/rate),lp=1-Math.exp(-2*Math.PI*Math.min(f.lowpass,rate*.45)/rate),delay=Math.max(1,Math.round(f.delayMs*rate/1000));
 for(const data of channels){let prev=0,high=0,low=0;const memory=f.mix?new Float32Array(delay):undefined;
  for(let i=0;i<data.length;i++){
   let x=data[i]!;if(f.highpass){high=hp*(high+x-prev);prev=x;x=high;}if(f.lowpass<20000){low+=lp*(x-low);x=low;}
   if(f.drive){const gain=1+f.drive*15;x=Math.tanh(x*gain)/Math.tanh(gain);}
   if(memory){const at=i%delay,echo=memory[at]!;memory[at]=x+echo*f.feedback;x=x*(1-f.mix)+echo*f.mix;}
   data[i]=x;
  }
  // Taper only a non-negligible residual at the render boundary.
  if(Math.abs(data.at(-1)??0)>.0001){const n=Math.min(data.length,Math.round(rate*.02));for(let i=0;i<n;i++)data[data.length-n+i]!*=1-i/(n-1);}
 }
}
