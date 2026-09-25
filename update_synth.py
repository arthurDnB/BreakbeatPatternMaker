with open('public/synth.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("if (!['kick','snare','hat','percussion'].includes(role))", "if (!['kick','snare','hat','percussion','scratch'].includes(role))")
text = text.replace("const duration={kick:.58,snare:.34,hat:.14,percussion:.26}[role];", "const duration={kick:.58,snare:.34,hat:.14,percussion:.26,scratch:.35}[role];")
text = text.replace("const peak={kick:.94,snare:.82,hat:.42,percussion:.62}[role];", "const peak={kick:.94,snare:.82,hat:.42,percussion:.62,scratch:.70}[role];")

scratch_code = """    } else if(role==='scratch') {
      // Vinyl scratch (chirp/forward stroke)
      const handSpeed = Math.max(0, Math.sin(Math.PI * Math.min(1, t / 0.35)));
      const freq = 120 + 1500 * handSpeed;
      phase += 2 * Math.PI * freq / sampleRate;
      const grit = Math.sin(phase + Math.sin(phase*2)*0.8);
      const envelope = Math.max(0, Math.sin(Math.PI * Math.min(1, t / 0.35)));
      value = (grit * 0.6 + bright * 0.4) * envelope * 0.8;
"""

text = text.replace("    // Remove DC", scratch_code + "    // Remove DC")

with open('public/synth.js', 'w', encoding='utf-8') as f:
    f.write(text)
