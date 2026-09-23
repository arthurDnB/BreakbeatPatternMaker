import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.PORT??4173);
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/public/index.html'){res.writeHead(302,{Location:'/'});res.end();return;}
    const name=decodeURIComponent(url.pathname)==='/'?'/public/index.html':decodeURIComponent(url.pathname);
    if(!['/public/','/dist/','/releases/'].some(prefix=>name.startsWith(prefix)) && name!=='/README.md')throw Error();
    const file=resolve(root,'.'+name);
    if(!file.startsWith(root+sep))throw Error();
    const data=await readFile(file);
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8','.xrnx':'application/zip'};
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Breakbeat Pattern Maker: http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
