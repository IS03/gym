Quiero que actúes como un arquitecto de software senior + product engineer senior + full-stack developer senior, con criterio real de producto, experiencia en apps mobile-first y foco en construir una base sólida sin sobreingeniería.

Tu trabajo es ayudarme a diseñar, auditar y construir una aplicación personal para registrar nutrición, entrenamiento, suplementos y contexto diario.

IMPORTANTE:
- No quiero un prototipo descartable.
- No quiero una app inflada con features inútiles.
- No quiero una arquitectura frágil que se rompa cuando el proyecto crezca.
- Quiero una base seria, simple, clara, escalable y usable de verdad.
- Quiero criterio técnico, honestidad y practicidad.
- No quiero relleno ni teoría genérica.

==================================================
1. OBJETIVO DEL PRODUCTO
==================================================

La app es para uso personal.
Su objetivo es registrar y analizar:

- comidas del día
- calorías del día
- proteína opcional
- peso corporal
- energía y cansancio
- estado emocional y contexto del día (simple, opcional)
- entrenamientos
- ejercicios
- series, repeticiones, peso y descansos
- cardio
- suplementos
- historial diario, semanal y mensual
- déficit / mantenimiento / superávit

No es solo un contador de calorías.
Es un sistema personal integral de seguimiento físico y nutricional.

==================================================
2. CONTEXTO REAL DE USO
==================================================

La voy a usar yo mismo.
La voy a usar 99% de las veces desde el celular.
Quiero cargar cosas durante el día, en el momento.
No quiero una experiencia pesada ni formularios eternos.
La app tiene que sentirse como una app, no como una web tosca.

Ejemplos de uso reales:
- cargo una comida en el momento
- saco o subo una foto del plato
- escribo un texto libre
- pido estimación de calorías con IA
- reviso y corrijo
- guardo
- entreno y voy cargando ejercicios y series
- inicio una rutina y la modifico libremente ese día
- marco suplementos tomados
- veo resumen del día y resumen semanal

La experiencia tiene que ser:
- mobile-first de verdad
- rápida
- legible
- cómoda con una mano
- limpia
- funcional antes que “bonita”

==================================================
3. STACK OBLIGATORIO PARA LA PRIMERA VERSIÓN
==================================================

Quiero construir la primera versión como web app / PWA, no como app nativa.

Stack objetivo:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase:
  - Postgres
  - Auth
  - Storage
- Vercel para deploy
- OpenAI API para estimación de calorías desde foto + texto

Reglas:
- No cambiar este stack salvo que exista una razón técnica muy fuerte y bien justificada.
- No usar Prisma salvo que haya una justificación muy clara.
- Priorizar simplicidad, mantenibilidad y claridad.
- Evitar capas innecesarias.
- Evitar complejidad innecesaria en el frontend.

==================================================
4. FILOSOFÍA GENERAL DE ARQUITECTURA
==================================================

Quiero que sigas estas reglas:

1. Separar claramente:
   - catálogos base
   - plantillas
   - ejecución real del día
   - datos derivados
   - estimaciones de IA

2. No mezclar lo que está “planeado” con lo que “realmente ocurrió”.

3. No hacer que editar algo en el día modifique automáticamente lo general.

4. Guardar snapshots diarios importantes cuando tengan valor histórico real.

5. No guardar derivados inútiles si no aportan valor.

6. Construir una V1 chica pero sólida.

7. La UX del día a día manda.
   Esta app tiene que ser cómoda para registrar cosas reales, no una demo.

==================================================
5. DECISIONES FUNCIONALES YA DEFINIDAS
==================================================

--------------------------------------------------
5.1 COMIDAS
--------------------------------------------------

Las comidas NO deben ser bloques fijos obligatorios.

No quiero que la app me obligue a usar:
- desayuno
- almuerzo
- merienda
- cena

Porque a veces como 3 veces, a veces 5, a veces hago 2 meriendas, a veces un extra, a veces nada.

