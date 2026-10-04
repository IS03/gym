import { parseQuickOption, parseQuickSelection, type QuickOption, type QuickSelection } from '@/api/nutrition-quick';
import { isNutritionDate } from '@/api/nutrition-day';
export type QuickDraft = { date: string; option: QuickOption; quantities: Record<string, string> };
export function quickDraft(date: string, option: QuickOption): QuickDraft {
  return { date, option, quantities: Object.fromEntries(option.items.map(i => [i.id, String(i.quantity).replace('.', ',')])) };
}
export function selectionFromDraft(draft: QuickDraft): { selection?: QuickSelection; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const quantities = draft.option.templateType === 'composite' ? draft.option.items.map(i => {
    const text = draft.quantities[i.id]?.trim() ?? '';
    const quantity = /^\d+(?:[,.]\d{1,2})?$/.test(text) ? Number(text.replace(',', '.')) : 0;
    if (quantity <= 0 || quantity > 1_000_000) errors[i.id] = 'Ingresá una cantidad positiva, con hasta dos decimales.';
    return { itemId: i.id, quantity };
  }) : null;
  if (Object.keys(errors).length) return { errors };
  const selection = parseQuickSelection({ date: draft.date, source: draft.option.source, quantities });
  return { ...(selection ? { selection } : {}), errors };
}
export function parseQuickDraft(v: unknown): QuickDraft | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const d = v as Record<string, unknown>, option = parseQuickOption(d.option);
  if (!isNutritionDate(d.date) || !option || !d.quantities || typeof d.quantities !== 'object' || Array.isArray(d.quantities)) return undefined;
  const quantities = d.quantities as Record<string, unknown>;
  if (Object.keys(quantities).length !== option.items.length || option.items.some(i => typeof quantities[i.id] !== 'string')) return undefined;
  return { date: d.date, option, quantities: quantities as Record<string, string> };
}
