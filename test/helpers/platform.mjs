import { readFile } from 'node:fs/promises';
import worker from '../../src/worker.mjs';
import { openDatabase } from '../../src/db.mjs';
import { mockAuth, AUTH, OWNER, PASSWORD } from './auth-provider.mjs';
export const LEGACY_KEY='legacy-test-key-for-claiming-only-'.repeat(2);
export function platform(t){
  const provider=mockAuth(),env={...AUTH,ADMIN_KEY:LEGACY_KEY,DB:openDatabase(),AUTH_FETCH:provider.fetch,ASSETS:{async fetch(request){const filename=new URL(request.url).pathname.slice(1)||'index.html';return new Response(await readFile(new URL('../../public/'+filename,import.meta.url)));}}};
  t.after(()=>env.DB.close());
  function client(){let cookie='';return{
    async call(path,method='GET',body,headers={}){const response=await worker.fetch(new Request('https://links.example.org'+path,{method,headers:{origin:'https://links.example.org','x-linkboard':'1','content-type':'application/json','cf-connecting-ip':'192.0.2.1',cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const text=await response.text();let data;try{data=JSON.parse(text);}catch{}return{status:response.status,headers:response.headers,data,text};},
    login(email=OWNER,password=PASSWORD){return this.call('/api/login','POST',{email,password});},cookie:()=>cookie
  };}
  return{env,provider,client};
}