Entonces:
- cada comida se registra como una entrada libre
- puede tener una etiqueta opcional:
  - breakfast
  - lunch
  - snack
  - dinner
  - extra
  - o ninguna
- pero no debe ser obligatoria

Cada comida debe permitir:
- hora
- título opcional
- descripción libre
- foto opcional
- calorías finales
- proteína opcional
- fuente del dato:
  - manual
  - IA
  - etiqueta nutricional
- notas
- etiqueta opcional

A largo plazo, lo más importante no es recordar cada comida exacta sino poder volver en 6 meses y ver:
- ese día consumí tantas calorías
- tuve tanto déficit o superávit
- pesé tanto
- entrené tanto
- comparar semanas o meses

Por eso:
- quiero conservar el detalle de comidas
- pero el dato histórico principal debe ser el resumen diario

--------------------------------------------------
5.2 RESUMEN DIARIO
--------------------------------------------------

Quiero que el resumen diario quede persistido.

El día debe guardar de forma histórica:
- fecha
- peso corporal
- energía
- cansancio
- estado de ánimo opcional
- estrés opcional
- calorías consumidas totales del día
- proteína total del día opcional
- BMR snapshot del día
- mantenimiento snapshot del día
- target calórico snapshot del día
- diferencia vs target
- diferencia vs mantenimiento
- notas del día

No quiero depender únicamente del recálculo desde comidas para todo.
Quiero poder consultar semanas y meses viejos rápido y con snapshots históricos consistentes.

IMPORTANTE:
Estos campos derivados del día deben recalcularse automáticamente cuando cambien comidas activas de ese día.
No quiero lógica ambigua.
Necesito una regla clara de sincronización.

--------------------------------------------------
5.3 PERFIL Y SNAPSHOT DE OBJETIVOS
--------------------------------------------------

Quiero configurar una sola vez en perfil:
- peso
- altura
- edad o fecha de nacimiento
- sexo
- nivel de actividad
- objetivo
- target o método de cálculo
- mantenimiento estimado

La app debe usar esa configuración como base.

Cuando se crea un nuevo día, el sistema debe copiar automáticamente un snapshot al day log:
- BMR del momento
- mantenimiento del momento
- target del momento
- goal type del momento

Reglas:
- no quiero tener que cargar esto todos los días
- si actualizo mi perfil hoy, no debe cambiar retroactivamente el pasado
- debe afectar desde hoy o desde mañana en adelante, según la lógica que propongas
- quiero una solución clara y consistente

IMPORTANTE:
No quiero depender de profiles.current_weight_kg como verdad histórica principal.
El peso histórico principal vive en day_logs.
Si en profile existe current_weight_kg, debe estar claramente justificado o sincronizado automáticamente.

--------------------------------------------------
5.4 EJERCICIOS, RUTINAS Y SESIONES
--------------------------------------------------

Esto es MUY importante.

Quiero separar claramente 3 cosas:

A) Biblioteca general de ejercicios
B) Rutinas
C) Lo que realmente hice ese día

No quiero mezclar eso.

### A) Biblioteca general de ejercicios
Quiero tener ejercicios creados aparte, por ejemplo:
- press banca
- press inclinado con barra
- press inclinado con mancuerna
- tríceps polea
- remo apoyado
- crunch
- cinta
- etc.

Cada ejercicio general puede tener defaults opcionales:
- series sugeridas
- reps sugeridas
- descanso sugerido
- peso sugerido opcional
- notas
- categoría / tipo

### B) Rutinas
Quiero poder crear rutinas usando ejercicios de la biblioteca general.

Ejemplos:
- Pecho
- Espalda
- Piernas
- Abdomen
- Cinta inclinada
- Cinta rápida

Las rutinas son plantillas.

No crean ejercicios nuevos.
Usan ejercicios ya existentes.
Pueden tener defaults específicos por rutina.

Ejemplo:
un ejercicio puede tener defaults generales,
pero dentro de una rutina puede tener otros defaults distintos.

