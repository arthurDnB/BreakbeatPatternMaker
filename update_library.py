with open('src/audio/library.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    {
      id: 'lofi-soul',
      name: 'dY?, Boom Bap & Lo-Fi (Deep 16x7 Snare & 18" Tom)',
      description: 'Warm 20" clean kick, 16x7 deep wood snare crack, natural closed hat, 18" floor tom',
      slots: {
        kick: 'acoustic-kick-clean',
        snare: 'acoustic-snare-fat',
        hat: 'acoustic-hat-closed',
        percussion: 'acoustic-tom-floor',
      },
      levels: {snare: 0.82},
      decays: {snare: 0.60},
    },"""

replacement = """    {
      id: 'lofi-soul',
      name: 'Lo-Fi Hip-Hop (Vinyl Scratch)',
      description: 'Warm 20" clean kick, 16x7 deep wood snare crack, natural closed hat, vinyl scratch',
      slots: {
        kick: 'acoustic-kick-clean',
        snare: 'acoustic-snare-fat',
        hat: 'acoustic-hat-closed',
        percussion: 'synth-scratch',
      },
      levels: {snare: 0.82, percussion: 0.95},
      decays: {snare: 0.60},
    },"""

text = text.replace(target, replacement)

with open('src/audio/library.ts', 'w', encoding='utf-8') as f:
    f.write(text)
