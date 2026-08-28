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

### 🟡 Mejorar

- **Today / Nutrición:** el resumen y la actividad son funcionales, pero la densidad de cards, contexto diario y registro de comida necesitan una arquitectura de pantalla más deliberada.
- **Train hub:** calendario, CTA y accesos sirven, pero la estructura de entrada debe alinearse con una arquitectura Train futura.
- **Lista de rutinas y detalle de rutina:** conservan flujos válidos, pero el escaneo, la planificación y la edición de ejercicios necesitan simplificarse.
- **Biblioteca, historial, calendario y progreso de entrenamiento:** los datos y filtros son útiles; falta una jerarquía común entre exploración, historial y análisis.
- **Cuerpo, peso y medidas:** registros y sheets funcionales; requieren una presentación más clara a medida que las métricas sean configurables.
- **Ajustes y subáreas nutricionales:** el agrupamiento es entendible, aunque los formularios/versiones necesitan lenguaje de lista, estado y empty más consistente.
- **Historial diario y progreso global:** hechos y enlaces están disponibles, pero precisan una lectura transversal de semántica y tendencias.

### 🔴 Replantear

- **Sesión activa:** es el momento de mayor frecuencia y complejidad; requiere reordenar ejercicios, series, progreso, acciones y transiciones preservando autosave, drafts y optimistic locking. PR25.
- **Selector Agregar ejercicio de sesión:** la altura cambia con los filtros y mueve el contexto y la CTA; necesita sheet estable con estructura fija. PR25.
- **Crear / editar rutina:** no conviene acumular ajustes en el editor actual. Debe ser excelente para una cuenta nueva y una rutina compleja. PR26.
- **Alimentos por cantidad:** la experiencia actual de catálogo no cubre el futuro flujo de cantidad y comida compuesta. PR29, después de PR28.

## Inventario de áreas y próxima decisión

| Ruta / área | Estado | Qué conservar | Dirección recomendada | PR |
| --- | --- | --- | --- | --- |
| `/login` | ✅ Mantener | Auth estable, identidad clara, CTA única y feedback inline | mantener composición de página; extender hacia onboarding sin rehacer identidad | resuelto PR24 |
| `/home` | ✅ Mantener | foco operativo, CTA contextual, resumen semanal | referencia de lenguaje, mantenimiento menor | — |
| `/today` | 🟡 Mejorar | datos canónicos, quick add, actividad compacta | revisar arquitectura diaria antes de sumar features | PR28 |
| `/today/reports` y `/today/steps` | ✅ / 🟡 | período, resumen, charts accesibles | preservar claridad; expandir análisis luego | PR35 |
| `/train` | 🟡 Mejorar | calendario, CTA de nueva sesión, accesos | reorganizar hub y arquitectura Train | PR27 |
| `/train/routines` | 🟡 Mejorar | archivo, inicio y colores | lista y prioridad de rutinas más clara | PR26 |
| `/train/routines/[id]` | 🔴 Replantear | snapshots y acciones existentes | editor progresivo para novatos y expertos | PR26 |
| `/train/session/new` | 🟡 Mejorar | inicio desde rutina/libre | alinear con futura entrada de Train | PR27 |
| `/train/session/[id]` activa | 🔴 Replantear | autosave, estado de guardado, objetivos | nueva jerarquía de sesión y series | PR25 |
| ejercicio abierto/cerrado, series, notas, próxima vez, más opciones | 🔴 Replantear | semántica y acciones robustas | disclosure, footer y feedback estables | PR25 |
| selector Agregar ejercicio | 🔴 Replantear | búsqueda, filtros y selección | sheet fijo; resultados scrollables; CTA fija | PR25 |
| finalizar / cancelar | 🟡 Mejorar | guardas y confirmaciones | integrarlas en jerarquía PR25 | PR25 |
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

**Resuelto.** La entrada dejó la card partida por una composición de página: símbolos canónicos claros/oscuros, un mensaje breve, una única CTA de Google y un cierre discreto. En desktop la identidad y la acción se separan por espacio y jerarquía, no por un contenedor pesado; en mobile se conservan safe areas. El pending mantiene tamaño del botón y el error público se reserva inline, sin exponer detalles de OAuth. Google OAuth, callback y redirects seguros permanecen sin cambios.

### PR25 — Sesión activa v2

Se puede replantear jerarquía, ejercicios, series, expand/collapse, transiciones, progreso, footer y acciones. Permanecen autosave robusto, drafts, conflicts, retries, ownership, session fences y optimistic locking.

El problema del selector **Agregar ejercicio** queda confirmado: Todos, Espalda y una categoría sin resultados producen alturas distintas. La solución objetivo es sheet estable con header, búsqueda y chips fijos, lista interna scrollable y footer/CTA fijo; selected suave y CTA violeta fuerte.

### PR26–29

- **PR26:** crear/editar rutinas v2.
- **PR27:** arquitectura Train.
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
