# Auditoría visual y UX global — PR23

## Método y alcance

Auditoría realizada el 28 de agosto de 2026 sobre el código de `main` y la producción autenticada de `https://www.ownlevel.fit`, sin crear ni modificar datos. Se inspeccionaron visualmente Home, Today, Reportes, Train, Ajustes y una sesión activa; además se inventariaron todas las rutas actuales y los patrones de interfaz que las sostienen. La superficie, bordes, muted, violeta, destructive y selected se contrastaron en claro y oscuro; el tema quedó restaurado a Sistema.

La captura productiva directa estuvo disponible en 1363 × 936 (desktop). El shell de producción declara una composición mobile de 320–430 px, bottom nav, safe areas y contenido máximo de 430 px; la herramienta administrada no permitió cambiar su viewport a 390 × 844. La verificación visual exacta de ese viewport queda como primer paso obligatorio de cada PR de rediseño, junto con light/dark. Esta limitación no se oculta ni se compensa cambiando producto en PR23.

## Lectura transversal

### ✅ Mantener

- **Home:** referencia interna de jerarquía; el estado operativo, las métricas y los accesos están bien ordenados.
- **Reportes de nutrición:** referencia interna de lectura analítica; período, resumen y tendencias separan bien la información.
- **Shell y navegación actual:** el límite mobile, safe areas, bottom nav y sidebar desktop responden a roles distintos sin duplicar rutas.
- **Tema y tokens base:** light/dark, violeta semántico y paleta de rutinas ya ofrecen una base visual coherente.
- **Integraciones ChatGPT:** configuración compacta, explicación de estado y acciones acotadas; no necesita rediseño dentro de esta etapa.
- **Sesión activa v2:** foco secuencial, jerarquía de series, autosave estable y selector de altura fija resuelven la dirección de PR23 sin cambiar semántica de entrenamiento.

### 🟡 Mejorar

- **Today / Nutrición:** el resumen y la actividad son funcionales, pero la densidad de cards, contexto diario y registro de comida necesitan una arquitectura de pantalla más deliberada.
- **Train hub:** calendario, CTA y accesos sirven, pero la estructura de entrada debe alinearse con una arquitectura Train futura.
- **Lista de rutinas:** conserva flujos válidos y ahora usa una densidad más deliberada; la arquitectura Train se revisará por separado.
- **Biblioteca, historial, calendario y progreso de entrenamiento:** los datos y filtros son útiles; falta una jerarquía común entre exploración, historial y análisis.
- **Cuerpo, peso y medidas:** registros y sheets funcionales; requieren una presentación más clara a medida que las métricas sean configurables.
- **Ajustes y subáreas nutricionales:** el agrupamiento es entendible, aunque los formularios/versiones necesitan lenguaje de lista, estado y empty más consistente.
- **Historial diario y progreso global:** hechos y enlaces están disponibles, pero precisan una lectura transversal de semántica y tendencias.

### 🔴 Replantear

- **Crear / editar rutina:** no conviene acumular ajustes en el editor actual. Debe ser excelente para una cuenta nueva y una rutina compleja. PR26.
- **Alimentos por cantidad:** la experiencia actual de catálogo no cubre el futuro flujo de cantidad y comida compuesta. PR29, después de PR28.

## Inventario de áreas y próxima decisión

| Ruta / área | Estado | Qué conservar | Dirección recomendada | PR |
| --- | --- | --- | --- | --- |
| `/login` | ✅ Mantener | Auth estable, identidad clara, CTA única y feedback inline | mantener composición de página; extender hacia onboarding sin rehacer identidad | resuelto PR24 |
| `/home` | ✅ Mantener | foco operativo, CTA contextual, resumen semanal | referencia de lenguaje, mantenimiento menor | — |
| `/today` | 🟡 Mejorar | datos canónicos, quick add, actividad compacta | revisar arquitectura diaria antes de sumar features | PR28 |
| `/today/reports` y `/today/steps` | ✅ / 🟡 | período, resumen, charts accesibles | preservar claridad; expandir análisis luego | PR35 |
| `/train` | ✅ Mantener | sesión operativa, calendario y accesos compactos | Train concentra hacer, planificar y revisar; Progreso concentra análisis | resuelto PR27 |
| `/train/routines` | ✅ Mantener | archivo, inicio y colores | lista compacta y entrada clara al editor | resuelto PR26 |
| `/train/routines/[id]` | ✅ Mantener | snapshots y acciones existentes | editor progresivo con estructura visible y guardado explícito | resuelto PR26 |
| `/train/session/new` | 🟡 Mejorar | inicio desde rutina/libre | alinear con futura entrada de Train | PR27 |
| `/train/session/[id]` activa | ✅ Mantener | autosave, drafts, progreso y foco secuencial | mantener jerarquía v2; medir uso real | resuelto PR25 |
| ejercicio abierto/cerrado, series, notas, próxima vez, más opciones | ✅ Mantener | un ejercicio abierto, header estable y detalle sin cards anidadas | mantenimiento y accesibilidad continua | resuelto PR25 |
| selector Agregar ejercicio | ✅ Mantener | sheet estable, selección persistente y footer fijo | ampliar filtros sólo con evidencia | resuelto PR25 |
| finalizar / cancelar | ✅ Mantener | flush antes de finalizar y destructive secundario | preservar separación de jerarquía | resuelto PR25 |
| `/train/exercises` | 🟡 Mejorar | biblioteca personal, filtros | consolidar exploración y edición | PR27 |
| `/train/history`, `/train/history/[exerciseId]` | 🟡 Mejorar | histórico por ejercicio | lenguaje común de análisis | PR27 / PR35 |
| `/train/progress`, `/train/calendar`, `/calendar` | 🟡 Mejorar | hechos, constancia y filtros | agrupar análisis sin perder contexto | PR27 / PR35 |
| `/train/body` | 🟡 Mejorar | peso y medidas canónicos | preparar métricas configurables | PR33 |
| `/history` | 🟡 Mejorar | correcciones y hechos diarios | revisar calidad/semántica | PR34 |
| `/progress` | 🟡 Mejorar | punto de entrada a análisis | definir arquitectura de reportes | PR35–37 |
| `/settings` y `/settings/profile` | 🟡 Mejorar | agrupación, tema, seguridad | despersonalizar y modularizar sin romper perfil | PR42 / PR45 |
| `/settings/nutrition` + objetivos/gasto/horario | 🟡 Mejorar | períodos versionados y contexto | simplificar orientación de configuración | PR28 |
| `/settings/nutrition/foods` | 🔴 Replantear | catálogo personal canónico | alimentos por cantidad y luego comidas guardadas | PR29 / PR30 |
| `/settings/nutrition/integrations` | ✅ Mantener | clave, estado, revocación | mantenimiento, sin ampliar alcance de datos | — |
| Tema | ✅ Mantener | Claro/Oscuro/Sistema | validar contrastes por cada rediseño | continuo |

