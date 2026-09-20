import { isProductPath, type ProductPath } from "./routes";

const PRODUCT_DEEP_LINK_PROTOCOL = "ownlevel:";
const PRODUCT_DEEP_LINK_HOST = "app";

export function parseProductDeepLink(rawUrl: string): ProductPath | null {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== PRODUCT_DEEP_LINK_PROTOCOL ||
    url.hostname !== PRODUCT_DEEP_LINK_HOST ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !isProductPath(url.pathname)
  ) {
    return null;
  }

  return url.pathname;
}
