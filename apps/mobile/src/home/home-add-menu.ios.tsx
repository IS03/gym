import { StyleSheet } from 'react-native';
import { Button, Host, Image, Menu, Section } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, frame, shapes } from '@expo/ui/swift-ui/modifiers';

import { useOwnlevelTheme } from '@/design-system';

import type { HomeAddMenuProps } from './home-add-menu.types';

/** Nutrition's "+": a native UIMenu (SwiftUI Menu through @expo/ui). */
export function HomeAddMenu({ habituals, onAll, onFood, onHabitual, onManual }: HomeAddMenuProps) {
  const { colors, isDark } = useOwnlevelTheme();
  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} matchContents style={styles.host} testID="home-add-menu">
      <Menu
        label={<Image color={colors.primary} modifiers={[frame({ height: 32, width: 32 }), background(colors.brandSubtle, shapes.circle())]}
          size={16} systemName="plus" />}
        modifiers={[accessibilityLabel('Agregar comida')]}
      >
        <Button label="Comida manual" onPress={onManual} systemImage="pencil" />
        <Button label="Buscar alimento" onPress={onFood} systemImage="magnifyingglass" />
        <Section title="Habituales">
          {habituals.map(option => (
            <Button key={`${option.source.kind}:${option.source.id}`} label={option.name} onPress={() => onHabitual(option)} systemImage="arrow.2.squarepath" />
          ))}
          <Button label="Ver todas" onPress={onAll} />
        </Section>
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({ host: { height: 32, width: 32 } });
