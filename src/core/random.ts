// Versioned FNV-1a + Mulberry32. Never use Math.random in generation.
export function random(seed: string, stream: string): () => number {
  let state = 2166136261;
  for (const c of `${seed}\0${stream}`) {state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;}
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
