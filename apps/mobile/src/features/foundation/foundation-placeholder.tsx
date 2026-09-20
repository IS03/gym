import { AppText, Heading, Screen, Surface } from '@/design-system';

type FoundationPlaceholderProps = {
  description: string;
  title: string;
};

export function FoundationPlaceholder({ description, title }: FoundationPlaceholderProps) {
  return (
    <Screen centered>
      <Surface>
        <AppText muted variant="overline">
          OWNLEVEL MOBILE
        </AppText>
        <Heading>{title}</Heading>
        <AppText>{description}</AppText>
        <AppText muted variant="caption">
          Foundation M1.1 · Sin datos reales
        </AppText>
      </Surface>
    </Screen>
  );
}
