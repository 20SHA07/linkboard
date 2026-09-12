// Used only by the downloadable offline demo. Production always uses the real API.
export function installDemoAPI({blankPage,validatePage}){
  const key='linkboard-offline-demo-v1';let storage=true;
  function initial(){return [{...blankPage('QMC','qmc'),id:'qmc-starter',version:1,slug_locked:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),links:[
    {id:'qmc-instagram',title:'Instagram',description:'Photos, stories & updates',icon:'instagram',url:'',enabled:false},
    {id:'qmc-whatsapp',title:'WhatsApp',description:'Stay in the loop',icon:'whatsapp',url:'',enabled:false},
    {id:'qmc-tiktok',title:'TikTok',description:'Behind the scenes',icon:'tiktok',url:'',enabled:false},
    {id:'qmc-linkedin',title:'LinkedIn',description:'Connect with us',icon:'linkedin',url:'',enabled:false}
  ]}];}
  let pages;
  try{const saved=localStorage.getItem(key);pages=saved?JSON.parse(saved):initial();if(!Array.isArray(pages))throw Error();pages=pages.map(p=>({...p,...validatePage(p),published:false}));}catch{pages=initial();}
  function save(){try{localStorage.setItem(key,JSON.stringify(pages));}catch{storage=false;}}
  save();
  const clone=x=>structuredClone(x);
  function create(input){const page={...validatePage({...input,published:false}),id:crypto.randomUUID(),version:1,slug_locked:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(pages.some(p=>p.slug===page.slug))throw Error('That address is already in use. Choose another.');page.links=page.links.map(l=>({...l,id:crypto.randomUUID()}));pages.push(page);save();return{page:clone(page),storage};}
  globalThis.LINKBOARD_DEMO_API=async(path,method='GET',body)=>{
    if(path==='/api/session')return{authenticated:true,origin:'',demo:true,storage};
    if(path==='/api/pages'&&method==='GET')return{pages:clone(pages)};
    if(path==='/api/pages'&&method==='POST')return create({...blankPage(body.name,body.slug),...body});
    if(path==='/api/import'&&method==='POST'){if(body.format!=='linkboard-page'||body.formatVersion!==1)throw Error('Choose a Linkboard page backup.');return create({...body.page,slug:body.slug||body.page.slug});}
    const match=path.match(/^\/api\/pages\/([a-zA-Z0-9-]+)(?:\/(stats|export))?$/);
    if(match){
      const p=pages.find(p=>p.id===match[1]);if(!p)throw Error('This page could not be found.');
      if(match[2]==='stats')return{enabled:p.analytics,since:new Date(Date.now()-29*86400000).toISOString().slice(0,10),rows:[],links:p.links.map(l=>({id:l.id,title:l.title}))};
      if(match[2]==='export')return{format:'linkboard-page',formatVersion:1,exportedAt:new Date().toISOString(),page:clone(p)};
      if(method==='GET')return{page:clone(p)};
      if(method==='PUT'){if(body.version!==p.version)throw Error('Reload this page before saving.');const changed=validatePage({...body,published:false});if(pages.some(other=>other.id!==p.id&&other.slug===changed.slug))throw Error('That address is already in use.');Object.assign(p,changed,{version:p.version+1,updated_at:new Date().toISOString()});save();return{page:clone(p),storage};}
      if(method==='DELETE'){if(body.confirm!==p.slug)throw Error('Enter the page address to confirm deletion.');pages=pages.filter(item=>item.id!==p.id);save();return{ok:true};}
    }
    throw Error('This action is only available in the running app.');
  };
}
