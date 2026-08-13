# OWNLEVEL — Visión de producto

## Propósito

OWNLEVEL es una aplicación personal para registrar y analizar entrenamiento, nutrición y evolución corporal sin separar esos datos en herramientas distintas.

La prioridad es el uso cotidiano desde el celular: registrar rápido, conservar historia confiable y poder entender el progreso sin convertir la aplicación en un formulario permanente.

## Principios de producto

### Mobile-first real

El flujo principal se diseña primero para teléfonos. Los layouts de 375, 390 y 430 px son referencias obligatorias en las áreas de uso frecuente.

Desktop aprovecha el espacio adicional para planificación y análisis, pero no define la experiencia mobile.

### Registrar hechos, no reconstruirlos después

Los datos históricos importantes deben conservarse cuando ocurren:

- sesiones y ejercicios realizados;
- series y valores reales;
- snapshots de rutina y objetivos;
- comidas y totales diarios;
- peso corporal por fecha.

Editar una plantilla futura no debe alterar el pasado.

### Poca fricción durante el uso

Las acciones frecuentes deben ser directas.

Ejemplos:

- iniciar entrenamiento: elegir → confirmar → empezar;
- registrar una serie: editar → completar → seguir;
- autosave: ocurre en segundo plano;
- registrar comida: cargar datos esenciales sin pasos administrativos innecesarios.

### Complejidad progresiva

La información necesaria para ejecutar una tarea permanece visible. Las opciones poco frecuentes viven en niveles secundarios, sheets, menús o secciones desplegables.

## Áreas principales

### Inicio

El Home funciona como resumen operativo:

- próximo paso de entrenamiento;
- nutrición del día;
- sesiones del día;
- progreso semanal;
- acceso al perfil.

No es un dashboard exhaustivo; muestra la información necesaria para decidir qué hacer a continuación.

### Entrenamiento

El módulo de entrenamiento cubre cuatro capas distintas:

1. **Ejercicios:** biblioteca personal.
2. **Rutinas:** plantillas ordenadas con objetivos.
3. **Sesiones:** instancia de entrenamiento de un día.
4. **Ejecución:** series realmente realizadas.

Funciones principales:

- creación y edición de rutinas;
- archivo/restauración de rutinas;
- reordenamiento de ejercicios;
- sesiones desde rutina o libres;
- una sola sesión activa;
- registro por serie;
- autosave de fondo;
- finalización estricta;
- historial de sesiones;
- corrección limitada de sesiones completadas;
- progreso e historial por ejercicio;
- calendario y continuidad.

### Nutrición

La nutrición utiliza entradas de comida libres, sin obligar a dividir el día en desayuno/almuerzo/merienda/cena.

Cada entrada puede representar una comida, snack o agregado real y participa del resumen diario.

La pantalla diaria prioriza:

- calorías consumidas;
- objetivo calórico;
- proteína;
- comidas registradas;
- edición/eliminación segura.

La dirección del producto es centralizar progresivamente reportes nutricionales dentro de OWNLEVEL sin crear una segunda fuente de verdad.

### Historial

Historial responde dos preguntas distintas:

- **Sesiones:** qué entrenamientos se realizaron.
- **Por ejercicio:** cómo evolucionó un ejercicio concreto.

Las sesiones completadas se tratan como historia. Una corrección ajusta datos realizados; no vuelve a abrir el entrenamiento ni reejecuta progresión.

### Progreso

Progreso resume hechos completados:

- sesiones;
- duración;
- series;
- volumen;
- rutinas;
- grupos musculares;
- comparación semanal;
- evolución individual por ejercicio.

El peso y las medidas corporales viven en la sección Cuerpo y no forman parte
del progreso de entrenamiento.

### Cuerpo

Cuerpo es la ubicación canónica del seguimiento corporal:

- peso histórico por fecha;
- peso actual derivado del último registro;
- medidas corporales históricas.

No se inventan contribuciones musculares indirectas ni recomendaciones de rotación si el modelo no las define explícitamente.

### Perfil y ajustes

El perfil concentra datos personales y configuración actual.

El peso actual y el historial corporal son conceptos distintos:

- perfil = valor actual;
- `day_logs.weight_kg` = registro histórico del día.

Modificar un punto histórico no cambia silenciosamente el valor actual del perfil.

## Navegación

### Mobile

```text
Inicio · Entrenar · Nutrición · Historial
```

Ajustes se accede desde la identidad/perfil del usuario y no ocupa una pestaña principal.

### Desktop

La navegación puede exponer más accesos de planificación y análisis aprovechando el ancho disponible.

## Tiempo y fechas

La fecha lógica del producto usa:

```text
America/Argentina/Cordoba
```

Una fecha de entrenamiento, nutrición o peso debe representar el día local del usuario y no derivarse ingenuamente desde UTC.

## Seguridad y ownership

Los datos pertenecen al usuario autenticado.

La aplicación se apoya en:

- Supabase Auth;
- RLS;
- validación de ownership;
- operaciones de servidor para mutaciones sensibles.

El cliente no debe decidir qué usuario modificar mediante un `user_id` arbitrario.

## Alcance actual y evolución

El entrenamiento es actualmente el módulo más profundo del producto. Nutrición ya tiene registro diario funcional y puede crecer hacia reportes más ricos.

Evoluciones naturales del producto:

- mejores análisis nutricionales;
- reportes combinados de entrenamiento y nutrición;
- modelo de cardio más específico por ejercicio;
- más contexto corporal y tendencias;
- refinamiento de experiencia desktop.

Estas mejoras deben reutilizar los datos existentes antes de introducir modelos paralelos.
