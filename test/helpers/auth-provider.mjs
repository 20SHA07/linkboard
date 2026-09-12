// A contract double, never used by production. Real SMTP/provider checks are separate.
export const OWNER='owner@example.com',OTHER='another@example.com',PASSWORD='a long test passphrase';
export const AUTH={SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_unit_test_only',SESSION_SECRET:'test-only-session-secret-'.repeat(3),OWNER_EMAIL:OWNER};
export function mockAuth(){
  const users=new Map(),access=new Map(),refresh=new Map(),codes=new Map(),requests=[];
  let outage=false;
  const add=(email,name='Creator',confirmed=true)=>{const user={id:crypto.randomUUID(),email,email_confirmed_at:confirmed?'2026-09-12T00:00:00Z':null,user_metadata:{display_name:name},password:PASSWORD};users.set(email,user);return user;};
  const clean=user=>{const {password,...rest}=user;return structuredClone(rest);};
  add(OWNER,'Owner');add(OTHER,'Another creator');
  function issue(user){const a=crypto.randomUUID(),r=crypto.randomUUID();access.set(a,user);refresh.set(r,{user});return{access_token:a,refresh_token:r,token_type:'bearer',expires_in:3600,user:clean(user)};}
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  async function fetch(url,options={}){
    const parsed=new URL(url),path=parsed.pathname.replace('/auth/v1/',''),body=options.body?JSON.parse(options.body):{},method=options.method||'GET',bearer=options.headers.authorization?.replace('Bearer ','');
    requests.push({path,method,body,headers:options.headers});
    if(outage)return reply({error:'temporarily_unavailable'},503);
    if(options.headers.apikey!==AUTH.SUPABASE_PUBLISHABLE_KEY)return reply({},401);
    if(path==='token'&&parsed.searchParams.get('grant_type')==='password'){
      const user=users.get(body.email);if(!user||user.password!==body.password||!user.email_confirmed_at)return reply({error_code:'invalid_credentials'},400);return reply(issue(user));
    }
    if(path==='token'&&parsed.searchParams.get('grant_type')==='refresh_token'){
      const item=refresh.get(body.refresh_token);if(!item)return reply({},400);if(!item.result)item.result=issue(item.user);return reply(item.result);
    }
    if(path==='user'){
      const user=access.get(bearer);if(!user)return reply({},401);
      if(method==='PUT'){if(body.password)user.password=body.password;if(body.data)user.user_metadata={...user.user_metadata,...body.data};}
      return reply(clean(user));
    }
    if(path==='signup'){
      if(!users.has(body.email)){const user=add(body.email,body.data.display_name,false);user.password=body.password;codes.set(body.email+':signup','123456');return reply({user:clean(user)});}
      return reply({user:{id:crypto.randomUUID(),identities:[]}});
    }
    if(path==='recover'||path==='resend'){if(users.has(body.email))codes.set(body.email+':'+(path==='recover'?'recovery':'signup'),'123456');return reply({});}
    if(path==='verify'){
      if(body.type==='email')body.type='signup';
      const user=users.get(body.email);if(!user||!codes.has(body.email+':'+body.type)||codes.get(body.email+':'+body.type)!==body.token)return reply({},403);
      codes.delete(body.email+':'+body.type);if(body.type==='signup')user.email_confirmed_at=new Date().toISOString();return reply(issue(user));
    }
    if(path==='logout'){for(const [key,item] of refresh)if(item.user===access.get(bearer))refresh.delete(key);return reply({});}
    throw Error('Unexpected mocked auth request: '+method+' '+url);
  }
  return{fetch,users,access,refresh,requests,add,issue,outage(value=true){outage=value;}};
}
