import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platform,LEGACY_KEY } from './helpers/platform.mjs';
import { OWNER,OTHER,PASSWORD } from './helpers/auth-provider.mjs';
import { blankPage } from '../public/core.mjs';

async function create(client,name='My page',slug='my-page'){
  const input=blankPage(name,slug);input.links=[{id:'original-link',title:'Website',url:'https://example.com/',description:'',icon:'globe',enabled:true}];
  const result=await client.call('/api/pages','POST',input);assert.equal(result.status,201,result.text);return result.data.page;
}
async function publish(client,page){const result=await client.call('/api/pages/'+page.id,'PUT',{...page,published:true});assert.equal(result.status,200,result.text);return result.data.page;}

test('signup verifies email, issues an opaque cookie, and exposes no provider credentials',async t=>{
  const f=platform(t),c=f.client(),email='new@example.com';
  const signup=await c.call('/api/auth/signup','POST',{displayName:'New person',email,password:PASSWORD,captchaToken:'test-captcha'});assert.equal(signup.status,200);assert(signup.data.verificationRequired);assert(!signup.headers.has('set-cookie'));
  assert.equal((await c.login(email)).status,401);assert.equal((await c.call('/api/auth/verify','POST',{email,code:'000000',type:'signup'})).status,401);
  const result=await c.call('/api/auth/verify','POST',{email,code:'123456',type:'signup'});assert.equal(result.status,200);assert.equal(result.data.user.email,email);assert(!result.text.includes('access_token'));
  assert.equal((await c.call('/api/pages')).data.pages.length,0);assert.equal((await c.call('/api/session')).data.user.displayName,'New person');
  const row=await f.env.DB.prepare('SELECT * FROM account_sessions').first();assert(!row.token_hash.includes(c.cookie().split('=')[1]));assert(!row.token_box.includes('access_token'));assert(!row.token_box.includes(PASSWORD));
  const outbound=f.provider.requests.find(r=>r.path==='signup');assert.equal(outbound.body.gotrue_meta_security.captcha_token,'test-captcha');assert.equal(outbound.headers.apikey,f.env.SUPABASE_PUBLISHABLE_KEY);
  const config=await c.call('/api/config');assert.equal(config.data.configured,true);assert(!config.text.includes('SESSION_SECRET'));assert(!config.text.includes(f.env.SUPABASE_PUBLISHABLE_KEY));
});

test('each account owns only its own pages, including all export and statistics endpoints',async t=>{
  const f=platform(t),a=f.client(),b=f.client();await a.login();await b.login(OTHER);
  const page=await create(a);assert.equal((await b.call('/api/pages')).data.pages.length,0);
  for(const action of ['','/preview','/stats','/export','/website'])assert.equal((await b.call('/api/pages/'+page.id+action)).status,404,action);
  assert.equal((await b.call('/api/pages/'+page.id,'PUT',{...page,name:'Stolen'})).status,404);
  assert.equal((await b.call('/api/pages/'+page.id,'DELETE',{version:page.version,confirm:page.slug})).status,404);
  const other=await b.call('/api/pages','POST',{...blankPage('Another','another'),owner_id:page.owner_id,id:page.id});assert.equal(other.status,201);assert.notEqual(other.data.page.owner_id,page.owner_id);assert.notEqual(other.data.page.id,page.id);
  assert.equal((await a.call('/api/pages')).data.pages.length,1);assert.equal((await b.call('/api/pages')).data.pages.length,1);
});

test('a published page remains public while editing remains private',async t=>{
  const f=platform(t),a=f.client(),visitor=f.client();await a.login();const page=await publish(a,await create(a));
  assert.equal((await visitor.call('/p/'+page.slug)).status,200);assert.equal((await visitor.call('/go/'+page.slug+'/'+page.links[0].id)).status,302);
  assert.equal((await visitor.call('/api/pages/'+page.id)).status,401);
});

