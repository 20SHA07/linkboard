// Shared by the browser, Worker, backups, and public-page renderer.
export const DARK_PALETTES={
  Clover:{bg:'#111d16',ink:'#edf3e6',card:'#1d2b21',muted:'#b7c6ad',accent:'#425b34',line:'#3a4d32',gradientTo:'#293f25'},
  Paper:{bg:'#211c17',ink:'#f8f1e7',card:'#302922',muted:'#c9bbab',accent:'#584533',line:'#514437',gradientTo:'#3a2c22'},
  Midnight:{bg:'#161d25',ink:'#f3f5f7',card:'#232f3b',muted:'#b7c2ce',accent:'#3b5267',line:'#344352',gradientTo:'#26364c'},
  Ocean:{bg:'#101e2b',ink:'#e7f2fb',card:'#1b3043',muted:'#afc6da',accent:'#2d526e',line:'#34516a',gradientTo:'#173d58'},
  Rose:{bg:'#261920',ink:'#f9eaf0',card:'#382731',muted:'#d2b7c4',accent:'#624052',line:'#573b4b',gradientTo:'#472538'},
  Apricot:{bg:'#261c14',ink:'#fff1e2',card:'#392a1e',muted:'#d7bfa8',accent:'#63482e',line:'#59412c',gradientTo:'#4a2e18'}
};
const LIGHT_MIDNIGHT={bg:'#edf1f6',ink:'#263445',card:'#ffffff',muted:'#5d6b7c',accent:'#d3dfed',line:'#d3dce8'};
export const DESIGN_DEFAULTS={
  colorMode:'system',showModeToggle:true,darkCustomColors:false,darkBg:'#111d16',darkInk:'#edf3e6',darkCard:'#1d2b21',darkMuted:'#b7c6ad',darkAccent:'#425b34',darkLine:'#3a4d32',darkGradientTo:'#293f25',
  customColors:false,bg:'#edf3e6',ink:'#203f32',card:'#ffffff',muted:'#60705f',accent:'#d5e8b7',line:'#d9e3d0',gradientTo:'#ffffff',
  background:'solid',backgroundImage:'',backgroundOverlay:30,gradientAngle:145,pattern:'none',
  coverImage:'',coverHeight:155,coverRadius:24,
  alignment:'center',layout:'stack',pageWidth:460,pagePadding:24,sectionSpacing:32,linkGap:12,
  avatarSize:92,avatarShape:'soft',avatarRing:0,showAvatar:true,
  headingSize:36,bodySize:14,headingWeight:600,letterSpacing:-1,headingFont:'inherit',
  buttonStyle:'filled',buttonRadius:20,buttonBorder:1,buttonPadding:17,buttonShadow:'soft',hover:'lift',animation:'none',
  showQRCode:true,qrLabel:'Scan to keep this page close.',qrPosition:'bottom',qrSize:180,
  showHeader:true,showShare:true,showIcons:true,showArrows:true,showDescriptions:true,showFooter:true,
  headerLabel:'Socials',footerText:'All our links. One place.',noteText:'See you around.',customCSS:''
};
const choices={colorMode:['system','light','dark'],background:['solid','gradient','image'],pattern:['none','dots','grid'],alignment:['center','left'],layout:['stack','grid','split'],qrPosition:['top','bottom'],avatarShape:['soft','circle','square'],headingFont:['inherit','modern','editorial','rounded','mono','geometric'],buttonStyle:['filled','outline','glass'],buttonShadow:['none','soft','hard'],hover:['none','lift','grow'],animation:['none','fade','rise']};
const ranges={backgroundOverlay:[0,90],gradientAngle:[0,360],coverHeight:[70,260],coverRadius:[0,40],qrSize:[120,260],pageWidth:[320,1200],pagePadding:[12,64],sectionSpacing:[12,72],linkGap:[6,30],avatarSize:[48,160],avatarRing:[0,6],headingSize:[22,64],bodySize:[12,20],headingWeight:[400,800],letterSpacing:[-2,4],buttonRadius:[0,48],buttonBorder:[0,4],buttonPadding:[12,30]};
const colorKeys=['bg','ink','card','muted','accent','line','gradientTo','darkBg','darkInk','darkCard','darkMuted','darkAccent','darkLine','darkGradientTo'];
export function imageData(value,max=300000){
  if(typeof value!=='string'||value.length>max||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))throw new Error('Use an uploaded PNG, JPEG, or WebP image within the size limit.');
  return value;
}
export function normalizeDesign(input={},palette={},shape='rounded'){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Page design must be an object.');
  const light=palette.name==='Midnight'?LIGHT_MIDNIGHT:palette,dark=DARK_PALETTES[palette.name]||DARK_PALETTES.Clover;
  const darkDefaults=Object.fromEntries(Object.entries(dark).map(([key,value])=>['dark'+key[0].toUpperCase()+key.slice(1),value]));
  const defaults={...DESIGN_DEFAULTS,...light,...darkDefaults,colorMode:palette.name==='Midnight'?'dark':'system',buttonRadius:{rounded:20,pill:45,square:5}[shape]||20};
  delete defaults.name;
  const out={};
  for(const [key,fallback] of Object.entries(defaults)){
    const value=input[key];
    if(value===undefined){out[key]=fallback;continue;}
    if(typeof fallback==='boolean'){if(typeof value!=='boolean')throw new Error('Choose a valid on/off setting for '+key+'.');out[key]=value;continue;}
    if(colorKeys.includes(key)){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Use six-digit hex colours, such as #edf3e6.');out[key]=value.toLowerCase();continue;}
    if(choices[key]){if(!choices[key].includes(value))throw new Error('Choose a valid '+key+' option.');out[key]=value;continue;}
    if(ranges[key]){const [min,max]=ranges[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(key+' must be between '+min+' and '+max+'.');out[key]=Math.round(value*10)/10;continue;}
    if(key==='backgroundImage'||key==='coverImage'){out[key]=value?imageData(value,key==='backgroundImage'?330000:230000):'';continue;}
    if(key==='customCSS'){
      if(typeof value!=='string'||value.length>18000)throw new Error('Custom CSS must be under 18,000 characters.');
      if(/<\s*\/?\s*(style|script|link|meta)|@import|expression\s*\(|javascript\s*:/i.test(value))throw new Error('Use CSS only. HTML tags, script, and stylesheet imports are not supported.');
      out[key]=value;continue;
    }
    if(typeof value!=='string'||value.length>(key==='headerLabel'?45:140))throw new Error('Keep '+key+' short.');out[key]=value;
  }
  if(!out.customColors)for(const key of ['bg','ink','card','muted','accent','line'])out[key]=light[key]||defaults[key];
  if(!out.darkCustomColors)Object.assign(out,darkDefaults);
  return out;
}
export function normalizeLinkStyle(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Link appearance must be an object.');
  const out={customColors:false,bg:'#ffffff',ink:'#203f32',border:'#d9e3d0',featured:false,badge:'',thumbnail:''};
  for(const key of ['customColors','featured'])if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw new Error('Choose a valid link style.');out[key]=input[key];}
  for(const key of ['bg','ink','border'])if(input[key]!==undefined){if(typeof input[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(input[key]))throw new Error('Use six-digit hex colours for your link.');out[key]=input[key].toLowerCase();}
  if(input.badge!==undefined){if(typeof input.badge!=='string'||input.badge.length>24)throw new Error('Keep link badges under 24 characters.');out.badge=input.badge;}
  if(input.thumbnail)out.thumbnail=imageData(input.thumbnail,75000);
  return out;
}
export function designCSS(d,fontFamily,headingFamily){
  const shadow={none:'none',soft:'0 5px 20px -12px color-mix(in srgb,var(--ink) 25%,transparent)',hard:'4px 5px 0 var(--line)'}[d.buttonShadow];
  const layers=[];
  if(d.pattern==='dots')layers.push('radial-gradient(color-mix(in srgb,var(--ink) 15%,transparent) .7px,transparent .7px)');
  if(d.pattern==='grid')layers.push('linear-gradient(color-mix(in srgb,var(--ink) 6%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ink) 6%,transparent) 1px,transparent 1px)');
  if(d.background==='gradient')layers.push(`linear-gradient(${d.gradientAngle}deg,var(--bg),var(--gradient-to))`);
  if(d.background==='image'&&d.backgroundImage)layers.push(`linear-gradient(color-mix(in srgb,var(--bg) ${d.backgroundOverlay}%,transparent),color-mix(in srgb,var(--bg) ${d.backgroundOverlay}%,transparent)),url("${d.backgroundImage}")`);
  const patternCount=d.pattern==='grid'?2:d.pattern==='dots'?1:0;
  const backgroundCount=(d.background==='image'&&d.backgroundImage)?2:d.background==='gradient'?1:0;
  const sizes=[...Array(patternCount).fill(d.pattern==='dots'?'12px 12px':'28px 28px'),...Array(backgroundCount).fill('cover')].join(',');
  const avatarRadius={soft:'29%',circle:'50%',square:'3px'}[d.avatarShape];
  const buttonBackground=d.buttonStyle==='outline'?'transparent':d.buttonStyle==='glass'?'color-mix(in srgb,var(--card) 68%,transparent)':'var(--card)';
  const motion=d.animation==='fade'?'lp-fade .5s ease both':d.animation==='rise'?'lp-rise .5s ease both':'none';
  return `.lp-main{display:${d.layout==='split'?'grid':'block'};grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);column-gap:48px;align-items:start}.lp-main>nav{min-width:0}.lp-main>.lp-note,.lp-main>.lp-draft{grid-column:1/-1}.lp-main>nav{padding-top:${d.layout==='split'?d.sectionSpacing:0}px}.lp-inline-qr{margin:24px auto;padding:20px;border:1px solid var(--line);border-radius:var(--radius);text-align:center;max-width:${d.qrSize+42}px;background:var(--card);color:var(--ink)}.lp-inline-qr .lp-qr{width:${d.qrSize}px;margin:0 auto 10px;max-width:100%;border-radius:0}.lp-inline-qr p{font-size:12px;line-height:1.7;overflow-wrap:anywhere}.lp-qr-placeholder{width:100%;min-height:90px;display:grid;place-content:center;color:var(--muted);font-size:11px;line-height:1.7}.lp-qr-placeholder svg{width:45px;height:45px;margin:auto auto 12px}.lp-report{display:block;margin:24px auto 0;text-align:center;font-size:10px;color:var(--muted)}@media(max-width:680px){.lp-main{display:block}.lp-main>nav{padding-top:0}}:root{color-scheme:light;--gradient-to:${d.gradientTo};--bg:${d.bg};--ink:${d.ink};--card:${d.card};--muted:${d.muted};--accent:${d.accent};--line:${d.line};--radius:${d.buttonRadius}px}body{background-color:var(--bg);background-image:${layers.join(',')||'none'};background-size:${sizes||'auto'};background-position:center;min-height:100svh;font-family:${fontFamily}}.lp{width:min(calc(100% - ${d.pagePadding*2}px),${d.pageWidth}px);padding-top:${d.sectionSpacing}px}.lp-profile{text-align:${d.alignment};padding:${d.sectionSpacing}px 0}.lp-avatar{width:${d.avatarSize}px;height:${d.avatarSize}px;border-radius:${avatarRadius};border:${d.avatarRing}px solid var(--accent);margin-left:${d.alignment==='left'?'0':'auto'};font-size:${Math.max(20,d.avatarSize*.28)}px;box-shadow:0 7px 0 var(--accent)}.lp-profile h1{font-family:${headingFamily};font-size:clamp(22px,10vw,${d.headingSize}px);font-weight:${d.headingWeight};letter-spacing:${d.letterSpacing}px}.lp-profile p{font-size:${d.bodySize}px;max-width:100%;margin-left:${d.alignment==='left'?'0':'auto'}}.lp-links{gap:${d.linkGap}px;grid-template-columns:${d.layout==='grid'?'repeat(2,minmax(0,1fr))':'1fr'}}.lp-link{padding:${d.buttonPadding}px;border-width:${d.buttonBorder}px;background:${buttonBackground};backdrop-filter:${d.buttonStyle==='glass'?'blur(12px)':'none'};box-shadow:${shadow};animation:${motion};min-width:0}.lp-link:hover{transform:${d.hover==='none'?'none':d.hover==='grow'?'scale(1.02)':'translateY(-3px)'}}.lp-copy strong{font-size:${d.bodySize}px}.lp-copy small{font-size:${Math.max(11,d.bodySize-2)}px}.lp-cover{display:block;width:100%;height:${d.coverHeight}px;object-fit:cover;border-radius:${d.coverRadius}px;margin-top:20px}.lp-badge{display:inline-block;margin:0 0 7px;padding:4px 7px;border-radius:20px;background:var(--accent);color:var(--ink);font-size:9px;font-weight:700;line-height:1.2}.lp-featured{border-color:var(--ink);border-width:${Math.max(2,d.buttonBorder)}px}.lp-thumbnail{display:block;object-fit:cover;width:48px;height:48px;border-radius:12px;flex-shrink:0}.lp-footer{gap:14px;flex-wrap:wrap}.lp-footer span{overflow-wrap:anywhere}.lp-top{gap:12px;min-height:44px}.lp-top>span{overflow-wrap:anywhere}.lp-note{white-space:pre-line;overflow-wrap:anywhere}.lp-links-grid .lp-link{flex-direction:column;align-items:${d.alignment==='left'?'flex-start':'center'};text-align:${d.alignment};height:100%}.lp-links-grid .lp-arrow{display:none}.lp-links-grid .lp-symbol,.lp-links-grid .lp-thumbnail{margin-bottom:5px}@keyframes lp-fade{from{opacity:0}to{opacity:1}}@keyframes lp-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.lp-link{animation:none!important;transition:none!important}.lp-link:hover{transform:none!important}}@media(max-width:350px){.lp-links-grid{grid-template-columns:1fr}.lp{width:calc(100% - 28px)}}`;
}
export function contrastRatio(a,b){const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const x=luminance(a),y=luminance(b);return((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(1);}

export function colorModeCSS(d){
  const dark=`color-scheme:dark;--bg:${d.darkBg};--ink:${d.darkInk};--card:${d.darkCard};--muted:${d.darkMuted};--accent:${d.darkAccent};--line:${d.darkLine};--gradient-to:${d.darkGradientTo}`;
  return `:root[data-mode="dark"]{${dark}}@media(prefers-color-scheme:dark){:root[data-mode="system"]{${dark}}}.lp-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.lp-mode{color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:24px;min-height:44px;padding:0 10px;font:11px ${'Arial,sans-serif'};cursor:pointer;max-width:100px}.lp-mode-preview{display:flex;align-items:center}.lp-mode:focus-visible{outline:3px solid var(--ink);outline-offset:3px}`;
}
