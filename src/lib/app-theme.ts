/** Misma clave que en el ThemeProvider (client). */
export const THEME_STORAGE_KEY = "appgym-theme";

/**
 * IIFE inyectada en <head> en el root layout. Debe reflejar la lógica inicial
 * de `theme-context` (claro / oscuro / sistema) y ejecutarse antes del primer paint.
 */
export const THEME_INIT_INLINE_SCRIPT = `(()=>{try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k);var id=t==='light'||t==='dark'||t==='system'?t:'system';var d=id==='dark'?true:id==='light'?false:window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
