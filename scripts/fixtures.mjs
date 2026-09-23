import {writeFile,mkdir} from 'node:fs/promises';
import {defaults,PROFILES} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {compile,serialize} from '../dist/core/compile.js';
import {DEFAULT_SOURCES} from '../dist/core/model.js';
await mkdir('exports',{recursive:true});
for(const genre of Object.keys(PROFILES))await writeFile(`exports/${genre}.bbpattern`,serialize(compile(generate(defaults(genre)))));
await writeFile('exports/example-source-map.json',JSON.stringify(DEFAULT_SOURCES,null,2)+'\n');
console.log(`Generated ${Object.keys(PROFILES).length} ready-to-import patterns and an editable source map.`);
