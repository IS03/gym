import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon, AppText, IconCircle, PressableSurface, ScrollScreen, spacing, useOwnlevelTheme } from '@/design-system';
import { haptics } from '@/platform/haptics';

/** Operational entries (M5/M6). Progress Overview (M7) keeps them under "Revisar datos". */
export function ProgressHub() {
  return <ScrollScreen testID="progress-hub"><ProgressDataLinks /></ScrollScreen>;
}
export function ProgressDataLinks() {
  const router = useRouter();
  const { colors } = useOwnlevelTheme();
  return <>
    <PressableSurface accessibilityLabel="Abrir Historial" style={styles.card} onPress={() => { haptics.selection(); router.push('/history'); }}>
      <IconCircle icon="activity" />
      <View style={styles.flex}><AppText variant="label">Historial</AppText><AppText muted variant="caption">Tus registros por día y calendario.</AppText></View>
      <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
    </PressableSurface>
    <PressableSurface accessibilityLabel="Abrir Cuerpo" accessibilityHint="Peso y medidas corporales" style={styles.card}
      onPress={() => { haptics.selection(); router.push('/(tabs)/progress/body'); }}>
      <IconCircle icon="activity" />
      <View style={styles.flex}>
        <AppText variant="label">Cuerpo</AppText>
        <AppText muted variant="caption">Peso y medidas corporales.</AppText>
      </View>
      <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
    </PressableSurface>
    <PressableSurface accessibilityLabel="Abrir Métricas diarias" accessibilityHint="Pasos, agua, sueño y tus métricas por fecha" style={styles.card}
      onPress={() => { haptics.selection(); router.push('/(tabs)/progress/metrics'); }}>
      <IconCircle icon="water" />
      <View style={styles.flex}>
        <AppText variant="label">Métricas diarias</AppText>
        <AppText muted variant="caption">Pasos, agua, sueño y tus métricas, por fecha.</AppText>
      </View>
      <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
    </PressableSurface>
  </>;
}
const styles = StyleSheet.create({ card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, flex: { flex: 1, gap: 2 } });
