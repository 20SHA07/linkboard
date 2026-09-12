import { createInterfaceMotion } from './interface-motion.mjs';
import { initColorMode } from './color-mode.mjs';
initColorMode({controls:document.querySelectorAll('[data-site-mode]'),storageKey:'linkboard-editor-mode',onApply(){const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();}});
const art=document.querySelector('.hero-art'),palettes={blue:['#dddefb','#353394','#f2f0ff'],rose:['#f4d6df','#823b57','#fff0f3'],green:['#dfe8c7','#3e5738','#f5f8e9']};
document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{const colors=palettes[button.dataset.palette];if(button.getAttribute('aria-pressed')!=='true')uiMotion.reveal(document.querySelector('.example-board'),{distance:0,duration:180});['--sample-bg','--sample-ink','--sample-card'].forEach((key,i)=>art.style.setProperty(key,colors[i]));document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',b===button));}));

const uiMotion=createInterfaceMotion();
uiMotion.group(document.querySelectorAll('.hero-copy > *, .example-board, .feature-card, .steps > li'));
uiMotion.detailOpen(document);
