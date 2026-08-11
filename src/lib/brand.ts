export const brandAssets = {
  appIcon: "/brand/ownlevel-app-icon.png",
  appIcon192: "/brand/ownlevel-app-icon-192.png",
  appIcon512: "/brand/ownlevel-app-icon-512.png",
  symbolOnLight: "/brand/ownlevel-symbol-on-light.png",
  symbolOnDark: "/brand/ownlevel-symbol-on-dark.png",
  lockupMobile: "/brand/ownlevel-lockup-mobile.png",
  lockupHorizontal: "/brand/ownlevel-lockup-horizontal.png",
} as const;

export const brandSymbolSources = {
  light: brandAssets.symbolOnLight,
  dark: brandAssets.symbolOnDark,
} as const;
