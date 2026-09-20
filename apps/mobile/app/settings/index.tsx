import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  AppText,
  Button,
  Heading,
  Row,
  ScrollScreen,
  Separator,
  Surface,
  type ThemeMode,
  useOwnlevelTheme,
} from '@/design-system';

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Sistema', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
];

export default function SettingsScreen() {
  const { mode, resolvedMode, setMode } = useOwnlevelTheme();

  return (
    <ScrollScreen>
      <Surface>
        <Heading level={2}>Tema</Heading>
        <AppText muted>La preferencia no se persiste todavía; eso pertenece a Settings real.</AppText>
        <Row>
          {themeOptions.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              onPress={() => setMode(option.value)}
              variant={mode === option.value ? 'primary' : 'secondary'}
            />
          ))}
        </Row>
        <AppText muted variant="caption">
          Modo efectivo: {resolvedMode === 'dark' ? 'oscuro' : 'claro'}
        </AppText>
      </Surface>
      <Separator />
      <Surface>
        <Heading level={2}>Runtime</Heading>
        <AppText>OWNLEVEL Dev {Constants.expoConfig?.version ?? '0.1.0'}</AppText>
        <AppText muted variant="caption">
          {Platform.OS} · Expo SDK {Constants.expoConfig?.sdkVersion ?? '57'}
        </AppText>
      </Surface>
    </ScrollScreen>
  );
}
