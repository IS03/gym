# Conectar ChatGPT con OWNLEVEL

## Mecanismo vigente

OWNLEVEL usa una **GPT Action privada** configurada en un GPT existente. Es el
mecanismo más corto para esta cuenta: Actions continúa aceptando un esquema
OpenAPI y autenticación API Key, mientras que OWNLEVEL conserva su API separada
de OpenAI.

OWNLEVEL no llama a OpenAI, no procesa fotos y no almacena imágenes. Recibe una
comida ya estructurada y sólo expone dos operaciones write-only:

- `checkConnection`: valida la clave sin devolver datos personales ni
  nutricionales;
- `logMeal`: registra una comida canónica.

La disponibilidad para crear o publicar GPTs personales puede variar según el
plan y los permisos de la cuenta. Este flujo fue validado con la cuenta Plus y el
GPT privado existente, que continúa editable. No se construyó MCP, OAuth ni una
app publicable innecesaria.

## Configuración

1. Abrí **Ajustes → Nutrición → Integraciones**.
2. Elegí **Crear clave** y copiala en ese momento. El valor raw se muestra una
   sola vez; OWNLEVEL persiste únicamente su SHA-256.
3. Abrí la configuración del GPT privado existente y agregá o editá su Action.
4. Importá este esquema desde una URL:

   ```text
   https://www.ownlevel.fit/api/integrations/chatgpt/openapi
   ```

5. En **Authentication**, elegí **API Key**, tipo **Bearer**, y pegá la clave de
   OWNLEVEL.
6. Guardá los cambios y probá primero `checkConnection`. La respuesta esperada
   es:

   ```json
   { "ok": true, "connected": true }
   ```

7. Confirmá en OWNLEVEL que **Último uso** dejó de mostrar `Nunca`.
8. Probá `logMeal` con una comida controlada y verificá que aparezca en Today.

## Contrato de comidas

La fecha omitida se resuelve usando `America/Argentina/Cordoba`. En macros,
`null` significa desconocido y `0` significa conocido y realmente cero. No se
deben inventar valores para completar campos opcionales.

El GPT debe mantener la misma `idempotency_key` al reintentar una misma acción.
El replay responde `created=false` e `idempotent_replay=true` sin crear otra
fila.

Si OWNLEVEL responde `409 possible_duplicate`, el GPT debe pedir confirmación.
Sólo cuando el usuario confirme que fue otra comida puede reenviar con una
`idempotency_key` nueva y `force_duplicate=true`.

## Revocación y diagnóstico

Revocar la clave la invalida inmediatamente. Después puede crearse otra. El
endpoint de estado usa exactamente la misma autenticación y scope
`meals:write` que el endpoint de comidas; no habilita permisos de lectura.

Ante un `401`, revisar que la clave siga activa y que la Action esté configurada
como API Key **Bearer**, no como header personalizado ni OAuth. Ante un `500`,
revisar los logs del deployment sin registrar la credencial.

Fuentes oficiales consultadas al definir este flujo:

- https://developers.openai.com/api/docs/actions/authentication
- https://developers.openai.com/api/docs/actions/getting-started
- https://help.openai.com/en/articles/8554397-creating-and-editing-gpts
- https://developers.openai.com/api/docs/guides/developer-mode
