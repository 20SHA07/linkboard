import { authConfig } from '../src/auth.mjs';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const root=fileURLToPath(new URL('../',import.meta.url));
const npx=process.platform==='win32'?'npx.cmd':'npx';
function run(args){return new Promise((resolve,reject)=>{const npm=process.env.npm_execpath;const command=npm?process.execPath:npx;const parameters=npm?[npm,'exec','--yes','--package=wrangler@4','--','wrangler',...args]:['--yes','wrangler@4',...args];const child=spawn(command,parameters,{cwd:root,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Wrangler stopped. Fix the reported issue, then run npm run deploy again.')));});}
async function readOptional(path){try{return await readFile(path,'utf8');}catch(error){if(error.code==='ENOENT')return '';throw error;}}
// Wrangler may add JSONC comments. Strip comments outside strings only.
function parseConfig(source){let out='',quoted=false,escape=false;for(let i=0;i<source.length;i++){const c=source[i],next=source[i+1];if(quoted){out+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}else if(c==='"'){quoted=true;out+=c;}else if(c==='/'&&next==='/'){while(i<source.length&&source[i]!=='\n')i++;out+='\n';}else if(c==='/'&&next==='*'){i+=2;while(i<source.length&&!(source[i]==='*'&&source[i+1]==='/'))i++;i++;out+=' ';}else out+=c;}return JSON.parse(out.replace(/,\s*([}\]])/g,'$1'));}
async function main(){
  if(!authConfig(process.env).configured)throw new Error('Run npm run configure first. Supabase project URL, publishable key, and a session secret are required.');
  if(!process.env.OWNER_EMAIL||!process.env.SUPPORT_EMAIL)throw new Error('Set OWNER_EMAIL and SUPPORT_EMAIL in .env before deploying.');
  console.log('Deploy Linkboard to your Cloudflare account.');
  console.log('Use the Workers Free plan. This script does not enable a paid plan.');
  console.log('Cloudflare will ask you to sign in through your browser.');
  await run(['login']);
  const configPath=resolve(root,'wrangler.jsonc');let config=await readOptional(configPath);
  let name;
  if(!config){
    const input=createInterface({input:process.stdin,output:process.stdout});
    name=(await input.question('Choose a Worker name [linkboard]: ')).trim()||'linkboard';input.close();
    if(!/^[a-z][a-z0-9-]{1,39}$/.test(name))throw new Error('Use 2–40 lowercase letters, numbers, or hyphens, starting with a letter.');
    const template=JSON.parse(await readFile(resolve(root,'wrangler.example.jsonc'),'utf8'));
    template.name=name;template.d1_databases=[];await writeFile(configPath,JSON.stringify(template,null,2)+'\n');config=await readFile(configPath,'utf8');
  }else{name=config.match(/"name"\s*:\s*"([a-z][a-z0-9-]+)"/)?.[1];if(!name)throw new Error('Check the name in wrangler.jsonc before deploying.');}
  if(!/"database_id"\s*:\s*"[a-f0-9-]{36}"/i.test(config)){
    await run(['d1','create',name+'-db','--binding','DB','--update-config']);
    config=await readFile(configPath,'utf8');
    if(!/"database_id"\s*:\s*"[a-f0-9-]{36}"/i.test(config))throw new Error('Add the database ID printed above to wrangler.jsonc, then run npm run deploy again.');
  }
  // Preserve database identity and other bindings while upgrading the app routes.
  const current=parseConfig(config),template=JSON.parse(await readFile(resolve(root,'wrangler.example.jsonc'),'utf8'));
  current.assets={...current.assets,...template.assets};
  current.vars={...current.vars,...Object.fromEntries(['SUPABASE_URL','OWNER_EMAIL','SUPPORT_EMAIL','REGISTRATION_OPEN','MAX_PAGES_PER_USER','TURNSTILE_SITE_KEY','PUBLIC_ORIGIN'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]))};
  await writeFile(configPath,JSON.stringify(current,null,2)+'\n');
  await run(['d1','migrations','apply','DB','--remote']);
  await mkdir(resolve(root,'.data'),{recursive:true,mode:0o700});
  let key=process.env.ADMIN_KEY||(await readOptional(resolve(root,'.data/admin-key'))).trim();
  if(!key){key=randomBytes(32).toString('hex');await writeFile(resolve(root,'.data/admin-key'),key+'\n',{mode:0o600,flag:'wx'});}
  if(key.length<32)throw new Error('Use a randomly generated ADMIN_KEY with at least 32 characters.');
  const temporary=await mkdtemp(join(tmpdir(),'linkboard-deploy-'));
  try{
    const secretFile=join(temporary,'secrets.json');await writeFile(secretFile,JSON.stringify({ADMIN_KEY:key,SESSION_SECRET:process.env.SESSION_SECRET,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY}),{mode:0o600});
    await run(['deploy','--secrets-file',secretFile]);
  }finally{await rm(temporary,{recursive:true,force:true});}
  console.log('Open the HTTPS address printed by Wrangler to use your hosted workspace.');
  console.log('Create and verify an account using OWNER_EMAIL. Use Account > Bring in an earlier workspace to claim QMC with the original key.');
  console.log('Before opening registration: verify SMTP delivery, signup and recovery code templates, and CAPTCHA configuration.');
  console.log('The hosted database is separate from local development data. Configure QMC in the hosted editor, or import a page backup.');
}
main().catch(error=>{console.error(error.message);process.exit(1);});
