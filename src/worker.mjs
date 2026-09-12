import { blankPage, validatePage, renderPage, standaloneDocument, escapeHTML } from '../public/core.mjs';

import { HttpError, json, html, sha, mutationGuard, readJSON, limitRequest } from './http.mjs';
import { authConfig, authRoute, authenticate, publicAccount } from './auth.mjs';

function validate(input){try{return validatePage(input);}catch(error){throw new HttpError(400,error.message);}}
function pageRecord(row){const {write_token,...rest}=row;return {...rest,design:JSON.parse(row.design||'{}'),branding:!!row.branding,published:!!row.published,slug_locked:!!row.slug_locked,analytics:!!row.analytics};}
async function getPage(env,id,ownerId){
  const page=await (ownerId?env.DB.prepare('SELECT * FROM pages WHERE id=? AND owner_id=?').bind(id,ownerId):env.DB.prepare('SELECT * FROM pages WHERE id=?').bind(id)).first();
  if(!page)throw new HttpError(404,'This page could not be found.');
  const {results}=await env.DB.prepare('SELECT id,title,description,url,icon,enabled,position,appearance FROM links WHERE page_id=? ORDER BY position').bind(id).all();
  return {...pageRecord(page),links:results.map(l=>({...l,enabled:!!l.enabled,appearance:JSON.parse(l.appearance||'{}')}))};
}
function publicOrigin(request,env){
  const origin=env.PUBLIC_ORIGIN||new URL(request.url).origin;
  try{const u=new URL(origin);if(u.pathname!=='/'||u.search||u.hash||u.username||u.password||!['http:','https:'].includes(u.protocol))throw Error();return u.origin;}catch{throw new HttpError(503,'The public site address needs to be configured correctly.');}
}
async function createPage(env,input,ownerId){
  const p=validate({...input,published:false,links:(input.links||[]).map(l=>({...l,id:crypto.randomUUID()}))});
  const id=crypto.randomUUID(),now=new Date().toISOString(),limit=pageLimit(env);
  if((await env.DB.prepare('SELECT count(*) AS n FROM pages WHERE owner_id=?').bind(ownerId).first()).n>=limit)throw new HttpError(409,`This account can have ${limit} pages. Delete an unused page to create another.`);
  const statements=[env.DB.prepare('INSERT INTO pages(id,slug,name,bio,avatar,theme,font,shape,branding,analytics,created_at,updated_at,design,owner_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM pages WHERE owner_id=?)<?').bind(id,p.slug,p.name,p.bio,p.avatar,p.theme,p.font,p.shape,+p.branding,+p.analytics,now,now,JSON.stringify(p.design),ownerId,ownerId,limit)];
  statements.push(...linkInserts(env,id,p.links));
  const result=await env.DB.batch(statements);if(!result[0].meta.changes)throw new HttpError(409,'Your account has reached its page limit.');return getPage(env,id,ownerId);
}
async function savePage(env,id,input,ownerId){
  const current=await getPage(env,id,ownerId),p=validate(input);
  if(!Number.isInteger(input.version)||input.version!==current.version)throw new HttpError(409,'This page changed in another tab. Reload it before saving.');
  if(current.slug_locked&&p.slug!==current.slug)throw new HttpError(400,'Published page addresses stay fixed so existing links and QR codes keep working.');
  const write=crypto.randomUUID(),now=new Date().toISOString();
  const statements=[env.DB.prepare('UPDATE pages SET slug=?,name=?,bio=?,avatar=?,theme=?,font=?,shape=?,branding=?,analytics=?,published=?,slug_locked=?,version=version+1,write_token=?,updated_at=?,design=? WHERE id=? AND version=? AND owner_id=?').bind(p.slug,p.name,p.bio,p.avatar,p.theme,p.font,p.shape,+p.branding,+p.analytics,+p.published,+(current.slug_locked||p.published),write,now,JSON.stringify(p.design),id,input.version,ownerId),env.DB.prepare('DELETE FROM links WHERE page_id=? AND EXISTS(SELECT 1 FROM pages WHERE id=? AND write_token=?)').bind(id,id,write)];
  statements.push(...linkInserts(env,id,p.links,write));
  const result=await env.DB.batch(statements);
  if(!result[0].meta.changes)throw new HttpError(409,'This page changed in another tab. Reload it before saving.');
  return getPage(env,id,ownerId);
}
function linkInserts(env,pageId,links,writeToken){
  // Ten rows per statement stay below D1's bound-parameter and Free query limits.
  const statements=[];
  for(let i=0;i<links.length;i+=10){
    const chunk=links.slice(i,i+10),args=chunk.flatMap(l=>[l.id,pageId,l.title,l.description,l.url,l.icon,+l.enabled,l.position,JSON.stringify(l.appearance)]);
    const values=chunk.map(()=>'(?,?,?,?,?,?,?,?,?)').join(',');
    const columns='id,page_id,title,description,url,icon,enabled,position,appearance';
    const sql=`INSERT INTO links(${columns}) SELECT column1,column2,column3,column4,column5,column6,column7,column8,column9 FROM (VALUES ${values}) WHERE EXISTS(SELECT 1 FROM pages WHERE id=?${writeToken?' AND write_token=?':''})`;
    args.push(pageId);if(writeToken)args.push(writeToken);statements.push(env.DB.prepare(sql).bind(...args));
  }
  return statements;
}
async function record(env,pageId,linkId=''){
  try{await env.DB.prepare('INSERT INTO stats(page_id,link_id,day,count) VALUES(?,?,?,1) ON CONFLICT(page_id,day,link_id) DO UPDATE SET count=count+1').bind(pageId,linkId,new Date().toISOString().slice(0,10)).run();}catch{/* Counts must never prevent someone from opening a link. */}
}
function countable(request){return request.method==='GET'&&!/bot|crawler|spider|preview|headless/i.test(request.headers.get('user-agent')||'')&&!request.headers.get('purpose')&&!request.headers.get('sec-purpose')&&request.headers.get('dnt')!=='1'&&request.headers.get('sec-gpc')!=='1';}
async function route(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==='/api/config'&&method==='GET'){const config=authConfig(env);return json({configured:config.configured,registrationOpen:config.registrationOpen,captchaSiteKey:config.captchaSiteKey,supportEmail:config.supportEmail,maxPages:pageLimit(env)});}
  const authResponse=await authRoute(request,env,path);if(authResponse)return authResponse;
  if(path==='/api/session'&&method==='GET'){const session=await authenticate(request,env);return json({authenticated:!!session,user:session?publicAccount(session.user,env):null,needsPasswordReset:session?.recovery||false,origin:publicOrigin(request,env),demo:false,maxPages:pageLimit(env)});}
  if(path==='/api/report'&&method==='POST'){
    mutationGuard(request);await limitRequest(request,env,'report',3,3600000);const input=await readJSON(request,5000);
    if(typeof input.reason!=='string'||input.reason.trim().length<20||input.reason.length>1000)throw new HttpError(400,'Describe the issue in 20 to 1,000 characters.');
    const page=await env.DB.prepare('SELECT id FROM pages WHERE slug=? AND published=1 AND moderation_hidden=0').bind(String(input.slug||'')).first();if(page)await env.DB.prepare('INSERT INTO abuse_reports(id,page_id,reason,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),page.id,input.reason.trim(),new Date().toISOString()).run();
    return json({ok:true});
  }
  if(path.startsWith('/api/')){
    const session=await authenticate(request,env);if(!session)throw new HttpError(401,'Sign in to manage your pages.');
    if(session.recovery)throw new HttpError(403,'Set your new password before continuing.');
    const ownerId=session.user.id;
    if(!['GET','HEAD'].includes(method))mutationGuard(request);
    if(path==='/api/account/claim'&&method==='POST'){
      await limitRequest(request,env,'claim',3,3600000);const input=await readJSON(request,5000);
      if(!env.ADMIN_KEY||env.ADMIN_KEY.length<32||typeof input.key!=='string'||await sha(input.key)!==await sha(env.ADMIN_KEY))throw new HttpError(403,'The original workspace key could not be verified.');
      const result=await env.DB.prepare('UPDATE pages SET owner_id=? WHERE owner_id IS NULL').bind(ownerId).run();return json({ok:true,claimed:result.meta.changes});
    }
    if(path.startsWith('/api/admin/')){
      if(!publicAccount(session.user,env).admin)throw new HttpError(403,'This action requires the site owner account.');
      if(path==='/api/admin/reports'&&method==='GET'){const {results}=await env.DB.prepare('SELECT abuse_reports.id,abuse_reports.reason,abuse_reports.created_at,pages.id AS page_id,pages.slug,pages.name,pages.moderation_hidden FROM abuse_reports JOIN pages ON pages.id=abuse_reports.page_id WHERE reviewed=0 ORDER BY abuse_reports.created_at DESC LIMIT 100').all();const hidden=await env.DB.prepare('SELECT id,name,slug FROM pages WHERE moderation_hidden=1 ORDER BY updated_at DESC LIMIT 100').all();return json({reports:results,hidden:hidden.results});}
      const restore=path.match(/^\/api\/admin\/pages\/([a-zA-Z0-9-]+)\/restore$/);if(restore&&method==='POST'){await env.DB.prepare('UPDATE pages SET moderation_hidden=0 WHERE id=?').bind(restore[1]).run();return json({ok:true});}
      const review=path.match(/^\/api\/admin\/reports\/([a-zA-Z0-9-]+)$/);
      if(review&&method==='POST'){const input=await readJSON(request,5000),report=await env.DB.prepare('SELECT page_id FROM abuse_reports WHERE id=?').bind(review[1]).first();if(!report)throw new HttpError(404,'Report not found.');if(!['dismiss','hide'].includes(input.action))throw new HttpError(400,'Choose a review action.');const statements=[env.DB.prepare('UPDATE abuse_reports SET reviewed=1 WHERE id=?').bind(review[1])];if(input.action==='hide')statements.push(env.DB.prepare('UPDATE pages SET moderation_hidden=1 WHERE id=?').bind(report.page_id));await env.DB.batch(statements);return json({ok:true});}
      throw new HttpError(404,'This action could not be found.');
    }
    if(path==='/api/pages'&&method==='GET'){
      const {results}=await env.DB.prepare('SELECT id,slug,name,theme,published,version,updated_at FROM pages WHERE owner_id=? ORDER BY created_at,id').bind(ownerId).all();return json({pages:results});
    }
    if(path==='/api/pages'&&method==='POST'){
      const body=await readJSON(request);return json({page:await createPage(env,{...blankPage(body.name,body.slug),...body},ownerId)},201);
    }
    if(path==='/api/import'&&method==='POST'){
      const body=await readJSON(request);if(body.format!=='linkboard-page'||body.formatVersion!==1)throw new HttpError(400,'Choose a Linkboard page backup.');
      return json({page:await createPage(env,{...body.page,slug:body.slug||body.page.slug},ownerId)},201);
    }
    const match=path.match(/^\/api\/pages\/([a-zA-Z0-9-]+)(?:\/(preview|stats|export|website))?$/);
    if(match){
      const [,id,action]=match;await getPage(env,id,ownerId);
      if(!action&&method==='GET')return json({page:await getPage(env,id)});
      if(!action&&method==='PUT')return json({page:await savePage(env,id,await readJSON(request),ownerId)});
      if(!action&&method==='DELETE'){
        const input=await readJSON(request),p=await getPage(env,id);
        if(input.confirm!==p.slug)throw new HttpError(400,'Enter the page address to confirm deletion.');
        const r=await env.DB.prepare('DELETE FROM pages WHERE id=? AND version=? AND owner_id=?').bind(id,input.version,ownerId).run();
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
    const row=await env.DB.prepare('SELECT pages.id,pages.analytics FROM pages LEFT JOIN accounts ON accounts.id=pages.owner_id WHERE pages.slug=? AND pages.published=1 AND pages.moderation_hidden=0 AND (pages.owner_id IS NULL OR accounts.disabled=0)').bind(publicMatch[1]).first();
    if(!row)return html(notFound(),404);
    const p=await getPage(env,row.id);
    if(p.analytics&&countable(request))await record(env,p.id);
    return html(renderPage(p,{origin:publicOrigin(request,env)}));
  }
  const clickMatch=path.match(/^\/go\/([a-z0-9-]+)\/([a-zA-Z0-9-]+)$/);
  if(clickMatch){
    const link=await env.DB.prepare('SELECT links.url,links.id,pages.id AS page_id,pages.analytics FROM links JOIN pages ON pages.id=links.page_id LEFT JOIN accounts ON accounts.id=pages.owner_id WHERE pages.slug=? AND pages.published=1 AND pages.moderation_hidden=0 AND (pages.owner_id IS NULL OR accounts.disabled=0) AND links.id=? AND links.enabled=1 AND links.url<>?').bind(clickMatch[1],clickMatch[2],'').first();
    if(!link)return html(notFound(),404);
    if(link.analytics&&countable(request))await record(env,link.page_id,link.id);
    return new Response(null,{status:302,headers:{location:link.url,'cache-control':'no-store','referrer-policy':'no-referrer'}});
  }
  if(path==='/robots.txt')return new Response('User-agent: *\nDisallow: /api/\nDisallow: /go/\nAllow: /p/\n',{headers:{'content-type':'text/plain'}});
  if(['/app','/app/','/login','/signup'].includes(path))return env.ASSETS.fetch(new Request(new URL('/editor.html',request.url),request));
  if(['/report','/privacy','/terms'].includes(path))return env.ASSETS.fetch(new Request(new URL(path+'.html',request.url),request));
  if(path==='/')return env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request));
  if(path==='/favicon.ico')return new Response(null,{status:204});
  // Only explicit public assets are served. Database files and source never enter this directory.
  if(path==='/'||path==='/index.html'||/^\/[a-zA-Z0-9-]+\.(css|mjs|svg|html)$/.test(path)){
    const asset=await env.ASSETS.fetch(request);
    return asset;
  }
  return html(notFound(),404);
}
function pageLimit(env){const n=Number(env.MAX_PAGES_PER_USER||5);return Number.isInteger(n)&&n>=1&&n<=50?n:5;}
function notFound(){return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page unavailable</title><body style="background:#f3f6ee;color:#244334;font:16px Arial;margin:15vh auto;padding:24px;max-width:440px"><h1>This page isn’t available.</h1><p>Check the address or ask the page owner for the latest link.</p></body></html>';}
function secure(response,request){
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','strict-origin-when-cross-origin');
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy',"default-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
  if(new URL(request.url).protocol==='https:')headers.set('strict-transport-security','max-age=31536000');
  if(['/app','/app/','/login','/signup','/editor.html'].includes(new URL(request.url).pathname))headers.set('x-robots-tag','noindex, nofollow');
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