## Decisiones confirmadas para próximos PRs

### PR24 — Login / Entrada

**Resuelto.** La entrada dejó la card partida por una composición de página: símbolos canónicos claros/oscuros, un mensaje breve, una única CTA de Google y un cierre discreto. En desktop la identidad y la acción se separan por espacio y jerarquía, no por un contenedor pesado; en mobile se conservan safe areas. El pending mantiene tamaño del botón y el error público se reserva inline, sin exponer detalles de OAuth. Google OAuth, callback y redirects seguros permanecen sin cambios. La verificación productiva visual quedó disponible en desktop; la herramienta administrada no permitió emular exactamente 390 × 844 ni alternar el tema del sistema, por lo que mobile y light/dark se cubren estructuralmente con breakpoints, safe areas, tokens y assets semánticos, sin declarar una comprobación visual inexistente.

### PR25 — Sesión activa v2

**Resuelto.** La sesión usa foco secuencial con un ejercicio abierto a la vez, encabezado persistente, compensación de scroll y transición local breve. La fila cerrada resume identidad, avance y series; la abierta prioriza series y expone descanso, próxima vez y notas sin otro accordion principal. El acento de rutina orienta sin competir con estados success o destructive.

El selector **Agregar ejercicio** mantiene altura basada en `dvh`, header/búsqueda/chips/footer fijos y sólo desplaza resultados. La selección no se pierde al filtrar, permanece nombrada en el footer y usa un estado suave distinto de la CTA primaria. El empty state conserva geometría y crear un ejercicio nuevo sigue como salida secundaria.

Permanecen sin cambios `ExerciseAutosaveQueue`, drafts versionados, optimistic locking, reconciliación de conflictos, retries, session fences, snapshots, notas, decisiones de próxima sesión y `apply_to_routine`.

### PR26 — Crear / editar rutinas v2

**Resuelto.** Crear una rutina continúa siendo un primer paso corto de nombre y color; una plantilla vacía explica qué falta y concentra la primera acción. El editor prioriza la estructura: header con identidad, estado y conteos; lista escaneable con orden, metadata y objetivo; nombre/color bajo disclosure en sheet.

Sólo un ejercicio se abre a la vez. Sus cambios locales sobreviven al collapse y se muestran como `Sin guardar` hasta el guardado explícito por ejercicio. Agregar, reordenar, quitar, editar identidad e iniciar entrenamiento quedan protegidos mientras existan objetivos pendientes, y salir del editor requiere confirmación para descartar cambios.

El selector de ejercicios de rutina adopta la geometría estable de PR25, con búsqueda, chips, resultados internos scrolleables, selección persistente, CTA fija y exclusión de duplicados. La persistencia sigue usando las server actions y validaciones existentes; no se alteran ownership ni snapshots.

### PR27 — Arquitectura Train

**Resuelto.** `/train` es el centro operativo del entrenamiento: sin una sesión activa presenta **Nueva sesión** mediante el selector existente; con una sesión en curso muestra su nombre y enlaza directamente a **Continuar entrenamiento**. El calendario conserva su papel de constancia mensual y las acciones restantes se organizan como **Planificar** (Rutinas y Ejercicios) y **Revisar** (Historial).

`/train/progress` y `/train/body` conservan sus rutas y deep links, pero su entrada canónica es `/progress`: el primero explica la evolución de entrenamiento y el segundo concentra el seguimiento corporal. Historial queda en Train porque muestra sesiones y registros ocurridos. No se modifica la navegación global ni las experiencias cerradas de sesión activa y rutinas.

### PR28–29

- **PR28:** Today / Nutrición v2, antes de nuevos features de comida.
- **PR29:** alimentos por cantidad.

## Roadmap visual y de producto

| Etapa | Alcance |
| --- | --- |
| PR23 | Design System v1 + auditoría visual global |
| PR24–29 | Login, sesión activa, rutinas, Train, Today y alimentos por cantidad |
| PR30–34 | comidas guardadas, suplementos, notificaciones, métricas configurables, calidad de datos |
| PR35–39 | reportes, tendencias, comparaciones, métrica de fuerza, performance/a11y/reliability |
| PR40–45 | fotos, integraciones de salud, despersonalización, empty states, onboarding, módulos/preferencias |
| PR46–50 | aislamiento multiusuario, amigos, privacidad, compartir, copias de rutinas |
| PR51+ | IA nativa |

El roadmap no autoriza implementación anticipada. Cada PR debe conservar las fuentes canónicas y validar la experiencia de una cuenta vacía cuando aplique.
