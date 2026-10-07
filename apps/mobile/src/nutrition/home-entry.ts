import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import type { QuickController, QuickState } from './quick-controller';

/** `quick=<saved|suggestion>:<id>` from Home's "Agregar rápido". */
export type QuickEntry = { kind: 'saved' | 'suggestion'; id: string };

export function parseQuickEntry(value: unknown): QuickEntry | null {
  if (typeof value !== 'string') return null;
  const match = /^(saved|suggestion):([0-9a-f-]{36})$/iu.exec(value);
  return match ? { id: match[2].toLowerCase(), kind: match[1] as QuickEntry['kind'] } : null;
}

/**
 * Entry points from Home into the existing Nutrition flows (M9.3A, decision A2):
 * `add=1` opens "Agregar"; `quick=kind:id` opens the existing quick registration with
 * that meal preselected (preview + the user's own confirmation; no new write path).
 * Each param is consumed once, only when the screen can edit (no pending intent).
 */
export function useNutritionHomeEntry({ add, editable, onAdd, onShowToday, quick, quickParam, today }: {
  add: unknown;
  editable: boolean;
  onAdd: () => void;
  onShowToday: () => void;
  quick: { controller: QuickController; state: QuickState } | null;
  quickParam: unknown;
  today: string;
}) {
  const router = useRouter();
  const pending = useRef<QuickEntry | null>(null);
  // Each param value is consumed once: closing the flow must never reopen it.
  const consumed = useRef<{ add: unknown; quick: unknown }>({ add: undefined, quick: undefined });
  // Once the param is cleared, the same value can be used again from Home (the tab stays mounted).
  useEffect(() => { if (add === undefined) consumed.current.add = undefined; }, [add]);
  useEffect(() => { if (quickParam === undefined) consumed.current.quick = undefined; }, [quickParam]);

  useEffect(() => {
    if (add !== '1' || !editable || consumed.current.add === add) return;
    consumed.current.add = add;
    router.setParams({ add: undefined });
    onShowToday();
    onAdd();
  }, [add, editable, onAdd, onShowToday, router]);

  const controller = quick?.controller;
  useEffect(() => {
    const entry = parseQuickEntry(quickParam);
    if (!entry || !editable || !controller || consumed.current.quick === quickParam) return;
    consumed.current.quick = quickParam;
    router.setParams({ quick: undefined });
    onShowToday();
    pending.current = entry;
    controller.open(today);
  }, [controller, editable, onShowToday, quickParam, router, today]);

  const state = quick?.state;
  useEffect(() => {
    const entry = pending.current;
    if (!entry || !state || !controller || !state.open || state.optionsLoading) return;
    pending.current = null;
    if (!state.options || state.optionsError || state.phase !== 'idle' || state.draft) return;
    const section = entry.kind === 'saved' ? state.options.saved : state.options.suggested;
    const option = section.status === 'ok' ? section.items.find(item => item.source.id === entry.id) : undefined;
    // If the meal is no longer offered, the quick list stays open to pick another.
    if (option) controller.choose(option);
  }, [controller, state]);
}
