/** Static, trusted script runs during HTML parsing, before the first paint. */
export default function ThemeScript() {
  return (
    <script
      id="linkboard-theme"
      dangerouslySetInnerHTML={{
        __html: `(function(){var p="system";try{var s=localStorage.getItem("linkboard.theme");if(s==="light"||s==="dark")p=s}catch(e){}var t=p==="system"?(typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;var d=document.documentElement;d.dataset.theme=t;d.dataset.themePreference=p;d.style.colorScheme=t})()`,
      }}
    />
  );
}
