with open('src/audio/drum-kit.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import {LIBRARY,KIT_PRESETS} from './library.js';", "import {LIBRARY,KIT_PRESETS} from './library.js';\n// @ts-expect-error Shared original synth\nimport {synthesize} from '../../public/synth.js';")

with open('src/audio/drum-kit.ts', 'w', encoding='utf-8') as f:
    f.write(text)
