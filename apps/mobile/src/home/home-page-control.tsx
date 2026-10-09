import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useOwnlevelTheme, useReduceMotion } from '@/design-system';
import type { HomePageControlProps } from './home-page-control.types';

/** Android/web retain the existing control; iOS resolves the UIKit-specific file. */
export function HomePageControl({ labels, offset, onScrub, onSelect, page, width }: HomePageControlProps) {
  const { colors, isDark } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  const supported = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (alive) setReduceTransparency(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => { if (alive) setReduceTransparency(value); });
    return () => { alive = false; subscription.remove(); };
  }, [supported]);
  const currentPage = useRef(page);
  useEffect(() => { currentPage.current = page; }, [page]);
  const dragStart = useRef(0);
  const dragPosition = useRef(0);
  const beginScrub = useCallback(() => { dragStart.current = currentPage.current; dragPosition.current = currentPage.current; }, []);
  const moveScrub = useCallback((dx: number) => {
    const position = Math.max(0, Math.min(labels.length - 1, dragStart.current + dx / 44));
    dragPosition.current = position;
    if (reduceMotion) {
      const next = Math.round(position);
      if (currentPage.current !== next) onSelect(next);
    } else onScrub(position);
  }, [labels.length, onScrub, onSelect, reduceMotion]);
  const endScrub = useCallback(() => onSelect(Math.round(dragPosition.current)), [onSelect]);
  // PanResponder only registers callbacks here; refs are read inside later gesture events.
  // eslint-disable-next-line react-hooks/refs
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, state) => Math.abs(state.dx) > 4 && Math.abs(state.dx) > Math.abs(state.dy),
    onPanResponderGrant: beginScrub,
    onPanResponderMove: (_, state) => moveScrub(state.dx),
    onPanResponderRelease: endScrub,
    onPanResponderTerminate: endScrub,
  }), [beginScrub, moveScrub, endScrub]);
  return <View {...gesture.panHandlers} style={styles.capsule} testID="home-week-pagination-control">
    <View pointerEvents="none" style={styles.backplate} testID="home-week-pagination-backplate">
      {supported && !reduceTransparency
        ? <GlassView colorScheme={isDark ? 'dark' : 'light'} glassEffectStyle="regular" isInteractive={false}
          style={StyleSheet.absoluteFill} testID="home-week-pagination-glass" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} testID="home-week-pagination-fallback" />}
    </View>
    {labels.map((label, index) => <Pressable accessibilityLabel={`Página ${index + 1} de ${labels.length}: ${label}`}
      accessibilityHint={`Muestra ${label.toLowerCase()} de esta semana. También podés deslizar sobre los puntos`} accessibilityRole="button"
      accessibilityState={{ selected: page === index }} key={label} onPress={() => onSelect(index)} style={styles.pageControl} testID={`home-week-page-${index}`}>
      <View style={[styles.dot, { backgroundColor: colors.textMuted, opacity: 0.35 }]} testID={`home-week-dot-${index}`} />
    </Pressable>)}
    <Animated.View pointerEvents="none" style={[styles.activeDot, { backgroundColor: colors.primary,
      transform: [{ translateX: offset.interpolate({ inputRange: [0, Math.max(1, labels.length - 1) * width],
        outputRange: [0, Math.max(0, labels.length - 1) * 44], extrapolate: 'clamp' }) }],
    }]} testID="home-week-active-dot" />
  </View>;
}

const styles = StyleSheet.create({
  dot: { borderRadius: 999, height: 6, width: 6 },
  capsule: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
  backplate: { borderRadius: 999, height: 28, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 8 },
  activeDot: { borderRadius: 999, height: 6, left: 19, position: 'absolute', top: 19, width: 6 },
  pageControl: { alignItems: 'center', justifyContent: 'center', minHeight: 44, width: 44 },
});
