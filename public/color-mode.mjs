// This function is also embedded in the standalone website export.
export function initColorMode({root=document.documentElement,controls=[],defaultMode='system',storageKey='linkboard-editor-mode',persist=true,onApply=()=>{},environment=globalThis}={}){
  const valid=value=>['light','dark','system'].includes(value);
  const media=environment.matchMedia?.('(prefers-color-scheme: dark)');
  let selection=valid(defaultMode)?defaultMode:'system';
  if(persist){try{const saved=environment.localStorage?.getItem(storageKey);if(valid(saved))selection=saved;}catch{/* Modes still work when browser storage is unavailable. */}}
  function apply(){
    const resolved=selection==='system'?(media?.matches?'dark':'light'):selection;
    root.dataset.mode=selection;root.dataset.colorMode=resolved;
    for(const control of controls){control.value=selection;control.hidden=false;}
    onApply(resolved,selection);return resolved;
  }
  function set(value){
    if(!valid(value))return;
    selection=value;if(persist){try{environment.localStorage?.setItem(storageKey,value);}catch{}}
    return apply();
  }
  const handlers=Array.from(controls,control=>{const handler=()=>set(control.value);control.addEventListener('change',handler);return [control,handler];});
  const systemChanged=()=>{if(selection==='system')apply();};
  if(media?.addEventListener)media.addEventListener('change',systemChanged);else media?.addListener?.(systemChanged);
  const storageChanged=event=>{if(!persist||(event.key!==storageKey&&event.key!==null))return;selection=valid(event.newValue)?event.newValue:(valid(defaultMode)?defaultMode:'system');apply();};
  environment.addEventListener?.('storage',storageChanged);
  apply();
  return {set,get:()=>selection,destroy(){for(const [control,handler] of handlers)control.removeEventListener('change',handler);if(media?.removeEventListener)media.removeEventListener('change',systemChanged);else media?.removeListener?.(systemChanged);environment.removeEventListener?.('storage',storageChanged);}};
}
