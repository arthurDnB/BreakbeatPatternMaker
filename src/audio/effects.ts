export interface Effects {
  bypass: boolean;
  highpass: number;
  lowpass: number;
  resonance?: number;
  punch?: number;
  drive: number;
  delayMs: number;
  feedback: number;
  mix: number;
}
export const defaultEffects = (): Effects => ({
  bypass: false,
  highpass: 0,
  lowpass: 20000,
  resonance: 0,
  punch: 0,
  drive: 0,
  delayMs: 250,
  feedback: .3,
  mix: 0
});
export function validateEffects(f: Effects) {
  if (!f || typeof f.bypass !== 'boolean') throw Error('Invalid effects.');
  for (const [key, min, max] of [
    ['highpass', 0, 2000],
    ['lowpass', 200, 20000],
    ['drive', 0, 1],
    ['delayMs', 30, 1000],
    ['feedback', 0, .75],
    ['mix', 0, .6]
  ] as const) if (!Number.isFinite(f[key]) || f[key] < min || f[key] > max) throw Error('Invalid effect ' + key);
  if (f.resonance !== undefined && (!Number.isFinite(f.resonance) || f.resonance < 0 || f.resonance > 1)) throw Error('Invalid effect resonance');
  if (f.punch !== undefined && (!Number.isFinite(f.punch) || f.punch < 0 || f.punch > 1)) throw Error('Invalid effect punch');
  if (f.highpass >= f.lowpass) throw Error('High-pass must be below low-pass.');
}
export function effectTail(f?: Effects) {
  if (!f || f.bypass || !f.mix) return 0;
  return Math.min(8, f.delayMs / 1000 * (f.feedback ? Math.ceil(Math.log(.001) / Math.log(f.feedback)) + 1 : 1));
}
export function processEffects(channels: Float32Array[], rate: number, f?: Effects) {
  if (!f) return;
  validateEffects(f);
  if (f.bypass) return;
  const useResonance = (f.resonance ?? 0) > 0;
  const hp = Math.exp(-2 * Math.PI * f.highpass / rate);
  const lp = 1 - Math.exp(-2 * Math.PI * Math.min(f.lowpass, rate * .45) / rate);
  const delay = Math.max(1, Math.round(f.delayMs * rate / 1000));

  // Resonant biquad coefficients if resonance > 0
  let l_b0 = 0, l_b1 = 0, l_b2 = 0, l_a1 = 0, l_a2 = 0;
  let h_b0 = 0, h_b1 = 0, h_b2 = 0, h_a1 = 0, h_a2 = 0;
  if (useResonance) {
    const Q = 0.707 + f.resonance! * 7.5;
    if (f.lowpass < 20000) {
      const w0L = 2 * Math.PI * Math.min(f.lowpass, rate * .45) / rate;
      const alphaL = Math.sin(w0L) / (2 * Q), cosw0L = Math.cos(w0L);
      const b0L = (1 - cosw0L) / 2, a0L = 1 + alphaL;
      l_b0 = b0L / a0L; l_b1 = (1 - cosw0L) / a0L; l_b2 = b0L / a0L;
      l_a1 = (-2 * cosw0L) / a0L; l_a2 = (1 - alphaL) / a0L;
    }
    if (f.highpass > 0) {
      const w0H = 2 * Math.PI * Math.max(10, f.highpass) / rate;
      const alphaH = Math.sin(w0H) / (2 * Q), cosw0H = Math.cos(w0H);
      const b0H = (1 + cosw0H) / 2, a0H = 1 + alphaH;
      h_b0 = b0H / a0H; h_b1 = (-(1 + cosw0H)) / a0H; h_b2 = b0H / a0H;
      h_a1 = (-2 * cosw0H) / a0H; h_a2 = (1 - alphaH) / a0H;
    }
  }

  for (const data of channels) {
    // Transient punch attack boost
    if ((f.punch ?? 0) > 0) {
      const punchLen = Math.min(data.length, Math.round(rate * .035));
      for (let i = 0; i < punchLen; i++) {
        const factor = 1 + f.punch! * 1.5 * Math.exp(-i / (rate * .008));
        data[i] = Math.tanh(data[i]! * factor);
      }
    }

    let prev = 0, high = 0, low = 0;
    let lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0;
    let hx1 = 0, hx2 = 0, hy1 = 0, hy2 = 0;
    const memory = f.mix ? new Float32Array(delay) : undefined;

    for (let i = 0; i < data.length; i++) {
      let x = data[i]!;

      // High-pass filter
      if (f.highpass > 0) {
        if (useResonance) {
          const y = h_b0 * x + h_b1 * hx1 + h_b2 * hx2 - h_a1 * hy1 - h_a2 * hy2;
          hx2 = hx1; hx1 = x; hy2 = hy1; hy1 = y;
          x = y;
        } else {
          high = hp * (high + x - prev);
          prev = x;
          x = high;
        }
      }

      // Low-pass filter
      if (f.lowpass < 20000) {
        if (useResonance) {
          const y = l_b0 * x + l_b1 * lx1 + l_b2 * lx2 - l_a1 * ly1 - l_a2 * ly2;
          lx2 = lx1; lx1 = x; ly2 = ly1; ly1 = y;
          x = y;
        } else {
          low += lp * (x - low);
          x = low;
        }
      }

      // Overdrive saturation
      if (f.drive) {
        const gain = 1 + f.drive * 15;
        x = Math.tanh(x * gain) / Math.tanh(gain);
      }

      // Delay
      if (memory) {
        const at = i % delay, echo = memory[at]!;
        memory[at] = x + echo * f.feedback;
        x = x * (1 - f.mix) + echo * f.mix;
      }

      data[i] = x;
    }

    // Taper only a non-negligible residual at the render boundary.
    if (Math.abs(data.at(-1) ?? 0) > .0001) {
      const n = Math.min(data.length, Math.round(rate * .02));
      for (let i = 0; i < n; i++) data[data.length - n + i]! *= 1 - i / (n - 1);
    }
  }
}
