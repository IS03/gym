import { StyleSheet } from 'react-native';
import { Button, Host, Menu, Section, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { useOwnlevelTheme } from '@/design-system';

import type { HomeAddMenuProps } from './home-add-menu.types';

/** Nutrition's "+ Comida": a native UIMenu (SwiftUI Menu through @expo/ui). */
export function HomeAddMenu({ habituals, onAll, onFood, onHabitual, onManual }: HomeAddMenuProps) {
  const { colors, isDark } = useOwnlevelTheme();
  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} matchContents style={styles.host} testID="home-add-menu">
      <Menu
        label={<Text modifiers={[font({ size: 17, weight: 'medium' }), foregroundStyle(colors.primary)]}>+ Comida</Text>}
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

const styles = StyleSheet.create({ host: { minHeight: 44 } });
