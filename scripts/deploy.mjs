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
async function main(){
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
  await run(['d1','migrations','apply','DB','--remote']);
  await mkdir(resolve(root,'.data'),{recursive:true,mode:0o700});
  let key=process.env.ADMIN_KEY||(await readOptional(resolve(root,'.data/admin-key'))).trim();
  if(!key){key=randomBytes(32).toString('hex');await writeFile(resolve(root,'.data/admin-key'),key+'\n',{mode:0o600,flag:'wx'});}
  if(key.length<32)throw new Error('Use a randomly generated ADMIN_KEY with at least 32 characters.');
  const temporary=await mkdtemp(join(tmpdir(),'linkboard-deploy-'));
  try{
    const secretFile=join(temporary,'secrets.json');await writeFile(secretFile,JSON.stringify({ADMIN_KEY:key}),{mode:0o600});
    await run(['deploy','--secrets-file',secretFile]);
  }finally{await rm(temporary,{recursive:true,force:true});}
  console.log('Open the HTTPS address printed by Wrangler to use your hosted workspace.');
  console.log(process.env.ADMIN_KEY?'Sign in with the ADMIN_KEY you supplied.':'Run npm run owner-key to view your private sign-in key.');
  console.log('The hosted database is separate from local development data. Configure QMC in the hosted editor, or import a page backup.');
}
main().catch(error=>{console.error(error.message);process.exit(1);});
