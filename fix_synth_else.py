with open('public/synth.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """      value=(bright*.85+metal*.065)*Math.exp(-t*44)*(1-Math.exp(-t*2200));
    } else {
      bodyPhase+=2*Math.PI*(360+135*Math.exp(-t*40))/sampleRate;"""

replacement = """      value=(bright*.85+metal*.065)*Math.exp(-t*44)*(1-Math.exp(-t*2200));
    } else if (role === 'percussion') {
      bodyPhase+=2*Math.PI*(360+135*Math.exp(-t*40))/sampleRate;"""

text = text.replace(target, replacement)

with open('public/synth.js', 'w', encoding='utf-8') as f:
    f.write(text)
