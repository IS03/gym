/** Accept only an application-local absolute path, never a protocol-relative URL. */
export function safeAuthRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/home";
  return value;
}
