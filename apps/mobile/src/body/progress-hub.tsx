import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon, AppText, IconCircle, PressableSurface, ScrollScreen, spacing, useOwnlevelTheme } from '@/design-system';
import { haptics } from '@/platform/haptics';

/** Minimal, extensible Progress hub (M5.1/M5.2). M7 adds its sections around these entries. */
export function ProgressHub() {
  const router = useRouter();
  const { colors } = useOwnlevelTheme();
  return <ScrollScreen testID="progress-hub">
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
  </ScrollScreen>;
}
const styles = StyleSheet.create({ card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, flex: { flex: 1, gap: 2 } });
