import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import OAuthConsentError from "./error";

describe("consent recovery preserves the full URL", () => {
  it("reloads the current document without a GET form that erases search parameters", () => {
    const href = "https://preview.example/oauth/consent?authorization_id=synthetic_pending_request&error=decision";
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { href, reload } });
    try {
      const result = OAuthConsentError();
      const children = result.props.children as ReactElement<{ type?: string; onClick?: () => void }>[];
      expect(children.some((child) => child.type === "form")).toBe(false);
      const button = children.find((child) => child.props.onClick)!;
      expect(button.props.type).toBe("button");
      button.props.onClick!();
      expect(reload).toHaveBeenCalledOnce();
      expect(window.location.href).toBe(href);
    } finally { vi.unstubAllGlobals(); }
  });
});
