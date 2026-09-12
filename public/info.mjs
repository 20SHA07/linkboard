const contact=document.querySelector('[data-support]');
if(contact)fetch('/api/config').then(r=>r.json()).then(config=>{if(typeof config.supportEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail)){const a=document.createElement('a');a.href='mailto:'+config.supportEmail;a.textContent=config.supportEmail;contact.replaceChildren(a);}}).catch(()=>{});
