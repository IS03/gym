const DEFAULT_MOBILE_API_BASE_URL = "https://www.ownlevel.fit";

export function mobileApiBaseUrl(
  configuredUrl = __OWNLEVEL_API_BASE_URL__,
): string {
  const value = configuredUrl.trim() || DEFAULT_MOBILE_API_BASE_URL;
  return value.replace(/\/+$/, "");
}
