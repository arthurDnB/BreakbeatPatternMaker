with open('src/audio/sample-panel.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = r"import type {Role} from '../core/model.js';\nexport function setupSamplePanel(stopPattern:()=>void, sendSlice:(role:Role, id:string, name:string, rate:number, channels:Float32Array[])=>void){"
replacement = "import type {Role} from '../core/model.js';\nexport function setupSamplePanel(stopPattern:()=>void, sendSlice:(role:Role, id:string, name:string, rate:number, channels:Float32Array[])=>void){"

text = text.replace(target, replacement)

with open('src/audio/sample-panel.ts', 'w', encoding='utf-8') as f:
    f.write(text)
