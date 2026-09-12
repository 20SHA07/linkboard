import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './worker.mjs';
import { openDatabase } from './db.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function startServer({port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1',dataDir=resolve(root,'.data'),key=process.env.ADMIN_KEY,quiet=false}={}){
  await mkdir(dataDir,{recursive:true,mode:0o700});
  if(!key){
    try{key=(await readFile(resolve(dataDir,'admin-key'),'utf8')).trim();}
    catch(error){if(error.code!=='ENOENT')throw error;key=randomBytes(32).toString('hex');await writeFile(resolve(dataDir,'admin-key'),key+'\n',{mode:0o600,flag:'wx'});}
  }
  if(key.length<32)throw new Error('ADMIN_KEY must be at least 32 characters. Use a randomly generated owner key.');
  const DB=openDatabase(resolve(dataDir,'linkboard.sqlite'));
  const ASSETS={async fetch(request){
    const pathname=new URL(request.url).pathname==='/'?'/index.html':new URL(request.url).pathname;
    if(!/^\/[a-zA-Z0-9-]+\.(html|css|mjs|svg)$/.test(pathname))return new Response('Not found',{status:404});
    try{const data=await readFile(resolve(root,'public',pathname.slice(1)));const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'}[extname(pathname)];return new Response(data,{headers:{'content-type':type,'cache-control':'no-cache'}});}catch{return new Response('Not found',{status:404});}
  }};
  const env={DB,ASSETS,ADMIN_KEY:key,PUBLIC_ORIGIN:process.env.PUBLIC_ORIGIN};
  const server=createServer(async(req,res)=>{
    try{
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>2000000){res.writeHead(413,{'content-type':'application/json'});res.end('{"error":"Request too large."}');return;}chunks.push(chunk);}
      const headers=new Headers();for(const [name,value] of Object.entries(req.headers)){if(value)headers.set(name,Array.isArray(value)?value.join(', '):value);}
      // A direct local connection cannot spoof Cloudflare's client IP header.
      headers.set('cf-connecting-ip',req.socket.remoteAddress||'local');
      const method=req.method||'GET';
      const request=new Request(`http://${req.headers.host||'localhost:'+port}${req.url}`,{method,headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})});
      const response=await worker.fetch(request,env);
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"The request could not be completed."}');}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  const address=server.address(),origin=`http://${host==='0.0.0.0'?'localhost':host}:${address.port}`;
  if(!quiet){console.log(`Linkboard is running at ${origin}`);console.log('Run npm run owner-key in another terminal to view your private sign-in key.');console.log('Your pages are stored in .data/linkboard.sqlite.');}
  return {origin,env,close:()=>new Promise(resolve=>server.close(()=>{DB.close();resolve();}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer().catch(error=>{console.error(error.message);process.exit(1);});
