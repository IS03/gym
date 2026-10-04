import { View, StyleSheet } from 'react-native';
import type { MobileNutritionDayResponse, NutritionDayContext, NutritionDayMetric } from '@/api/nutrition-day';
import type { NutritionDayMeal } from '../../../../src/lib/mobile-api/nutrition-day-contract';
import { AppText, Button, Heading, Surface, spacing } from '@/design-system';
import { canWriteDay } from './day-write-model';
import { amount, nutrientAmount, signedAmount } from './day-format';

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><AppText muted style={styles.label}>{label}</AppText><AppText style={styles.value}>{value}</AppText></View>;
}
function effective(value: boolean | null): string { return value === null ? 'Sin dato' : value ? 'Sí' : 'No'; }
const sources = { workout: 'sesión registrada', override: 'ajuste diario', none: 'sin sesión', schedule: 'horario' };
const mealLabels = { breakfast: 'Desayuno', lunch: 'Almuerzo', snack: 'Merienda', dinner: 'Cena', extra: 'Extra' };
function Context({ data, onAdjust }: { data: NutritionDayContext; onAdjust?: () => void }) {
  return <Surface>
    <Heading level={2}>Contexto del día</Heading>
    {onAdjust ? <Button label="Ajustar contexto" onPress={onAdjust} variant="secondary" /> : null}
    <Detail label="Entrenamiento efectivo" value={`${effective(data.training.effective)}${data.training.source ? ` · ${sources[data.training.source]}` : ''}`} />
    <Detail label="Trabajo efectivo" value={`${effective(data.work.effective)}${data.work.source ? ` · ${sources[data.work.source]}` : ''}`} />
    <Detail label="Objetivo automático" value={amount(data.targetAutomaticKcal, 'kcal')} />
    {data.targetOverrideKcal !== null ? <Detail label="Objetivo ajustado para este día" value={amount(data.targetOverrideKcal, 'kcal')} /> : null}
    <Detail label="Gasto automático" value={amount(data.expenditureAutomaticKcal, 'kcal')} />
    {data.expenditureOverrideKcal !== null ? <Detail label="Gasto ajustado para este día" value={amount(data.expenditureOverrideKcal, 'kcal')} /> : null}
    <Detail label="Objetivo de agua del plan" value={amount(data.waterTargetL, 'L')} />
    {data.resolvedAt === null ? <AppText muted>Este día no tiene contexto nutricional resuelto.</AppText> : null}
  </Surface>;
}
export function metricValue(m: NutritionDayMetric, value: number | null): string {
  if (value === null) return 'Sin dato';
  if (m.valueType === 'duration') return `${Math.floor(value / 60)} h ${value % 60} min`;
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(value)}${m.unit ? ` ${m.unit}` : ''}`;
}
export function NutritionDayContent({ data, onEdit, onActivity, onContext }: { data: MobileNutritionDayResponse; onEdit?: (meal: NutritionDayMeal) => void; onActivity?: (data: MobileNutritionDayResponse) => void; onContext?: (data: MobileNutritionDayResponse) => void }) {
  const nutrition = data.nutrition.status === 'ok' ? data.nutrition.data : null;
  const recorded = nutrition?.dayState === 'recorded' ? nutrition : null;
  const energyAmount = (value: number | null) => {
    if (!recorded) return 'Sin dato';
    const { calories, entryCount } = recorded.summary;
    if (entryCount > 0 && calories.missingCount === entryCount) return 'Sin dato';
    return `${signedAmount(value)}${value !== null && calories.missingCount > 0 ? ' · parcial' : ''}`;
  };
  return <>
    {!nutrition ? <Surface><Heading level={2}>Nutrición no disponible</Heading><AppText muted>No pudimos consultar el resumen ni las comidas de esta fecha. Deslizá para reintentar.</AppText></Surface>
      : !recorded ? <Surface><Heading level={2}>Sin día registrado</Heading><AppText muted>Esta fecha todavía no tiene un registro nutricional. No hay resumen ni objetivos guardados.</AppText></Surface>
      : <>
        <Surface>
          <Heading level={2}>Resumen nutricional</Heading>
          <Detail label="Consumo" value={nutrientAmount(recorded.summary.calories, recorded.summary.entryCount, 'kcal')} />
          <Detail label="Objetivo nutricional" value={amount(recorded.context.calorieTarget, 'kcal')} />
          <Detail label="Consumo − objetivo" value={energyAmount(recorded.context.deltaVsTargetKcal)} />
          <Detail label="Gasto energético" value={amount(recorded.context.expenditureKcal, 'kcal')} />
          <Detail label="Balance: consumo − gasto" value={energyAmount(recorded.context.energyBalanceKcal)} />
          <Detail label="Proteína" value={nutrientAmount(recorded.summary.proteinG, recorded.summary.entryCount, 'g')} />
          <Detail label="Objetivo de proteína" value={amount(recorded.context.proteinTargetG, 'g')} />
          <Detail label="Carbohidratos" value={nutrientAmount(recorded.summary.carbsG, recorded.summary.entryCount, 'g')} />
          <Detail label="Grasas" value={nutrientAmount(recorded.summary.fatG, recorded.summary.entryCount, 'g')} />
          {Object.values(recorded.summary).some(v => typeof v === 'object' && v.missingCount > 0) ?
            <AppText muted>Las sumas parciales incluyen sólo valores conocidos. “Sin dato” no significa cero.</AppText> : null}
        </Surface>
        <View style={styles.section}>
          <Heading level={2}>Comidas</Heading>
          {recorded.meals.length === 0 ? <Surface><AppText>Sin comidas registradas</AppText></Surface> : recorded.meals.map(meal =>
            <Surface key={meal.id}>
              <AppText variant="label">{meal.entryKind === 'legacy_daily_summary' ? 'Resumen histórico importado' : meal.title || meal.description || 'Comida'}</AppText>
              {meal.mealLabel ? <AppText muted>{mealLabels[meal.mealLabel]}</AppText> : null}
              {meal.timeKnown ? <AppText muted>{new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Cordoba', hour: '2-digit', minute: '2-digit' }).format(new Date(meal.consumedAt))}</AppText> : <AppText muted>Hora sin dato</AppText>}
              {meal.description && meal.description !== meal.title && meal.title ? <AppText muted>{meal.description}</AppText> : null}
              <Detail label="Calorías" value={amount(meal.calories, 'kcal')} />
              <AppText muted>{`Proteína ${amount(meal.proteinG, 'g')} · Carbohidratos ${amount(meal.carbsG, 'g')} · Grasas ${amount(meal.fatG, 'g')}`}</AppText>
              {meal.precision === 'estimated' ? <AppText muted>Valores estimados</AppText> : null}
              {onEdit && meal.entryKind === 'meal' && meal.sourceType === 'manual' ?
                <Button label="Editar comida" accessibilityLabel={`Editar ${meal.title || meal.description || 'comida'}`} onPress={() => onEdit(meal)} variant="secondary" /> : null}
            </Surface>)}
        </View>
        <Context data={recorded.context} onAdjust={onContext && canWriteDay('context', data) ? () => onContext(data) : undefined} />
      </>}
    <Surface>
      <Heading level={2}>Actividad</Heading>
      {onActivity && canWriteDay('metrics', data) ? <Button label="Editar actividad" onPress={() => onActivity(data)} variant="secondary" /> : null}
      {data.activity.status === 'unavailable' ? <AppText muted>Las métricas de esta fecha no están disponibles. Deslizá para reintentar.</AppText>
        : data.activity.data.metrics.length === 0 ? <AppText muted>No hay métricas disponibles para esta fecha.</AppText>
        : data.activity.data.metrics.map(m => <View key={m.id} style={styles.metric}>
          <Detail label={`${m.label}${m.isActive ? '' : ' · archivada'}`} value={metricValue(m, m.value)} />
          {m.target !== null ? <AppText muted variant="caption">Objetivo actual de la métrica: {metricValue(m, m.target)}</AppText> : null}
        </View>)}
      <AppText muted variant="caption">Valores de esta fecha exacta. Sin dato indica que no se registró un valor.</AppText>
    </Surface>
  </>;
}
const styles = StyleSheet.create({
  detail: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { flex: 1 }, value: { flex: 1, textAlign: 'right' },
  section: { gap: spacing.md }, metric: { gap: spacing.xs },
});
