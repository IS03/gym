import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { PROGRESS_CUSTOM_MAX_DAYS, PROGRESS_PRESETS, parseProgressQuery, type ProgressPeriod, type ProgressQuery } from '@/api/progress';
import { AppText, Button, Surface, spacing, useOwnlevelTheme } from '@/design-system';
import { inputNutritionDate, parseInputNutritionDate } from '@/nutrition/day-format';
import { PRESET_LABELS, periodText } from './progress-format';

const spanDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
/** Shared Progress period selector: 7/14/30 días, 3/6 meses, 1 año, personalizado (≤366 días, hasta hoy). */
export function ProgressPeriodSelector({ query, period, onChange }: { query: ProgressQuery; period?: ProgressPeriod; onChange: (q: ProgressQuery) => void }) {
  const { colors } = useOwnlevelTheme();
  const [custom, setCustom] = useState(query.period === 'custom');
  const [from, setFrom] = useState(query.from ? inputNutritionDate(query.from) : '');
  const [to, setTo] = useState(query.to ? inputNutritionDate(query.to) : '');
  const [error, setError] = useState<string | null>(null);
  return <View style={styles.section} testID="progress-period-selector">
    <View style={styles.wrap}>{PROGRESS_PRESETS.map(p => <Button key={p} label={PRESET_LABELS[p]} variant={(p === 'custom' ? custom : !custom && query.period === p) ? 'primary' : 'secondary'}
      onPress={() => { setError(null); setCustom(p === 'custom'); if (p !== 'custom') onChange({ period: p }); }} />)}</View>
    {custom ? <Surface style={styles.section}>
      <AppText variant="caption">Rango personalizado · hasta 366 días, nunca después de hoy.</AppText>
      <TextInput accessibilityLabel="Desde (DD/MM/AAAA)" value={from} onChangeText={setFrom} placeholder="Desde DD/MM/AAAA" placeholderTextColor={colors.textMuted}
        keyboardType="numbers-and-punctuation" maxLength={10} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Hasta (DD/MM/AAAA)" value={to} onChangeText={setTo} placeholder="Hasta DD/MM/AAAA" placeholderTextColor={colors.textMuted}
        keyboardType="numbers-and-punctuation" maxLength={10} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
      {error ? <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">{error}</AppText> : null}
      <Button label="Consultar rango" onPress={() => {
        const q = parseProgressQuery({ period: 'custom', from: parseInputNutritionDate(from.trim()), to: parseInputNutritionDate(to.trim()) });
        if (!q) { setError('Usá fechas válidas (DD/MM/AAAA) y que "desde" no sea posterior a "hasta".'); return; }
        if (spanDays(q.from!, q.to!) > PROGRESS_CUSTOM_MAX_DAYS) { setError(`El período personalizado admite hasta ${PROGRESS_CUSTOM_MAX_DAYS} días.`); return; }
        setError(null); onChange(q);
      }} />
    </Surface> : null}
    {period ? <AppText muted variant="caption">{periodText(period)}{period.includesToday ? ' · hoy en curso' : ''}</AppText> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48 } });
