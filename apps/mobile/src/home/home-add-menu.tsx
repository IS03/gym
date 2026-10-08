import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, ListGroup, ListRow, SheetHandle, SheetSurface, spacing } from '@/design-system';

import type { HomeAddMenuProps } from './home-add-menu.types';
import { HomeLink } from './home-ui';

/** Nutrition's "+ Comida" outside iOS: the M9.2 sheet with the same entries as the native menu. */
export function HomeAddMenu({ habituals, onAll, onFood, onHabitual, onManual }: HomeAddMenuProps) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  return (
    <>
      <HomeLink accessibilityLabel="Agregar comida" label="+ Comida" onPress={() => setOpen(true)} testID="home-add-menu" />
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
});
