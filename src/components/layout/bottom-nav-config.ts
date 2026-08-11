export const bottomNavItems = [
  { id: "home", href: "/home", label: "Inicio" },
  { id: "train", href: "/train", label: "Entrenar" },
  { id: "nutrition", href: "/today", label: "Nutrición" },
  { id: "history", href: "/history", label: "Historial" },
] as const;

export type BottomNavItemId = (typeof bottomNavItems)[number]["id"];

export function isBottomNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveBottomNavIndex(pathname: string) {
  return bottomNavItems.findIndex(({ href }) =>
    isBottomNavItemActive(pathname, href),
  );
}
