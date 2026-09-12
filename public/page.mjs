import { initColorMode } from './color-mode.mjs';
import { createQR } from './qr.mjs';
import { isHosted } from './core.mjs';
const get=id=>document.getElementById(id),dialog=get('share-dialog');
initColorMode({defaultMode:document.documentElement.dataset.mode,controls:document.querySelectorAll('#page-mode'),storageKey:'linkboard-visitor-mode:'+location.pathname,persist:document.documentElement.dataset.visitorMode==='true',onApply(){const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());}});
if(dialog&&get('share-open')){
  const url=document.body.dataset.publicUrl||location.origin+location.pathname;
  let svg='';
  get('share-open').addEventListener('click',()=>{
    get('share-status').textContent='';get('share-url').value=url;
    const ready=isHosted(url);get('share-download').hidden=!ready;get('share-qr').hidden=!ready;
    get('share-native').hidden=!navigator.share;
    get('share-description').textContent=ready?'One scan. All our socials.':'This page is running locally. Open its hosted address to get a QR code others can use.';
    if(ready){try{svg=createQR(url);get('share-qr').innerHTML=svg;}catch{get('share-download').hidden=true;get('share-qr').hidden=true;get('share-status').textContent='The QR code could not be created. You can still copy the link.';}}
    dialog.showModal();
  });
  get('share-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  get('share-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);get('share-status').textContent='Link copied.';}catch{get('share-url').focus();get('share-url').select();get('share-status').textContent='Copy the selected page link.';}});
  get('share-download').addEventListener('click',()=>{if(!svg)return;const objectURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=objectURL;a.download='page-qr.svg';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),3000);get('share-status').textContent='QR downloaded. Scan it once before printing.';});
  get('share-native').addEventListener('click',async()=>{try{await navigator.share({title:document.title,url});}catch(error){if(error.name!=='AbortError')get('share-status').textContent='Use Copy link to share this page.';}});
}