### C) Lo que hice ese día
El día real debe quedar separado de la rutina.

Ejemplo real:
- hoy selecciono la rutina Pecho
- la app me precarga sus ejercicios
- después puedo:
  - borrar uno
  - agregar otro
  - crear uno nuevo
  - cambiar series
  - cambiar reps
  - cambiar peso
- y eso debe afectar SOLO la sesión real de ese día

REGLAS IMPORTANTES:
- editar una sesión del día NO modifica la rutina general
- editar una sesión del día NO modifica el ejercicio global
- si creo un ejercicio nuevo desde el día, debe:
  - agregarse a la sesión actual
  - guardarse también en la biblioteca general
- si borro un ejercicio del día:
  - solo se borra de la sesión
  - NO se borra de la biblioteca general
- si cambio reps, series o peso en el día:
  - solo afecta ese día
  - NO modifica defaults generales ni de la rutina
- si quiero convertir esos valores en nuevos predeterminados:
  - debe ser una acción explícita, no automática

--------------------------------------------------
5.5 MÚLTIPLES SESIONES EN EL MISMO DÍA
--------------------------------------------------

Quiero poder tener varias sesiones en un mismo día.

Ejemplo:
- sesión 1: Pecho
- sesión 2: Abdomen
- sesión 3: Cinta inclinada

No quiero una sola bolsa gigante mezclando todo.

Esto permite que el mismo día haga:
- una rutina principal
- otra sesión corta de abdomen
- otra sesión de cardio

--------------------------------------------------
5.6 CARDIO / CINTA
--------------------------------------------------

No quiero una subsección rara.

Quiero que Abdomen y Cinta puedan existir como:
- rutinas independientes
- sesiones separadas
- agregables el mismo día que otra rutina

Para cinta, prefiero algo así:
- ejercicio general: Treadmill
- rutinas de cardio:
  - Treadmill incline
  - Treadmill fast

Y en la sesión guardar:
- duración
- distancia
- velocidad
- inclinación

--------------------------------------------------
5.7 CONTEXTO EMOCIONAL / DEL DÍA
--------------------------------------------------

A futuro quiero poder analizar relaciones entre:
- juntadas
- trabajo
- facultad
- ansiedad
- tristeza
- salidas
- estrés
- comer más o menos
- subir o bajar de peso

No quiero un sistema psicológico complejo en V1.
Pero sí quiero dejar la base lista.

Quiero algo simple, opcional, no invasivo.

Ejemplos:
- mood_level
- stress_level
- context_tags opcionales:
  - work
  - university
  - friends
  - family
  - partner
  - social_event
  - anxiety
  - sadness
  - low_sleep
  - good_sleep
  - etc.

IMPORTANTE:
No quiero tags libres de texto.
Quiero valores controlados para permitir análisis futuro consistente.

--------------------------------------------------
5.8 SUPLEMENTOS
--------------------------------------------------

Quiero poder definir suplementos generales, por ejemplo:
- creatina
- magnesio
- multivitamínico
- pre-entreno

Cada suplemento puede tener:
- nombre
- dosis por defecto
- horario ideal
- notas

Y cada día quiero poder registrar:
- si lo tomé o no
- dosis real
- hora real
- notas

==================================================
6. IA PARA CALORÍAS
==================================================

La app debe poder estimar calorías usando:
- foto del plato
- texto libre del usuario
- eventualmente foto de etiqueta nutricional

IMPORTANTE:
No quiero humo.
La IA no debe comportarse como si supiera con exactitud las calorías viendo una foto.
La IA debe ser un asistente de estimación, no una autoridad absoluta.

Requisitos:
- usar OpenAI API
- entrada multimodal: imagen + texto
- devolver salida estructurada en JSON
- devolver algo como:
  - foods_detected
  - estimated_calories
  - estimated_protein_g
  - confidence_score
  - notes / assumptions
