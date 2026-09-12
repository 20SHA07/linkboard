import { THEMES, FONTS, escapeHTML as e, icon } from './core.mjs';
import { normalizeDesign, normalizeLinkStyle, contrastRatio } from './design.mjs';

const names={modern:'Modern',editorial:'Editorial',rounded:'Rounded',mono:'Monospace',geometric:'Geometric'};
const fontOptions=Object.keys(FONTS).map(key=>[key,names[key]]);
const title=s=>s[0].toUpperCase()+s.slice(1);
function select(d,key,label,options){return `<label class="studio-field">${label}<select data-design="${key}">${options.map(option=>{const [value,text]=Array.isArray(option)?option:[option,title(option)];return `<option value="${value}" ${d[key]===value?'selected':''}>${text}</option>`;}).join('')}</select></label>`;}
function range(d,key,label,min,max,unit='px',step=1){return `<label class="studio-field range-field"><span>${label}<output data-output="${key}">${d[key]}${unit}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${d[key]}" data-design="${key}" data-unit="${unit}"></label>`;}
function toggle(d,key,label){return `<label class="studio-toggle"><span>${label}</span><span class="switch"><input type="checkbox" data-design="${key}" ${d[key]?'checked':''}><span></span></span></label>`;}
function text(d,key,label,max=140){return `<label class="studio-field">${label}<input type="text" data-design="${key}" maxlength="${max}" value="${e(d[key])}"></label>`;}
function color(d,key,label,link=false){const attr=link?'data-link-color':'data-design-color';return `<label class="color-control"><span>${label}</span><span class="color-inputs"><input type="color" value="${d[key]}" ${attr}="${key}" aria-label="${label} colour"><input type="text" value="${d[key]}" ${attr}="${key}" maxlength="7" pattern="#[0-9a-fA-F]{6}" aria-label="${label} hex code" spellcheck="false"></span></label>`;}
function asset(d,key,label){return `<div class="studio-asset">${d[key]?`<img src="${e(d[key])}" alt="${label} preview">`:`<span class="asset-placeholder">${icon('image')}</span>`}<div><strong>${label}</strong><div class="asset-actions"><button class="text-button" type="button" data-upload-design="${key}">${d[key]?'Replace':'Upload'} image</button>${d[key]?`<button class="text-button" type="button" data-clear-design="${key}">Remove</button>`:''}</div></div><input type="file" accept="image/png,image/jpeg,image/webp" data-file-design="${key}" hidden></div>`;}
function group(key,kicker,label,content,open=false){return `<details class="studio-group" data-studio-group="${key}" ${open?'open':''}><summary><span><small>${kicker}</small><strong>${label}</strong></span><span class="studio-chevron">${icon('plus')}</span></summary><div class="studio-body">${content}</div></details>`;}
export function studioHTML(page){
  const raw=page.design||{},d=normalizeDesign({...raw,customCSS:''},THEMES[page.theme],page.shape);d.customCSS=raw.customCSS||'';
  return group('mode','00 / DISPLAY','Light, dark, or both',`
    ${select(d,'colorMode','Default page mode',[['system','Match visitor’s device'],['light','Light'],['dark','Dark']])}
    ${toggle(d,'showModeToggle','Let visitors choose their mode')}
    <p class="studio-hint">Visitors’ choices stay in their browser. Use the preview selector to check both looks. The editor’s own mode is independent of your public page.</p>`,true)
  +group('palette','01 / COLOUR','Your palette & background',`
    <div class="studio-section-heading"><span data-palette-status>${d.customColors?'Custom light colours':THEMES[page.theme].name+' · light colours'}</span><button class="text-button" type="button" data-reset-palette>Reset colours</button></div>
    <div class="color-grid">${[['bg','Background'],['ink','Text'],['card','Buttons'],['muted','Secondary text'],['accent','Accent'],['line','Borders']].map(([key,label])=>color(d,key,label)).join('')}</div>
    <p class="studio-hint" data-contrast>Light button contrast: ${contrastRatio(d.ink,d.card)}:1. Aim for at least 4.5:1.</p>
    <div class="studio-grid">${select(d,'background','Background',['solid','gradient','image'])}${select(d,'pattern','Texture',['none','dots','grid'])}</div>
    <div data-design-when="background:gradient" ${d.background==='gradient'?'':'hidden'}><div class="studio-grid">${color(d,'gradientTo','Second colour')}${range(d,'gradientAngle','Gradient angle',0,360,'°')}</div></div>
    <div data-design-when="background:image" ${d.background==='image'?'':'hidden'}>${asset(d,'backgroundImage','Background image')}${range(d,'backgroundOverlay','Colour overlay',0,90,'%')}</div>
    <details class="dark-palette" data-studio-group="dark-colours"><summary>Customize dark colours</summary><div class="studio-section-heading"><span data-dark-palette-status>${d.darkCustomColors?'Custom dark colours':'Matching dark palette'}</span><button class="text-button" type="button" data-reset-dark>Reset dark colours</button></div><div class="color-grid">${[['darkBg','Background'],['darkInk','Text'],['darkCard','Buttons'],['darkMuted','Secondary text'],['darkAccent','Accent'],['darkLine','Borders'],['darkGradientTo','Gradient end']].map(([key,label])=>color(d,key,label)).join('')}</div><p class="studio-hint" data-dark-contrast>Dark button contrast: ${contrastRatio(d.darkInk,d.darkCard)}:1. Aim for at least 4.5:1.</p></details>`,true)
  +group('type','02 / TYPE','Find your voice',`
    ${select(d,'headingFont','Heading font',[['inherit','Match body font'],...fontOptions])}
    <div class="studio-grid">${range(d,'headingSize','Heading size',22,64)}${range(d,'bodySize','Body size',12,20)}${range(d,'headingWeight','Heading weight',400,800,'',100)}${range(d,'letterSpacing','Heading spacing',-2,4,'px',.1)}</div>
    <p class="studio-hint">Fonts use those already on each visitor’s device. No font service or subscription.</p>`)
  +group('profile','03 / IDENTITY','Profile & cover',`
    ${asset(d,'coverImage','Cover image')}<div data-design-when="coverImage:set" ${d.coverImage?'':'hidden'}><div class="studio-grid">${range(d,'coverHeight','Cover height',70,260)}${range(d,'coverRadius','Cover corners',0,40)}</div></div>
    ${toggle(d,'showAvatar','Show profile image')}<div class="studio-grid">${select(d,'alignment','Profile alignment',['center','left'])}${select(d,'avatarShape','Image shape',[['soft','Soft square'],['circle','Circle'],['square','Square']])}${range(d,'avatarSize','Profile image size',48,160)}${range(d,'avatarRing','Image border',0,6)}</div>
    <p class="studio-hint">Upload your profile image in the Links tab.</p>`)
  +group('layout','04 / SPACE','Room to breathe',`
    ${select(d,'layout','Link layout',[['stack','Single column'],['grid','Two-column grid']])}<div class="studio-grid">${range(d,'pageWidth','Maximum page width',320,720)}${range(d,'pagePadding','Side margins',12,64)}${range(d,'sectionSpacing','Section spacing',12,72)}${range(d,'linkGap','Space between links',6,30)}</div>`)
  +group('buttons','05 / DETAILS','Buttons & motion',`
    <div class="studio-grid">${select(d,'buttonStyle','Button finish',['filled','outline','glass'])}${select(d,'buttonShadow','Shadow',['none','soft','hard'])}${range(d,'buttonRadius','Corner radius',0,48)}${range(d,'buttonBorder','Border width',0,4)}${range(d,'buttonPadding','Button padding',12,30)}${select(d,'hover','Hover effect',['none','lift','grow'])}${select(d,'animation','Entrance animation',['none','fade','rise'])}</div>
    <p class="studio-hint">Use “Style this link” in Link details for individual colours, a badge, or a thumbnail. Motion respects visitors’ reduced motion settings.</p>`)
  +group('content','06 / FINISHING TOUCHES','Keep what feels like you',`
    <div class="studio-grid">${toggle(d,'showHeader','Show top label')}${toggle(d,'showShare','Show share button')}${toggle(d,'showIcons','Show link icons')}${toggle(d,'showArrows','Show link arrows')}${toggle(d,'showDescriptions','Show descriptions')}${toggle(d,'showFooter','Show footer')}</div>
    ${text(d,'headerLabel','Top label',45)}${text(d,'noteText','Note below links')}${text(d,'footerText','Footer text')}`)
  +group('advanced','07 / YOUR RULES','Custom CSS',`
    <p class="studio-hint">Style the public page with your own CSS. Useful selectors: <code>.lp</code>, <code>.lp-profile</code>, <code>.lp-avatar</code>, <code>.lp-link</code>, <code>.lp-copy</code>, <code>.lp-footer</code>. HTML, JavaScript, and external assets aren’t supported here.</p>
    <label class="studio-field" for="custom-css">Your stylesheet<textarea id="custom-css" class="css-editor" data-design="customCSS" maxlength="18000" rows="8" spellcheck="false" placeholder=".lp-profile h1 {\n  font-style: italic;\n}">${e(d.customCSS)}</textarea></label>
    <button class="text-button" type="button" data-reset-design>Reset all design settings</button>`);
}
export function bindStudio({root,getPage,onChange,onRender,onError,onBusy=()=>{}}){
  function sync(){const p=getPage(),d=normalizeDesign({...p.design,customCSS:''},THEMES[p.theme],p.shape);root.querySelectorAll('[data-design-when]').forEach(el=>{const [key,value]=el.dataset.designWhen.split(':');el.hidden=value==='set'?!d[key]:d[key]!==value;});const contrast=root.querySelector('[data-contrast]');if(contrast)contrast.textContent=`Light button contrast: ${contrastRatio(d.ink,d.card)}:1. Aim for at least 4.5:1.`;const status=root.querySelector('[data-palette-status]');if(status)status.textContent=d.customColors?'Custom light colours':THEMES[p.theme].name+' · light colours';const darkContrast=root.querySelector('[data-dark-contrast]');if(darkContrast)darkContrast.textContent=`Dark button contrast: ${contrastRatio(d.darkInk,d.darkCard)}:1. Aim for at least 4.5:1.`;const darkStatus=root.querySelector('[data-dark-palette-status]');if(darkStatus)darkStatus.textContent=d.darkCustomColors?'Custom dark colours':'Matching dark palette';}
  root.addEventListener('input',event=>{
    const target=event.target,p=getPage();if(!p)return;
    const key=target.dataset.design,colorKey=target.dataset.designColor;if(!key&&!colorKey)return;
    p.design={...normalizeDesign({...p.design,customCSS:''},THEMES[p.theme],p.shape),customCSS:p.design?.customCSS||''};
    if(colorKey){if(!/^#[0-9a-f]{6}$/i.test(target.value)){target.setCustomValidity('Use a six-digit hex code, for example #edf3e6.');return;}target.setCustomValidity('');p.design[colorKey]=target.value.toLowerCase();p.design[colorKey.startsWith('dark')?'darkCustomColors':'customColors']=true;root.querySelectorAll(`[data-design-color="${colorKey}"]`).forEach(el=>{if(el!==target)el.value=target.value;});}
    else{p.design[key]=target.type==='checkbox'?target.checked:target.type==='range'?Number(target.value):target.value;const output=root.querySelector(`[data-output="${key}"]`);if(output)output.textContent=target.value+(target.dataset.unit||'');}
    sync();onChange();
  });
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;const p=getPage();if(!p)return;
    if(button.dataset.uploadDesign)root.querySelector(`[data-file-design="${button.dataset.uploadDesign}"]`).click();
    if(button.dataset.clearDesign){p.design={...p.design,[button.dataset.clearDesign]:''};onRender();onChange();}
    if(button.hasAttribute('data-reset-palette')){p.design={...p.design,customColors:false};onRender();onChange();}
    if(button.hasAttribute('data-reset-dark')){p.design={...p.design,darkCustomColors:false};onRender();onChange();}
    if(button.hasAttribute('data-reset-design')){p.design={};p.font='modern';p.shape='rounded';onRender();onChange();}
  });
  root.addEventListener('change',async event=>{
    const key=event.target.dataset.fileDesign;if(!key)return;const file=event.target.files[0],page=getPage();if(!file||!page)return;const pageId=page.id;onBusy(true);
    try{const data=await prepareImage(file,{width:key==='coverImage'?1200:1440,max:key==='coverImage'?230000:330000});if(getPage()?.id!==pageId)return;const current=getPage();current.design={...current.design,[key]:data,...(key==='backgroundImage'?{background:'image'}:{})};onRender();onChange();}catch(error){onError(error.message);}finally{onBusy(false);event.target.value='';}
  });
}
export function linkStyleHTML(link){
  const a=normalizeLinkStyle(link.appearance);
  return `<form id="link-style-form"><p>Give “${e(link.title)}” its own look. These settings stay with this link when you reorder it.</p><label class="studio-toggle"><span>Use individual colours</span><span class="switch"><input id="link-custom-colors" type="checkbox" ${a.customColors?'checked':''}><span></span></span></label><div class="color-grid link-color-grid">${[['bg','Background'],['ink','Text'],['border','Border']].map(([key,label])=>color(a,key,label,true)).join('')}</div><label class="studio-toggle"><span>Featured border</span><span class="switch"><input id="link-featured" type="checkbox" ${a.featured?'checked':''}><span></span></span></label><label for="link-badge">Badge <span class="optional">(optional)</span></label><input id="link-badge" maxlength="24" value="${e(a.badge)}" placeholder="e.g. Join us"><div class="studio-asset"><span id="link-thumbnail-preview">${a.thumbnail?`<img src="${e(a.thumbnail)}" alt="Thumbnail preview">`:icon('image')}</span><div><strong>Link thumbnail</strong><div class="asset-actions"><button class="text-button" id="link-thumbnail-upload" type="button">Upload image</button><button class="text-button" id="link-thumbnail-remove" type="button" ${a.thumbnail?'':'hidden'}>Remove</button></div></div><input type="file" id="link-thumbnail-file" accept="image/png,image/jpeg,image/webp" hidden></div><p class="field-error" id="modal-error" role="alert"></p><div class="button-row"><button type="button" class="btn secondary" data-close-modal>Cancel</button><button type="submit" class="btn primary" id="apply-link-style">Apply style ${icon('check')}</button></div></form>`;
}
export async function prepareImage(file,{width=1200,max=230000,square=false}={}){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Choose a PNG, JPEG, or WebP image smaller than 12 MB.');
  const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas'),context=canvas.getContext('2d');const side=Math.min(image.width,image.height);let size=Math.min(width,square?side:Math.max(image.width,image.height));
    for(let attempt=0;attempt<5;attempt++){
      canvas.width=square?Math.round(size):Math.max(1,Math.round(image.width*size/Math.max(image.width,image.height)));canvas.height=square?Math.round(size):Math.max(1,Math.round(image.height*size/Math.max(image.width,image.height)));
      if(square)context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,canvas.width,canvas.height);else context.drawImage(image,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/webp',.84-attempt*.08);if(data.length<=max)return data;size*=.8;
    }throw new Error('This image is too detailed. Try a smaller or simpler image.');
  }catch(error){throw new Error(error.message||'This image could not be opened.');}finally{URL.revokeObjectURL(url);}
}
