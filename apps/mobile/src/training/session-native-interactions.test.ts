import { describe, expect, it } from '@jest/globals';
import type { SharedValue } from 'react-native-reanimated';
import { DRAG_DELAY, dragOrder, isHoldActivation, itemTop, recordItemHeight } from './session-native-interactions';

// Reanimated JS-thread semantics: `.value` reads the UI runtime synchronously,
// while `.set()`/`.modify()` are only scheduled there (flushed later, in order).
function jsThreadSharedValue<T>(initial: T) {
  let ui = initial; const scheduled: (() => void)[] = [];
  const value = { get value() { return ui; }, set: (next: T) => { scheduled.push(() => { ui = next; }); },
    modify: (modifier: (current: T) => T) => { scheduled.push(() => { ui = modifier(ui); }); } };
  return { value: value as unknown as SharedValue<T>, flush: () => scheduled.splice(0).forEach(run => run()) };
}
describe('native drag measurements and activation', () => {
  it('keeps every height from one batch of layout events (mount, expand/collapse)', () => {
    const heights = jsThreadSharedValue<Record<string, number>>({});
    for (const [id, height] of [['a', 520], ['b', 96], ['c', 96]] as const) recordItemHeight(heights.value, id, height);
    heights.flush();
    expect(heights.value.value).toEqual({ a: 520, b: 96, c: 96 });
  });
  it('documents the dropped-height failure of a JS read-modify-write', () => {
    const heights = jsThreadSharedValue<Record<string, number>>({});
    for (const [id, height] of [['a', 520], ['b', 96], ['c', 96]] as const) heights.value.set({ ...heights.value.value, [id]: height });
    heights.flush();
    // Two of three items stay unmeasured, so a lift guard requiring heights never passes.
    expect(heights.value.value).toEqual({ c: 96 });
  });
  it('lifts only from the real hold, never from an early movement activation', () => {
    expect(isHoldActivation(1000, 1041)).toBe(false);
    expect(isHoldActivation(1000, 1000 + DRAG_DELAY - 41)).toBe(false);
    expect(isHoldActivation(1000, 1000 + DRAG_DELAY - 40)).toBe(true);
    expect(isHoldActivation(1000, 1412)).toBe(true);
  });
});
describe('native drag slot geometry', () => {
  it('supports variable-height expanded cards, crossing multiple slots and moving back', () => {
    const heights = { a: 500, b: 100, c: 160 }, initial = ['a', 'b', 'c'];
    expect(itemTop(initial, heights, 'c')).toBe(600);
    expect(dragOrder(initial, heights, 'a', 60)).toEqual(['b', 'a', 'c']);
    expect(dragOrder(['b', 'a', 'c'], heights, 'a', 0)).toEqual(initial);
    expect(dragOrder(initial, heights, 'a', 200)).toEqual(['b', 'c', 'a']);
    expect(dragOrder(initial, heights, 'c', 200)).toEqual(['c', 'a', 'b']);
  });
  it('keeps untouched slots stable and clamps insertion to the bounds', () => {
    const heights = { a: 80, b: 80, c: 80 }, initial = ['a', 'b', 'c'];
    expect(dragOrder(initial, heights, 'b', 80)).toEqual(initial);
    expect(dragOrder(initial, heights, 'b', -500)).toEqual(['b', 'a', 'c']);
    expect(dragOrder(initial, heights, 'b', 500)).toEqual(['a', 'c', 'b']);
  });
});
