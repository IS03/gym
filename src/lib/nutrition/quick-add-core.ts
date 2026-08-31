/**
 * Keeps the quick-add search local to data already rendered by Today. The
 * normalized comparison makes names equally discoverable with or without
 * accents, without adding a request on every keystroke.
 */
function normalizeQuickAddSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-AR");
}

export function filterQuickAddItems<T>(
  items: T[],
  search: string,
  label: (item: T) => string,
) {
  const term = normalizeQuickAddSearch(search.trim());
  if (!term) return items;
  return items.filter((item) => normalizeQuickAddSearch(label(item)).includes(term));
}
