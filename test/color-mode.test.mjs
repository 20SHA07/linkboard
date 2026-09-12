import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { initColorMode } from '../public/color-mode.mjs';
import { normalizeDesign, DARK_PALETTES, contrastRatio } from '../public/design.mjs';
import { blankPage, THEMES, renderPage, standaloneDocument } from '../public/core.mjs';

function browser({dark=false,blocked=false}={}){
  const environment=new EventTarget(),media=new EventTarget(),values=new Map();media.matches=dark;
  environment.localStorage={getItem(key){if(blocked)throw Error('blocked');return values.get(key)||null;},setItem(key,value){if(blocked)throw Error('full');values.set(key,value);}};
  environment.matchMedia=()=>media;
  const root={dataset:{}},first=new EventTarget(),second=new EventTarget();first.hidden=second.hidden=true;
  return {environment,media,values,root,controls:[first,second],changeSystem(dark){media.matches=dark;media.dispatchEvent(new Event('change'));}};
}

test('system appearance follows device changes; explicit choices synchronize controls and survive reload',()=>{
  const b=browser({dark:true});let notifications=0;
  const mode=initColorMode({...b,onApply:()=>notifications++});assert.equal(mode.get(),'system');assert.equal(b.root.dataset.colorMode,'dark');assert.equal(b.controls[0].hidden,false);
  b.changeSystem(false);assert.equal(b.root.dataset.colorMode,'light');
  b.controls[1].value='dark';b.controls[1].dispatchEvent(new Event('change'));assert.equal(mode.get(),'dark');assert.equal(b.controls[0].value,'dark');assert.equal(b.values.get('linkboard-editor-mode'),'dark');
  b.changeSystem(false);assert.equal(b.root.dataset.colorMode,'dark');
  mode.destroy();const restored=initColorMode({...b});assert.equal(restored.get(),'dark');restored.set('system');b.changeSystem(true);assert.equal(b.root.dataset.colorMode,'dark');restored.destroy();
  const before=notifications;b.changeSystem(false);assert.equal(notifications,before);
});
test('modes work without storage and respect owner defaults when visitor preferences are disabled',()=>{
  const b=browser({blocked:true});const mode=initColorMode({...b,defaultMode:'dark'});assert.equal(b.root.dataset.colorMode,'dark');assert.doesNotThrow(()=>mode.set('light'));assert.equal(b.root.dataset.colorMode,'light');mode.set('invalid');assert.equal(mode.get(),'light');mode.destroy();
  const c=browser();c.values.set('linkboard-editor-mode','dark');const fixed=initColorMode({...c,defaultMode:'light',persist:false});assert.equal(fixed.get(),'light');fixed.destroy();
});
test('editor and public page preferences stay separate and mode changes sync between tabs',()=>{
  const b=browser();b.values.set('linkboard-editor-mode','dark');b.values.set('linkboard-visitor-mode:/qmc/','light');
  const publicMode=initColorMode({...b,storageKey:'linkboard-visitor-mode:/qmc/'});assert.equal(publicMode.get(),'light');publicMode.set('dark');assert.equal(b.values.get('linkboard-editor-mode'),'dark');
  const unrelated=new Event('storage');Object.assign(unrelated,{key:'different',newValue:'light'});b.environment.dispatchEvent(unrelated);assert.equal(publicMode.get(),'dark');
  const changed=new Event('storage');Object.assign(changed,{key:'linkboard-visitor-mode:/qmc/',newValue:'system'});b.environment.dispatchEvent(changed);assert.equal(publicMode.get(),'system');
  const cleared=new Event('storage');Object.assign(cleared,{key:null,newValue:null});b.environment.dispatchEvent(cleared);assert.equal(publicMode.get(),'system');publicMode.destroy();
});
test('preset dark palettes have readable text and custom dark colours are validated',()=>{
  for(const [name,d] of Object.entries(DARK_PALETTES)){assert(Number(contrastRatio(d.ink,d.card))>=4.5,name+' button text');assert(Number(contrastRatio(d.muted,d.bg))>=4.5,name+' secondary text');}
  const oldMidnight=normalizeDesign({},THEMES.midnight);assert.equal(oldMidnight.colorMode,'dark');assert.equal(oldMidnight.darkBg,THEMES.midnight.bg);assert.notEqual(oldMidnight.bg,THEMES.midnight.bg);
  const custom=normalizeDesign({darkCustomColors:true,darkBg:'#123456',colorMode:'light'},THEMES.clover);assert.equal(custom.darkBg,'#123456');assert.equal(custom.colorMode,'light');
  assert.throws(()=>normalizeDesign({colorMode:'invalid'},THEMES.clover));assert.throws(()=>normalizeDesign({darkInk:'red;display:none'},THEMES.clover));
});
test('public CSS supports system mode without scripts and preview mode does not change saved design',()=>{
  const page=blankPage('QMC','qmc');page.design={colorMode:'system',darkCustomColors:true,darkBg:'#101020',background:'gradient'};
  const html=renderPage(page,{preview:true,mode:'dark'});assert(html.includes('data-mode="dark"'));assert(html.includes(':root[data-mode="dark"]'));assert(html.includes('@media(prefers-color-scheme:dark)'));assert(html.includes(':root[data-mode="system"]'));assert(html.includes('--bg:#101020'));assert(html.includes('var(--gradient-to)'));assert.equal(page.design.colorMode,'system');
});
test('exported website initializes modes on a GitHub project path even when sharing is hidden',async()=>{
  const page=blankPage('QMC','qmc');page.links=[{id:'qmc-link',title:'Our site',description:'',url:'https://example.com/social',icon:'link',enabled:true}];page.design={colorMode:'system',showShare:false};
  const sources=await Promise.all(['qr.mjs','page.mjs'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  const html=standaloneDocument(page,...sources),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert(!html.includes('id="share-dialog"'));assert(html.includes('id="page-mode"'));assert(!/<script[^>]+src=/.test(html));assert(html.includes('href="https://example.com/social"'));
  const b=browser();b.root.dataset={mode:'system',visitorMode:'true'};b.values.set('linkboard-visitor-mode:/qmc/','dark');let metaColor='';
  runInNewContext(script,{document:{body:{dataset:{publicUrl:''}},documentElement:b.root,getElementById:()=>null,querySelectorAll:()=>b.controls,querySelector:()=>({setAttribute:(key,value)=>metaColor=value})},location:{origin:'https://example.github.io',pathname:'/qmc/'},localStorage:b.environment.localStorage,matchMedia:b.environment.matchMedia,addEventListener:()=>{},getComputedStyle:()=>({getPropertyValue:()=>b.root.dataset.colorMode==='dark'?'#111d16':'#edf3e6'}),URL,TextEncoder,TextDecoder});
  assert.equal(b.root.dataset.colorMode,'dark');assert.equal(b.controls[0].value,'dark');assert.equal(metaColor,'#111d16');b.controls[0].value='light';b.controls[0].dispatchEvent(new Event('change'));assert.equal(b.values.get('linkboard-visitor-mode:/qmc/'),'light');assert.equal(b.root.dataset.colorMode,'light');
});
