import type { MobileAuthState } from "../auth/state";

export type MobileRootSurface = "auth" | "product";

export function selectMobileRootSurface(
  status: MobileAuthState["status"],
): MobileRootSurface {
  return status === "authenticated" ? "product" : "auth";
}
