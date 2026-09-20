import { useEffect } from "react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

import { isCapacitorRuntime } from "../native/runtime";
import { parseProductDeepLink } from "./product-deep-link";

export function useProductDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitorRuntime()) return;

    let active = true;
    let listener: PluginListenerHandle | null = null;

    function openProductUrl(rawUrl: string) {
      const path = parseProductDeepLink(rawUrl);
      if (active && path) {
        navigate(path, { replace: true });
      }
    }

    void App.addListener("appUrlOpen", ({ url }) => openProductUrl(url)).then(
      (handle) => {
        if (!active) {
          void handle.remove();
          return;
        }
        listener = handle;
      },
      () => undefined,
    );

    void App.getLaunchUrl().then(
      (launch) => {
        if (launch?.url) openProductUrl(launch.url);
      },
      () => undefined,
    );

    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, [navigate]);
}