- la salida debe poder revisarse y corregirse antes de guardar
- nunca guardar como definitivo sin confirmación o edición del usuario

IMPORTANTE:
Guardar separado:
- texto original del usuario
- foto(s) originales
- estimación IA
- valor final confirmado por el usuario
- fuente del dato

Además:
- usar detail low por defecto para fotos normales de comida
- usar detail high solo cuando haga falta, por ejemplo:
  - leer etiquetas nutricionales
  - texto pequeño
- optimizar costo y simpleza

--------------------------------------------------
6.1 FLUJO CORRECTO DE IA
--------------------------------------------------

No quiero que la comida dependa completamente de que la IA responda.

Quiero este flujo:

1. Primero se crea la comida como registro real en la base
2. La comida puede quedar en estado draft o ai_pending
3. Se guardan:
   - texto
   - fotos
   - metadata mínima
4. Luego se corre la estimación IA sobre esa comida ya existente
5. Si la IA responde bien:
   - se guarda la estimación en nutrition_estimations
   - se propone actualizar la comida
6. Si la IA falla:
   - la comida sigue existiendo
   - no se pierde nada
   - el usuario puede reintentar o completar manualmente

Esto es importante para UX móvil.
La red puede ser mala y no quiero perder datos ni bloquear todo el flujo.

==================================================
7. MODELO DE DATOS DESEADO
==================================================

Quiero que propongas un modelo de datos serio, limpio, escalable y coherente con estas reglas.

La estructura esperada debería contemplar algo como esto, refinado si hace falta:

### users / auth
Manejado por Supabase Auth.

### profiles
Configuración actual del usuario:
- user_id
- display_name
- birth_date o age
- sex
- height_cm
- activity_level
- goal_type
- target_kcal_current
- maintenance_kcal_current
- bmr_kcal_current
- updated_at

### day_logs
Centro del día:
- id
- user_id
- log_date
- weight_kg
- energy_level_1_10
- fatigue_level_1_10
- mood_level opcional
- stress_level opcional
- notes
- bmr_kcal_snapshot
- maintenance_kcal_snapshot
- target_kcal_snapshot
- goal_type_snapshot
- total_calories_consumed
- total_protein_g
- delta_vs_target
- delta_vs_maintenance
- created_at
- updated_at

Debe existir un day log por fecha por usuario.

IMPORTANTE:
- estos totales persisten
- pero deben recalcularse automáticamente cuando cambian comidas activas de ese día
- necesito una estrategia clara para mantener consistencia

### context_tags
Catálogo controlado de tags.

### day_log_context_tags
Relación entre day_logs y tags.

### meal_entries
Entradas libres de comida:
- id
- day_log_id
- consumed_at
- meal_label opcional
- title
- description
- final_calories
- final_protein_g
- source_type
- status (draft, completed, ai_pending, ai_failed)
- is_confirmed
- notes
- deleted_at nullable
- created_at
- updated_at

IMPORTANTE:
- quiero soft delete en meal_entries desde V1
- las queries normales deben ignorar registros con deleted_at
- los recálculos del día deben usar solo comidas activas

### meal_photos
- id
- meal_entry_id
- storage_path
- image_type
- display_order
- created_at

### nutrition_estimations
- id
- meal_entry_id
- provider
- model_name
- raw_user_text
- detail_mode
- estimated_foods_json
- estimated_calories
- estimated_protein_g
- confidence_score
- reasoning_summary
- raw_response_json
- status opcional si hace falta
- created_at

### exercises
Biblioteca general:
- id
- user_id
- name
- category
- exercise_type (strength, abs, cardio, mobility, other)
- default_sets
- default_reps
- default_rest_seconds
- default_weight_kg
- notes
- is_active
- created_at
- updated_at

### routines
Plantillas:
- id
- user_id
- name
- routine_type (strength, abs, cardio, mixed)
- notes
- is_active
- created_at
- updated_at

