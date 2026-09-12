import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [html,css,core,qr,app,demo,favicon,design,studio,share,modes,account]=await Promise.all(['public/editor.html','public/app.css','public/core.mjs','public/qr.mjs','public/app.mjs','scripts/demo-api.mjs','public/favicon.svg','public/design.mjs','public/studio.mjs','public/page.mjs','public/color-mode.mjs','public/account.mjs'].map(read));
const exported=source=>[...source.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)].map(m=>m[1]);
const strip=source=>source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const module=(name,source,imports='')=>`const ${name}=(()=>{${imports}\n${strip(source)}\nreturn {${exported(source).join(',')}};})();`;
const code=`${module('Modes',modes)}
${module('Design',design)}
${module('Core',core,'const {normalizeDesign,normalizeLinkStyle,designCSS,colorModeCSS}=Design;const {initColorMode}=Modes;')}
${module('Studio',studio,'const {THEMES,FONTS,escapeHTML:e,icon}=Core;const {normalizeDesign,normalizeLinkStyle,contrastRatio}=Design;')}
const createQR=(()=>{${strip(qr)}\nreturn createQR;})();
${strip(demo)}
installDemoAPI(Core);
globalThis.LINKBOARD_DEMO_WEBSITE=page=>Core.standaloneDocument(page,${JSON.stringify(qr)},${JSON.stringify(share)});
${module('Accounts',account,'const {escapeHTML:e}=Core;')}
const {accountForms}=Accounts;
const {initColorMode}=Modes;
const {THEMES,SOCIALS,icon,escapeHTML:e,renderPage,safeLink,isHosted,blankPage}=Core;
const {normalizeDesign,normalizeLinkStyle}=Design;
const {studioHTML,bindStudio,linkStyleHTML,prepareImage}=Studio;
${strip(app)}`;
const output=html.replace('<link rel="stylesheet" href="/app.css">',`<style>${css}</style>`).replace('<script type="module" src="/app.mjs"></script>','').replace('href="/favicon.svg"',`href="data:image/svg+xml,${encodeURIComponent(favicon)}"`).replace('href="/" aria-label="Linkboard home"','href="#links" aria-label="Linkboard home"').replace('</body>',`<script type="module">${code.replace(/<\/script/gi,'<\\/script')}</script>\n</body>`);
const target=process.argv[2]||resolve('linkboard-demo.html');await writeFile(target,output);console.log('Offline demo created:',target);
