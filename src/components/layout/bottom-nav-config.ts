export const bottomNavItems = [
  { id: "home", href: "/home", label: "Inicio" },
  { id: "train", href: "/train", label: "Entrenar" },
  { id: "nutrition", href: "/today", label: "Nutrición" },
  { id: "progress", href: "/progress", label: "Progreso" },
] as const;

export type BottomNavItemId = (typeof bottomNavItems)[number]["id"];

export function isBottomNavItemActive(pathname: string, href: string) {
  if (href === "/progress") return pathname === href || pathname.startsWith("/progress/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveBottomNavIndex(pathname: string) {
  return bottomNavItems.findIndex(({ href }) =>
    isBottomNavItemActive(pathname, href),
  );
}
