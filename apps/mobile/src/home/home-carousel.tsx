import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, spacing, useOwnlevelTheme, useReduceMotion } from '@/design-system';

/** Swipe and explicit buttons expose the same pages, including to VoiceOver. */
export function HomeCarousel({ pages }: { pages: { label: string; content: ReactNode }[] }) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, window.width - 32));
  const [page, setPage] = useState(0);
  const currentPage = useRef(0);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ x: currentPage.current * width, animated: false });
  }, [width]);
  const select = (index: number) => {
    setPage(index);
    currentPage.current = index;
    scroll.current?.scrollTo({ x: index * width, animated: !reduceMotion });
  };
  return (
    <View onLayout={event => {
      const next = event.nativeEvent.layout.width;
      if (next > 0 && next !== width) { setHeights({}); setWidth(next); }
    }} testID="home-week-carousel">
      <View style={styles.tabs}>
        {pages.map((item, index) => <Pressable accessibilityLabel={`Ver ${item.label.toLowerCase()} de esta semana`}
          accessibilityRole="button" accessibilityState={{ selected: page === index }} key={item.label}
          onPress={() => select(index)} style={[styles.tab, { borderBottomColor: page === index ? colors.primary : 'transparent' }]}
          testID={`home-week-page-${index}`}>
          <AppText style={{ color: page === index ? colors.primary : colors.textMuted }} variant="footnote">{item.label}</AppText>
        </Pressable>)}
      </View>
      <ScrollView contentContainerStyle={styles.pages} decelerationRate="fast" directionalLockEnabled horizontal nestedScrollEnabled
        onMomentumScrollEnd={event => {
          const next = Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
          currentPage.current = next; setPage(next);
        }}
        pagingEnabled ref={scroll} showsHorizontalScrollIndicator={false} style={{ height: heights[page] }} testID="home-week-pager">
        {pages.map((item, index) => <View accessibilityElementsHidden={page !== index}
          importantForAccessibility={page === index ? 'auto' : 'no-hide-descendants'} key={item.label}
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            if (height > 0) setHeights(previous => previous[index] === height ? previous : { ...previous, [index]: height });
          }} style={{ width }} testID={`home-week-content-${index}`}>{item.content}</View>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pages: { alignItems: 'flex-start' },
  tab: { alignItems: 'center', borderBottomWidth: 2, flex: 1, justifyContent: 'center', minHeight: 44 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
});
