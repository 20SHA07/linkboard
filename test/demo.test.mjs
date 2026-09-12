import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDemoAPI } from '../scripts/demo-api.mjs';
import { blankPage, validatePage } from '../public/core.mjs';

test('offline demo saves edits, restores them, and never claims a live deployment',async()=>{
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  installDemoAPI({blankPage,validatePage});let api=globalThis.LINKBOARD_DEMO_API;
  assert.equal((await api('/api/session')).demo,true);assert.equal((await api('/api/session')).origin,'');
  let p=(await api('/api/pages/qmc-starter')).page;p.name='QMC edited';p.links[0].url='https://example.com/';p.links[0].enabled=true;p.published=true;
  p=(await api('/api/pages/'+p.id,'PUT',p)).page;assert.equal(p.published,false);
  installDemoAPI({blankPage,validatePage});api=globalThis.LINKBOARD_DEMO_API;assert.equal((await api('/api/pages/qmc-starter')).page.name,'QMC edited');
  const extra=(await api('/api/pages','POST',blankPage('Second','second'))).page;assert.notEqual(extra.id,p.id);assert.equal((await api('/api/pages')).pages.length,2);
  await assert.rejects(api('/api/pages','POST',blankPage('Duplicate','second')),/already in use/);
  const backup=await api('/api/pages/'+p.id+'/export');const imported=await api('/api/import','POST',{...backup,slug:'restored'});assert.equal(imported.page.published,false);
  delete globalThis.localStorage;delete globalThis.LINKBOARD_DEMO_API;
});
test('the standalone demo builds without external scripts and its complete module parses',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'linkboard-demo-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const script=fileURLToPath(new URL('../scripts/build-preview.mjs',import.meta.url)),target=join(dir,'demo.html');
  const build=spawnSync(process.execPath,[script,target],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const html=await readFile(target,'utf8');const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];assert.equal(scripts.length,1);assert(scripts.every(s=>!s[1].includes('src=')));assert(!/<link[^>]+rel="stylesheet"/i.test(html));
  const module=scripts[0][2];assert(module);assert(!/^import /m.test(module));
  const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:module,encoding:'utf8'});assert.equal(check.status,0,check.stderr);
});
test('editor controls reference existing static or modal elements',async()=>{
  const html=await readFile(new URL('../public/editor.html',import.meta.url),'utf8'),app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
  const studio=await readFile(new URL('../public/studio.mjs',import.meta.url),'utf8');
  const ids=new Set([...`${html}\n${app}\n${studio}`.matchAll(/\bid="([a-z][a-z0-9-]*)"/g)].map(m=>m[1]));
  const missing=[...app.matchAll(/\$\('([a-z][a-z0-9-]*)'\)/g)].map(m=>m[1]).filter(id=>!ids.has(id));assert.deepEqual([...new Set(missing)],[]);
});

test('Pages demo builds for repository subpaths with embedded assets and clear local-only wording',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'linkboard-pages-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const script=fileURLToPath(new URL('../scripts/build-pages.mjs',import.meta.url));
  const build=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const html=await readFile(join(dir,'index.html'),'utf8');
  assert(html.includes('<title>Linkboard | Interactive editor demo</title>'));
  assert(html.includes('Sign-in and public publishing are unavailable in this demo.'));
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1);assert(scripts.every(s=>!s[1].includes('src=')));
  assert(!/<link[^>]+rel="stylesheet"/i.test(html));
  assert(!/href="\/(?:favicon|app|refine)/i.test(html));
  assert(html.includes('Copyright (c) 2024 ibelick'));assert(html.includes('installDemoAPI(Core)'));
  assert.equal(await readFile(join(dir,'.nojekyll'),'utf8'),'');
});
