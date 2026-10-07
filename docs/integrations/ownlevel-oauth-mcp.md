# OWNLEVEL Meals — revisión previa al despliegue

Rama: `codex/ownlevel-oauth-mcp`. Este informe registra la validación local previa
a publicar la rama: en ese momento no se había hecho commit, push, PR ni
despliegue. La publicación posterior de la rama/preview no autoriza migraciones
productivas ni merge a `main`. El complemento Site instalado sigue intacto.
OAuth está desactivado por defecto (`OWNLEVEL_OAUTH_ENABLED` ausente o distinto
de `true`). **No habilitar producción hasta completar las puertas de salida.**

## Qué cambia y por qué

El origen exacto del mensaje anterior está en el Site: `app/mcp/route.ts:99`
pasaba `env.OWNLEVEL_API_BASE_URL` y `env.OWNLEVEL_CHATGPT_TOKEN` a `registerMeal()`;
`lib/ownlevel-meals.ts:152` devolvía ese error cuando faltaba cualquiera de las
dos variables. No tomaba ni reenviaba el Bearer autenticado de esa petición.
Que OAuth figurara conectado al Site no completaba esas variables. Además,
la API de OWNLEVEL sólo autentica tokens privados `ownlevel_*`: recibir un token
OAuth de otro issuer no lo convierte en un token válido para OWNLEVEL.
Esta implementación no intenta reparar eso aceptando cualquier Bearer ni usando
una API key compartida. Se añade una conexión separada con Supabase OAuth Server.

- `src/lib/integrations/mcp-meals.ts`: MCP Streamable HTTP sin sesión persistente,
  descriptor `register_meal` con `openid`, validación previa y reenvío del Bearer
  del usuario al endpoint fijo de comidas. Sin redirecciones ni reintentos.
- `oauth-auth.ts`: `@supabase/server` verifica firma/JWKS, issuer, audience y
  vigencia mediante `withSupabase({ auth: "user" })`; después exige identidad
  `sub`, cliente, sesión OAuth, grant y claim interno. Consulta política vigente.
  `withOAuthProtectedResource()`/`resourceMetadataResponse()` resuelven metadata
  y challenge estándar. Se mantienen las comprobaciones estándar del paquete.
- `oauth-meals.ts` y la rama OAuth de la API: vuelven a comprobar permiso dentro
  de la transacción de escritura. El token se reenvía, nunca se registra ni se
  guarda; el usuario sólo se toma del `sub` verificado.
- Consentimiento propio de OWNLEVEL para permisos de aplicación, no un
  Authorization Server: Supabase emite códigos, valida PKCE, intercambia tokens,
  administra refresh, discovery, JWKS y consentimientos OAuth.
- Inicio de sesión Google conserva su callback existente y añade un `next`
  local sanitizado para volver al consentimiento. Proxy refresca sus cookies.
- Revocación desde Ajustes → Aplicación → Integraciones. Primero se revoca el
  permiso local; después el grant en Supabase. Un fallo en esa limpieza remota
  se muestra como pendiente, sin recuperar el permiso de escritura.

Se conservan intactos `chatgpt-tokens.ts`, el parser del payload, las tablas de
comidas, la RPC legacy, la deduplicación y los triggers de `day_logs`. La rama
legacy `ownlevel_*` sigue operativa incluso después de revocar OAuth. Se añade
sólo un error de permiso `403`, sin cambiar la forma de una comida.

## Migración

Archivo: `supabase/migrations/20261007111714_ownlevel_oauth_meals.sql`.

1. Schema privado `ownlevel_integrations`, con `oauth_clients` (allowlist de
   cliente/resource, deshabilitado por defecto) y `oauth_grants` (permiso vigente,
   revocación y fingerprint del grant). RLS y acceso exclusivamente administrativo.
2. `ownlevel_integrations.custom_access_token_hook(jsonb)`, ejecutable sólo por
   `supabase_auth_admin`. Obtiene `claims.client_id`, no metadata del usuario.
   Para clientes y grants permitidos fija `aud` al resource registrado y agrega
   `ownlevel_permissions=["meals:write"]` y `ownlevel_grant_id`. No altera sesiones
   normales de Web/Mobile; elimina claims propios obsoletos en tokens OAuth.
3. RPCs service-only para verificar cliente/solicitud/permiso, conceder y revocar.
   El consentimiento se vincula a la solicitud almacenada por Supabase, usuario,
   cliente allowlisteado, `resource` exacto y `scope='openid'`.