test('legacy workspace keys cannot sign in and only claim previously unowned pages',async t=>{
  const f=platform(t),a=f.client(),b=f.client();assert.equal((await a.call('/api/login','POST',{key:LEGACY_KEY})).status,400);
  await a.login();await b.login(OTHER);assert.equal((await a.call('/api/pages/qmc-starter')).status,404);
  assert.equal((await a.call('/api/account/claim','POST',{key:'wrong'})).status,403);
  const claim=await a.call('/api/account/claim','POST',{key:LEGACY_KEY});assert.equal(claim.status,200);assert.equal(claim.data.claimed,1);
  assert.equal((await b.call('/api/account/claim','POST',{key:LEGACY_KEY})).data.claimed,0);assert.equal((await b.call('/api/pages/qmc-starter')).status,404);assert.equal((await a.call('/api/pages/qmc-starter')).status,200);
});

test('duplicate names cannot overwrite another account and backups always get new ownership',async t=>{
  const f=platform(t),a=f.client(),b=f.client();await a.login();await b.login(OTHER);const page=await create(a);
  assert.equal((await b.call('/api/pages','POST',blankPage('Duplicate',page.slug))).status,409);
  const backup=(await a.call('/api/pages/'+page.id+'/export')).data;const result=await b.call('/api/import','POST',{...backup,slug:'imported-page'});assert.equal(result.status,201);assert.notEqual(result.data.page.owner_id,page.owner_id);assert.notEqual(result.data.page.links[0].id,page.links[0].id);assert.equal(result.data.page.published,false);
});

