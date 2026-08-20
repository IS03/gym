# Conectar un GPT privado con OWNLEVEL

OWNLEVEL recibe datos nutricionales ya estructurados. No llama a OpenAI, no procesa
fotos y no almacena imágenes.

1. Abrí **Ajustes → Nutrición → Integración con ChatGPT**.
2. Elegí **Crear clave**, copiala y guardala en ese momento. OWNLEVEL no puede
   volver a mostrarla.
3. Abrí la configuración de tu GPT privado y agregá una Action.
4. Importá `docs/integrations/ownlevel-chatgpt-action.openapi.yaml`.
5. Configurá autenticación **API Key**, tipo **Bearer**, y pegá la clave OWNLEVEL.
6. Probá con una comida simple y verificá sus totales en Today.
7. Si una clave se expone o deja de usarse, revocala desde OWNLEVEL. La revocación
   es inmediata; después podés crear una nueva.

El GPT debe mantener la misma `idempotency_key` al reintentar la misma acción. Si
OWNLEVEL responde `possible_duplicate`, debe pedir confirmación antes de reenviar
con `force_duplicate=true` y una nueva clave de idempotencia.
