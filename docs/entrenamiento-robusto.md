# Reconstrucción robusta de entrenamiento

## Objetivo

Reemplaza el registro resumido `series × reps × peso` por un modelo que conserva cada
serie planificada y realizada. Mantiene separados:

1. **Biblioteca:** definición general de un ejercicio.
2. **Rutina:** plantilla ordenada y sus objetivos por serie.
3. **Sesión:** copia inmutable de una rutina para un día concreto.
4. **Ejecución:** valores reales, notas y decisión para la próxima vez.

Editar una biblioteca o rutina nunca reescribe una sesión anterior. Una sesión iniciada
tampoco cambia si la plantilla se edita mientras está en curso.

## Modelo de datos

La migración `20260810112232_training_robust_rebuild.sql` es aditiva y conserva las tablas y
filas existentes.

| Entidad | Responsabilidad |
| --- | --- |
| `exercises` | Catálogo del usuario; agrega ID estable de origen, grupo detallado, implemento y modo de peso. |
| `routines` | Plantilla, color, orden e ID estable de origen. |
| `routine_exercises` | Orden y ajuste sugerido dentro de una rutina. |
| `routine_exercise_sets` | Una fila por serie objetivo, con reps y peso. |
| `workout_sessions` | Fecha, estado, snapshots de nombre y resumen opcional. |
| `workout_session_exercises` | Snapshot del ejercicio y decisión de progresión. |
| `workout_sets` | Una fila por serie real, junto con su objetivo copiado. |

Todas las tablas nuevas tienen RLS por `user_id`, índices para ownership y foreign keys,
permisos solo para `authenticated` y triggers de ownership. Las funciones compuestas son
`SECURITY INVOKER`, validan `auth.uid()` y revocan ejecución a `public` y `anon`.

## Operaciones atómicas

- `start_workout_session`: crea la sesión, copia ejercicios y series objetivo en una sola
  transacción.
- `save_workout_exercise`: usa control optimista con `updated_at`; si otro dispositivo
  cambió el ejercicio, rechaza el guardado en vez de sobrescribirlo.
- `finish_workout_session`: guarda el resumen, aplica únicamente los objetivos marcados
  expresamente y finaliza la sesión en una sola transacción.
- `import_training_plan`: sincroniza de forma repetible las tres rutinas de la planilla.

La migración incluye triggers puente para que la versión anterior de la app siga pudiendo
crear relaciones sin enviar el nuevo orden ni las nuevas filas de series.

## Plan inicial

`src/lib/phase2/initial-plan.ts` contiene la copia auditable de la planilla:

- 3 rutinas: PECHO, ESPALDA y PIERNAS.
- 27 ejercicios con `source_key` estable.
- 92 series objetivo.
- Repeticiones, pesos, implementos, modo de peso y ajuste próximo por ejercicio.

La importación no incorpora el historial viejo. Al ejecutarla de nuevo, reconstruye solo
esas tres plantillas; no borra ejercicios o rutinas extra y no modifica sesiones anteriores.
No se permite importar mientras haya una sesión activa.

## Orden de uso

1. Entrar a **Entrenar → Rutinas**.
2. Tocar **Cargar rutinas de la planilla** una sola vez. Si ya están cargadas, el botón se
   convierte en **Restaurar desde la planilla** y pide confirmación.
3. Revisar una rutina. Cada ejercicio permite editar orden, series, reps, peso y ajuste.
   Los cambios se guardan con **Guardar objetivo**.
4. Volver a **Entrenar** e iniciar una rutina. Solo puede existir una sesión activa.
5. En cada ejercicio, completar reps/peso por serie y marcar las series hechas.
6. Tocar **Guardar ejercicio**. Hasta ese momento la tarjeta queda marcada y mantiene una
   copia local versionada; cerrar la pestaña muestra una advertencia.
7. Opcionalmente elegir el ajuste próximo. **Usar lo realizado como próximo objetivo** está
   apagado por defecto y solo tiene efecto al finalizar.
8. Completar energía, rendimiento, dolor, abdominales, cinta y notas si corresponde.
9. Finalizar. El botón queda bloqueado mientras haya tarjetas con cambios sin guardar.

Una sesión finalizada queda en modo lectura. **Cancelar borrador de sesión** elimina solo la
sesión activa, después de confirmación; no toca rutina, catálogo, nutrición ni historial.

## Progreso

El resumen semanal y el progreso consideran solamente:

- sesiones con estado `completed`;
- ejercicios/series marcados como hechos;
- volumen registrado = `repeticiones reales × peso real`.

El peso “por mancuerna” se mantiene como fue cargado; no se multiplica automáticamente por
dos. El historial por ejercicio muestra objetivo y ejecución de cada serie.

## Despliegue seguro

1. Ejecutar tests, lint, TypeScript y build.
2. Aplicar `20260810112232_training_robust_rebuild.sql` en Supabase.
3. Ejecutar asesores de seguridad y performance.
4. Desplegar la rama en Vercel como Preview.
5. Probar login, importación, inicio, guardado, conflicto, finalización e historial.
6. Recién después abrir/mergear la rama hacia `main`.

La migración fue ejecutada completa contra PostgreSQL 17 dentro de una transacción terminada
en `ROLLBACK`; esa validación no dejó tablas ni columnas nuevas en producción.