test('per-account page limits hold under concurrent creation and do not leak orphan links',async t=>{
  const f=platform(t),a=f.client(),b=f.client();f.env.MAX_PAGES_PER_USER='1';await a.login();await b.login(OTHER);
  const input=blankPage('Page','first');input.links=[{id:'x',title:'Link',url:'https://example.com/',icon:'link',enabled:true}];
  const results=await Promise.all([a.call('/api/pages','POST',input),a.call('/api/pages','POST',{...input,slug:'second'})]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal((await a.call('/api/pages')).data.pages.length,1);assert.equal((await b.call('/api/pages','POST',blankPage('Other','other'))).status,201);
  assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM links WHERE page_id<>?').bind('qmc-starter').first()).n,1);
});

test('password recovery sessions cannot edit pages and password changes revoke all app sessions',async t=>{
  const f=platform(t),a=f.client(),b=f.client(),recovery=f.client();await a.login();await b.login();const page=await create(a);
  assert.equal((await recovery.call('/api/auth/recover','POST',{email:OWNER})).status,200);
  const verified=await recovery.call('/api/auth/verify','POST',{email:OWNER,code:'123456',type:'recovery'});assert.equal(verified.status,200);assert(verified.data.needsPasswordReset);
  assert.equal((await recovery.call('/api/pages')).status,403);assert.equal((await recovery.call('/api/account/claim','POST',{key:LEGACY_KEY})).status,403);assert.equal((await recovery.call('/api/session')).data.needsPasswordReset,true);
  const changed=await recovery.call('/api/auth/password','POST',{password:'a different long password'});assert.equal(changed.status,200);assert(changed.data.signInRequired);
  assert.equal((await a.call('/api/pages/'+page.id)).status,401);assert.equal((await b.call('/api/pages')).status,401);assert.equal((await recovery.call('/api/session')).data.authenticated,false);
  assert.equal((await a.login(OWNER)).status,401);assert.equal((await a.login(OWNER,'a different long password')).status,200);
});

test('an ordinary password change requires the current password',async t=>{
  const f=platform(t),a=f.client();await a.login();
  assert.equal((await a.call('/api/auth/password','POST',{password:'another longer password',currentPassword:'wrong'})).status,401);
  assert.equal((await a.call('/api/auth/password','POST',{password:'another longer password',currentPassword:PASSWORD})).status,200);
  assert.equal((await a.call('/api/session')).data.authenticated,false);
});

test('expired provider tokens refresh, concurrent refreshes stay usable, and outages preserve sessions',async t=>{
  const f=platform(t),a=f.client();await a.login();f.provider.access.clear();
  const results=await Promise.all([a.call('/api/pages'),a.call('/api/pages')]);assert(results.every(r=>r.status===200));assert(f.provider.requests.some(r=>r.body.refresh_token));assert.equal((await a.call('/api/session')).data.authenticated,true);
  f.provider.outage();assert.equal((await a.call('/api/pages')).status,503);assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM account_sessions').first()).n,1);f.provider.outage(false);assert.equal((await a.call('/api/pages')).status,200);
  f.provider.access.clear();f.provider.refresh.clear();assert.equal((await a.call('/api/pages')).status,401);assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM account_sessions').first()).n,0);
});

test('disabled accounts lose private and public access',async t=>{
  const f=platform(t),a=f.client(),visitor=f.client();await a.login();const page=await publish(a,await create(a));
  await f.env.DB.prepare('UPDATE accounts SET disabled=1 WHERE email=?').bind(OWNER).run();assert.equal((await a.call('/api/pages')).status,401);assert.equal((await visitor.call('/p/'+page.slug)).status,404);assert.equal((await visitor.call('/go/'+page.slug+'/'+page.links[0].id)).status,404);assert.equal((await a.login()).status,403);
});

test('public reports can be reviewed only by the verified owner, with reversible hiding',async t=>{
  const f=platform(t),owner=f.client(),creator=f.client(),visitor=f.client();await owner.login();await creator.login(OTHER);const page=await publish(creator,await create(creator));
  f.provider.users.get(OTHER).user_metadata.admin=true;
  assert.equal((await creator.call('/api/admin/reports')).status,403);
  assert.equal((await visitor.call('/api/report','POST',{slug:page.slug,reason:'This page appears to be impersonating another community.'})).status,200);
  const report=(await owner.call('/api/admin/reports')).data.reports[0];assert(report);
  assert.equal((await owner.call('/api/admin/reports/'+report.id,'POST',{action:'hide'})).status,200);
  assert.equal((await visitor.call('/p/'+page.slug)).status,404);assert.equal((await visitor.call('/go/'+page.slug+'/'+page.links[0].id)).status,404);assert.equal((await creator.call('/api/pages/'+page.id)).status,200);
  assert.equal((await owner.call('/api/admin/reports')).data.hidden.length,1);
  assert.equal((await owner.call('/api/admin/pages/'+page.id+'/restore','POST',{})).status,200);assert.equal((await visitor.call('/p/'+page.slug)).status,200);
});

test('closed registration still permits existing members and blocks new accounts through login too',async t=>{
  const f=platform(t),a=f.client(),b=f.client();await a.login();f.env.REGISTRATION_OPEN='false';
  assert.equal((await a.call('/api/auth/signup','POST',{email:'new@example.com',displayName:'New',password:PASSWORD})).status,403);
  assert.equal((await b.login(OTHER)).status,403);assert.equal((await a.login()).status,200);
});

test('account endpoints enforce origin, request limits, and neutral recovery messages',async t=>{
  const f=platform(t),a=f.client();assert.equal((await a.call('/api/auth/signup','POST',{email:OWNER,displayName:'Test',password:PASSWORD},{origin:'https://elsewhere.example'})).status,403);
  assert.equal((await a.call('/api/login','POST',{email:OWNER,password:PASSWORD},{'x-linkboard':''})).status,403);
  assert.equal((await a.call('/api/auth/signup','POST',{email:'bad',displayName:'Test',password:PASSWORD})).status,400);
  assert.equal((await a.call('/api/auth/signup','POST',{email:OTHER,displayName:'Test',password:'short'})).status,400);
  const known=await a.call('/api/auth/recover','POST',{email:OWNER}),unknown=await a.call('/api/auth/recover','POST',{email:'absent@example.com'});assert.deepEqual(known.data,unknown.data);
  assert.equal((await a.call('/api/auth/signup','POST',{email:OTHER,displayName:'A'.repeat(14000),password:PASSWORD})).status,413);
  delete f.env.SUPABASE_URL;assert.equal((await a.call('/api/config')).data.configured,false);assert.equal((await a.login()).status,503);
});
