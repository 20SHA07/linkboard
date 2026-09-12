import { createInterface } from 'node:readline/promises';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),file=resolve(root,'.env');
const input=createInterface({input:process.stdin,output:process.stdout});
try{
  let existing={};try{existing=parseEnv(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  console.log('Connect Linkboard to Supabase Auth. Values are saved only in your local .env file.');
  console.log('Set up email confirmation, code templates, and SMTP in Supabase as described in README.md.');
  const url=(await input.question(`Supabase project URL${existing.SUPABASE_URL?' [Enter to keep current]':''}: `)).trim()||existing.SUPABASE_URL;
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Use the HTTPS project URL, without an API path.');
  const key=(await input.question(`Supabase publishable key${existing.SUPABASE_PUBLISHABLE_KEY?' [Enter to keep current]':''}: `)).trim()||existing.SUPABASE_PUBLISHABLE_KEY;
  if(!key||key.length<20||key.startsWith('sb_secret_'))throw Error('Use the publishable key or legacy anon key. Do not use a secret/service_role key.');
  if(key.startsWith('eyJ')){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')throw Error();}catch{throw Error('The legacy key must have the anon role.');}}
  const email=(await input.question(`Site owner email${existing.OWNER_EMAIL?' [Enter to keep current]':''}: `)).trim()||existing.OWNER_EMAIL;
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter the email you will verify when registering the owner account.');
  const support=(await input.question('Support email [Enter to use owner email]: ')).trim()||existing.SUPPORT_EMAIL||email;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support))throw Error('Enter a valid support email.');
  const turnstile=(await input.question('Turnstile site key [Enter to keep existing, or leave blank]: ')).trim()||existing.TURNSTILE_SITE_KEY||'';
  let secret=existing.SESSION_SECRET;
  if(!secret||secret.length<32){try{secret=(await readFile(resolve(root,'.data/session-secret'),'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;}}
  if(!secret||secret.length<32)secret=randomBytes(32).toString('hex');
  const config={...existing,SUPABASE_URL:parsed.origin,SUPABASE_PUBLISHABLE_KEY:key,SESSION_SECRET:secret,OWNER_EMAIL:email.toLowerCase(),SUPPORT_EMAIL:support,REGISTRATION_OPEN:existing.REGISTRATION_OPEN||'true',MAX_PAGES_PER_USER:existing.MAX_PAGES_PER_USER||'5',TURNSTILE_SITE_KEY:turnstile};
  for(const value of Object.values(config))if(/[\r\n"\\]/.test(value))throw Error('Configuration values cannot contain newlines, quotes, or backslashes.');
  await writeFile(file,'# Private configuration. Never commit this file.\n'+Object.entries(config).map(([key,value])=>`${key}="${value}"`).join('\n')+'\n',{mode:0o600});
  await mkdir(resolve(root,'.data'),{recursive:true,mode:0o700});
  console.log('Configuration saved. Run npm start to test locally, then npm run deploy to host it.');
}finally{input.close();}
