export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export const encoder=new TextEncoder();
export const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
export const html=(value,status=200,headers={})=>new Response(value,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',...headers}});
export function mutationGuard(request){
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-linkboard')!=='1')throw new HttpError(403,'Reload the page and try again.');
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new HttpError(415,'Send JSON data.');
}
export async function readJSON(request,limit=2000000){
  if(Number(request.headers.get('content-length'))>limit)throw new HttpError(413,'This request is too large. Keep pages and images under 1.8 MB.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Send the form details.');const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new HttpError(413,'This request is too large.');}chunks.push(value);}
  const all=new Uint8Array(length);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}
  try{const value=JSON.parse(new TextDecoder().decode(all));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new HttpError(400,'The submitted form could not be read.');}
}
export async function limitRequest(request,env,kind,maximum=10,windowMs=600000,subject=''){
  const ip=request.headers.get('cf-connecting-ip')||'local',expires=Date.now()+windowMs;
  const bucket=await sha(kind+':'+ip+':'+subject+':'+Math.floor(Date.now()/windowMs));
  await env.DB.prepare('INSERT INTO login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1').bind(bucket,expires).run();
  const row=await env.DB.prepare('SELECT attempts FROM login_limits WHERE bucket=?').bind(bucket).first();
  if(row.attempts>maximum)throw new HttpError(429,'Too many attempts. Please wait and try again.');
}
