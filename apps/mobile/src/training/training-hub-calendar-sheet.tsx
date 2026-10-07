import { BottomSheet, Host, RNHostView } from '@expo/ui';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { MobileTrainingResponse } from '@/api/training';
import { AppIcon, AppText, InlineUnavailable, ListGroup, SkeletonBlock, radius, spacing, useOwnlevelTheme } from '@/design-system';
import { weekDates } from '@/home/home-day';
import type { HomeResource } from '@/home/home-resource';

import { buildTrainingMonth } from './calendar';
import { hubWeekTotals, type HubWeek } from './training-hub-data';
import { HUB_WEEKDAY_NAMES, HubCircleButton, hubDayName, hubMonthName } from './training-hub-dashboard';

export function hubWeekLabel(start: string, end: string): string {
  const startDay = Number(start.slice(8));
  const endDay = Number(end.slice(8));
  return start.slice(0, 7) === end.slice(0, 7) ? `Semana del ${startDay} al ${endDay}` :
    `Semana del ${startDay} de ${hubMonthName(start.slice(0, 7)).toLowerCase()} al ${endDay} de ${hubMonthName(end.slice(0, 7)).toLowerCase()}`;
}

function Metric({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  const { colors } = useOwnlevelTheme();
  return <View style={[styles.metric, { backgroundColor: colors.surfaceRaised }]}>
    <AppText muted variant="caption">{label}</AppText>
    <View style={styles.metricValue}><AppText numeric style={styles.number}>{value === undefined ? '—' : value}</AppText><AppText muted variant="caption">{unit}</AppText></View>
  </View>;
}

export function TrainingHubCalendarContent({ calendar, month, onMonth, onSelect, onDay, onRetry, selected, today, week }: {
  calendar: HomeResource<MobileTrainingResponse>; month: string; onMonth: (delta: -1 | 1) => void; onSelect: (date: string) => void;
  onDay: (date: string) => void; onRetry: () => void; selected: string; today: string; week: HomeResource<HubWeek>;
}) {
  const { colors } = useOwnlevelTheme();
  const { fontScale } = useWindowDimensions();
  const read = calendar.data?.calendar;
  const trained = read?.status === 'ok' ? new Set(read.data.days.map(day => day.date)) : null;
  const totals = week.data ? hubWeekTotals(week.data) : null;
  const days = week.data ? weekDates(week.data.start).filter(date => week.data!.sessions.some(session => session.logDate === date)) : [];
  return <ScrollView contentContainerStyle={styles.content} testID="training-calendar-sheet-content">
    <View style={styles.header}>
      <AppText accessibilityRole="header" numeric style={styles.flex} variant="title2">{hubMonthName(month, true)}</AppText>
      <HubCircleButton icon="chevronLeft" label="Mes anterior" onPress={() => onMonth(-1)} />
      <HubCircleButton icon="chevronRight" label="Mes siguiente" onPress={() => onMonth(1)} />
    </View>
    <View>
      <View style={styles.gridRow}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, index) => <View accessibilityElementsHidden key={index} style={styles.gridCell}><AppText muted style={styles.weekday}>{label}</AppText></View>)}</View>
      {buildTrainingMonth(month).map((row, index) => <View key={index} style={styles.gridRow}>
        {row.map((cell, weekday) => cell ? <Pressable key={cell.date} accessibilityRole="button"
          accessibilityLabel={`${HUB_WEEKDAY_NAMES[weekday]} ${cell.day} de ${hubMonthName(month)}, ${trained === null ? 'actividad no disponible' : trained.has(cell.date) ? 'con entrenamiento' : 'sin entrenamiento'}`}
          accessibilityState={{ selected: cell.date === selected }} onPress={() => onSelect(cell.date)} style={styles.gridCell} testID={`training-month-day-${cell.date}`}>
          <View style={[styles.dayCircle, { backgroundColor: cell.date === selected ? colors.primary : 'transparent',
            borderColor: cell.date === today && cell.date !== selected ? colors.primary : 'transparent' }]}>
            <AppText numeric variant="subheadline" style={{ color: cell.date === selected ? colors.onPrimary : cell.date > today ? colors.textMuted : colors.text,
              opacity: cell.date > today && cell.date !== selected ? 0.6 : 1 }}>{cell.day}</AppText>
          </View>
          <View accessibilityElementsHidden style={[styles.dot, { backgroundColor: trained?.has(cell.date) ? colors.primary : 'transparent' }]} testID={trained?.has(cell.date) ? `training-month-dot-${cell.date}` : undefined} />
        </Pressable> : <View key={`empty-${weekday}`} style={styles.gridCell} accessibilityElementsHidden />)}
      </View>)}
    </View>
    {trained === null ? calendar.status === 'loading' ? <SkeletonBlock height={18} /> : <InlineUnavailable message="No pudimos cargar los días entrenados de este mes." actionLabel="Reintentar" onAction={onRetry} /> : null}
    {calendar.status === 'unavailable' && trained !== null ? <InlineUnavailable message="El calendario está guardado. No pudimos actualizarlo." actionLabel="Reintentar" onAction={onRetry} /> : null}
    <View style={[styles.metrics, fontScale > 1.4 && styles.metricsVertical]}>
      <Metric label={`Días · ${hubMonthName(month).toLowerCase()}`} value={trained?.size} unit="entrenados" />
      <Metric label="Sesiones · semana" value={totals?.sessions} unit="sesiones" />
      <Metric label="Series · semana" value={totals?.sets} unit="series" />
    </View>
    <AppText accessibilityRole="header" numeric variant="headline">{week.data ? hubWeekLabel(week.data.start, week.data.end) : 'Semana elegida'}</AppText>
    {!week.data ? week.status === 'loading' ? <SkeletonBlock height={140} /> : <InlineUnavailable message="No pudimos cargar esta semana." actionLabel="Reintentar" onAction={onRetry} /> : days.length ?
      <ListGroup bordered={false} elevated>
        {days.map(date => {
          const sessions = week.data!.sessions.filter(session => session.logDate === date);
          const detail = sessions.map(session => `${session.routineName}${session.durationMilliseconds === null ? '' : ` ${Math.round(session.durationMilliseconds / 60_000)} min`}`).join(' · ');
          return <Pressable key={date} accessibilityRole="button" onPress={() => onDay(date)} accessibilityLabel={`${hubDayName(date, '')}, ${detail}, abrir día en el historial`}
            style={({ pressed }) => [styles.weekDay, { backgroundColor: date === selected ? colors.brandSubtle : 'transparent', opacity: pressed ? 0.6 : 1 }]}>
            <View style={styles.flex}><AppText numeric style={styles.weekDayTitle}>{hubDayName(date, '') + (date === today ? ' · Hoy' : '')}</AppText>
              <AppText muted numeric variant="footnote">{detail} · {sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'}</AppText></View>
            <AppIcon color={colors.textMuted} name="chevronRight" size={17} />
          </Pressable>;
        })}
      </ListGroup> : <AppText muted variant="footnote">Sin entrenamientos esta semana</AppText>}
    {week.status === 'unavailable' && week.data ? <InlineUnavailable message="Mostramos la semana guardada. No pudimos actualizarla." actionLabel="Reintentar" onAction={onRetry} /> : null}
  </ScrollView>;
}

