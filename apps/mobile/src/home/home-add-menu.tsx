import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText, ListGroup, ListRow, SheetHandle, SheetSurface, spacing, useOwnlevelTheme } from '@/design-system';

import type { HomeAddMenuProps } from './home-add-menu.types';

/** Nutrition's "+" outside iOS: the M9.2 sheet with the same entries as the native menu. */
export function HomeAddMenu({ habituals, onAll, onFood, onHabitual, onManual }: HomeAddMenuProps) {
  const { colors } = useOwnlevelTheme();
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  return (
    <>
      <Pressable accessibilityLabel="Agregar comida" accessibilityRole="button" hitSlop={8} onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, { backgroundColor: colors.brandSubtle, opacity: pressed ? 0.6 : 1 }]} testID="home-add-menu">
        <AppIcon color={colors.primary} name="plus" size={16} />
      </Pressable>
      <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Pressable accessibilityLabel="Cerrar" onPress={() => setOpen(false)} style={styles.backdrop} />
        <SheetSurface>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <SheetHandle />
            <ListGroup>
              <ListRow onPress={run(onManual)} subtitle="Cargar macros a mano" title="Comida manual" />
              <ListRow onPress={run(onFood)} title="Buscar alimento" />
            </ListGroup>
            <View style={styles.section}>
              <AppText muted variant="footnote">Habituales</AppText>
              <ListGroup>
                {habituals.map(option => (
                  <ListRow key={`${option.source.kind}:${option.source.id}`} onPress={run(() => onHabitual(option))} title={option.name} />
                ))}
                <ListRow onPress={run(onAll)} title="Ver todas" />
              </ListGroup>
            </View>
          </SafeAreaView>
        </SheetSurface>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.3)', flex: 1 },
  section: { gap: spacing.sm },
  sheet: { gap: spacing.lg, padding: spacing.lg },
  trigger: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
});
