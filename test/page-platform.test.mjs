import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { blankPage,renderPage,standaloneDocument,validatePage } from '../public/core.mjs';
import { createQR } from '../public/qr.mjs';
import { platform } from './helpers/platform.mjs';

const sample=()=>({...blankPage('QMC','qmc'),links:[{id:'our-site',title:'Website',url:'https://example.com/',description:'',enabled:true,icon:'globe'}]});
test('on-page QR follows its position and remains independent of share and footer settings',()=>{
  const page=sample();page.design={showQRCode:true,showShare:false,showFooter:false,qrPosition:'top',qrLabel:'A <caption>',qrSize:200,layout:'split',pageWidth:1080};
  const html=renderPage(page,{origin:'https://links.example.org'});assert(html.includes('id="inline-qr"'));assert(html.includes('A &lt;caption&gt;'));assert(!html.includes('id="share-open"'));assert(html.indexOf('id="inline-qr"')<html.indexOf('<ul class="lp-links'));assert(html.includes('grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)'));assert(html.includes('/report?slug=qmc'));
  page.design.qrPosition='bottom';const bottom=renderPage(page);assert(bottom.indexOf('id="inline-qr"')>bottom.indexOf('<ul class="lp-links'));
  page.design.showQRCode=false;assert(!renderPage(page).includes('id="inline-qr"'));assert.throws(()=>validatePage({...page,design:{qrSize:500}}));
});
test('exported on-page QR encodes the actual GitHub project URL with no old-host dependency',async()=>{
  const page=sample();page.design={showShare:false,showQRCode:true};const sources=await Promise.all(['qr.mjs','page.mjs'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  const html=standaloneDocument(page,...sources),code=html.match(/<script>([\s\S]*?)<\/script>/)[1],box={innerHTML:''},download={hidden:true};
  const root={dataset:{mode:'system',visitorMode:'true'}},document={body:{dataset:{publicUrl:''}},documentElement:root,getElementById:id=>id==='inline-qr'?box:id==='inline-qr-download'?download:null,querySelectorAll:()=>[],querySelector:()=>null};
  runInNewContext(code,{document,location:{origin:'https://20sha07.github.io',pathname:'/qmc/'},getComputedStyle:()=>({getPropertyValue:()=>''}),URL,TextEncoder,TextDecoder});
  assert.equal(box.innerHTML,createQR('https://20sha07.github.io/qmc/'));assert.equal(download.hidden,false);assert.equal(typeof download.onclick,'function');assert(!html.includes('Report this page'));
});
test('landing, account, policy, and report routes are served through configured Worker paths',async t=>{
  const f=platform(t),visitor=f.client();
  const expected={'/':'Every side of you','/login':'account-root','/signup':'account-root','/app':'account-root','/report':'report-form','/terms':'Community terms','/privacy':'Your information on Linkboard'};
  for(const [path,content] of Object.entries(expected)){const result=await visitor.call(path);assert.equal(result.status,200,path);assert(result.text.includes(content),path);if(['/login','/signup','/app'].includes(path))assert.equal(result.headers.get('x-robots-tag'),'noindex, nofollow');}
  const config=JSON.parse(await readFile(new URL('../wrangler.example.jsonc',import.meta.url),'utf8'));assert.equal(config.assets.html_handling,'none');for(const path of Object.keys(expected))assert(config.assets.run_worker_first.includes(path),path);
  assert.equal((await visitor.call('/.env')).status,404);assert.equal((await visitor.call('/src/auth.mjs')).status,404);
});
