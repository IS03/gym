# Patrones de interfaz OWNLEVEL v1

Los patrones describen cómo reutilizar y consolidar lo existente. No obligan a crear nuevos componentes en este PR.

## Elegir la superficie

| Superficie | Cuándo usarla | No usarla para |
| --- | --- | --- |
| Página | tarea compleja, navegación propia o contexto durable | confirmación breve |
| Sección | agrupar una parte legible de una página | encapsular cada párrafo |
| Card | resumen o unidad con borde propio y lectura conjunta | lista larga de filas simples |
| Lista / fila | navegación, selección o registros repetidos | métricas que necesitan comparación visual |
| Inset / secundaria | contexto auxiliar dentro de una unidad | crear otro nivel de card |
| Sheet | contexto mobile ligado a la pantalla actual y que requiere alto vertical | tarea larga o navegación propia |
| Dialog | decisión puntual, confirmación o contenido acotado | formularios extensos o flujos de varios pasos |

En mobile un sheet se ancla abajo; en desktop el mismo contenido puede pasar a dialog centrado si conserva el contexto. No convertir todo en modal.

## Controles

| Patrón | Regla |
| --- | --- |
| Primary button | una acción dominante por contexto; violeta, label de verbo claro |
| Secondary / outline | alternativa real a la primaria, no una copia desaturada de todas las acciones |
| Ghost | acción auxiliar junto al contenido; mantener nombre accesible |
| Destructive | sólo mutación riesgosa; confirmar si el efecto no es reversible |
| Icon button | icono con `aria-label`, target de 44 px y tooltip cuando el significado no es obvio |
| Input / numérico | `Input` / `LocalizedDecimalInput`, label visible, unidad junto al campo, error inline |
| Fecha | `DateField`; conservar la fecha lógica de Córdoba |
| Search | control estable al inicio de lista o sheet; no moverlo con filtros |
| Select / filtros | opciones escaneables; selected suave y persistente; filtros locales no reordenan toda la página |
| Toggle / segmentado | estados mutuamente excluyentes y cortos; no usar para navegación profunda |
| Chip | filtro o atributo corto; nunca única señal de una acción crítica |

## Listas, expandibles y selección

Las filas repetidas comparten altura, padding y foco. Toda fila con navegación es un objetivo único, no varios links competidores. Accordions se usan para detalle secundario dentro del flujo; el encabezado mantiene siempre título, progreso o estado que permita decidir si abrirlo.

Seleccionar un ejercicio u objeto muestra check/tint/borde suave. La CTA para confirmar (por ejemplo, **Agregar a la sesión**) conserva el peso violeta.

## Sheets y dialogs

Los componentes actuales usan Base UI `Dialog` y varias envolturas locales. El patrón futuro debe mantener:

- backdrop, foco, cierre accesible y `Escape` correctos;
- header con título, contexto y cierre con nombre accesible;
- cuerpo scrolleable sin que el header ni el footer se desplacen;
- footer con CTA estable cuando la tarea requiere confirmación;
- altura máxima basada en `dvh`, safe areas y reduced motion.

### Caso confirmado: Agregar ejercicio

Este input queda reservado para **PR25**. Cambiar entre Todos, Espalda o una categoría sin resultados no debe encoger/agrandar el sheet ni mover la CTA. Dirección acordada:

1. sheet de altura aproximadamente estable;
2. header fijo;
3. buscador y chips de filtro fijos;
4. lista de resultados interna y scrolleable;
5. footer y CTA fijos;
6. selección visual suave; CTA violeta fuerte.

No se implementa ese cambio en PR23.

## Loading, feedback, errores y vacíos

| Estado | Patrón recomendado |
| --- | --- |
| Carga de página | skeleton que conserva jerarquía y tamaño del resultado; usar sólo si hay espera perceptible |
| Acción breve | pending inline en el botón + controles relacionados deshabilitados |
| Autosave | estado discreto, estable y cercano al objeto; `Guardando…`, `Guardado` o error recuperable |
| Éxito | confirmación breve e inline; no modal “se guardó” |
| Error | cerca del origen, en lenguaje entendible, con siguiente acción; no exponer internals |
| Empty state | qué falta + por qué importa + CTA clara; no una superficie vacía |

La interfaz de sesión ya contiene aprendizajes valiosos de autosave: no borrar drafts, no simular guardado y no permitir que feedback desplace series o CTA.

## Inventario de componentes y patrones existentes

| Componente / patrón | Ubicación actual | Estado | Acción futura |
| --- | --- | --- | --- |
| `Button` | `src/components/ui/button.tsx` | ✅ variantes, foco y tamaños coherentes | mantener; aplicar criterios de prioridad |
| `Card` | `src/components/ui/card.tsx` | 🟡 base sólida, riesgo de sobreuso | conservar y definir cuándo no usarla |
| `Input` + `Label` | `src/components/ui/` | ✅ alturas, foco y disabled consistentes | mantener |
| `DateField` | `src/components/ui/date-field.tsx` | ✅ fecha visible + picker nativo | mantener fecha lógica y tratamiento visual |
| `LocalizedDecimalInput` | `src/components/ui/localized-decimal-input.tsx` | ✅ semántica local explícita | mantener para números de dominio |
| `DateRangePicker` | `src/components/ui/date-range-picker.tsx` | 🟡 patrón útil, específico | consolidar criterios de selección/error cuando reaparezca |
| `ChartDetail` | `src/components/ui/chart-detail.tsx` | ✅ feedback accesible de charts | mantener como patrón de detalle contextual |
| `ResponsiveDialog` | `src/app/(app)/today/responsive-dialog.tsx` | 🟡 buena adaptación sheet/dialog | consolidar gradualmente como envoltura común |
| Sheets locales Base UI | entrenamiento, cuerpo, rutinas, ejercicios | 🟡 repiten estructura y radios | converger en futuros PRs sin refactor masivo |
| Accordions de sesión | `train/session/[id]/session-editor.tsx` | 🟡 funcionales, jerarquía exigida | replantear dentro de PR25 |
| Navegación mobile | `components/layout/bottom-nav.tsx` | ✅ clara y acotada | preservar mientras PR27 evalúa arquitectura Train |
| Sidebar desktop | `components/layout/desktop-sidebar.tsx` | ✅ agrupación y estados claros | mantener como referencia desktop |
| App shell | `components/layout/app-shell.tsx` | ✅ safe areas y límites mobile explícitos | mantener |
| Theme provider / selector | `components/providers/`, settings | ✅ roles light/dark existentes | mantener y validar contraste por cambio |
| Charts y selector de período | `components/nutrition/` | ✅ reportes informativos y accesibles | mantener como referencia; ampliar en PR35 |
| Empty / status inline | distribuidos por dominios | 🟡 semántica existe, presentación no unificada | consolidar lenguaje en cada rediseño |

No hay un componente compartido de toast, tabs, select, toggle o skeleton que deba imponerse ahora. Cuando una necesidad recurrente quede demostrada, se consolida desde la semántica y accesibilidad, no por abstracción anticipada.
