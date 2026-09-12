import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../src/worker.mjs';
import { openDatabase } from '../src/db.mjs';
import { startServer } from '../src/local.mjs';
import { validatePage, blankPage } from '../public/core.mjs';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { createQR } from '../public/qr.mjs';

const KEY='a6bc74dd00d536cf691211171a0b3719de6c2ca461bca216be119b7bd99ff427';
function fixture(t){
  const env={DB:openDatabase(),ADMIN_KEY:KEY,ASSETS:{async fetch(request){const file=new URL(request.url).pathname.slice(1)||'index.html';return new Response(await readFile(new URL('../public/'+file,import.meta.url)),{headers:{'content-type':file.endsWith('.mjs')?'text/javascript':'text/html'}});}}};
  t.after(()=>env.DB.close());let cookie='';
  async function call(path,method='GET',body,options={}){
    const headers={'content-type':'application/json','x-linkboard':'1',origin:'https://links.example.org','user-agent':'Mozilla/5.0',...(options.auth===false?{}:{cookie}),...options.headers};
    if(options.noCSRF)delete headers['x-linkboard'];
    const request=new Request('https://links.example.org'+path,{method,headers,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
    const response=await worker.fetch(request,env);const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
    return {status:response.status,headers:response.headers,text,data};
  }
  return {env,call,login:()=>call('/api/login','POST',{key:KEY}),cookie:()=>cookie};
}
async function livePage(f){await f.login();const p=(await f.call('/api/pages/qmc-starter')).data.page;p.links[0].url='https://example.com/social';p.links[0].enabled=true;p.published=true;return (await f.call('/api/pages/'+p.id,'PUT',p)).data.page;}

test('private editor API requires a session; public draft and draft links stay private',async t=>{
  const f=fixture(t);
  for(const path of ['/api/pages','/api/pages/qmc-starter','/api/pages/qmc-starter/preview','/api/pages/qmc-starter/export','/api/pages/qmc-starter/website'])assert.equal((await f.call(path)).status,401,path);
  assert.equal((await f.call('/p/qmc')).status,404);assert.equal((await f.call('/go/qmc/qmc-instagram')).status,404);
  const session=await f.call('/api/session');assert.equal(session.data.authenticated,false);
  const root=await f.call('/');assert.equal(root.status,200);assert(root.headers.get('content-security-policy').includes("script-src 'self'"));assert.equal(root.headers.get('x-robots-tag'),'noindex, nofollow');
});
test('owner login uses a secure cookie and server-side revocable sessions',async t=>{
  const f=fixture(t);assert.equal((await f.call('/api/login','POST',{key:'wrong'})).status,401);
  const result=await f.login();assert.equal(result.status,200);for(const flag of ['__Host-linkboard=','HttpOnly','Secure','SameSite=Strict'])assert(result.headers.get('set-cookie').includes(flag));
  assert.equal((await f.call('/api/session')).data.authenticated,true);const original=f.cookie();
  assert.equal((await f.call('/api/logout','POST',{})).status,200);
  assert.equal((await f.call('/api/pages','GET',undefined,{headers:{cookie:original}})).status,401);
});
test('rotating the workspace key immediately invalidates existing sessions',async t=>{
  const f=fixture(t);await f.login();f.env.ADMIN_KEY='f'.repeat(64);assert.equal((await f.call('/api/pages')).status,401);
});
test('CSRF guards reject cross-origin and non-app writes',async t=>{
  const f=fixture(t);await f.login();
  assert.equal((await f.call('/api/pages','POST',blankPage('New','new'),{headers:{origin:'https://other.example'}})).status,403);
  assert.equal((await f.call('/api/pages','POST',blankPage('New','new'),{noCSRF:true})).status,403);
  assert.equal((await f.call('/api/pages','POST',blankPage('New','new'),{headers:{'content-type':'text/plain'}})).status,415);
});
test('repeated incorrect login attempts are limited',async t=>{
  const f=fixture(t);for(let i=0;i<10;i++)assert.equal((await f.call('/api/login','POST',{key:'wrong'})).status,401);
  assert.equal((await f.login()).status,429);
});
test('publishing validates links, then serves escaped HTML and working redirects',async t=>{
  const f=fixture(t);await f.login();let p=(await f.call('/api/pages/qmc-starter')).data.page;
  const invalid=await f.call('/api/pages/'+p.id,'PUT',{...p,published:true});assert.equal(invalid.status,400);assert.match(invalid.data.error,/at least one link/);
  p.name='<script>alert(1)</script>';p.bio='QMC <friends> & community';p.links[0].url='https://example.com/social';p.links[0].enabled=true;p.published=true;
  const saved=await f.call('/api/pages/'+p.id,'PUT',p);assert.equal(saved.status,200);assert.equal(saved.data.page.slug_locked,true);
  const publicPage=await f.call('/p/qmc');assert.equal(publicPage.status,200);assert(publicPage.text.includes('&lt;script&gt;'));assert(!publicPage.text.includes('<script>alert(1)</script>'));assert(publicPage.text.includes('/go/qmc/qmc-instagram'));assert(!publicPage.text.includes('/go/qmc/qmc-whatsapp'));
  const go=await f.call('/go/qmc/qmc-instagram');assert.equal(go.status,302);assert.equal(go.headers.get('location'),'https://example.com/social');
  assert.equal((await f.call('/go/other/qmc-instagram')).status,404);assert.equal((await f.call('/go/qmc/qmc-whatsapp')).status,404);
});
test('editing live links keeps the page address and never accepts a stale overwrite',async t=>{
  const f=fixture(t);const p=await livePage(f),old=structuredClone(p);
  p.links[0].url='https://example.com/updated';const updated=await f.call('/api/pages/'+p.id,'PUT',p);assert.equal(updated.status,200);
  assert.equal((await f.call('/api/pages/'+p.id,'PUT',old)).status,409);
  assert.equal((await f.call('/go/qmc/qmc-instagram')).headers.get('location'),'https://example.com/updated');
  assert.equal((await f.call('/api/pages/'+p.id,'PUT',{...updated.data.page,slug:'different'})).status,400);
});
test('simultaneous edits cannot mix link lists or bypass optimistic locking',async t=>{
  const f=fixture(t);const p=await livePage(f),a=structuredClone(p),b=structuredClone(p);a.name='First';a.links=a.links.slice(0,1);b.name='Second';b.links[0].title='Second link';
  const results=await Promise.all([f.call('/api/pages/'+p.id,'PUT',a),f.call('/api/pages/'+p.id,'PUT',b)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const saved=(await f.call('/api/pages/'+p.id)).data.page;
  assert(saved.name==='First'?saved.links.length===1&&saved.links[0].title==='Instagram':saved.name==='Second'&&saved.links[0].title==='Second link');
});
test('link ordering, disabled links, and deletion persist atomically',async t=>{
  const f=fixture(t);const p=await livePage(f);p.links.reverse();p.links=p.links.filter(l=>l.id!=='qmc-tiktok');p.links.find(l=>l.id==='qmc-whatsapp').url='https://example.com/whatsapp';
  const saved=await f.call('/api/pages/'+p.id,'PUT',p);assert.equal(saved.status,200);assert.deepEqual(saved.data.page.links.map(l=>l.id),p.links.map(l=>l.id));
  assert(!(await f.call('/p/qmc')).text.includes('/go/qmc/qmc-whatsapp'));
  const page=saved.data.page;page.published=false;assert.equal((await f.call('/api/pages/'+p.id,'PUT',page)).status,200);assert.equal((await f.call('/p/qmc')).status,404);assert.equal((await f.call('/go/qmc/qmc-instagram')).status,404);
});
test('unsafe URLs, invalid images, malformed JSON, and duplicate IDs are rejected',async t=>{
  const f=fixture(t);await f.login();const p=(await f.call('/api/pages/qmc-starter')).data.page;
  for(const url of ['javascript:alert(1)','data:text/html,<script>','http://example.com','https://user:pass@example.com','https://example.com\r\nSet-Cookie:x=1']){
    const value=structuredClone(p);value.links[0].url=url;assert.equal((await f.call('/api/pages/'+p.id,'PUT',value)).status,400,url);
  }
  assert.equal((await f.call('/api/pages/'+p.id,'PUT',{...p,avatar:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
  assert.equal((await f.call('/api/pages/'+p.id,'PUT',{...p,links:[p.links[0],p.links[0]]})).status,400);
  assert.equal((await f.call('/api/pages','POST','{bad')).status,400);
});
test('analytics are opt-in, count views and clicks, and honor privacy signals',async t=>{
  const f=fixture(t);let p=await livePage(f);await f.call('/p/qmc');assert.equal((await f.call('/api/pages/'+p.id+'/stats')).data.rows.length,0);
  p.analytics=true;p=(await f.call('/api/pages/'+p.id,'PUT',p)).data.page;
  await f.call('/p/qmc');await f.call('/go/qmc/qmc-instagram');await f.call('/p/qmc','HEAD');await f.call('/p/qmc','GET',undefined,{headers:{dnt:'1'}});await f.call('/p/qmc','GET',undefined,{headers:{'sec-gpc':'1'}});await f.call('/p/qmc','GET',undefined,{headers:{'user-agent':'Googlebot'}});
  const stats=(await f.call('/api/pages/'+p.id+'/stats')).data;assert.equal(stats.rows.find(r=>!r.link_id).count,1);assert.equal(stats.rows.find(r=>r.link_id==='qmc-instagram').count,1);
});
test('page backups import as separate drafts and duplicate slugs cannot overwrite pages',async t=>{
  const f=fixture(t);const p=await livePage(f),backup=(await f.call('/api/pages/'+p.id+'/export')).data;
  const same=await f.call('/api/import','POST',backup);assert.equal(same.status,409);
  const imported=await f.call('/api/import','POST',{...backup,slug:'qmc-copy'});assert.equal(imported.status,201);assert.equal(imported.data.page.published,false);assert.equal(imported.data.page.name,p.name);assert.notEqual(imported.data.page.links[0].id,p.links[0].id);
  assert.equal((await f.call('/p/qmc-copy')).status,404);assert.equal((await f.call('/p/qmc')).status,200);
});
test('page deletion requires the typed address and removes dependent data',async t=>{
  const f=fixture(t),p=await livePage(f);
  assert.equal((await f.call('/api/pages/'+p.id,'DELETE',{version:p.version,confirm:'wrong'})).status,400);
  assert.equal((await f.call('/api/pages/'+p.id,'DELETE',{version:p.version,confirm:p.slug})).status,200);
  assert.equal((await f.call('/p/qmc')).status,404);assert.equal((await f.call('/api/pages/'+p.id)).status,404);
  assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM links').first()).n,0);
});
test('the real local server persists edits across restart without re-adding starter links',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'linkboard-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  let server=await startServer({port:0,dataDir:dir,key:KEY,quiet:true});
  const login=await fetch(server.origin+'/api/login',{method:'POST',headers:{origin:server.origin,'content-type':'application/json','x-linkboard':'1'},body:JSON.stringify({key:KEY})});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];const headers={cookie,origin:server.origin,'content-type':'application/json','x-linkboard':'1'};
  let page=(await(await fetch(server.origin+'/api/pages/qmc-starter',{headers})).json()).page;page.links=page.links.slice(1);page.name='QMC saved';
  assert.equal((await fetch(server.origin+'/api/pages/'+page.id,{method:'PUT',headers,body:JSON.stringify(page)})).status,200);
  const css=await fetch(server.origin+'/app.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/text\/css/);
  const secret=await fetch(server.origin+'/.data/admin-key');assert.equal(secret.status,404);
  await server.close();server=await startServer({port:0,dataDir:dir,key:KEY,quiet:true});
  page=(await(await fetch(server.origin+'/api/pages/qmc-starter',{headers:{cookie}})).json()).page;assert.equal(page.name,'QMC saved');assert.equal(page.links.length,3);assert(!page.links.some(l=>l.id==='qmc-instagram'));await server.close();
});
test('QR exports are self-contained vectors with a white quiet zone and URL normalization',()=>{
  const qr=createQR('https://example.com/a');assert.match(qr,/viewBox="0 0 \d+ \d+"/);assert(qr.includes('fill="#fff"'));assert(qr.includes('shape-rendering="crispEdges"'));assert(qr.includes('width="1024"'));
  assert.equal(createQR('https://example.com/你好'),createQR('https://example.com/%E4%BD%A0%E5%A5%BD'));assert(!qr.includes('https://api.'));
});
test('100 links can be saved in small D1-compatible SQL batches',async t=>{
  const f=fixture(t);await f.login();const input=blankPage('Many links','many-links');input.links=Array.from({length:100},(_,i)=>({id:'link-'+i,title:'Link '+i,url:'https://example.com/'+i,description:'',icon:'link',enabled:true}));
  const created=await f.call('/api/pages','POST',input);assert.equal(created.status,201);assert.equal(created.data.page.links.length,100);
  const p=created.data.page;p.links.reverse();p.published=true;const saved=await f.call('/api/pages/'+p.id,'PUT',p);assert.equal(saved.status,200);assert.equal(saved.data.page.links[0].title,'Link 99');assert.equal(saved.data.page.links.length,100);
});

test('design choices, images, and individual link styles survive saving, publishing, and backup import',async t=>{
  const f=fixture(t);let p=await livePage(f);
  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE7sAAAAASUVORK5CYII=';
  p.font='mono';p.design={colorMode:'dark',darkCustomColors:true,darkBg:'#141f19',customColors:true,bg:'#ffccaa',ink:'#223344',card:'#fafafa',background:'gradient',gradientTo:'#ccbbaa',pattern:'dots',alignment:'left',layout:'grid',coverImage:pixel,avatarSize:120,headingFont:'editorial',headingSize:48,buttonRadius:7,buttonShadow:'hard',showArrows:false,showHeader:false,showShare:false,showModeToggle:false,showFooter:false,noteText:'Hello <friends>',customCSS:'.lp-profile h1 { font-style: italic; }'};
  p.links[0].appearance={customColors:true,bg:'#123456',ink:'#ffffff',border:'#345678',featured:true,badge:'Join <QMC>',thumbnail:pixel};
  const response=await f.call('/api/pages/'+p.id,'PUT',p);assert.equal(response.status,200,response.text);p=response.data.page;
  const restored=(await f.call('/api/pages/'+p.id)).data.page;assert.deepEqual(restored.design,p.design);assert.deepEqual(restored.links[0].appearance,p.links[0].appearance);
  const publicPage=await f.call('/p/qmc');assert.equal(publicPage.status,200);for(const text of ['--bg:#ffccaa','lp-links-grid','lp-featured','Join &lt;QMC&gt;',pixel,'font-style: italic','font-size:clamp(22px,10vw,48px)'])assert(publicPage.text.includes(text),text);
  for(const text of ['id="share-open"','id="share-dialog"','class="lp-top"','class="lp-footer"','class="lp-arrow"'])assert(!publicPage.text.includes(text),text);
  assert(publicPage.text.includes('Hello &lt;friends&gt;'));
  const backup=(await f.call('/api/pages/'+p.id+'/export')).data,copy=(await f.call('/api/import','POST',{...backup,slug:'qmc-designed'})).data.page;
  assert.deepEqual(copy.design,p.design);assert.deepEqual(copy.links[0].appearance,p.links[0].appearance);assert.equal(copy.published,false);
});
test('design validation rejects CSS breakout, unsafe images, injected colours, and unbounded values',async t=>{
  const f=fixture(t);await f.login();const p=(await f.call('/api/pages/qmc-starter')).data.page;
  const badDesigns=[{customCSS:'</style><script>alert(1)</script>'},{customCSS:'@import "https://example.com/style.css";'},{customCSS:'.x{background:expression(alert(1))}'},{bg:'#fff;display:none'},{coverImage:'https://example.com/picture.png'},{backgroundImage:'data:image/svg+xml;base64,PHN2Zz4='},{headingSize:999},{colorMode:'sepia'},{darkBg:'#fff;display:none'},{showModeToggle:'true'},{showShare:'false'},{layout:'</style>'},null];
  for(const design of badDesigns)assert.equal((await f.call('/api/pages/'+p.id,'PUT',{...p,design})).status,400,JSON.stringify(design));
  const invalid=structuredClone(p);invalid.links[0].appearance={ink:'#ffffff;display:none'};assert.equal((await f.call('/api/pages/'+p.id,'PUT',invalid)).status,400);
  invalid.links[0].appearance={badge:'x'.repeat(25)};assert.equal((await f.call('/api/pages/'+p.id,'PUT',invalid)).status,400);
});
test('standalone export contains direct links and inline sharing with no dependency on the old host',async t=>{
  const f=fixture(t);await f.login();assert.equal((await f.call('/api/pages/qmc-starter/website')).status,400);
  let p=await livePage(f);p.design={customColors:true,bg:'#faf0e0',buttonRadius:32};p=(await f.call('/api/pages/'+p.id,'PUT',p)).data.page;
  const output=await f.call('/api/pages/'+p.id+'/website');assert.equal(output.status,200,output.text);assert.match(output.headers.get('content-disposition'),/qmc\.html/);
  assert(output.text.includes('href="https://example.com/social"'));assert(output.text.includes('data-public-url=""'));assert(!output.text.includes('/go/qmc/'));assert(!output.text.includes('links.example.org'));assert(output.text.includes('--bg:#faf0e0'));
  assert(!/<script[^>]+src=|<link[^>]+rel="stylesheet"/i.test(output.text));
  const scripts=[...output.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];assert.equal(scripts.length,1);
  const check=spawnSync(process.execPath,['--check'],{input:scripts[0][1],encoding:'utf8'});assert.equal(check.status,0,check.stderr);assert(scripts[0][1].includes('location.origin+location.pathname'));
  assert(output.text.includes('Content-Security-Policy'));assert(output.text.includes('default-src &#39;none&#39;'));
});
test('upgrading a version 1 database preserves existing pages and removed links',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'linkboard-migration-'));t.after(()=>rm(dir,{recursive:true,force:true}));const filename=join(dir,'old.sqlite');
  const old=new DatabaseSync(filename);old.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));old.exec("CREATE TABLE local_migrations(name TEXT PRIMARY KEY); INSERT INTO local_migrations VALUES('0001_initial'); UPDATE pages SET name='Already edited',published=1,slug_locked=1; DELETE FROM links WHERE id='qmc-instagram'");old.close();
  const upgraded=openDatabase(filename);const page=await upgraded.prepare('SELECT * FROM pages WHERE id=?').bind('qmc-starter').first();assert.equal(page.name,'Already edited');assert.equal(page.published,1);assert.equal(page.design,'{}');assert.equal((await upgraded.prepare('SELECT count(*) AS n FROM links').first()).n,3);assert.equal((await upgraded.prepare('SELECT appearance FROM links LIMIT 1').first()).appearance,'{}');upgraded.close();
  const again=openDatabase(filename);assert.equal((await again.prepare('SELECT count(*) AS n FROM local_migrations').first()).n,2);again.close();
});
test('image payloads above the old limit are accepted and excessive total page sizes are rejected',async t=>{
  const f=fixture(t);await f.login();let p=(await f.call('/api/pages/qmc-starter')).data.page;
  // Synthetic base64 exercises request and storage limits; browser uploads encode actual images.
  p.avatar='data:image/png;base64,'+'A'.repeat(170000);p.design={backgroundImage:'data:image/png;base64,'+'A'.repeat(320000),coverImage:'data:image/png;base64,'+'A'.repeat(220000)};
  const result=await f.call('/api/pages/'+p.id,'PUT',p);assert.equal(result.status,200,result.text.slice(0,200));assert.equal(result.data.page.design.backgroundImage,p.design.backgroundImage);
  const oversize=blankPage('Large','large-page');oversize.links=Array.from({length:30},(_,i)=>({id:'size-'+i,title:'Link',url:'https://example.com/'+i,enabled:true,appearance:{thumbnail:'data:image/png;base64,'+'A'.repeat(74000)}}));
  assert.throws(()=>validatePage(oversize),/1.8 MB/);
});
