// Runtime copies of the canonical brand package (docs/brand/ownlevel-marca/), served
// from public/brand. Favicon, icon.svg and apple-icon.png use the App Router file
// conventions in src/app instead (one mechanism per asset).
export const brandAssets = {
  appIcon192: "/brand/icon-192.png",
  appIcon512: "/brand/icon-512.png",
  appIconMaskable512: "/brand/icon-maskable-512.png",
  /** Isotype for light backgrounds (#18181B + #7D6A3C). */
  symbolOnLight: "/brand/logo/isotipo-claro.png",
  /** Isotype for dark backgrounds (white + #C9B68A). */
  symbolOnDark: "/brand/logo/isotipo-oscuro.png",
} as const;

/** Intrinsic size of the isotype PNGs (keeps next/image aspect ratio exact). */
export const brandSymbolSize = { width: 1024, height: 830 } as const;

export const brandSymbolSources = {
  light: brandAssets.symbolOnLight,
  dark: brandAssets.symbolOnDark,
} as const;