### routine_exercises
Relación rutina <-> ejercicios:
- id
- routine_id
- exercise_id
- exercise_order
- default_sets
- default_reps
- default_rest_seconds
- default_weight_kg
- default_duration_seconds
- default_distance_meters
- default_speed_kmh
- default_incline_percent
- notes
- created_at

### workout_sessions
Sesión real de un día:
- id
- day_log_id
- base_routine_id nullable
- title
- session_order
- started_at
- ended_at
- notes
- created_at
- updated_at

### workout_session_exercises
Ejercicios reales de la sesión:
- id
- workout_session_id
- routine_exercise_id nullable
- exercise_id
- exercise_name_snapshot
- category_snapshot
- exercise_type_snapshot
- source_type (routine, extra, manual_new)
- exercise_order
- notes
- created_at

### workout_sets
Series reales:
- id
- workout_session_exercise_id
- set_number
- reps nullable
- weight_kg nullable
- rest_seconds nullable
- duration_seconds nullable
- distance_meters nullable
- speed_kmh nullable
- incline_percent nullable
- rpe nullable
- notes
- created_at

### supplement_definitions
- id
- user_id
- name
- default_dose
- ideal_time
- notes
- is_active
- created_at
- updated_at

### supplement_logs
- id
- day_log_id
- supplement_definition_id
- taken
- actual_dose
- taken_at
- notes
- created_at
- updated_at

IMPORTANTE:
Toda operación que cree un meal_entry, workout_session o supplement_log debe usar una lógica central tipo:
getOrCreateDayLog(userId, date)
para asegurar que siempre exista el day_log correspondiente.

Quiero que analices este esquema y lo mejores si hace falta.
No quiero academicismo innecesario.
Quiero una base lógica, mantenible y útil.

==================================================
8. RELACIONES Y REGLAS DE NEGOCIO
==================================================

Quiero que valides y mejores estas reglas:

1. Un usuario tiene un perfil actual.
2. Un usuario tiene muchos day_logs.
3. Cada day_log representa una fecha única.
4. Un day_log puede tener muchas comidas.
5. Un day_log puede tener muchas sesiones de entrenamiento.
6. Un day_log puede tener muchos supplement_logs.
7. Las comidas tienen fotos opcionales.
8. Las comidas pueden tener varias estimaciones IA.
9. Los ejercicios generales son un catálogo independiente.
10. Las rutinas usan ejercicios del catálogo.
11. Una sesión real puede arrancar desde una rutina, pero luego modificarse libremente.
12. Los ejercicios de la sesión son una “copia viva” del momento, no la rutina original en vivo.
13. Las series reales cuelgan del ejercicio realizado en esa sesión.
14. Crear un ejercicio desde una sesión debe guardarlo también en el catálogo general.
15. Borrar un ejercicio desde la sesión no debe borrar el ejercicio del catálogo general.
16. Modificar una rutina no debe alterar sesiones pasadas.
17. Modificar defaults del ejercicio global no debe alterar sesiones pasadas.
18. Los snapshots diarios deben preservar historia real.
19. Editar o soft-deletear una comida pasada debe recalcular automáticamente el resumen de ese día.
20. Los snapshots de target/mantenimiento del día no deben cambiar por editar comidas.
21. Las queries normales no deben considerar meal_entries soft-deleted.
22. Los context tags deben venir de un catálogo controlado, no de texto libre.

==================================================
9. PANTALLAS Y UX
==================================================

Quiero una propuesta de UX mobile-first muy concreta.

Pantallas mínimas esperadas:

### Hoy
Debe mostrar:
- resumen del día
- calorías consumidas hoy
- target
- diferencia
- peso
- energía / cansancio
- comidas del día
- sesiones del día
- suplementos del día
- notas rápidas

### Comidas
- lista de comidas del día
- agregar comida
- editar comida
- subir foto
- pedir estimación IA
- revisar y confirmar

### Entrenar
- iniciar sesión desde rutina
- iniciar sesión libre
- continuar sesión abierta
- agregar ejercicio
- buscar ejercicio en biblioteca
- crear ejercicio nuevo
- cargar series
- guardar sesión

