# Documentación de OWNLEVEL

Este directorio concentra la documentación funcional y técnica del proyecto.

## Fuente de verdad

Cuando dos documentos contradigan el estado actual, usar este orden:

1. código y tests del repositorio;
2. migraciones y esquema vigente de Supabase;
3. documentación de arquitectura vigente;
4. documentación de producto;
5. historial de decisiones;
6. archivos de `archive/`.

## Producto

### [`product/product-overview.md`](./product/product-overview.md)

Define el propósito de OWNLEVEL, áreas funcionales, principios de UX y alcance actual.

## Diseño / Product UX

### [`design/README.md`](./design/README.md)

Índice del Design System v1 y de la auditoría visual global. Define principios,
patrones de interfaz, inventario de componentes y prioridades de los próximos
rediseños.

- [`design/principles.md`](./design/principles.md): dirección, tokens y reglas de interacción.
- [`design/patterns.md`](./design/patterns.md): superficies, controles y estados.
- [`design/visual-audit.md`](./design/visual-audit.md): inventario de rutas y roadmap visual.

## Arquitectura

### [`architecture/data-flow.md`](./architecture/data-flow.md)

Define fuentes de verdad, sincronización de peso, snapshots nutricionales,
flujo de entrenamiento, fechas e invariantes entre estado actual e historial.

### [`architecture/training-system.md`](./architecture/training-system.md)

Describe el modelo de rutinas, sesiones, series, snapshots, autosave, concurrencia, finalización, historial y reportes de entrenamiento.

## Desarrollo

### [`development/engineering-guidelines.md`](./development/engineering-guidelines.md)

Convenciones de ingeniería, validación, Next.js, Supabase, responsive y criterios para cambios seguros.

## Integraciones

### [`integrations/chatgpt-nutrition.md`](./integrations/chatgpt-nutrition.md)

Configuración y diagnóstico de la integración privada write-only entre ChatGPT
y las comidas canónicas de OWNLEVEL.

## Historial

### [`history/technical-decisions.md`](./history/technical-decisions.md)

Resumen de las decisiones que surgieron de los issues cerrados y de cómo fueron evolucionando.

## Archivo

`archive/` conserva documentación histórica que puede ser útil para reconstruir contexto, pero que contiene decisiones antiguas o reemplazadas.

- `archive/initial-product-spec.md`: especificación inicial del producto.
- `archive/issue-history-full.md`: recopilación extensa de issues cerrados.

No implementar directamente desde un archivo de `archive/` sin verificar primero el código actual.