4. `create_chatgpt_meal_for_oauth(...)` bloquea cliente y grant, verifica política
   vigente y sesión OAuth aún existente, y delega en la RPC canónica sin alterarla.
   La revocación de permisos y la escritura se serializan con locks de fila.
   Reautorizar un grant revocado cambia su fingerprint: no revive JWTs viejos.
5. RLS restrictiva adicional en tablas públicas existentes para impedir acceso
   directo con `client_id`. Un pre-request de PostgREST también bloquea RPCs que
   podrían eludir RLS. No reemplaza políticas de ownership. Aborta si ya existe
   otro pre-request que deba componerse. Sesiones Web/Mobile normales no cambian.

No hay clientes de producción ni permisos de usuarios reales sembrados.
No aplicar esta migración a producción como parte de las pruebas locales.

## Endpoints resultantes (destinos previstos, aún no desplegados)

| Función | URL de producción prevista |
| --- | --- |
| MCP | `https://www.ownlevel.fit/mcp` |
| Resource metadata RFC | `https://www.ownlevel.fit/.well-known/oauth-protected-resource/mcp` |
| Alias metadata del wrapper | `https://www.ownlevel.fit/mcp/oauth-protected-resource` |
| API canónica | `POST https://www.ownlevel.fit/api/integrations/chatgpt/meals` |
| Consentimiento OWNLEVEL | `https://www.ownlevel.fit/oauth/consent?authorization_id=…` |
| Decisión de consentimiento | `POST https://www.ownlevel.fit/api/oauth/decision` |
| Revocación OWNLEVEL | `POST https://www.ownlevel.fit/api/oauth/revoke` |

Authorization Server del proyecto gym, **no** `auth.openai.com`:

- Issuer: `https://vtxacamtayeqnogxyapd.supabase.co/auth/v1`.
- Discovery: `https://vtxacamtayeqnogxyapd.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
- Authorization: `https://vtxacamtayeqnogxyapd.supabase.co/auth/v1/oauth/authorize`.
- Token: `https://vtxacamtayeqnogxyapd.supabase.co/auth/v1/oauth/token`.
- JWKS: `https://vtxacamtayeqnogxyapd.supabase.co/auth/v1/.well-known/jwks.json`.

El metadata anuncia ese issuer y sólo `scopes_supported=["openid"]`.
`meals:write` **nunca** es un scope OAuth. El audience requerido es exactamente
`https://www.ownlevel.fit/mcp`, también al autenticar la API canónica.

En la inspección previa del proyecto gym, OAuth Server estaba deshabilitado.
Estos endpoints OAuth deben activarse/configurarse en Supabase; no están
implementados ni simulados como un Authorization Server en este repositorio.

## Configuración y despliegue escalonado

### Lockdown opt-in del Preview

`src/proxy.ts` cubre todas las rutas (incluyendo APIs, archivos públicos y assets).
Bloquea por defecto con 404 y `Cache-Control: private, no-store` sólo cuando se
cumplen **simultáneamente** `VERCEL=1`, `VERCEL_ENV=preview` y
`OWNLEVEL_OAUTH_PREVIEW_LOCKDOWN=true`. Sin ese opt-in, desarrollo y producción
conservan la selección existente de rutas para refrescar la sesión.

Configurar la variable únicamente en Vercel → gymapp → Preview, override de
la rama `codex/ownlevel-oauth-mcp`. No es `NEXT_PUBLIC_`, no activa OAuth, no
concede permisos y no evita las comprobaciones JWT/DB/CSRF de los endpoints.

Lista exhaustiva de exposición durante lockdown:

| Ruta | Métodos permitidos |
| --- | --- |
| `/mcp` | GET, HEAD, POST, DELETE, OPTIONS |
| `/mcp/oauth-protected-resource` | GET, HEAD, OPTIONS |
| `/.well-known/oauth-protected-resource/mcp` | GET, HEAD, OPTIONS |
| `/oauth/consent` | GET, HEAD |
| `/login` | GET, HEAD |
| `/auth/callback` | GET, HEAD |
| `/api/oauth/decision` | POST, OPTIONS |
| `/api/integrations/chatgpt/meals` | POST, OPTIONS |
| `/_next/static/*` | GET, HEAD |
| `/favicon.ico`, `/icon.svg`, `/apple-icon.png` | GET, HEAD |
| `/brand/logo/isotipo-claro.png`, `/brand/logo/isotipo-oscuro.png` | GET, HEAD |
| `/_next/image` | GET, HEAD, sólo con un único `url` igual a uno de esos dos logos locales |

