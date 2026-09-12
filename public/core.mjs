import { initColorMode } from './color-mode.mjs';
import { normalizeDesign, normalizeLinkStyle, designCSS, colorModeCSS } from './design.mjs';
export const THEMES = {
  clover:{name:'Clover',bg:'#edf3e6',ink:'#203f32',card:'#ffffff',muted:'#60705f',accent:'#d5e8b7',line:'#d9e3d0'},
  paper:{name:'Paper',bg:'#f8f5ef',ink:'#34302a',card:'#fffefa',muted:'#756e62',accent:'#e8ded0',line:'#e6dfd4'},
  midnight:{name:'Midnight',bg:'#161d25',ink:'#f3f5f7',card:'#232f3b',muted:'#b7c2ce',accent:'#3b5267',line:'#344352'},
  ocean:{name:'Ocean',bg:'#e9f1f7',ink:'#1c415e',card:'#ffffff',muted:'#536e84',accent:'#c8dfef',line:'#d0e0ec'},
  rose:{name:'Rose',bg:'#f7edf0',ink:'#633d49',card:'#fffafb',muted:'#876471',accent:'#ecd1da',line:'#e9d6dd'},
  apricot:{name:'Apricot',bg:'#fbf0e4',ink:'#67472f',card:'#fffcf7',muted:'#826d5b',accent:'#f1d4b3',line:'#ecdcc8'}
};
export const FONTS={modern:'Arial,Helvetica,sans-serif',editorial:'Georgia,"Times New Roman",serif',rounded:'"Trebuchet MS",Arial,sans-serif',mono:'"Courier New",Courier,monospace',geometric:'"Century Gothic",Futura,"Trebuchet MS",sans-serif'};
export const ICONS={
  link:'<path d="m10 13 4-4m-5 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1"/>',
  instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
  whatsapp:'<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l1.9-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 7.4c.3-.5.7-.5 1-.1l1 1.6c.2.4-.3 1-.6 1.3.7 1.5 1.8 2.6 3.4 3.4.3-.4.9-1 1.3-.7l1.8 1c.4.3.4.7 0 1.1-2.4 2.7-10-4.3-7.9-7.6Z"/>',
  tiktok:'<path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.5v3a1.5 1.5 0 1 0 1 1.5V3h3Zm0 0c.6 3 2.4 4.5 5 4.6v3c-2-.1-3.6-.9-5-2.2"/>',
  linkedin:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10v7m4-7v7m0-4a3 3 0 0 1 6 0v4"/><circle cx="7" cy="7" r=".8" fill="currentColor" stroke="none"/>',
  facebook:'<path d="M14.5 21v-8H18l.5-4h-4V7c0-1 .4-2 2-2H19V1.5a31 31 0 0 0-3.2-.2c-3.3 0-5.3 2-5.3 5.5V9H7v4h3.5v8"/>',
  youtube:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 6 9 7 9-7"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  x:'<path d="m4 3 16 18h-5L4 8V3Zm16 0L4 21"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M6 18 18 6M6 6h12v12"/>',
  share:'<path d="M12 16V3m-4 4 4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  paint:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 .8-2.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z"/><path d="M7 8h.01M12 6h.01M17 9h.01M6 13h.01"/>',
  chart:'<path d="M4 3v17h17M8 15V9m5 6V5m5 10v-4"/>',
  qr:'<path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h3v3h3v3h-6zm-3-3h3m6 0v3M12 18v3"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  up:'<path d="m6 15 6-6 6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  grip:'<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" stroke-width="3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V3H3v13h5"/>',
  logout:'<path d="M9 3H3v18h6m7-14 5 5-5 5M8 12h13"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  pages:'<rect x="7" y="3" width="14" height="17" rx="3"/><path d="M7 7H3v14h14M11 8h6m-6 4h6"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 4-6 5 7"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>'
};
export const SOCIALS=['link','instagram','whatsapp','tiktok','linkedin','facebook','youtube','mail','globe','x'];
export function icon(name,cls='') { return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.link}</svg>`; }
export function escapeHTML(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function safeLink(value) {
  if(typeof value!=='string'||value.length>2048||/[\x00-\x20\x7f]/.test(value)) return '';
  if(/^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+$/i.test(value)) return value;
  try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname?u.href:''; } catch{return '';}
}
export function isHosted(origin) { try { const u=new URL(origin);return u.protocol==='https:'&&!/^(localhost|127\.|\[::1\])/.test(u.hostname)&&!u.hostname.endsWith('.localhost'); }catch{return false;} }
export function blankPage(name='Untitled page',slug='my-page') { return {name,slug,bio:'All my links, in one place.',avatar:'',theme:'clover',font:'modern',shape:'rounded',design:{},branding:false,published:false,analytics:false,links:[]}; }
export function validatePage(input) {
  const fail=message=>{throw new Error(message);};
  if(!input||typeof input!=='object') fail('Enter page details.');
  const str=(key,max,required=false)=>{const v=typeof input[key]==='string'?input[key].trim():'';if((required&&!v)||v.length>max)fail(`${key[0].toUpperCase()+key.slice(1)} must be ${required?'1 to':'at most'} ${max} characters.`);return v;};
  const page={name:str('name',60,true),slug:str('slug',48,true),bio:str('bio',240),avatar:str('avatar',180000),theme:str('theme',20),font:str('font',20),shape:str('shape',20),branding:!!input.branding,analytics:!!input.analytics,published:!!input.published};
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)||page.slug.length<2)fail('Use 2–48 lowercase letters, numbers, or single hyphens for the address.');
  if(!Object.hasOwn(THEMES,page.theme)||!Object.hasOwn(FONTS,page.font)||!['rounded','pill','square'].includes(page.shape))fail('Choose a valid theme, font, and button shape.');
  page.design=normalizeDesign(input.design,THEMES[page.theme],page.shape);
  if(page.avatar&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(page.avatar))fail('Upload a PNG, JPEG, or WebP profile image.');
  if(!Array.isArray(input.links)||input.links.length>100)fail('A page can contain up to 100 links.');
  const ids=new Set();
  page.links=input.links.map((item,index)=>{
    if(!item||typeof item!=='object')fail('A link is invalid.');
    const id=typeof item.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(item.id)?item.id:crypto.randomUUID();
    if(ids.has(id))fail('Link IDs must be unique.');ids.add(id);
    const title=typeof item.title==='string'?item.title.trim():'';
    const description=typeof item.description==='string'?item.description.trim():'';
    const url=typeof item.url==='string'?item.url.trim():'';
    if(!title||title.length>80||description.length>140)fail('Give each link a title (up to 80 characters) and a short description (up to 140).');
    if(url&&!safeLink(url))fail(`Use a complete HTTPS or email address for “${title}”.`);
    const link={id,title,description,url:url?safeLink(url):'',icon:SOCIALS.includes(item.icon)?item.icon:'link',enabled:!!item.enabled,position:index,appearance:normalizeLinkStyle(item.appearance)};
    if(page.published&&link.enabled&&!link.url)fail(`Add a URL for “${title}” or switch it off before publishing.`);
    return link;
  });
  if(page.published&&!page.links.some(l=>l.enabled&&l.url))fail('Add and enable at least one link before publishing.');
  if(new TextEncoder().encode(JSON.stringify(page)).length>1800000)fail('Keep the page and its images under 1.8 MB. Remove a few thumbnails or use smaller images.');
  return page;
}
function basePageCSS(page) {
  const t=THEMES[page.theme]||THEMES.clover;
  return `:root{color-scheme:${page.theme==='midnight'?'dark':'light'};--bg:${t.bg};--ink:${t.ink};--card:${t.card};--muted:${t.muted};--accent:${t.accent};--line:${t.line};--radius:${{rounded:'20px',pill:'45px',square:'5px'}[page.shape]||'20px'}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:${FONTS[page.font]||FONTS.modern};-webkit-font-smoothing:antialiased}a,button{-webkit-tap-highlight-color:transparent}button{font:inherit;cursor:pointer}svg{width:22px;height:22px;flex-shrink:0}[hidden]{display:none!important}:focus-visible{outline:3px solid var(--ink);outline-offset:4px}.lp{width:min(100% - 40px,460px);margin:auto;padding:30px 0 34px;min-height:100svh}.lp-top{display:flex;justify-content:space-between;align-items:center;gap:15px;font-size:11px;text-transform:uppercase;letter-spacing:1.7px}.lp-top span{opacity:.7}.lp-share{width:44px;height:44px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;color:var(--ink);background:var(--card)}.lp-profile{text-align:center;padding:33px 0 31px}.lp-avatar{margin:0 auto 24px;width:92px;height:92px;border-radius:29px;display:grid;place-items:center;background:var(--ink);color:var(--bg);font-weight:700;font-size:25px;letter-spacing:-1px;overflow:hidden;box-shadow:0 7px 0 var(--accent)}.lp-avatar img{width:100%;height:100%;object-fit:cover}.lp-profile h1{font-size:34px;letter-spacing:-1.1px;margin:0 0 12px;line-height:1.2;overflow-wrap:anywhere}.lp-profile p{max-width:350px;margin:auto;font-size:14px;line-height:1.7;color:var(--muted);white-space:pre-line;overflow-wrap:anywhere}.lp-links{list-style:none;padding:0;margin:0;display:grid;gap:12px}.lp-link{display:flex;align-items:center;gap:15px;min-height:78px;padding:17px 19px;border:1px solid var(--line);border-radius:var(--radius);color:var(--ink);background:var(--card);text-decoration:none;box-shadow:0 3px 0 color-mix(in srgb,var(--ink) 4%,transparent);transition:transform .16s}.lp-link:hover{transform:translateY(-3px)}.lp-symbol{width:40px;height:40px;display:grid;place-items:center;background:var(--bg);border-radius:12px;flex-shrink:0}.lp-copy{flex:1;min-width:0}.lp-copy strong{display:block;font-size:14px;font-weight:700;overflow-wrap:anywhere}.lp-copy small{display:block;font-size:11px;line-height:1.5;color:var(--muted);margin-top:5px;overflow-wrap:anywhere}.lp-arrow{width:15px;height:15px;opacity:.6}.lp-note{margin:30px 0;text-align:center;font-size:11px;color:var(--muted)}.lp-footer{margin-top:40px;border-top:1px solid var(--line);padding-top:18px;display:flex;justify-content:space-between;gap:10px;font-size:10px;color:var(--muted)}.lp-footer a{color:inherit}.lp-empty{padding:24px;text-align:center;border:1px dashed var(--line);border-radius:20px;color:var(--muted);font-size:13px;line-height:1.7}.lp-draft{display:block;font-size:10px;background:var(--accent);padding:7px 10px;border-radius:20px;text-align:center;margin-top:22px}.lp-sample{opacity:.55}.lp-dialog{max-width:390px;width:calc(100% - 32px);border:1px solid var(--line);border-radius:24px;padding:25px;background:var(--bg);color:var(--ink);max-height:calc(100svh - 36px);overflow:auto}.lp-dialog::backdrop{background:#0008;backdrop-filter:blur(4px)}.lp-dialog header{display:flex;justify-content:space-between;align-items:center}.lp-dialog h2{font-size:23px;letter-spacing:-.5px;margin:0}.lp-dialog p{font-size:12px;color:var(--muted);line-height:1.6}.lp-qr{width:220px;max-width:100%;margin:18px auto;background:white;border-radius:10px;overflow:hidden}.lp-qr svg{display:block;width:100%;height:auto}.lp-url{width:100%;padding:13px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:11px Arial;text-align:center}.lp-button{width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--ink);color:var(--bg);font-size:12px;font-weight:700;margin-top:9px;min-height:44px}.lp-button.alt{background:transparent;color:var(--ink)}.lp-status{min-height:18px;text-align:center}body:has(dialog[open]){overflow:hidden}@media(prefers-reduced-motion:reduce){*{transition:none!important}}@media(max-width:340px){.lp{width:calc(100% - 28px)}.lp-link{padding:14px;gap:11px}}`;
}
export function pageCSS(page) {
  const d=normalizeDesign(page.design,THEMES[page.theme]||THEMES.clover,page.shape);
  const family=FONTS[page.font]||FONTS.modern;
  return basePageCSS(page)+'\n'+designCSS(d,family,d.headingFont==='inherit'?family:FONTS[d.headingFont])+'\n'+colorModeCSS(d)+'\n'+d.customCSS;
}
export function renderPage(page,{origin='',preview=false,standalone=false,bodyOnly=false,mode}={}) {
  const e=escapeHTML,d=normalizeDesign(page.design,THEMES[page.theme]||THEMES.clover,page.shape);
  if(['light','dark','system'].includes(mode))d.colorMode=mode;
  const initials=page.name.length<=4?page.name:page.name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('');
  const active=page.links.filter(l=>l.enabled&&safeLink(l.url));
  const shown=preview&&!active.length?page.links:active;
  const canonical=origin?`${origin}/p/${page.slug}`:'';
  const links=shown.map(l=>{
    const usable=l.enabled&&safeLink(l.url),a=normalizeLinkStyle(l.appearance);
    const href=standalone?l.url:`/go/${e(page.slug)}/${e(l.id)}`;
    const tag=usable&&!preview?'a':'div';
    const style=a.customColors?` style="--card:${a.bg};--ink:${a.ink};--muted:${a.ink};--line:${a.border};background:${a.bg};color:${a.ink};border-color:${a.border}"`:'';
    const symbol=a.thumbnail?`<img class="lp-thumbnail" src="${e(a.thumbnail)}" alt="" loading="lazy">`:d.showIcons?`<span class="lp-symbol">${icon(l.icon)}</span>`:'';
    return `<li><${tag} class="lp-link${a.featured?' lp-featured':''}${!usable?' lp-sample':''}"${style}${usable&&!preview?` href="${e(href)}" target="_blank" rel="noopener noreferrer" aria-label="${e(l.title)} (opens in a new tab)"`:''}>${symbol}<span class="lp-copy">${a.badge?`<span class="lp-badge">${e(a.badge)}</span>`:''}<strong>${e(l.title)}</strong>${d.showDescriptions&&l.description?`<small>${e(l.description)}</small>`:''}${!usable?'<small>Add a URL to enable this link</small>':''}</span>${d.showArrows?icon('arrow','lp-arrow'):''}</${tag}></li>`;
  }).join('');
  const share=d.showShare?(!preview?`<button class="lp-share" id="share-open" aria-label="Share ${e(page.name)}" aria-haspopup="dialog">${icon('share')}</button>`:`<span class="lp-share">${icon('share')}</span>`):'';
  const modeControl=d.showModeToggle?(preview?`<span class="lp-mode lp-mode-preview">${{system:'System',light:'Light',dark:'Dark'}[d.colorMode]}</span>`:`<select class="lp-mode" id="page-mode" aria-label="Page colour mode" hidden><option value="light">☀ Light</option><option value="dark">☾ Dark</option><option value="system">◐ System</option></select>`):'';
  const top=d.showHeader||d.showShare||d.showModeToggle?`<header class="lp-top"><span>${d.showHeader?e(page.name)+(d.headerLabel?' / '+e(d.headerLabel):''):''}</span><div class="lp-actions">${modeControl}${share}</div></header>`:'';
  const cover=d.coverImage?`<img class="lp-cover" src="${e(d.coverImage)}" alt="">`:'';
  const avatar=d.showAvatar?`<div class="lp-avatar">${page.avatar?`<img src="${e(page.avatar)}" alt="${e(page.name)} logo">`:e(initials)}</div>`:'';
  const footer=d.showFooter?`<footer class="lp-footer"><span>${e(page.name)}</span><span>${e(d.footerText)}</span>${page.branding?'<span>Made with Linkboard</span>':''}</footer>`:'';
  const content=`<div class="lp">${top}${cover}<main><section class="lp-profile">${avatar}<h1>${e(page.name)}</h1>${page.bio?`<p>${e(page.bio)}</p>`:''}</section><nav aria-label="Social links"><ul class="lp-links${d.layout==='grid'?' lp-links-grid':''}">${links}</ul>${!shown.length?'<p class="lp-empty">Your links will appear here.<br>Add your first link to get started.</p>':''}</nav>${preview&&!active.length?'<span class="lp-draft">Draft preview · Add your social URLs in the editor</span>':''}${d.noteText?`<p class="lp-note">${e(d.noteText)}</p>`:''}</main>${footer}</div>`;
  if(bodyOnly)return content;
  const policy=`default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src ${standalone?"'unsafe-inline'":"'self'"}; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html lang="en" data-mode="${d.colorMode}" data-visitor-mode="${d.showModeToggle}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${e(policy)}"><meta name="theme-color" content="${d.colorMode==='dark'?d.darkBg:d.bg}"><title>${e(page.name)} | Links</title><meta name="description" content="${e(page.bio)}"><meta property="og:title" content="${e(page.name)}"><meta property="og:description" content="${e(page.bio)}"><meta property="og:type" content="website">${canonical?`<link rel="canonical" href="${e(canonical)}">`:''}${preview?'<meta name="robots" content="noindex,nofollow">':''}<style>${pageCSS(page)}</style></head><body data-public-url="${e(canonical)}">${content}${!preview&&d.showShare?`<dialog class="lp-dialog" id="share-dialog" aria-labelledby="share-title"><header><h2 id="share-title">Pass it on.</h2><button class="lp-share" id="share-close" aria-label="Close share dialog" autofocus>${icon('close')}</button></header><p id="share-description">One scan. All our socials.</p><div class="lp-qr" id="share-qr"></div><label for="share-url" hidden>Page link</label><input class="lp-url" id="share-url" readonly aria-label="Page link"><button class="lp-button" id="share-copy">Copy link</button><button class="lp-button alt" id="share-download">Download QR code</button><button class="lp-button alt" id="share-native" hidden>Share with a friend</button><p class="lp-status" id="share-status" role="status"></p></dialog>`:''}${!preview?(standalone?'<!-- STANDALONE_SCRIPT -->':'<script type="module" src="/page.mjs"></script>'):''}</body></html>`;
}
export function standaloneDocument(page,qrSource,shareSource){
  const clean=validatePage({...page,published:true});
  const code=`${initColorMode.toString()}\n${qrSource.replace(/^export /gm,'')}\n${isHosted.toString()}\n${shareSource.replace(/^import .*;\n/gm,'')}`;
  return renderPage(clean,{standalone:true}).replace('<!-- STANDALONE_SCRIPT -->',`<script>${code.replace(/<\/script/gi,'<\\/script')}</script>`);
}
