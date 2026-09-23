import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import fengari from 'fengari';
import {generate} from '../dist/core/generate.js';
import {compile,serialize} from '../dist/core/compile.js';
import {defaults,PROFILES} from '../dist/core/profiles.js';
import {Editor} from '../dist/core/editor.js';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
function runLua(pattern){
 const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
 for(const [name,value] of Object.entries({TOOL_DIR:resolve('tools/renoise/com.breakbeat.PatternImporter.xrnx').replaceAll('\\','/'),GOOD_JSON:serialize(compile(pattern)),OTHER_JSON:serialize(compile(generate(defaults('hiphop'))))})){
  lua.lua_pushstring(L,to_luastring(value));lua.lua_setglobal(L,to_luastring(name));
 }
 const code=readFileSync('tests/importer-test.lua','utf8');
 let result=lauxlib.luaL_loadstring(L,to_luastring(code));
 if(result===lua.LUA_OK)result=lua.lua_pcall(L,0,lua.LUA_MULTRET,0);
 const error=result===lua.LUA_OK?'':to_jsstring(lua.lua_tostring(L,-1));lua.lua_close(L);
 assert.equal(result,lua.LUA_OK,error);
}
test('real Lua decoder, validator and importer execute round trips and rollback tests',()=>{
 runLua(generate({...defaults(),complexity:1,fillAmount:1,ghostAmount:1}));
});
test('mutated and filled patterns round-trip through the unchanged Lua importer',()=>{
 const editor=new Editor(generate({...defaults(),complexity:1,fillAmount:1,ghostAmount:1}));
 editor.toggleRole('kick');editor.mutate();editor.state.selection={ids:[],rows:[28,31]};editor.fill();
 runLua(editor.state.pattern);
});

test('new genres import and roll back through the Lua host simulator',()=>{
 for(const genre of Object.keys(PROFILES))runLua(generate({...defaults(genre),bpm:165}));
});

test('named break presets round trip through the file importer',()=>{
 for(const breakStyle of ['amen','think','apache','funkyDrummer','hotPants'])runLua(generate({...defaults(),breakStyle}));
});
