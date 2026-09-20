import { useCallback, useEffect, useReducer, useRef } from "react";

import { fetchMobileHome } from "../api/home";
import { subscribeToAppForeground } from "../native/lifecycle";
import {
  initialMobileHomeState,
  mobileHomeReducer,
} from "./home-state";

export function useMobileHome(onUnauthorized: () => Promise<void>) {
  const [state, dispatch] = useReducer(
    mobileHomeReducer,
    initialMobileHomeState,
  );
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    dispatch({ type: "load_started" });

    try {
      const result = await fetchMobileHome();
      dispatch({ type: "load_finished", result });
      if (result.status === "unauthorized") {
        await onUnauthorized();
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeToAppForeground(() => void refresh()).then(
      (cleanup) => {
        if (!active) {
          cleanup();
          return;
        }
        unsubscribe = cleanup;
      },
      () => undefined,
    );

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refresh]);

  return { refresh, state };
}
