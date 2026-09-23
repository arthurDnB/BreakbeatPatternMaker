// Original, deterministic synthesized drums. Shared by browser and Renoise WAV kit.
// No recordings, external samples, or network dependencies.
export function synthesize(role, sampleRate = 44100) {
  if (!['kick','snare','hat','percussion'].includes(role)) throw new Error('Unknown drum role.');
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Unsupported sample rate.');
  const duration={kick:.58,snare:.34,hat:.14,percussion:.26}[role];
  const peak={kick:.94,snare:.82,hat:.42,percussion:.62}[role];
  const data=new Float32Array(Math.ceil(duration*sampleRate));
  let state=123456789,phase=0,bodyPhase=0,low=0,air=0,dc=0;
  // One-pole filters keep noise transients bright without full-band hiss.
  const coefficient=hz=>1-Math.exp(-2*Math.PI*Math.min(hz,sampleRate*.42)/sampleRate);
  const lowAlpha=coefficient(Math.min(role==='hat'?6500:role==='snare'?1600:2200,sampleRate*.22));
  const airAlpha=coefficient(role==='hat'?10000:8500);
  const dcAlpha=coefficient(18);
  let maximum=0;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate;
    state^=state<<13;state^=state>>>17;state^=state<<5;
    const noise=(state>>>0)/4294967296*2-1;
    low+=lowAlpha*(noise-low);air+=airAlpha*(noise-air);
    const bright=air-low;
    let value=0;
    if(role==='kick') {
      // Fast beater pitch drop settles into a rounded sub with a quieter mid body.
      phase+=2*Math.PI*(49+105*Math.exp(-t*65)+30*Math.exp(-t*18))/sampleRate;
      const body=Math.sin(phase)*Math.exp(-t*10.5);
      const punch=Math.sin(phase*2)*Math.exp(-t*32)*.18;
      const beater=bright*Math.exp(-t*240)*.32;
      value=Math.tanh((body+punch)*1.5)*.8+beater;
    } else if(role==='snare') {
      bodyPhase+=2*Math.PI*(172+55*Math.exp(-t*65))/sampleRate;
      const shell=(Math.sin(bodyPhase)*.5+Math.sin(2*Math.PI*329*t)*.22)*Math.exp(-t*22);
      const wires=bright*(.8*Math.exp(-t*24)+.2*Math.exp(-t*12));
      const crack=air*Math.exp(-t*170)*.32;
      value=Math.tanh((shell+wires+crack)*1.25);
    } else if(role==='hat') {
      // Inharmonic partials add metallic definition to filtered noise.
      let metal=0;
      for(const frequency of [4217,5633,6971,8221]) {
        if(frequency<sampleRate*.42)metal+=Math.sin(2*Math.PI*frequency*t);
      }
      value=(bright*.85+metal*.065)*Math.exp(-t*44)*(1-Math.exp(-t*2200));
    } else {
      bodyPhase+=2*Math.PI*(360+135*Math.exp(-t*40))/sampleRate;
      const skin=Math.sin(bodyPhase)*Math.exp(-t*22);
      const rim=Math.sin(2*Math.PI*1173*t)*Math.exp(-t*65)*.3;
      value=Math.tanh(skin*.9+rim+bright*Math.exp(-t*95)*.2);
    }
    // Remove DC/very low rumble and taper both edges to avoid cut-off clicks.
    dc+=dcAlpha*(value-dc);value-=dc;
    const attack=Math.min(1,t/.0007);
    const tail=Math.min(1,(data.length-1-i)/(sampleRate*.012));
    value*=attack*tail;
    data[i]=value;maximum=Math.max(maximum,Math.abs(value));
  }
  if(maximum>0)for(let i=0;i<data.length;i++)data[i]*=peak/maximum;
  return data;
}

