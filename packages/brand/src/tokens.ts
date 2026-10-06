/**
 * OWNLEVEL brand tokens: shared runtime entry for Mobile (Expo) and Web (Next).
 *
 * The values live in ONE file, the brand package's own tokens
 * (docs/brand/ownlevel-marca/tema/tokens.ts, pure TypeScript, no platform APIs).
 * This module only re-exports them so app code never imports from docs/ directly
 * and no value is ever copied. Platform adapters (React Native theme, CSS
 * variables) consume this entry; they must not redefine base values.
 *
 * Semantics (IDENTIDAD.md § Colores): the palette has a single system state,
 * `error`/`errorSoft`, for system failures and destructive actions only. There is
 * no success/warning token, and no token may judge the user's personal data
 * (weight, intake, performance): ups/downs are shown with arrows, not color.
 */
export * from '../../../docs/brand/ownlevel-marca/tema/tokens';
