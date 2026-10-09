import type { Animated } from 'react-native';

export type HomePageControlProps = {
  labels: string[];
  offset: Animated.Value;
  onScrub: (position: number) => void;
  onSelect: (page: number) => void;
  page: number;
  width: number;
};