No se expone el resto de `/_next/*`, `/api/*`, `/settings`, `/home`, `/today`,
`/train`, service workers, manifest ni revocación. OPTIONS pasa a la resolución
normal de Next, no agrega autenticación ni CORS por sí solo. Las rutas de UI no
admiten POST/Server Actions. Los redirects a páginas del producto seguirán
encontrando el lockdown; no se amplía la lista para evitarlos.

Vercel Authentication permanece activo: este guard es una condición previa a
una eventual excepción del hostname de la rama, no modifica esa protección.
Antes de una excepción comprobar en el deployment que `/home` y APIs ajenas
devuelven el 404 con `X-OWNLEVEL-Preview-Lockdown: blocked`, y que MCP/metadata
llegan a sus handlers (503 `integration_disabled` mientras OAuth no se active).

### Configuración OAuth posterior (requiere aprobación independiente)

El usuario eligió continuar posteriormente con el proyecto Supabase productivo,
sin Branch paga. El lockdown no aplica la migración ni activa OAuth Server.
Antes de esos cambios compartidos hay que revisar la configuración vigente:
Supabase construye el consentimiento con Site URL + Authorization Path; apuntar
Site URL al preview no es una configuración aislada de esta rama. La secuencia
aislada original de abajo documenta la validación previa, no una autorización
para crear otra base ni para modificar producción automáticamente.

1. Preparar un Supabase de prueba aislado y un preview HTTPS accesible a ChatGPT,
   sin copiar datos personales de producción. Confirmar costos si se necesita
   una rama alojada. El Supabase CLI local ya probado no es accesible por ChatGPT.
2. Comprobar versión/esquema de Auth: `auth.oauth_authorizations.resource`,
   `auth.sessions.oauth_client_id`, cliente público PKCE y `claims.client_id` en
   el hook. Verificar pre-request existente y superficies privadas de Storage
   si se utilizan: el guard de PostgREST no cubre Storage. No habilitar otras
   exposiciones de producto para clientes OAuth.
3. Revisar/aplicar la migración sólo en el entorno de prueba. Activar Supabase
   OAuth Server y configurar Site URL de ese entorno, ruta `/oauth/consent` y
   Custom Access Token Hook `ownlevel_integrations.custom_access_token_hook`.
   Conservar configuración Google y redirects normales de Web/Mobile.
4. Registrar un cliente público exclusivo para OWNLEVEL Meals/ChatGPT,
   `token_endpoint_auth_method=none`, Authorization Code + refresh y PKCE S256.
   Copiar el callback real mostrado por ChatGPT; no inventar su URL ni usar
   wildcards. El ambiente local usa cliente estático y DCR deshabilitado. DCR
   es de Supabase si se elige, pero no autoriza automáticamente clientes nuevos.
5. Añadir **ese client_id exacto** y el resource del entorno a la allowlist, y
   habilitarlo explícitamente. La aprobación del usuario crea el permiso local.
   No poner permisos en `user_metadata` ni exponer gestión de grants a OAuth.
6. Configurar en el servidor las credenciales Supabase existentes:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`. Son credenciales internas
   del backend, **no una API key adicional que deba configurar ChatGPT**.
   Añadir `OWNLEVEL_OAUTH_ENABLED=true` y `OWNLEVEL_MCP_RESOURCE=https://<host>/mcp`.
   No configurar `OWNLEVEL_LOCAL_API_ORIGIN` fuera de desarrollo: se rechaza
   siempre con `NODE_ENV=production`.
7. Crear una conexión de prueba separada: no reemplazar la instalada. Revisar
   metadata, OAuth y el flujo completo desde ChatGPT. Sólo después de revisar
   resultados y aprobar producción, repetir configuración del proyecto gym y
   preparar adopción del nuevo `/mcp`. No borrar el Site actual ni tokens legacy.

Rollback del rollout: desactivar `OWNLEVEL_OAUTH_ENABLED` y/o el cliente en la
allowlist. No eliminar tablas/grants ni deshabilitar el hook indiscriminadamente:
puede estar compartido y Web/Mobile deben conservar sus claims. No revertir la
RPC legacy ni recalcular/eliminar comidas ya registradas.

## Pruebas y reproducción

Dependencies runtime exactas: `@supabase/server@1.9.1`,
`@modelcontextprotocol/sdk@1.32.1`, con lockfile actualizado.

Supabase CLI aislado (`project_id=ownlevel-oauth-mcp`, API 55421, DB 55422), sin
link a producción. El histórico `0001.sql` no lo reconoce el parser de nombres
de migraciones del CLI: `db.migrations.enabled=false` y el bootstrap local aplica
explícitamente todos los SQL ordenados. Sólo funciona con base vacía; no resetea.