export function TrainingHubCalendarSheet({ open, onClose, ...props }: Parameters<typeof TrainingHubCalendarContent>[0] & { open: boolean; onClose: () => void }) {
  const { colors, isDark } = useOwnlevelTheme();
  return <Host colorScheme={isDark ? 'dark' : 'light'} style={styles.host}>
    <BottomSheet isPresented={open} onDismiss={onClose} snapPoints={['half', 'full']} showDragIndicator containerColor={colors.surface} contentPadding={0} testID="training-calendar-sheet">
      <RNHostView><View style={[styles.sheet, { backgroundColor: colors.surface }]}><TrainingHubCalendarContent {...props} /></View></RNHostView>
    </BottomSheet>
  </Host>;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 0, height: 0 },
  sheet: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1, minWidth: 0 },
  gridRow: { flexDirection: 'row' },
  gridCell: { alignItems: 'center', flex: 1, minHeight: 48, justifyContent: 'center', paddingVertical: 2 },
  dayCircle: { alignItems: 'center', borderRadius: radius.full, borderWidth: 1.5, justifyContent: 'center', minHeight: 36, minWidth: 36, padding: 2 },
  dot: { borderRadius: radius.full, height: 4, width: 4 },
  weekday: { fontSize: 11 },
  metrics: { flexDirection: 'row', gap: spacing.xs },
  metricsVertical: { flexDirection: 'column' },
  metric: { flex: 1, borderRadius: radius.inner, gap: spacing.xs, padding: spacing.sm },
  metricValue: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  number: { fontSize: 20, fontWeight: '700' },
  weekDay: { alignItems: 'center', borderRadius: radius.inner, flexDirection: 'row', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  weekDayTitle: { fontSize: 16, fontWeight: '600' },
});
