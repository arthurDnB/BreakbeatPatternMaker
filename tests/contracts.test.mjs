import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import Ajv from 'ajv';
import luaparse from 'luaparse';
import {compile} from '../dist/core/compile.js';
import {generate} from '../dist/core/generate.js';
import {defaults,PROFILES} from '../dist/core/profiles.js';

test('every shipped Lua module parses with Lua 5.1 grammar',()=>{
 const dir='tools/renoise/com.breakbeat.PatternImporter.xrnx';
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.lua'))) {
  assert.doesNotThrow(()=>luaparse.parse(readFileSync(join(dir,file),'utf8'),{luaVersion:'5.1'}),file);
 }
});
test('JSON Schema independently validates generated transfer fields',()=>{
 const schema=JSON.parse(readFileSync('schemas/bbpattern-v1.schema.json','utf8'));
 const check=new Ajv({strict:true}).compile(schema);
 for(const genre of Object.keys(PROFILES))for(const bars of [1,4])for(const resolution of [8,64]){
  const transfer=compile(generate({...defaults(genre),bars,resolution}));
  assert.ok(check(transfer),JSON.stringify(check.errors));
  transfer.notes[0].delay=256;assert.equal(check(transfer),false);
 }
});
