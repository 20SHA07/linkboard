import { initColorMode } from './color-mode.mjs';
import { THEMES, SOCIALS, icon, escapeHTML as e, renderPage, safeLink, isHosted, blankPage } from './core.mjs';
import { normalizeDesign, normalizeLinkStyle } from './design.mjs';
import { studioHTML, bindStudio, linkStyleHTML, prepareImage } from './studio.mjs';
import { createQR } from './qr.mjs';

const $=id=>document.getElementById(id);
const state={pages:[],page:null,saved:null,dirty:false,saving:false,view:'links',origin:'',demo:false,stats:null,previewTimer:null,previewMode:'page',uploads:0};
let toastTimer,dragId=null,undoAction=null;
const viewCopy={links:['BUILD YOUR PAGE','A home for your links.','The good stuff, all in one place.'],appearance:['SET THE TONE','A little more you.','Find a look that feels right.'],insights:['FOLLOW THE CONNECTIONS','See what’s clicking.','A simple look at how people find you.'],share:['TAKE IT WITH YOU','One page. Everywhere.','Share a link, print a code, spread the word.'],settings:['THE LITTLE DETAILS','Make yourself at home.','Your page, just the way you want it.']};
function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
async function api(path,method='GET',body){
  if(globalThis.LINKBOARD_DEMO_API)return globalThis.LINKBOARD_DEMO_API(path,method,body);
  let response;
  try{response=await fetch(path,{method,credentials:'same-origin',headers:{'content-type':'application/json','x-linkboard':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{throw new Error('Couldn’t connect. Your unsaved changes are still here. Try again.');}
  const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!response.ok){const error=new Error(data.error||'Something went wrong.');error.status=response.status;if(response.status===401&&path!=='/api/login'){showLogin();}throw error;}
  return data;
}
function toast(message,undo){clearTimeout(toastTimer);$('toast-text').textContent=message;$('toast').hidden=false;undoAction=undo||null;$('toast-action').hidden=!undo;toastTimer=setTimeout(()=>$('toast').hidden=true,undo?9000:6500);}
function showLogin(){ $('boot').hidden=true;$('app').hidden=true;$('login').hidden=false; }
function openModal(title,content){$('modal').classList.remove('wide-modal');$('modal-title').textContent=title;$('modal-body').innerHTML=content;fillIcons($('modal'));if(!$('modal').open)$('modal').showModal();}
function confirmAction(title,message,label='Continue'){
  return new Promise(resolve=>{
    openModal(title,`<p>${e(message)}</p><div class="button-row"><button class="btn secondary" id="confirm-cancel">Cancel</button><button class="btn primary" id="confirm-ok">${e(label)}</button></div>`);
    const onClose=()=>resolve(false);$('modal').addEventListener('close',onClose,{once:true});
    $('confirm-cancel').onclick=()=>$('modal').close();$('confirm-ok').onclick=()=>{resolve(true);$('modal').close();};
  });
}
async function canLeave(){if(state.saving)return false;return !state.dirty||await confirmAction('Leave unsaved changes?','Your saved page will stay as it is. Changes you haven’t saved will be discarded.','Discard changes');}
function refreshToolbar(){
  const p=state.page;$('save-state').classList.toggle('dirty',state.dirty);$('save-state').innerHTML='<i></i>'+(state.saving?'Saving…':state.dirty?'Unsaved changes':'All changes saved');
  $('save-page').disabled=!p||state.saving||state.uploads>0||(!state.dirty&&p.published);
  $('save-page').innerHTML=(state.saving?'Saving…':state.demo?'Save demo':p?.published?'Save changes':'Publish page')+' '+icon(p?.published?'check':'arrow');
  $('save-draft').hidden=!p||p.published||!state.dirty||state.demo;$('save-draft').disabled=state.saving||state.uploads>0;
  $('open-page').disabled=!p?.published||state.demo;$('unpublish-page').disabled=!p?.published||state.demo;
  if(p){$('page-status').textContent=p.published?'Published':'Draft';$('page-status').className='status-pill '+(p.published?'live':'draft');}
}
function markDirty(){state.dirty=true;refreshToolbar();renderPreview();}
function renderPreview(){clearTimeout(state.previewTimer);state.previewTimer=setTimeout(()=>{if(!state.page)return;try{$('preview-frame').srcdoc=renderPage(state.page,{preview:true,mode:state.previewMode});$('preview-error').hidden=true;}catch(error){$('preview-error').textContent=error.message;$('preview-error').hidden=false;}},100);}
function renderPicker(){
  $('page-picker').innerHTML=state.pages.length?state.pages.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join(''):'<option value="">No pages yet</option>';
  $('page-picker').value=state.page?.id||'';
}
function renderLinks(){
  if(!state.page)return;
  const links=state.page.links;$('links-total').textContent=links.length;$('link-count').textContent=links.filter(l=>l.enabled&&safeLink(l.url)).length;
  const moves=(i,cls='')=>`<div class="${cls}"><button type="button" class="icon-button" data-move="-1" ${i===0?'disabled':''} aria-label="Move ${e(links[i].title)} up">${icon('up')}</button><button type="button" class="icon-button" data-move="1" ${i===links.length-1?'disabled':''} aria-label="Move ${e(links[i].title)} down">${icon('down')}</button></div>`;
  $('link-list').innerHTML=links.length?links.map((l,i)=>`<article class="link-row" data-id="${e(l.id)}"><div class="link-row-main"><div class="link-controls"><button type="button" class="icon-button drag-handle" draggable="true" aria-label="Drag ${e(l.title)} to reorder">${icon('grip')}</button>${moves(i)}</div><span class="link-symbol">${icon(l.icon)}</span><div class="link-content"><input class="link-input title" value="${e(l.title)}" data-link-field="title" maxlength="80" aria-label="Link title"><input class="link-input" type="text" inputmode="url" value="${e(l.url)}" data-link-field="url" maxlength="2048" placeholder="Paste your social URL…" aria-label="URL for ${e(l.title)}"><p class="link-incomplete" ${safeLink(l.url)?'hidden':''}>Add a valid URL, then switch this link on.</p></div><div class="link-row-actions"><label class="switch"><input type="checkbox" data-link-field="enabled" ${l.enabled?'checked':''} ${!safeLink(l.url)?'disabled':''} aria-label="Show ${e(l.title)} on your page"><span></span></label><button class="icon-button" data-remove-link aria-label="Remove ${e(l.title)}">${icon('trash')}</button></div></div><details class="link-more"><summary>Link details</summary><div class="link-detail-fields"><label>Description<input value="${e(l.description)}" data-link-field="description" maxlength="140" placeholder="An optional short note"></label><label>Icon<select data-link-field="icon">${SOCIALS.map(s=>`<option value="${s}" ${s===l.icon?'selected':''}>${s==='link'?'Link':s==='x'?'X':s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select></label></div><button type="button" class="text-button link-style-button" data-customize-link>${icon('paint')} Style this link</button>${moves(i,'mobile-move')}</details></article>`).join(''):'<div class="lp-empty editor-empty">Your page is ready for its first link.<br>Start with a social profile, website, or email address.</div>';
}
function renderAppearance(){
  const p=state.page;if(!p)return;
  $('theme-grid').innerHTML=Object.entries(THEMES).map(([id,t])=>`<button class="theme-option" data-theme="${id}" aria-label="${t.name} theme" aria-pressed="${p.theme===id}"><span class="theme-mini" style="background:${t.bg}"><b style="background:${t.ink}"></b><i style="background:${t.card}"></i><i style="background:${t.card}"></i><i style="background:${t.card}"></i></span><span class="theme-name">${t.name}${p.theme===id?icon('check'):''}</span></button>`).join('');
  const openGroups=[...$('design-studio').querySelectorAll('details[open]')].map(el=>el.dataset.studioGroup);
  $('design-studio').innerHTML=studioHTML(p);if(openGroups.length)$('design-studio').querySelectorAll('details').forEach(el=>el.open=openGroups.includes(el.dataset.studioGroup));
  $('font-select').value=p.font;document.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.shape===p.shape));$('branding-toggle').checked=p.branding;$('remove-avatar').disabled=!p.avatar;
}
function renderPageEditor(){
  const p=state.page;document.body.classList.toggle('no-pages',!p);$('empty-workspace').hidden=!!p;document.querySelector('.page-heading').hidden=!p;
  renderPicker();refreshToolbar();
  if(!p){document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=true);$('breadcrumb-page').textContent='Your pages';return;}
  $('breadcrumb-page').textContent=p.name;$('page-name').value=p.name;$('page-bio').value=p.bio;
  $('editor-avatar').innerHTML=p.avatar?`<img src="${e(p.avatar)}" alt="">`:e(p.name.length<=4?p.name:p.name.split(/\s+/).map(w=>w[0]).slice(0,2).join(''));
  $('page-slug').value=p.slug;$('page-slug').disabled=!!p.slug_locked;$('analytics-toggle').checked=p.analytics;
  renderLinks();renderAppearance();renderPreview();switchView(state.view);
}
async function loadPage(id){const {page}=await api('/api/pages/'+id);state.page=page;state.saved=structuredClone(page);state.dirty=false;state.stats=null;renderPageEditor();}
async function loadWorkspace(preferredId){
  const data=await api('/api/pages');state.pages=data.pages;
  if(data.pages.length)await loadPage(data.pages.find(p=>p.id===preferredId)?.id||data.pages[0].id);
  else{state.page=null;state.dirty=false;renderPageEditor();}
}
async function savePage(publish=state.page?.published){
  if(!state.page||state.saving)return false;if(state.uploads){toast('Your image is still being prepared. Save in a moment.');return false;}
  state.saving=true;document.querySelector('.editor-column').inert=true;refreshToolbar();
  try{
    const {page,storage}=await api('/api/pages/'+state.page.id,'PUT',{...structuredClone(state.page),published:state.demo?false:!!publish});
    state.page=page;state.saved=structuredClone(page);state.dirty=false;state.pages=state.pages.map(p=>p.id===page.id?{...p,...page}:p);
    toast(state.demo?(storage===false?'Saved for this session only. Browser storage is unavailable or full; download a backup to keep your edits.':'Demo changes saved in this browser.'):page.published?'Your page is published and up to date.':'Draft saved.');renderPageEditor();return true;
  }catch(error){toast(error.message);return false;}
  finally{state.saving=false;document.querySelector('.editor-column').inert=false;refreshToolbar();}
}
function switchView(view){
  if(!viewCopy[view])view='links';state.view=view;
  const copy=viewCopy[view];$('view-eyebrow').textContent=copy[0];$('view-title').textContent=copy[1];$('view-description').textContent=copy[2];
  document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==view||!state.page);
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(state.page&&view==='insights')loadStats().catch(error=>toast(error.message));if(state.page&&view==='share')renderShare();
}
function moveLink(id,offset){const items=state.page.links,from=items.findIndex(l=>l.id===id),to=from+offset;if(from<0||to<0||to>=items.length)return;items.splice(to,0,items.splice(from,1)[0]);renderLinks();markDirty();}
async function addPageDialog(copy){
  if(!await canLeave())return;
  const defaultName=copy?copy.name+' copy':'',defaultSlug=copy?copy.slug.slice(0,39)+'-copy':'';
  openModal(copy?'A fresh copy.':'Make a little space.',`<form id="new-page-form"><p>${copy?'Your links and design will be copied into a new private draft.':'Start with a name and an address. You can add links and choose a theme next.'}</p><label for="new-name">Page name</label><input id="new-name" maxlength="60" required value="${e(defaultName)}" placeholder="A community, project, or your name"><label for="new-slug">Page address</label><input id="new-slug" required minlength="2" maxlength="48" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${e(defaultSlug)}" placeholder="your-name"><p class="field-error" id="modal-error" role="alert"></p><div class="button-row"><button type="button" class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" type="submit">Create page ${icon('arrow')}</button></div></form>`);
  let manuallyChanged=!!copy;$('new-slug').oninput=()=>manuallyChanged=true;$('new-name').oninput=()=>{if(!manuallyChanged)$('new-slug').value=$('new-name').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);};
  $('new-page-form').onsubmit=async event=>{
    event.preventDefault();const btn=event.submitter;btn.disabled=true;
    try{const input={...(copy||blankPage()),name:$('new-name').value,slug:$('new-slug').value,published:false};const {page}=await api('/api/pages','POST',input);$('modal').close();state.dirty=false;await loadWorkspace(page.id);switchView('links');toast('Your new page is ready.');}catch(error){$('modal-error').textContent=error.message;btn.disabled=false;}
  };
}
function addLinkDialog(){
  if(!state.page)return;let selected='link';
  openModal('Add something good.',`<form id="new-link-form"><p>A social profile, your website, or anything you want people to find.</p><div class="social-choices">${SOCIALS.map(s=>`<button class="social-choice" type="button" data-social="${s}" aria-label="${s} icon" aria-pressed="${s==='link'}">${icon(s)}</button>`).join('')}</div><label for="new-link-title">Title</label><input id="new-link-title" maxlength="80" required placeholder="e.g. Instagram"><label for="new-link-url">Link</label><input id="new-link-url" type="text" inputmode="url" maxlength="2048" required placeholder="https://…"><label for="new-link-description">Short description <span class="optional">(optional)</span></label><input id="new-link-description" maxlength="140" placeholder="A little context helps"><p class="field-error" id="modal-error" role="alert"></p><div class="button-row"><button type="button" class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" type="submit">Add link ${icon('plus')}</button></div></form>`);
  document.querySelectorAll('[data-social]').forEach(button=>button.onclick=()=>{selected=button.dataset.social;document.querySelectorAll('[data-social]').forEach(b=>b.setAttribute('aria-pressed',b===button));if(!$('new-link-title').value)$('new-link-title').value=selected==='link'?'':selected==='x'?'X':selected[0].toUpperCase()+selected.slice(1);});
  $('new-link-form').onsubmit=event=>{event.preventDefault();const url=safeLink($('new-link-url').value.trim());if(!url){$('modal-error').textContent='Use a full HTTPS URL or an email link such as mailto:hello@example.com.';return;}if(state.page.links.length>=100){$('modal-error').textContent='This page already has 100 links.';return;}state.page.links.push({id:crypto.randomUUID(),title:$('new-link-title').value.trim(),url,description:$('new-link-description').value.trim(),icon:selected,enabled:true});$('modal').close();renderLinks();markDirty();toast('Link added. Save your page when you’re ready.');};
}
async function loadStats(){
  if(!state.page)return;const id=state.page.id,data=await api('/api/pages/'+id+'/stats');if(state.page?.id!==id)return;state.stats=data;
  $('analytics-notice').hidden=data.enabled;const views=data.rows.filter(r=>!r.link_id).reduce((sum,r)=>sum+r.count,0),clicks=data.rows.filter(r=>r.link_id).reduce((sum,r)=>sum+r.count,0);
  $('total-views').textContent=views.toLocaleString();$('total-clicks').textContent=clicks.toLocaleString();
  const daily=Array.from({length:30},(_,i)=>{const day=new Date(Date.now()-(29-i)*86400000).toISOString().slice(0,10);return{day,count:data.rows.filter(r=>r.day===day&&!r.link_id).reduce((n,r)=>n+r.count,0)};});
  const max=Math.max(1,...daily.map(d=>d.count));$('views-chart').innerHTML=daily.map(d=>`<div class="chart-bar" style="height:${Math.max(2,d.count/max*100)}%" title="${d.day}: ${d.count} views"></div>`).join('')+(views?'':'<span class="chart-empty">Your first views will show up here.</span>');$('views-chart').setAttribute('aria-label',daily.map(d=>`${d.day}: ${d.count} views`).join('; '));$('chart-start').textContent=daily[0].day;
  const map=new Map(data.links.map(l=>[l.id,{title:l.title,count:0}]));for(const row of data.rows){if(!row.link_id)continue;if(!map.has(row.link_id))map.set(row.link_id,{title:'Removed link',count:0});map.get(row.link_id).count+=row.count;}
  $('link-stats').innerHTML=[...map.values()].sort((a,b)=>b.count-a.count).map(l=>`<div class="link-stat"><span>${e(l.title)}</span><strong>${l.count.toLocaleString()}</strong></div>`).join('')||'<p class="quiet-note">Add a link to see its counts here.</p>';
}
function download(content,filename,type){const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function pageURL(){return state.page&&state.origin?state.origin+'/p/'+state.page.slug:'';}
function renderShare(){
  const ready=state.saved?.published&&!state.demo&&isHosted(state.origin),url=pageURL();$('public-url').value=state.demo?'Available after hosting your project':url;
  $('download-svg').disabled=!ready;$('download-png').disabled=!ready;$('copy-url').disabled=state.demo||!state.saved?.published;$('native-share').hidden=!navigator.share||!ready;
  if(ready){$('editor-qr').innerHTML=createQR(url);$('qr-state').textContent='Ready for print. Scan once on your phone before using it on a poster.';}
  else{$('editor-qr').innerHTML=icon('qr');$('qr-state').textContent=state.demo?'Run or deploy Linkboard to publish a page and make its QR code.':!state.saved?.published?'Publish your page first. Its QR code will appear here.':'Your page is running locally. Host the project on HTTPS to create a QR code others can scan.';}
}
async function copyURL(){try{await navigator.clipboard.writeText(pageURL());toast('Page link copied.');}catch{$('public-url').focus();$('public-url').select();toast('Copy the selected address.');}}
async function downloadPNG(){
  try{const blob=new Blob([createQR(pageURL())],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=1536;canvas.getContext('2d').drawImage(image,0,0,1536,1536);URL.revokeObjectURL(url);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error();download(png,state.page.slug+'-qr.png');}catch{toast('The PNG could not be created. Try the SVG download.');}
}
async function uploadAvatar(file){
  if(!file||!state.page)return;const pageId=state.page.id;state.uploads++;refreshToolbar();
  try{const data=await prepareImage(file,{width:320,max:180000,square:true});if(state.page?.id!==pageId)return;state.page.avatar=data;$('editor-avatar').innerHTML=`<img src="${e(data)}" alt="">`;$('remove-avatar').disabled=false;markDirty();}catch(error){toast(error.message);}finally{state.uploads--;refreshToolbar();$('avatar-file').value='';}
}
async function downloadWebsite(){
  if(!state.page)return;const button=$('download-website');button.disabled=true;
  try{if(state.dirty&&!await savePage(state.page.published))return;let document;
    if(state.demo)document=globalThis.LINKBOARD_DEMO_WEBSITE(state.page);
    else{const response=await fetch('/api/pages/'+state.page.id+'/website',{credentials:'same-origin'});if(!response.ok){const result=await response.json();throw new Error(result.error||'The website could not be exported.');}document=await response.text();}
    download(document,state.page.slug+'.html','text/html');toast('Website downloaded. Rename it index.html before uploading to a static host.');
  }catch(error){toast(error.message);}finally{button.disabled=false;}
}
function customizeLink(id){
  const pageId=state.page.id,link=state.page.links.find(l=>l.id===id);if(!link)return;const appearance=normalizeLinkStyle(link.appearance);let thumbnail=appearance.thumbnail;
  openModal('Make this link yours.',linkStyleHTML(link));
  $('link-style-form').addEventListener('input',event=>{const key=event.target.dataset.linkColor;if(!key)return;if(!/^#[0-9a-f]{6}$/i.test(event.target.value)){event.target.setCustomValidity('Use a six-digit hex colour.');return;}event.target.setCustomValidity('');appearance[key]=event.target.value.toLowerCase();$('link-custom-colors').checked=true;$('modal').querySelectorAll(`[data-link-color="${key}"]`).forEach(input=>{if(input!==event.target)input.value=appearance[key];});});
  $('link-thumbnail-upload').onclick=()=>$('link-thumbnail-file').click();
  $('link-thumbnail-remove').onclick=()=>{thumbnail='';$('link-thumbnail-preview').innerHTML=icon('image');$('link-thumbnail-remove').hidden=true;};
  const form=$('link-style-form');
  $('link-thumbnail-file').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;$('apply-link-style').disabled=true;$('modal-error').textContent='Preparing image…';
    try{const data=await prepareImage(file,{width:256,max:75000,square:true});if(!$('modal').open||$('link-style-form')!==form)return;thumbnail=data;$('link-thumbnail-preview').innerHTML=`<img src="${e(data)}" alt="Thumbnail preview">`;$('link-thumbnail-remove').hidden=false;$('modal-error').textContent='';}catch(error){if($('link-style-form')===form)$('modal-error').textContent=error.message;}finally{if($('link-style-form')===form)$('apply-link-style').disabled=false;event.target.value='';}
  };
  form.onsubmit=event=>{event.preventDefault();if(state.page?.id!==pageId){$('modal').close();return;}const current=state.page.links.find(l=>l.id===id);if(!current)return;try{current.appearance=normalizeLinkStyle({...appearance,customColors:$('link-custom-colors').checked,featured:$('link-featured').checked,badge:$('link-badge').value,thumbnail});$('modal').close();markDirty();toast('Link style updated.');}catch(error){$('modal-error').textContent=error.message;}};
}
async function importFile(file){
  if(!file)return;if(file.size>2000000){toast('Choose a page backup smaller than 2 MB.');return;}
  if(!await canLeave())return;let body;try{body=JSON.parse(await file.text());if(body.format!=='linkboard-page'||body.formatVersion!==1||!body.page)throw Error();}catch{toast('Choose a valid Linkboard page backup.');return;}
  openModal('Bring your page with you.',`<form id="import-form"><p>Import “${e(body.page.name||'Untitled page')}” as a new private draft.</p><label for="import-slug">New page address</label><input id="import-slug" required minlength="2" maxlength="48" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${e(String(body.page.slug||'my-page').slice(0,38)+'-import')}"><p class="field-error" id="modal-error" role="alert"></p><div class="button-row"><button type="button" class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" type="submit">Import page</button></div></form>`);
  $('import-form').onsubmit=async event=>{event.preventDefault();event.submitter.disabled=true;try{const {page}=await api('/api/import','POST',{...body,slug:$('import-slug').value});$('modal').close();state.dirty=false;await loadWorkspace(page.id);toast('Page imported as a draft.');}catch(error){$('modal-error').textContent=error.message;event.submitter.disabled=false;}};
}
async function deletePage(){
  const p=state.page;if(!p)return;
  openModal('Delete this page?',`<form id="delete-form"><p>This removes <strong>${e(p.name)}</strong>, its links, and its counts. Existing links and QR codes will stop working.</p><label for="delete-confirm">Type ${e(p.slug)} to confirm</label><input id="delete-confirm" required autocomplete="off"><p class="field-error" id="modal-error" role="alert"></p><div class="button-row"><button type="button" class="btn secondary" data-close-modal>Keep page</button><button type="submit" class="btn danger">Delete page</button></div></form>`);
  $('delete-form').onsubmit=async event=>{event.preventDefault();event.submitter.disabled=true;try{await api('/api/pages/'+p.id,'DELETE',{version:p.version,confirm:$('delete-confirm').value});$('modal').close();state.dirty=false;await loadWorkspace();toast('Page deleted.');}catch(error){$('modal-error').textContent=error.message;event.submitter.disabled=false;}};
}
function bindEvents(){
  initColorMode({controls:document.querySelectorAll('[data-editor-mode]'),onApply(){const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());}});
  $('preview-mode').onchange=()=>{state.previewMode=$('preview-mode').value;renderPreview();};
  bindStudio({root:$('design-studio'),getPage:()=>state.page,onChange:markDirty,onRender:renderAppearance,onError:toast,onBusy:busy=>{state.uploads+=busy?1:-1;refreshToolbar();}});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.view&&!state.saving){switchView(button.dataset.view);history.replaceState(null,'','#'+button.dataset.view);}
    if(button.dataset.goto)switchView(button.dataset.goto);
    if(button.dataset.action==='new-page')addPageDialog().catch(error=>toast(error.message));
    if(button.dataset.action==='add-link')addLinkDialog();
    if(button.hasAttribute('data-close-modal'))$('modal').close();
    if(button.dataset.theme&&state.page){state.page.theme=button.dataset.theme;state.page.design={...state.page.design,customColors:false,darkCustomColors:false,...(button.dataset.theme==='midnight'?{colorMode:'dark'}:{})};renderAppearance();markDirty();}
    if(button.dataset.shape&&state.page){state.page.shape=button.dataset.shape;state.page.design={...state.page.design,buttonRadius:{rounded:20,pill:45,square:5}[button.dataset.shape]};renderAppearance();markDirty();}
    const row=button.closest('[data-id]');
    if(row&&button.hasAttribute('data-customize-link'))customizeLink(row.dataset.id);
    if(row&&button.dataset.move)moveLink(row.dataset.id,Number(button.dataset.move));
    if(row&&button.hasAttribute('data-remove-link')){const id=state.page.id,index=state.page.links.findIndex(l=>l.id===row.dataset.id),[removed]=state.page.links.splice(index,1);renderLinks();markDirty();toast('Link removed.',()=>{if(state.page?.id!==id){toast('Return to the page to restore this link.');return;}state.page.links.splice(index,0,removed);renderLinks();markDirty();toast('Link restored.');});}
  });
  document.querySelectorAll('[data-field]').forEach(input=>input.addEventListener(['checkbox','select-one'].includes(input.type)?'change':'input',()=>{if(!state.page)return;state.page[input.dataset.field]=input.type==='checkbox'?input.checked:input.value;markDirty();}));
  $('link-list').addEventListener('input',event=>{
    const field=event.target.dataset.linkField;if(!field)return;const row=event.target.closest('[data-id]'),link=state.page.links.find(l=>l.id===row.dataset.id);if(!link)return;
    link[field]=event.target.type==='checkbox'?event.target.checked:event.target.value;
    if(field==='url'){const valid=!!safeLink(link.url);row.querySelector('[data-link-field="enabled"]').disabled=!valid;row.querySelector('.link-incomplete').hidden=valid;}
    if(field==='icon')row.querySelector('.link-symbol').innerHTML=icon(link.icon);$('link-count').textContent=state.page.links.filter(l=>l.enabled&&safeLink(l.url)).length;markDirty();
  });
  $('link-list').addEventListener('dragstart',event=>{if(!event.target.closest('.drag-handle')){event.preventDefault();return;}dragId=event.target.closest('[data-id]').dataset.id;event.dataTransfer.setData('text/plain',dragId);event.dataTransfer.effectAllowed='move';});
  $('link-list').addEventListener('dragover',event=>{if(dragId&&event.target.closest('[data-id]'))event.preventDefault();});
  $('link-list').addEventListener('drop',event=>{event.preventDefault();const row=event.target.closest('[data-id]');if(!row||!dragId)return;const from=state.page.links.findIndex(l=>l.id===dragId),to=state.page.links.findIndex(l=>l.id===row.dataset.id);if(from>=0&&to>=0)moveLink(dragId,to-from);dragId=null;});$('link-list').addEventListener('dragend',()=>dragId=null);
  $('page-picker').onchange=async()=>{const id=$('page-picker').value;if(!await canLeave()){$('page-picker').value=state.page?.id||'';return;}try{await loadPage(id);}catch(error){toast(error.message);}};
  $('save-page').onclick=()=>savePage(state.demo?false:true);$('save-draft').onclick=()=>savePage(false);
  $('open-page').onclick=()=>{if(state.saved?.published&&!state.demo)window.open(state.origin+'/p/'+state.saved.slug,'_blank','noopener,noreferrer');};
  $('change-avatar').onclick=()=>$('avatar-file').click();$('avatar-file').onchange=()=>uploadAvatar($('avatar-file').files[0]);
  $('remove-avatar').onclick=()=>{if(state.page){state.page.avatar='';markDirty();renderPageEditor();}};
  $('copy-url').onclick=copyURL;$('download-svg').onclick=()=>download(createQR(pageURL()),state.page.slug+'-qr.svg','image/svg+xml');$('download-png').onclick=downloadPNG;
  $('native-share').onclick=async()=>{try{await navigator.share({title:state.page.name,url:pageURL()});}catch(error){if(error.name!=='AbortError')toast('Use Copy link to share your page.');}};
  $('refresh-stats').onclick=()=>loadStats().catch(error=>toast(error.message));
  $('export-stats').onclick=()=>{if(!state.stats)return;const rows=['date,kind,link_id,count',...state.stats.rows.map(r=>[r.day,r.link_id?'click':'view',r.link_id,r.count].join(','))];download(rows.join('\r\n'),state.page.slug+'-counts.csv','text/csv');};
  $('backup-page').onclick=async()=>{try{if(state.dirty&&!await savePage(state.page.published))return;const backup=await api('/api/pages/'+state.page.id+'/export');download(JSON.stringify(backup,null,2),state.page.slug+'-backup.json','application/json');toast('Page backup downloaded.');}catch(error){toast(error.message);}};
  $('download-website').onclick=downloadWebsite;
  $('import-page').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{await importFile($('import-file').files[0]);$('import-file').value='';};
  $('duplicate-page').onclick=()=>addPageDialog(structuredClone(state.page)).catch(error=>toast(error.message));
  $('unpublish-page').onclick=async()=>{if(await confirmAction('Take this page offline?','Its address will stay reserved. You can publish it again whenever you’re ready.','Unpublish'))await savePage(false);};
  $('delete-page').onclick=deletePage;
  $('sign-out').onclick=async()=>{if(!await canLeave())return;try{await api('/api/logout','POST',{});state.dirty=false;showLogin();}catch(error){toast(error.message);}};
  $('mobile-preview').textContent='Expand preview ↗';$('mobile-preview').onclick=()=>{try{const content=renderPage(state.page,{preview:true,mode:state.previewMode});openModal('Your page, up close.', '<iframe id="wide-preview" class="wide-preview" title="Expanded page preview" sandbox></iframe>');$('modal').classList.add('wide-modal');$('wide-preview').srcdoc=content;}catch(error){toast(error.message);}};
  $('mobile-signout').onclick=()=>$('sign-out').click();
  $('mobile-signout-top').onclick=()=>$('sign-out').click();
  $('modal-close').onclick=()=>$('modal').close();$('modal').addEventListener('click',event=>{const r=$('modal').getBoundingClientRect();if(event.target===$('modal')&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))$('modal').close();});
  $('toast-close').onclick=()=>$('toast').hidden=true;$('toast-action').onclick=()=>undoAction?.();
  $('reveal-key').onclick=()=>{const show=$('owner-key').type==='password';$('owner-key').type=show?'text':'password';$('reveal-key').textContent=show?'Hide':'Show';$('reveal-key').setAttribute('aria-label',(show?'Hide':'Show')+' workspace key');};
  $('login-form').onsubmit=async event=>{event.preventDefault();$('sign-in').disabled=true;$('login-error').textContent='';try{await api('/api/login','POST',{key:$('owner-key').value});$('owner-key').value='';await boot();}catch(error){$('login-error').textContent=error.message;}finally{$('sign-in').disabled=false;}};
  window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
}
async function boot(){
  try{const pending=state.dirty&&state.page?structuredClone(state.page):null;const session=await api('/api/session');state.origin=session.origin;state.demo=!!session.demo;
    if(!session.authenticated){showLogin();return;}
    $('boot').hidden=true;$('login').hidden=true;$('app').hidden=false;$('demo-banner').hidden=!state.demo;$('sign-out').hidden=state.demo;$('mobile-signout').hidden=state.demo;$('mobile-signout-top').hidden=state.demo;
    if(state.demo&&session.storage===false)$('demo-banner').querySelector('span').textContent='Temporary demo. Browser storage is unavailable; export a backup to keep your edits.';
    state.view=location.hash.slice(1)||'links';await loadWorkspace(state.page?.id);
    if(pending&&state.page?.id===pending.id){state.page=pending;state.dirty=true;renderPageEditor();toast('Your unsaved changes are still here.');}
  }catch(error){showLogin();$('login-error').textContent=error.message;}
}
fillIcons();bindEvents();boot();
