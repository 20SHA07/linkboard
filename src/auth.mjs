import { HttpError, json, sha, encoder, mutationGuard, readJSON, limitRequest } from './http.mjs';
const SESSION_MS=7*24*60*60*1000;
const COOKIE=request=>new URL(request.url).protocol==='https:'?'__Host-linkboard':'linkboard_local';
const token=request=>(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE(request)+'='))?.slice(COOKIE(request).length+1)||'';
const cookie=(request,value,seconds=SESSION_MS/1000)=>`${COOKIE(request)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const email=value=>{if(typeof value!=='string'||value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new HttpError(400,'Enter a valid email address.');return value.trim().toLowerCase();};
function password(value){if(typeof value!=='string'||value.length<12||value.length>128)throw new HttpError(400,'Use a password between 12 and 128 characters.');return value;}
export function authConfig(env){
  let url='';try{const u=new URL(env.SUPABASE_URL);if(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash)url=u.origin;}catch{}
  const configured=!!url&&typeof env.SUPABASE_PUBLISHABLE_KEY==='string'&&env.SUPABASE_PUBLISHABLE_KEY.length>=20&&typeof env.SESSION_SECRET==='string'&&env.SESSION_SECRET.length>=32;
  return {configured,url,registrationOpen:env.REGISTRATION_OPEN!=='false',captchaSiteKey:env.TURNSTILE_SITE_KEY||'',supportEmail:env.SUPPORT_EMAIL||''};
}
function ready(env){if(!authConfig(env).configured)throw new HttpError(503,'Sign-in is temporarily unavailable. Please try again later.');}
function profile(user){
  if(!user||typeof user.id!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(user.id)||!user.email||!user.email_confirmed_at)throw new HttpError(401,'Verify your email before signing in.');
  return {id:user.id,email:email(user.email),display_name:String(user.user_metadata?.display_name||'').slice(0,60)};
}
export function publicAccount(user,env){return {id:user.id,email:user.email,displayName:user.display_name||'',admin:!!env.OWNER_EMAIL&&user.email.toLowerCase()===env.OWNER_EMAIL.trim().toLowerCase()};}
async function provider(env,path,{method='POST',body,accessToken}={}){
  ready(env);let response;
  try{response=await (env.AUTH_FETCH||fetch)(authConfig(env).url+'/auth/v1/'+path,{method,headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json',...(accessToken?{authorization:'Bearer '+accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(503,'The account service is unavailable. Please try again shortly.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===429)throw new HttpError(429,'The account service is busy. Please wait before trying again.');if(response.status>=500)throw new HttpError(503,'The account service is unavailable. Please try again shortly.');const error=new HttpError(401,'The email, password, or code could not be verified.');error.providerCode=data.error_code||data.code;throw error;}
  return data;
}
async function encryptionKey(env){return crypto.subtle.importKey('raw',new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(env.SESSION_SECRET))),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(authConfig(env).url)},await encryptionKey(env),encoder.encode(JSON.stringify(value))));return JSON.stringify({iv:Array.from(iv),data:Array.from(bytes)});}
async function unseal(env,value){try{const box=JSON.parse(value);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(box.iv),additionalData:encoder.encode(authConfig(env).url)},await encryptionKey(env),new Uint8Array(box.data))));}catch{throw new HttpError(401,'Your session expired. Sign in again.');}}
async function tag(env){return sha(env.SESSION_SECRET+':'+authConfig(env).url);}
async function saveProfile(env,user){
  const p=profile(user);
  if(!authConfig(env).registrationOpen&&!publicAccount(p,env).admin&&!await env.DB.prepare('SELECT id FROM accounts WHERE id=?').bind(p.id).first())throw new HttpError(403,'New account registration is temporarily closed.');
  await env.DB.prepare('INSERT INTO accounts(id,email,display_name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name').bind(p.id,p.email,p.display_name,new Date().toISOString()).run();
  const row=await env.DB.prepare('SELECT * FROM accounts WHERE id=?').bind(p.id).first();if(row.disabled)throw new HttpError(403,'This account is unavailable. Contact the site owner for help.');return row;
}
async function startSession(request,env,data,purpose='account'){
  if(!data.access_token||!data.refresh_token)throw new HttpError(401,'Verify your email, then sign in.');
  const verified=await provider(env,'user',{method:'GET',accessToken:data.access_token}),user=await saveProfile(env,verified);
  const raw=random(),expires=Date.now()+(purpose==='recovery'?20*60000:SESSION_MS);
  const old=token(request);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO account_sessions(token_hash,user_id,token_box,key_tag,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(await sha(raw),user.id,await seal(env,{access_token:data.access_token,refresh_token:data.refresh_token}),await tag(env),purpose,expires,Date.now()),
    env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=? OR expires_at<?').bind(await sha(old),Date.now()),
    env.DB.prepare('DELETE FROM login_limits WHERE expires_at<?').bind(Date.now())
  ]);
  return json({ok:true,user:publicAccount(user,env),needsPasswordReset:purpose==='recovery'},200,{'set-cookie':cookie(request,raw,purpose==='recovery'?1200:SESSION_MS/1000)});
}
export async function authenticate(request,env){
  if(!authConfig(env).configured)return null;const raw=token(request);if(!/^[a-f0-9]{64}$/.test(raw))return null;
  const hash=await sha(raw),row=await env.DB.prepare('SELECT * FROM account_sessions WHERE token_hash=?').bind(hash).first();
  if(!row||row.expires_at<=Date.now()||row.key_tag!==await tag(env))return null;
  let pair;try{pair=await unseal(env,row.token_box);}catch{return null;}
  let user;
  try{user=await provider(env,'user',{method:'GET',accessToken:pair.access_token});}
  catch(error){
    if(error.status!==401)throw error;
    try{const fresh=await provider(env,'token?grant_type=refresh_token',{body:{refresh_token:pair.refresh_token}});pair={access_token:fresh.access_token,refresh_token:fresh.refresh_token};if(!pair.access_token||!pair.refresh_token)throw new HttpError(401,'Sign in again.');
      const changed=await env.DB.prepare('UPDATE account_sessions SET token_box=? WHERE token_hash=? AND token_box=?').bind(await seal(env,pair),hash,row.token_box).run();
      if(!changed.meta.changes){const latest=await env.DB.prepare('SELECT token_box FROM account_sessions WHERE token_hash=?').bind(hash).first();if(!latest)return null;pair=await unseal(env,latest.token_box);}
      user=await provider(env,'user',{method:'GET',accessToken:pair.access_token});
    }catch(refreshError){if(refreshError.status!==401)throw refreshError;await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(hash).run();return null;}
  }
  const p=profile(user);if(p.id!==row.user_id){await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(hash).run();return null;}
  const account=await env.DB.prepare('SELECT * FROM accounts WHERE id=?').bind(p.id).first();if(!account||account.disabled)return null;
  return {user:{...account,email:p.email,display_name:p.display_name},hash,pair,recovery:row.purpose==='recovery'};
}
export async function authRoute(request,env,path){
  if(!['/api/login','/api/logout','/api/auth/signup','/api/auth/verify','/api/auth/recover','/api/auth/resend','/api/auth/password'].includes(path))return null;
  if(request.method!=='POST')throw new HttpError(405,'Use the account form to continue.');mutationGuard(request);ready(env);
  const body=await readJSON(request,12000);
  if(path==='/api/logout'){
    const raw=token(request),hash=await sha(raw),row=await env.DB.prepare('SELECT token_box FROM account_sessions WHERE token_hash=?').bind(hash).first();await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(hash).run();
    if(row){try{const pair=await unseal(env,row.token_box);await provider(env,'logout?scope=local',{accessToken:pair.access_token});}catch{/* Local logout still revokes this app session immediately. */}}
    return json({ok:true},200,{'set-cookie':cookie(request,'',0)});
  }
  await limitRequest(request,env,'auth:'+path,10,600000);
  if(path==='/api/auth/password'){
    const session=await authenticate(request,env);if(!session)throw new HttpError(401,'Sign in again to change your password.');const next=password(body.password);let passwordAccess=session.pair.access_token;
    if(!session.recovery){const checked=await provider(env,'token?grant_type=password',{body:{email:session.user.email,password:String(body.currentPassword||''),gotrue_meta_security:{captcha_token:body.captchaToken||undefined}}});if(checked.user?.id!==session.user.id)throw new HttpError(401,'Your current password could not be verified.');passwordAccess=checked.access_token;}
    await provider(env,'user',{method:'PUT',accessToken:passwordAccess,body:{password:next}});
    await env.DB.prepare('DELETE FROM account_sessions WHERE user_id=?').bind(session.user.id).run();
    return json({ok:true,signInRequired:true},200,{'set-cookie':cookie(request,'',0)});
  }
  const address=email(body.email);
  const security={gotrue_meta_security:{captcha_token:typeof body.captchaToken==='string'?body.captchaToken:undefined}};
  if(path==='/api/login'){
    if(typeof body.password!=='string'||body.password.length>128)throw new HttpError(400,'Enter your email and password.');
    const data=await provider(env,'token?grant_type=password',{body:{email:address,password:body.password,...security}});return startSession(request,env,data);
  }
  if(path==='/api/auth/signup'){
    if(!authConfig(env).registrationOpen)throw new HttpError(403,'New account registration is temporarily closed.');await limitRequest(request,env,'signup',5,3600000);
    const name=typeof body.displayName==='string'?body.displayName.trim():'';if(!name||name.length>60)throw new HttpError(400,'Enter a name of up to 60 characters.');
    const data=await provider(env,'signup',{body:{email:address,password:password(body.password),data:{display_name:name},...security}});
    if(data.access_token)return startSession(request,env,data);
    return json({ok:true,verificationRequired:true,message:'Check your email for the verification code. If you already have an account, sign in.'});
  }
  if(path==='/api/auth/recover'||path==='/api/auth/resend'){
    await limitRequest(request,env,'email',4,3600000,address);
    try{await provider(env,path.endsWith('recover')?'recover':'resend',{body:{email:address,...(path.endsWith('resend')?{type:'signup'}:{}),...security}});}catch(error){if(error.status>=500||error.status===429)throw error;}
    return json({ok:true,message:'If this address can receive a code, it will arrive shortly.'});
  }
  if(path==='/api/auth/verify'){
    if(!['signup','recovery'].includes(body.type)||typeof body.code!=='string'||!/^\d{6,10}$/.test(body.code))throw new HttpError(400,'Enter the code from your email.');
    const data=await provider(env,'verify',{body:{email:address,token:body.code,type:body.type==='signup'?'email':'recovery',...security}});return startSession(request,env,data,body.type==='recovery'?'recovery':'account');
  }
  return null;
}
