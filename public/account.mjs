import { escapeHTML as e } from './core.mjs';

// Passwords and verification codes stay in form memory, never in browser storage.
export function accountForms({root,api,onAuthenticated,onSignedOut}){
  let config,view='login',address='',flow='signup',captcha='',widget,revision=0;
  const $=id=>root.querySelector('#'+id);
  const copy={login:['WELCOME BACK','Your space awaits.','Sign in to create, edit, and share your pages.','Sign in'],signup:['MAKE YOURSELF AT HOME','Start something you.','Create a free account. Bring all your links along.','Create account'],verify:['CHECK YOUR INBOX','One small step.','Enter the code we sent to your email.','Verify email'],recover:['LET’S GET YOU BACK IN','Forgot your password?','We’ll send a code if an account exists for this email.','Send recovery code'],reset:['A FRESH START','Choose a new password.','Use at least 12 characters. A longer passphrase works well.','Save password'],password:['ACCOUNT SETTINGS','Update your password.','You’ll sign in again after saving your new password.','Update password']};
  async function captchaScript(){
    if(globalThis.turnstile)return;
    if(!globalThis.LINKBOARD_CAPTCHA_LOAD)globalThis.LINKBOARD_CAPTCHA_LOAD=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=resolve;script.onerror=()=>{delete globalThis.LINKBOARD_CAPTCHA_LOAD;script.remove();reject(Error('The verification check could not load. Check your connection and try again.'));};document.head.append(script);});
    await globalThis.LINKBOARD_CAPTCHA_LOAD;
  }
  async function show(next='login',notice=''){
    view=next;const current=++revision;captcha='';
    if(widget!==undefined){try{globalThis.turnstile?.remove(widget);}catch{}widget=undefined;}
    if(!config){root.innerHTML='<p role="status">Opening your account form…</p>';try{config=await api('/api/config');}catch(error){root.innerHTML=`<p role="alert">${e(error.message)}</p><button type="button" class="btn secondary" id="auth-retry">Try again</button>`;$('auth-retry').onclick=()=>show(next);return;}}
    if(current!==revision)return;
    if(!config.configured){root.innerHTML='<span class="eyebrow">ALMOST HERE</span><h2>Accounts are being set up.</h2><p>The editor will open once this Linkboard site is connected to its account service.</p><a class="btn secondary" href="/">Back to Linkboard</a>';return;}
    if(view==='signup'&&!config.registrationOpen){view='login';notice='New registrations are paused. Existing members can still sign in.';}
    const [eyebrow,title,description,button]=copy[view],needsEmail=['login','signup','recover','verify'].includes(view),needsPassword=['login','signup','reset','password'].includes(view),needsCaptcha=!!config.captchaSiteKey&&['login','signup','recover','password','verify'].includes(view);
    root.innerHTML=`<span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${description}</p><form id="account-form">${view==='signup'?'<label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" maxlength="60" required placeholder="What should we call you?">':''}${needsEmail?`<label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" maxlength="254" required value="${e(address)}" ${view==='verify'?'readonly':''} placeholder="you@example.com">`:''}${view==='password'?'<label for="auth-current">Current password</label><input id="auth-current" type="password" autocomplete="current-password" maxlength="128" required>':''}${needsPassword?`<label for="auth-password">${['reset','password'].includes(view)?'New password':'Password'}</label><div class="key-field"><input id="auth-password" name="password" type="password" autocomplete="${view==='login'?'current-password':'new-password'}" ${view==='login'?'':'minlength="12"'} maxlength="128" required placeholder="${view==='login'?'Your password':'At least 12 characters'}"><button type="button" id="auth-reveal" aria-label="Show password">Show</button></div>`:''}${view==='verify'?'<label for="auth-code">Email code</label><input id="auth-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required placeholder="Verification code">':''}${view==='signup'?'<label class="auth-agree"><input type="checkbox" required><span>I agree to the <a href="/terms" target="_blank" rel="noopener">community terms</a> and have read the <a href="/privacy" target="_blank" rel="noopener">privacy information</a>.</span></label>':''}${needsCaptcha?'<div id="auth-captcha" class="auth-captcha"></div>':''}<p class="auth-notice" role="status">${e(notice)}</p><p class="field-error" id="auth-error" role="alert"></p><button class="btn primary full" id="auth-submit" type="submit">${button} ↗</button></form><div class="auth-options">${view==='password'?'<button type="button" class="text-button" id="auth-return">Back to workspace</button>':''}${view==='login'?`<button type="button" class="text-button" data-auth-view="recover">Forgot password?</button>${config.registrationOpen?'<p>New here? <button type="button" class="text-button" data-auth-view="signup">Create an account ↗</button></p>':''}<button type="button" class="text-button" id="auth-continue-verify">Already have a verification code?</button>`:view==='verify'?'<button type="button" class="text-button" id="auth-resend">Send another code</button><button type="button" class="text-button" data-auth-view="login">Back to sign in</button>':'<button type="button" class="text-button" data-auth-view="login">Back to sign in</button>'}</div>`;
    root.querySelectorAll('[data-auth-view]').forEach(b=>b.onclick=()=>{address=$('auth-email')?.value||address;show(b.dataset.authView);});
    if($('auth-return'))$('auth-return').onclick=()=>onAuthenticated();
    if($('auth-reveal'))$('auth-reveal').onclick=()=>{const field=$('auth-password'),reveal=field.type==='password';field.type=reveal?'text':'password';$('auth-reveal').textContent=reveal?'Hide':'Show';$('auth-reveal').setAttribute('aria-label',reveal?'Hide password':'Show password');};
    if($('auth-continue-verify'))$('auth-continue-verify').onclick=()=>{if(!$('auth-email').reportValidity())return;address=$('auth-email').value;flow='signup';show('verify');};
    const body=()=>({email:$('auth-email')?.value||address,captchaToken:captcha});
    const resetCaptcha=()=>{captcha='';if(widget!==undefined)globalThis.turnstile?.reset(widget);};
    if($('auth-resend'))$('auth-resend').onclick=async event=>{const b=event.currentTarget;b.disabled=true;try{if(needsCaptcha&&!captcha)throw Error('Complete the verification check first.');await api(flow==='recovery'?'/api/auth/recover':'/api/auth/resend','POST',body());root.querySelector('.auth-notice').textContent='If eligible, a new code is on its way. Check spam too.';resetCaptcha();}catch(error){$('auth-error').textContent=error.message;}finally{setTimeout(()=>{b.disabled=false;},30000);}};
    $('account-form').onsubmit=async event=>{
      event.preventDefault();const submit=$('auth-submit');submit.disabled=true;$('auth-error').textContent='';const submitted=view;
      try{
        if(needsCaptcha&&submitted!=='verify'&&!captcha)throw Error('Complete the verification check first.');
        const payload=body();address=payload.email;
        if(needsPassword)payload.password=$('auth-password').value;
        if(submitted==='signup')payload.displayName=$('auth-name').value;
        if(submitted==='verify'){payload.code=$('auth-code').value;payload.type=flow;}
        if(submitted==='password')payload.currentPassword=$('auth-current').value;
        const path={login:'/api/login',signup:'/api/auth/signup',verify:'/api/auth/verify',recover:'/api/auth/recover',reset:'/api/auth/password',password:'/api/auth/password'}[submitted];
        const data=await api(path,'POST',payload);
        if(submitted==='recover'){flow='recovery';await show('verify','If an account exists, we sent a recovery code.');}
        else if(submitted==='signup'&&data.verificationRequired){flow='signup';await show('verify',data.message);}
        else if(data.needsPasswordReset)await show('reset');
        else if(data.signInRequired){onSignedOut?.();await show('login','Password updated. Sign in with your new password.');}
        else{root.querySelectorAll('input[type="password"]').forEach(input=>input.value='');await onAuthenticated();}
      }catch(error){if(view===submitted){$('auth-error').textContent=error.message;resetCaptcha();}}
      finally{submit.disabled=false;}
    };
    if(needsCaptcha){try{await captchaScript();if(current!==revision)return;widget=globalThis.turnstile.render($('auth-captcha'),{sitekey:config.captchaSiteKey,theme:'auto',callback:value=>captcha=value,'expired-callback':()=>captcha='','error-callback':()=>{$('auth-error').textContent='Verification could not load. Refresh this page to try again.';}});}catch(error){if(current===revision)$('auth-error').textContent=error.message;}}
  }
  return {show};
}
