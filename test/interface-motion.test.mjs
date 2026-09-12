import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInterfaceMotion, selectionBox } from '../public/interface-motion.mjs';

class Element extends EventTarget {
  constructor(rect={left:0,top:0,width:100,height:40}) {
    super();this.rect=rect;this.style={};this.hidden=false;this.isConnected=true;
    this.attributes=new Map();this.children=[];this.animations=[];
    const names=new Set();this.classList={add:(...v)=>v.forEach(x=>names.add(x)),remove:(...v)=>v.forEach(x=>names.delete(x)),contains:v=>names.has(v)};
    this.ownerDocument={createElement:()=>new Element()};
  }
  getBoundingClientRect(){return this.rect;}
  setAttribute(k,v){this.attributes.set(k,v);}
  getAttribute(k){return this.attributes.get(k)??null;}
  querySelectorAll(){return this.children.filter(x=>x.button);}
  prepend(child){this.children.unshift(child);child.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  animate(keyframes,options){
    let finish;const animation={keyframes,options,cancelled:false,finished:new Promise(resolve=>{finish=resolve;}),cancel(){this.cancelled=true;finish();}};
    this.animations.push(animation);return animation;
  }
}
function harness(matches=false){
  const preference=new EventTarget();preference.matches=matches;
  const callbacks=new Map();let next=0;
  const environment={matchMedia:()=>preference,requestAnimationFrame:fn=>{callbacks.set(++next,fn);return next;},cancelAnimationFrame:id=>callbacks.delete(id),getComputedStyle:el=>({...el.style})};
  return {environment,preference,flush(){const current=[...callbacks.values()];callbacks.clear();current.forEach(fn=>fn());},pending:()=>callbacks.size};
}
test('selection geometry includes track borders and scrolling',()=>{
  const track=new Element({left:100,top:80,width:200,height:300});Object.assign(track,{clientLeft:2,clientTop:3,scrollLeft:5,scrollTop:20});
  const target=new Element({left:115,top:125,width:160,height:38});
  assert.deepEqual(selectionBox(track,target),{x:18,y:62,width:160,height:38});
});
test('reveals preserve base transforms, replace only their own animation, and cancel for reduced motion',()=>{
  const h=harness(),motion=createInterfaceMotion(h.environment),toast=new Element();toast.style.transform='translateX(-50%)';
  const first=motion.reveal(toast,{distance:5,delay:45});
  assert.equal(toast.style.transform,'translateX(-50%)');assert(first.keyframes.every(frame=>!('transform' in frame)));
  assert.equal(first.options.fill,'backwards');assert.equal(first.options.delay,45);
  const second=motion.reveal(toast);assert.equal(first.cancelled,true);assert.equal(second.cancelled,false);
  h.preference.matches=true;h.preference.dispatchEvent(new Event('change'));assert.equal(second.cancelled,true);
  assert.equal(motion.reveal(toast),undefined);assert.equal(toast.animations.length,2);assert.equal(toast.hidden,false);
  motion.destroy();
});
test('selection motion preserves original buttons and click handlers, and snaps with reduced motion',()=>{
  const h=harness(),motion=createInterfaceMotion(h.environment),track=new Element();
  const a=new Element({left:0,top:0,width:100,height:40}),b=new Element({left:0,top:50,width:100,height:40});
  a.button=b.button=true;a.setAttribute('aria-pressed','true');b.setAttribute('aria-pressed','false');track.children=[a,b];
  let clicks=0;b.addEventListener('click',()=>{clicks++;a.setAttribute('aria-pressed','false');b.setAttribute('aria-pressed','true');});
  const control=motion.background(track,'button');h.flush();const indicator=track.children[0];
  assert.equal(indicator.getAttribute('aria-hidden'),'true');assert.equal(indicator.style.transform,'translate(0px, 0px)');
  b.dispatchEvent(new Event('click'));control.refresh();h.flush();
  assert.equal(clicks,1);assert.deepEqual(track.querySelectorAll('button'),[a,b]);assert.equal(indicator.style.transform,'translate(0px, 50px)');
  const animation=indicator.animations.at(-1);assert(animation);
  h.preference.matches=true;h.preference.dispatchEvent(new Event('change'));assert(animation.cancelled);
  a.setAttribute('aria-pressed','true');b.setAttribute('aria-pressed','false');control.refresh();h.flush();
  assert.equal(indicator.style.transform,'translate(0px, 0px)');assert.equal(indicator.animations.length,1);
  control.refresh();h.flush();assert.equal(h.pending(),0);
  motion.destroy();assert.deepEqual(track.children,[a,b]);assert.equal(track.classList.contains('lb-motion-ready'),false);
});
test('missing animation APIs and hidden selection tracks keep usable static controls',()=>{
  const h=harness(),motion=createInterfaceMotion(h.environment),element=new Element();element.animate=undefined;
  assert.doesNotThrow(()=>motion.reveal(element));assert.equal(element.hidden,false);
  const track=new Element(),button=new Element({left:0,top:0,width:0,height:0});button.button=true;button.setAttribute('aria-pressed','true');track.children=[button];
  const control=motion.background(track,'button');h.flush();assert.equal(track.classList.contains('lb-motion-ready'),false);
  button.rect={left:0,top:0,width:100,height:40};control.refresh();h.flush();assert.equal(track.classList.contains('lb-motion-ready'),true);
  button.disabled=true;control.refresh();h.flush();assert.equal(track.classList.contains('lb-motion-ready'),false);
  assert.equal(button.getAttribute('aria-pressed'),'true');motion.destroy();
});
test('native details toggling and group entrances retain content and do not attach twice',()=>{
  const h=harness(),motion=createInterfaceMotion(h.environment),detail=new Element(),summary=new Element(),content=new Element();
  summary.tagName='SUMMARY';content.tagName='DIV';detail.children=[summary,content];
  const root={querySelectorAll:()=>[detail]};motion.detailOpen(root);motion.detailOpen(root);
  detail.open=true;detail.dispatchEvent(new Event('toggle'));assert.equal(content.animations.length,1);assert.equal(summary.animations.length,0);
  detail.open=false;detail.dispatchEvent(new Event('toggle'));assert.equal(content.animations.length,1);
  const card=new Element();motion.group([card]);motion.group([card]);assert.equal(card.animations.length,1);
  motion.destroy();assert.equal(card.hidden,false);assert.equal(content.hidden,false);
});
