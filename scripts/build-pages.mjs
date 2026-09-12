import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
const root=new URL('../',import.meta.url);
const directory=process.argv[2]?pathToFileURL(resolve(process.argv[2])+sep):new URL('docs/',root);
const target=new URL('index.html',directory);
await mkdir(directory,{recursive:true});
const built=spawnSync(process.execPath,[fileURLToPath(new URL('scripts/build-preview.mjs',root)),fileURLToPath(target)],{cwd:fileURLToPath(root),stdio:'inherit'});
if(built.status!==0)process.exit(built.status||1);
let html=await readFile(target,'utf8');
html=html.replace('<title>Linkboard | Your links, your space</title>','<title>Linkboard | Interactive editor demo</title>')
  .replace('<strong>Offline demo</strong>','<strong>Interactive demo</strong>')
  .replace('Try the editor. Changes stay in this browser. Export your website in Settings to host it.','Changes stay in this browser. Accounts and public publishing require the hosted app. Export a website in Settings.');
await writeFile(target,html);
await writeFile(new URL('.nojekyll',directory),'');
console.log('GitHub Pages demo prepared:',fileURLToPath(directory));
