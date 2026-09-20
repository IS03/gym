import { useOwnlevelTheme } from '@/design-system';

export function useStackScreenOptions() {
  const { colors } = useOwnlevelTheme();

  return {
    contentStyle: { backgroundColor: colors.background },
    headerBackButtonDisplayMode: 'minimal' as const,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
  };
}