### Rutinas
- listar rutinas
- crear rutina
- editar rutina
- agregar o quitar ejercicios
- ordenar ejercicios
- editar defaults de la rutina

### Biblioteca de ejercicios
- listar ejercicios
- crear ejercicio
- editar defaults generales
- activar / desactivar

### Historial
- por fecha
- por semana
- por mes
- por ejercicio
- ver calorías, peso, déficit, sesiones y contexto

### Suplementos
- listado rápido del día
- definiciones generales
- marcar tomado/no tomado

### Perfil / Ajustes
- datos físicos
- actividad
- objetivo
- target
- mantenimiento
- preferencias
- modo oscuro
- opción de aplicar cambios desde hoy o desde mañana, si conviene

Requisitos UX:
- botones grandes
- formularios breves
- navegación simple
- excelente legibilidad
- nada recargado
- tono serio y limpio
- dark mode
- optimizado para móvil

==================================================
10. FLUJOS CLAVE QUE QUIERO PERFECTOS
==================================================

### Flujo 1: agregar comida manual
1. Entrar a Hoy
2. Tocar Agregar comida
3. Crear el meal_entry base
4. Escribir descripción y/o título
5. Poner calorías manuales
6. Guardar
7. Recalcular y actualizar day_log

### Flujo 2: agregar comida con IA
1. Entrar a Hoy
2. Tocar Agregar comida
3. Crear meal_entry en draft o ai_pending
4. Subir foto y escribir texto
5. Guardar primero la comida y las fotos
6. Pedir estimación
7. Llamar a OpenAI
8. Mostrar resultado estructurado
9. Permitir corregir
10. Guardar estimación y valor final
11. Recalcular resumen diario

### Flujo 3: iniciar rutina
1. Entrar a Entrenar
2. Elegir rutina
3. Obtener o crear day_log
4. Crear workout_session
5. Copiar routine_exercises a workout_session_exercises
6. Permitir editar libremente la sesión
7. Cargar workout_sets
8. Guardar

### Flujo 4: agregar ejercicio extra en una sesión
1. Dentro de una sesión
2. Tocar Agregar ejercicio
3. Buscar uno existente o crear nuevo
4. Si se crea nuevo:
   - agregar a la sesión
   - agregar a catálogo general
5. No modificar la rutina general

### Flujo 5: registrar abdomen o cardio el mismo día
1. Crear una segunda o tercera sesión
2. Elegir rutina Abdomen o Cinta
3. Registrar normalmente
4. Queda separado del entrenamiento principal

### Flujo 6: registrar suplemento
1. Entrar al día o pantalla Hoy
2. Obtener o crear day_log
3. Marcar suplemento
4. Guardar supplement_log

### Flujo 7: ver semana o mes
1. Entrar a Historial
2. Seleccionar semana o mes
3. Ver:
   - calorías totales
   - promedio diario
   - peso promedio
   - déficit/superávit acumulado
   - días entrenados
   - contexto opcional

==================================================
11. COSAS QUE NO QUIERO EN LA V1
==================================================

No quiero meter ahora:
- smartwatch integration
- pasos automáticos
- sueño complejo
- gráficos gigantes
- redes sociales
- gamificación
- recomendaciones médicas
- macros hiper detallados obligatorios
- calorías “quemadas” ultra confiables del cardio
- algoritmos complejos de predicción
- dashboards excesivos
- sobreingeniería

==================================================
12. SEGURIDAD Y MULTIUSUARIO
==================================================

Aunque al principio la use una sola persona, quiero que la arquitectura quede bien hecha.

Necesito:
- Supabase Auth
- RLS bien pensada
- cada usuario ve solo sus datos
- storage de fotos segregado por usuario
- reglas claras de acceso

No quiero agujeros de seguridad ni una app “solo funciona porque soy yo”.

