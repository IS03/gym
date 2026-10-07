import type { QuickOption } from '@/api/nutrition-quick';

/** Entries of Nutrition's "+" (lámina 90). Each one opens an existing loading flow. */
export type HomeAddMenuProps = {
  habituals: QuickOption[];
  onAll: () => void;
  onFood: () => void;
  onHabitual: (option: QuickOption) => void;
  onManual: () => void;
};
