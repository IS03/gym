# Appgym

PWA (Next.js + Supabase) — seguimiento de nutrición y entrenamiento (en desarrollo).

## Requisitos

- Node 20+
- Proyecto en [Supabase](https://supabase.com) con Auth activo

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

| Variable | Dónde obtenerla |
| -------- | --------------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Misma pantalla, clave **anon** o **publishable** (pública) |

**Vercel:** en el proyecto → **Settings → Environment Variables**, las mismas dos variables para **Production** (y **Preview** si usás previews). Sin esto el deploy no puede validar sesión. Volvé a desplegar tras agregarlas.

**Supabase → Authentication → URL configuration:** agregá `https://<tu-dominio-vercel>.vercel.app/auth/callback` (y `http://localhost:3000/auth/callback` para local) en *Redirect URLs*.

## Scripts

```bash
npm run dev     # desarrollo (Turbopack; PWA desactivada en next.config)
npm run build   # producción (Webpack; requerido por @ducanh2912/next-pwa)
npm run start
npm run lint
```

## Notas de despliegue

- `next build` usa **`--webpack`** por el plugin PWA; en local `next dev` no lo necesita.
- Las rutas autenticadas usan `dynamic = "force-dynamic"` para no ejecutar el layout con Supabase durante el prerender del build (compatible con builds en CI sin `.env` embebido).