==================================================
13. CALIDAD TÉCNICA
==================================================

Quiero código con criterio profesional.

Requisitos:
- TypeScript estricto
- validación de datos
- separación clara entre UI, lógica, datos y servicios
- nombres consistentes
- arquitectura mantenible
- componentes reutilizables
- manejo de errores correcto
- no llenar todo de librerías
- no inflar el proyecto
- documentación breve pero útil

También quiero que evalúes qué conviene usar para:
- formularios
- validaciones
- fechas
- estado local
- data fetching
- subida de archivos
- integración con Supabase
- PWA

Pero elegí poco y bien.
No llenes el proyecto de dependencias si no aportan valor.

==================================================
14. COSAS QUE QUIERO QUE DETECTES Y CUESTIONES
==================================================

Quiero que me señales, con honestidad, si algo de lo siguiente está mal:
- reglas de negocio confusas
- tablas innecesarias
- campos redundantes
- normalización excesiva
- desnormalización peligrosa
- decisiones que rompan historial
- decisiones que rompan UX
- cosas que sean lindas en teoría pero malas en la práctica
- flujos pesados para móvil
- cosas que me obliguen a registrar demasiado

No quiero que me des la razón en todo.
Quiero criterio real.

==================================================
15. ROADMAP ESPERADO
==================================================

Quiero una propuesta de roadmap realista.

Algo parecido a esto, refinado por vos:

FASE 0
- arquitectura base
- setup de proyecto
- layout
- navegación
- PWA base
- Supabase setup
- auth setup

FASE 1
- profiles
- day_logs
- comidas manuales
- resumen diario
- historial diario básico
- getOrCreateDayLog()

FASE 2
- catálogo de ejercicios
- rutinas
- sesiones de entrenamiento
- ejercicios del día
- sets
- historial por ejercicio
- fotos básicas de comidas
- storage básico
- IA básica para comidas

FASE 3
- suplementos
- contexto emocional simple
- semana / mes
- mejoras de edición de comidas pasadas
- recálculo robusto de day_logs

FASE 4
- mejoras UX
- repetir comidas
- mejores filtros
- optimización de IA y costos
- pequeñas visualizaciones

Podés cambiar el orden si encontrás uno mejor, pero justificá por qué.

==================================================
16. QUÉ QUIERO QUE HAGAS AHORA
==================================================

Quiero que trabajes en este orden exacto:

PASO 1
Analizá todo este prompt y detectá:
- contradicciones
- riesgos
- huecos
- decisiones mejorables
- problemas de arquitectura
- problemas de UX
- cosas que no tienen sentido

PASO 2
Proponé la arquitectura final recomendada para la V1:
- stack definitivo
- librerías concretas que sí usarías
- librerías que evitarías
- estructura del proyecto
- flujo de datos
- reglas clave

PASO 3
Proponé el esquema final de base de datos:
- tablas
- campos
- relaciones
- índices
- snapshots
- RLS
- strategy de storage

PASO 4
Proponé el mapa de pantallas y rutas:
- Hoy
- Comidas
- Entrenar
- Rutinas
- Biblioteca de ejercicios
- Historial
- Suplementos
- Perfil

PASO 5
Proponé el roadmap realista por fases.

PASO 6
Recién después de eso, empezá a scaffoldar el proyecto base.

IMPORTANTE:
No empieces generando 200 archivos sin antes validar que la arquitectura tenga sentido.

==================================================
17. FORMA DE RESPONDER
==================================================

Quiero que respondas:
- claro
- técnico
- práctico
- honesto
- sin relleno
- sin teoría genérica
- señalando lo que está mal
- proponiendo mejoras concretas

No quiero un manual aburrido.
No quiero que intentes impresionar con complejidad.
Quiero una solución real que pueda construir y usar.

Empezá por:
1. auditoría crítica del enfoque
2. arquitectura final recomendada
3. esquema de datos final
4. mapa de pantallas
5. roadmap por fases

Y solo después pasá a implementación.
