export const bottomNavItems = [
  { id: "home", href: "/home", label: "Inicio" },
  { id: "train", href: "/train", label: "Entrenar" },
  { id: "nutrition", href: "/today", label: "Nutrición" },
  { id: "progress", href: "/progress", label: "Progreso" },
] as const;

export type BottomNavItemId = (typeof bottomNavItems)[number]["id"];

export type BottomNavContext = { fromProgress?: boolean };

function isTrainingProgressContext(pathname: string, context: BottomNavContext) {
  return pathname === "/train/progress" || pathname.startsWith("/train/progress/") || (context.fromProgress === true && pathname.startsWith("/train/history/"));
}

export function isBottomNavItemActive(pathname: string, href: string, context: BottomNavContext = {}) {
  const trainingProgress = isTrainingProgressContext(pathname, context);
  if (href === "/progress") return trainingProgress || pathname === href || pathname.startsWith("/progress/") || pathname === "/calendar" || pathname.startsWith("/calendar/") || pathname === "/history" || pathname.startsWith("/history/");
  if (href === "/train" && trainingProgress) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveBottomNavIndex(pathname: string, context: BottomNavContext = {}) {
  return bottomNavItems.findIndex(({ href }) =>
    isBottomNavItemActive(pathname, href, context),
  );
}
