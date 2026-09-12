import { blankPage, validatePage, renderPage, standaloneDocument, escapeHTML } from '../public/core.mjs';

const SESSION_MS=7*24*60*60*1000;
const encoder=new TextEncoder();
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const html=(value,status=200,headers={})=>new Response(value,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',...headers}});
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const cookieName=request=>new URL(request.url).protocol==='https:'?'__Host-linkboard':'linkboard_local';
function cookie(request,value,seconds=SESSION_MS/1000){return `${cookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
function token(request){const name=cookieName(request);return (request.headers.get('cookie')||'').split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1)||'';}
async function keyTag(env){return sha('linkboard-owner-key:'+env.ADMIN_KEY);}
function ready(env){if(typeof env.ADMIN_KEY!=='string'||env.ADMIN_KEY.length<32)throw new HttpError(503,'The workspace owner key has not been configured.');}
async function authorized(request,env){
  ready(env); const raw=token(request); if(!/^[a-f0-9]{64}$/.test(raw))return false;
  const row=await env.DB.prepare('SELECT expires_at,key_tag FROM sessions WHERE token_hash=?').bind(await sha(raw)).first();
  return !!row&&row.expires_at>Date.now()&&row.key_tag===await keyTag(env);
}
function mutationGuard(request){
  const origin=request.headers.get('origin');
  if(origin!==new URL(request.url).origin||request.headers.get('x-linkboard')!=='1')throw new HttpError(403,'Reload the page and try again.');
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new HttpError(415,'Send JSON data.');
}
async function readJSON(request){
  if(Number(request.headers.get('content-length'))>2000000)throw new HttpError(413,'This page is too large. Keep the page and its images under 2 MB.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Send page details.');
  const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2000000){await reader.cancel();throw new HttpError(413,'This page is too large. Keep the page and its images under 2 MB.');}chunks.push(value);}
  const all=new Uint8Array(length);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(all));}catch{throw new HttpError(400,'The submitted JSON could not be read.');}
}
function validate(input){try{return validatePage(input);}catch(error){throw new HttpError(400,error.message);}}
function pageRecord(row){const {write_token,...rest}=row;return {...rest,design:JSON.parse(row.design||'{}'),branding:!!row.branding,published:!!row.published,slug_locked:!!row.slug_locked,analytics:!!row.analytics};}
async function getPage(env,id){
  const page=await env.DB.prepare('SELECT * FROM pages WHERE id=?').bind(id).first();
  if(!page)throw new HttpError(404,'This page could not be found.');
  const {results}=await env.DB.prepare('SELECT id,title,description,url,icon,enabled,position,appearance FROM links WHERE page_id=? ORDER BY position').bind(id).all();
  return {...pageRecord(page),links:results.map(l=>({...l,enabled:!!l.enabled,appearance:JSON.parse(l.appearance||'{}')}))};
}
function publicOrigin(request,env){
  const origin=env.PUBLIC_ORIGIN||new URL(request.url).origin;
  try{const u=new URL(origin);if(u.pathname!=='/'||u.search||u.hash||u.username||u.password||!['http:','https:'].includes(u.protocol))throw Error();return u.origin;}catch{throw new HttpError(503,'The public site address needs to be configured correctly.');}
}
async function createPage(env,input){
  const p=validate({...input,published:false,links:(input.links||[]).map(l=>({...l,id:crypto.randomUUID()}))});
  const id=crypto.randomUUID(),now=new Date().toISOString();
  const statements=[env.DB.prepare('INSERT INTO pages(id,slug,name,bio,avatar,theme,font,shape,branding,analytics,created_at,updated_at,design) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,p.slug,p.name,p.bio,p.avatar,p.theme,p.font,p.shape,+p.branding,+p.analytics,now,now,JSON.stringify(p.design))];
  statements.push(...linkInserts(env,id,p.links));
  await env.DB.batch(statements);return getPage(env,id);
}
async function savePage(env,id,input){
  const current=await getPage(env,id),p=validate(input);
  if(!Number.isInteger(input.version)||input.version!==current.version)throw new HttpError(409,'This page changed in another tab. Reload it before saving.');
  if(current.slug_locked&&p.slug!==current.slug)throw new HttpError(400,'Published page addresses stay fixed so existing links and QR codes keep working.');
  const write=crypto.randomUUID(),now=new Date().toISOString();
  const statements=[env.DB.prepare('UPDATE pages SET slug=?,name=?,bio=?,avatar=?,theme=?,font=?,shape=?,branding=?,analytics=?,published=?,slug_locked=?,version=version+1,write_token=?,updated_at=?,design=? WHERE id=? AND version=?').bind(p.slug,p.name,p.bio,p.avatar,p.theme,p.font,p.shape,+p.branding,+p.analytics,+p.published,+(current.slug_locked||p.published),write,now,JSON.stringify(p.design),id,input.version),env.DB.prepare('DELETE FROM links WHERE page_id=? AND EXISTS(SELECT 1 FROM pages WHERE id=? AND write_token=?)').bind(id,id,write)];
  statements.push(...linkInserts(env,id,p.links,write));
  const result=await env.DB.batch(statements);
  if(!result[0].meta.changes)throw new HttpError(409,'This page changed in another tab. Reload it before saving.');
  return getPage(env,id);
}
function linkInserts(env,pageId,links,writeToken){
  // Ten rows per statement stay below D1's bound-parameter and Free query limits.
  const statements=[];
  for(let i=0;i<links.length;i+=10){
    const chunk=links.slice(i,i+10),args=chunk.flatMap(l=>[l.id,pageId,l.title,l.description,l.url,l.icon,+l.enabled,l.position,JSON.stringify(l.appearance)]);
    const values=chunk.map(()=>'(?,?,?,?,?,?,?,?,?)').join(',');
    const columns='id,page_id,title,description,url,icon,enabled,position,appearance';
    const sql=writeToken?`INSERT INTO links(${columns}) SELECT column1,column2,column3,column4,column5,column6,column7,column8,column9 FROM (VALUES ${values}) WHERE EXISTS(SELECT 1 FROM pages WHERE id=? AND write_token=?)`:`INSERT INTO links(${columns}) VALUES ${values}`;
    if(writeToken)args.push(pageId,writeToken);statements.push(env.DB.prepare(sql).bind(...args));
  }
  return statements;
}
async function record(env,pageId,linkId=''){
  try{await env.DB.prepare('INSERT INTO stats(page_id,link_id,day,count) VALUES(?,?,?,1) ON CONFLICT(page_id,day,link_id) DO UPDATE SET count=count+1').bind(pageId,linkId,new Date().toISOString().slice(0,10)).run();}catch{/* Counts must never prevent someone from opening a link. */}
}
function countable(request){return request.method==='GET'&&!/bot|crawler|spider|preview|headless/i.test(request.headers.get('user-agent')||'')&&!request.headers.get('purpose')&&!request.headers.get('sec-purpose')&&request.headers.get('dnt')!=='1'&&request.headers.get('sec-gpc')!=='1';}
async function route(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==='/api/login'&&method==='POST'){
    ready(env);mutationGuard(request);
    const body=await readJSON(request);
    const ip=request.headers.get('cf-connecting-ip')||'local';
    const bucket=await sha(ip+':'+Math.floor(Date.now()/600000));
    await env.DB.prepare('INSERT INTO login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1').bind(bucket,Date.now()+600000).run();
    const limited=await env.DB.prepare('SELECT attempts FROM login_limits WHERE bucket=?').bind(bucket).first();
    if(limited.attempts>10)throw new HttpError(429,'Too many sign-in attempts. Try again in 10 minutes.');
    const supplied=typeof body.key==='string'?body.key:'';
    const a=await sha(supplied),b=await sha(env.ADMIN_KEY);let diff=0;
    for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
    if(diff!==0)throw new HttpError(401,'That workspace key is not correct.');
    const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    await env.DB.batch([
      env.DB.prepare('INSERT INTO sessions(token_hash,key_tag,expires_at) VALUES(?,?,?)').bind(await sha(raw),await keyTag(env),Date.now()+SESSION_MS),
      env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),
      env.DB.prepare('DELETE FROM login_limits WHERE expires_at<?').bind(Date.now())
    ]);
    return json({ok:true},200,{'set-cookie':cookie(request,raw)});
  }
  if(path==='/api/session'&&method==='GET')return json({authenticated:await authorized(request,env),origin:publicOrigin(request,env),demo:false});
  if(path.startsWith('/api/')){
    if(!await authorized(request,env))throw new HttpError(401,'Sign in to manage your pages.');
    if(!['GET','HEAD'].includes(method))mutationGuard(request);
    if(path==='/api/logout'&&method==='POST'){
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token(request))).run();
      return json({ok:true},200,{'set-cookie':cookie(request,'',0)});
    }
    if(path==='/api/pages'&&method==='GET'){
      const {results}=await env.DB.prepare('SELECT id,slug,name,theme,published,version,updated_at FROM pages ORDER BY created_at,id').all();return json({pages:results});
    }
    if(path==='/api/pages'&&method==='POST'){
      const body=await readJSON(request);return json({page:await createPage(env,{...blankPage(body.name,body.slug),...body})},201);
    }
    if(path==='/api/import'&&method==='POST'){
      const body=await readJSON(request);if(body.format!=='linkboard-page'||body.formatVersion!==1)throw new HttpError(400,'Choose a Linkboard page backup.');
      return json({page:await createPage(env,{...body.page,slug:body.slug||body.page.slug})},201);
    }
    const match=path.match(/^\/api\/pages\/([a-zA-Z0-9-]+)(?:\/(preview|stats|export|website))?$/);
    if(match){
      const [,id,action]=match;
      if(!action&&method==='GET')return json({page:await getPage(env,id)});
      if(!action&&method==='PUT')return json({page:await savePage(env,id,await readJSON(request))});
      if(!action&&method==='DELETE'){
        const input=await readJSON(request),p=await getPage(env,id);
        if(input.confirm!==p.slug)throw new HttpError(400,'Enter the page address to confirm deletion.');
        const r=await env.DB.prepare('DELETE FROM pages WHERE id=? AND version=?').bind(id,input.version).run();
        if(!r.meta.changes)throw new HttpError(409,'The page changed. Reload it before deleting.');
        return json({ok:true});
      }
      if(action==='preview'&&method==='GET')return html(renderPage(await getPage(env,id),{preview:true,origin:publicOrigin(request,env)}));
      if(action==='export'&&method==='GET'){
        const page=await getPage(env,id);return json({format:'linkboard-page',formatVersion:1,exportedAt:new Date().toISOString(),page},200,{'content-disposition':`attachment; filename="${page.slug}-backup.json"`});
      }
      if(action==='website'&&method==='GET'){
        const page=await getPage(env,id);
        validate({...page,published:true});
        const sources=await Promise.all(['qr.mjs','page.mjs'].map(async file=>{
          const response=await env.ASSETS.fetch(new Request(new URL('/'+file,request.url)));
          if(!response.ok)throw new HttpError(503,'The website export assets are unavailable.');
          return response.text();
        }));
        return html(standaloneDocument(page,...sources),200,{'content-disposition':`attachment; filename="${page.slug}.html"`});
      }
      if(action==='stats'&&method==='GET'){
        const p=await getPage(env,id);const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
        const {results}=await env.DB.prepare('SELECT day,link_id,count FROM stats WHERE page_id=? AND day>=? ORDER BY day').bind(id,since).all();
        return json({enabled:p.analytics,since,rows:results,links:p.links.map(l=>({id:l.id,title:l.title}))});
      }
    }
    throw new HttpError(404,'This action could not be found.');
  }
  if(!['GET','HEAD'].includes(method))throw new HttpError(405,'This method is not supported.');
  const publicMatch=path.match(/^\/p\/([a-z0-9-]+)\/?$/);
  if(publicMatch){
    const row=await env.DB.prepare('SELECT id,analytics FROM pages WHERE slug=? AND published=1').bind(publicMatch[1]).first();
    if(!row)return html(notFound(),404);
    const p=await getPage(env,row.id);
    if(p.analytics&&countable(request))await record(env,p.id);
    return html(renderPage(p,{origin:publicOrigin(request,env)}));
  }
  const clickMatch=path.match(/^\/go\/([a-z0-9-]+)\/([a-zA-Z0-9-]+)$/);
  if(clickMatch){
    const link=await env.DB.prepare('SELECT links.url,links.id,pages.id AS page_id,pages.analytics FROM links JOIN pages ON pages.id=links.page_id WHERE pages.slug=? AND pages.published=1 AND links.id=? AND links.enabled=1 AND links.url<>?').bind(clickMatch[1],clickMatch[2],'').first();
    if(!link)return html(notFound(),404);
    if(link.analytics&&countable(request))await record(env,link.page_id,link.id);
    return new Response(null,{status:302,headers:{location:link.url,'cache-control':'no-store','referrer-policy':'no-referrer'}});
  }
  if(path==='/robots.txt')return new Response('User-agent: *\nDisallow: /api/\nDisallow: /go/\nAllow: /p/\n',{headers:{'content-type':'text/plain'}});
  if(path==='/favicon.ico')return new Response(null,{status:204});
  // Only explicit public assets are served. Database files and source never enter this directory.
  if(path==='/'||path==='/index.html'||/^\/[a-zA-Z0-9-]+\.(css|mjs|svg)$/.test(path)){
    const asset=await env.ASSETS.fetch(request);
    return asset;
  }
  return html(notFound(),404);
}
function notFound(){return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page unavailable</title><body style="background:#f3f6ee;color:#244334;font:16px Arial;margin:15vh auto;padding:24px;max-width:440px"><h1>This page isn’t available.</h1><p>Check the address or ask the page owner for the latest link.</p></body></html>';}
function secure(response,request){
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','strict-origin-when-cross-origin');
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
  if(new URL(request.url).protocol==='https:')headers.set('strict-transport-security','max-age=31536000');
  if(new URL(request.url).pathname==='/'||new URL(request.url).pathname==='/index.html')headers.set('x-robots-tag','noindex, nofollow');
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
export default {
  async fetch(request,env){
    try{return secure(await route(request,env),request);}
    catch(error){
      const status=error.status||(/unique constraint/i.test(error.message)?409:500);
      const message=error.status?error.message:status===409?'That page address or link ID is already in use. Choose another.':'Something went wrong. Your changes may not have saved. Reload the page and try again.';
      if(status===500)console.error('Linkboard request failed:',error.name);
      const response=new URL(request.url).pathname.startsWith('/api/')?json({error:message},status):html(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page unavailable</title><p>${escapeHTML(message)}</p>`,status);
      return secure(response,request);
    }
  }
};