```sh
npm ci --ignore-scripts
npx supabase@2.120.0 start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
node scripts/testing/oauth-db-bootstrap.mjs
node scripts/testing/oauth-local-e2e.mjs
```

El E2E obtiene exclusivamente claves locales del CLI, rechaza otros destinos,
crea fixtures sintéticos y levanta Next en 3007. Limpia usuario/cliente de esa
ejecución y termina Next. No imprime ni persiste credenciales.

Resultados de esta implementación:

- **71 tests focalizados pasan** (JWT real ES256/JWKS, issuer, aud, exp, nbf,
  firma falsa, permiso y sesión ausentes, DB revocada/caída, reenvío Bearer,
  `user_id`, scopes, tokens legacy, Google/next y límites del proxy).
- **3 regresiones SQL pasan**, con rollback: `ownlevel_oauth_meals.sql`,
  `pr8_chatgpt_private_meal_api.sql` y `pr22_chatgpt_integration.sql`.
  Se ejecutaron dentro del contenedor local con `psql -U supabase_admin` para
  poder adoptar `supabase_auth_admin` durante el test del hook.
- **E2E OAuth local pasa**: autorización real Supabase con PKCE y consentimiento
  OWNLEVEL, `resource` enviado en authorize/token exchange, JWT firmado con issuer
  local y `aud=https://www.ownlevel.fit/mcp`, refresh, MCP initialize/tools/list,
  challenge sin autenticación, registro/idempotencia/duplicados/force_duplicate,
  propiedad de comidas y recálculo 1300 kcal, prohibición de `user_id`, cliente
  deshabilitado, CSRF, revocación de JWT no vencido y rechazo de acceso Data API.
  La sesión Web mantiene `aud=authenticated` y el token legacy sigue funcionando.
- **TypeScript, build de producción y lint de archivos cambiados pasan.**
- Batería general final: **1355/1357**; dos fallos preexistentes en
  `daily-metrics/write-reliability.test.ts` (nombre de migración inexistente) y
  `nutrition/pr73.test.ts` (assert sobre implementación de métricas anterior).
  No se alteraron esos archivos ni sus implementaciones.
- Lint general: dos errores preexistentes en el Capacitor legacy
  `mobile/src/api/product-data-sync.tsx` y `mobile/src/auth/use-mobile-auth.ts`,
  más trece warnings ajenos. No se modificaron. No se afirma que todo el repo
  esté verde.
- El instalador reportó 31 vulnerabilidades del árbol de dependencias (11
  moderadas, 16 altas, 4 críticas; 32 antes de añadir estas dependencias). No se
  aplicaron actualizaciones automáticas fuera de alcance.
- `next dev` añadió su bloque estándar de instrucciones a `AGENTS.md`. Es un
  cambio generado por Next, no un cambio de seguridad/producto ni una instrucción
  para desplegar. Se leyó y se revisaron los guides locales pertinentes.

## Puertas pendientes — no declararlas verificadas

1. **ChatGPT real:** capturar de forma segura y redacted la autorización y el
   token exchange que hace ChatGPT, y demostrar `resource` en **ambos**. Verificar
   firma, issuer, expiración, `client_id`, permiso y `aud` del access token emitido.
   No guardar bearer, refresh token, code ni PKCE verifier en el reporte.
2. El E2E sintético usa el resource canónico como audience contra Auth local. Eso
   **no** demuestra que ChatGPT haya enviado ese resource. Un preview con otro
   host demuestra su propio resource, no el resource final: antes de adopción hay
   que repetir el intercambio con `https://www.ownlevel.fit/mcp` en una exposición
   de prueba aprobada bajo ese dominio, sin modificar el complemento existente.
3. QA visual/funcional de Google → consentimiento → ChatGPT y revocación en
   Ajustes. En local se probó el render y las decisiones por HTTP, no una sesión
   humana completa en Google/ChatGPT.
4. Revisar este diff, migración, impacto de RLS/pre-request y credenciales/config
   del entorno. Obtener aprobación de producción; recién entonces desplegar y
   activar OAuth. La configuración del hook en Supabase no se activa mediante
   esta migración por sí sola.

Referencias oficiales:
[Supabase OAuth Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started),
[flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows),
[token security](https://supabase.com/docs/guides/auth/oauth-server/token-security),
[Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook),
[paquetes de servidor](https://supabase.com/docs/guides/auth/choosing-a-server-package),
[autenticación de plugins ChatGPT](https://developers.openai.com/plugins/build/auth).
