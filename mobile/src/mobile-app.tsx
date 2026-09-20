import { useEffect, useState } from "react";

import { ProductApp } from "./app/product-app";
import { selectMobileRootSurface } from "./app/root-state";
import { AuthSurface } from "./auth/auth-surface";
import { useMobileAuth } from "./auth/use-mobile-auth";
import { native } from "./native/bridge";
import type { NativeInfo } from "./native/types";

export function MobileApp() {
  const { retry, signIn, signOut, state } = useMobileAuth();
  const [nativeInfo, setNativeInfo] = useState<NativeInfo | null>(null);

  useEffect(() => {
    let active = true;

    void native.info().then(
      (info) => {
        if (active) setNativeInfo(info);
      },
      () => undefined,
    );

    return () => {
      active = false;
    };
  }, []);

  if (selectMobileRootSurface(state.status) === "product") {
    if (state.status !== "authenticated") return null;
    return (
      <ProductApp
        identity={state.identity}
        nativeInfo={nativeInfo}
        onAuthRejected={retry}
        onSignOut={signOut}
      />
    );
  }

  if (state.status === "authenticated") return null;
  return (
    <AuthSurface
      nativeInfo={nativeInfo}
      onRetry={retry}
      onSignIn={signIn}
      state={state}
    />
  );
}
