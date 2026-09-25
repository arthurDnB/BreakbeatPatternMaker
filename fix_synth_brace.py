with open('public/synth.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """      value = (grit * 0.6 + bright * 0.4) * envelope * 0.8;
    // Remove DC/very low rumble and taper both edges to avoid cut-off clicks."""

replacement = """      value = (grit * 0.6 + bright * 0.4) * envelope * 0.8;
    }
    // Remove DC/very low rumble and taper both edges to avoid cut-off clicks."""

text = text.replace(target, replacement)

with open('public/synth.js', 'w', encoding='utf-8') as f:
    f.write(text)
