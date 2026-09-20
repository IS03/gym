export const PRODUCT_TABS = [
  { id: "home", path: "/home", label: "Inicio" },
  { id: "train", path: "/train", label: "Entrenar" },
  { id: "nutrition", path: "/today", label: "Nutrición" },
  { id: "progress", path: "/progress", label: "Progreso" },
] as const;

export const PRODUCT_PATHS = [
  ...PRODUCT_TABS.map(({ path }) => path),
  "/settings",
  "/settings/diagnostics",
] as const;

export type ProductTab = (typeof PRODUCT_TABS)[number];
export type ProductTabId = ProductTab["id"];
export type ProductTabPath = ProductTab["path"];
export type ProductPath =
  | ProductTabPath
  | "/settings"
  | "/settings/diagnostics";

const productPaths = new Set<string>(PRODUCT_PATHS);

function cleanPath(pathname: string): string {
  const withoutSearch = pathname.split(/[?#]/, 1)[0] ?? "";
  if (!withoutSearch || withoutSearch === "/") return "/";
  return withoutSearch.replace(/\/+$/, "") || "/";
}

export function isProductPath(pathname: string): pathname is ProductPath {
  return productPaths.has(pathname);
}

export function safeProductPath(pathname: string): ProductPath {
  const cleaned = cleanPath(pathname);
  return productPaths.has(cleaned) ? (cleaned as ProductPath) : "/home";
}

export function activeProductTab(pathname: string): ProductTabId | null {
  const cleaned = cleanPath(pathname);
  return PRODUCT_TABS.find(({ path }) => cleaned === path)?.id ?? null;
}

export function tabPathForContext(pathname: string): ProductTabPath {
  const cleaned = cleanPath(pathname);
  return (
    PRODUCT_TABS.find(({ path }) => cleaned === path)?.path ?? "/home"
  );
}

export type ProductNavigationState = {
  returnTo?: ProductTabPath;
};

export function settingsReturnPath(state: unknown): ProductTabPath {
  if (!state || typeof state !== "object") return "/home";
  const returnTo = (state as ProductNavigationState).returnTo;
  return PRODUCT_TABS.some(({ path }) => path === returnTo)
    ? (returnTo as ProductTabPath)
    : "/home";
}
