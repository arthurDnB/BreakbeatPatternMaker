import {readFile,writeFile,mkdir,rm,lstat} from 'node:fs/promises';
import {resolve,relative,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'site');
// This is a generated directory only. Never follow a symlink or erase outside this project.
if(dirname(out)!==root||relative(root,out)!=='site')throw Error('Unsafe output directory');
const existing=await lstat(out).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
if(existing?.isSymbolicLink()||(existing&&!existing.isDirectory()))throw Error('site must be a normal generated directory');
const files=new Map();
function inside(path){const rel=relative(root,path);if(rel==='..'||rel.startsWith('..'+sep)||resolve(path)===root)throw Error('Dependency outside project');return rel.split(sep).join('/');}
async function module(path){const name=inside(path);if(files.has(name))return;if(!name.startsWith('dist/')&&name!=='public/synth.js')throw Error('Unexpected browser module '+name);
 const code=(await readFile(path,'utf8')).replace(/^\/\/# sourceMappingURL=.*$/gm,'');files.set(name,code);
 // TypeScript emits these browser imports as static import/export declarations.
 for(const match of code.matchAll(/^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/gm)){const spec=match[1];if(!spec.startsWith('.'))throw Error('Browser dependency must be relative: '+spec);await module(resolve(dirname(path),spec));}

}
await module(resolve(root,'dist/web.js'));
for(const name of ['public/style.css','public/workspace.css','README.md','public/samples/credits.html','public/samples/catalog.json','public/samples/VCSL-LICENSE.txt','public/samples/TR808-LICENSE.txt','public/samples/STARGATE-LICENSE.txt'])files.set(name,await readFile(resolve(root,name)));
files.set('index.html',await readFile(resolve(root,'public/index.html')));files.set('.nojekyll','');
const catalog=JSON.parse(await readFile(resolve(root,'public/samples/catalog.json'),'utf8'));
for(const sound of catalog){if(sound.license!=='CC0-1.0'||!/^\/public\/samples\/[a-z0-9-]+\.wav$/.test(sound.path))throw Error('Unapproved sample '+sound.id);const name=sound.path.slice(1),bytes=await readFile(resolve(root,name));if(createHash('sha256').update(bytes).digest('hex')!==sound.sha256)throw Error('Sample hash mismatch: '+sound.id);files.set(name,bytes);}
// All sources have been checked before replacing the previous generated artifact.
if(existing)await rm(out,{recursive:true});await mkdir(out,{recursive:true});
for(const [name,data] of files){const target=resolve(out,name);if(!target.startsWith(out+sep))throw Error('Unsafe artifact path');await mkdir(dirname(target),{recursive:true});await writeFile(target,data);}
console.log(`Static site built: site/ (${files.size} files, ${catalog.length} licensed WAVs). Upload the contents, not the enclosing folder.`);
