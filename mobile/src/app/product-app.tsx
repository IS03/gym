import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import type { AuthIdentity } from "../auth/state";
import { ProductNavigation } from "../navigation/product-navigation";
import {
  settingsReturnPath,
  tabPathForContext,
  type ProductNavigationState,
} from "../navigation/routes";
import { useProductDeepLinks } from "../navigation/use-product-deep-links";
import type { NativeInfo } from "../native/types";
import { DiagnosticsScreen } from "../screens/diagnostics-screen";
import {
  PlaceholderScreen,
  SettingsScreen,
} from "../screens/product-screens";

type ProductAppProps = {
  identity: AuthIdentity;
  nativeInfo: NativeInfo | null;
  onSignOut: () => Promise<void>;
};

function ProductRouter({ identity, nativeInfo, onSignOut }: ProductAppProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutPending, setLogoutPending] = useState(false);
  const isSettings = location.pathname === "/settings";
  const isDiagnostics = location.pathname === "/settings/diagnostics";
  const nested = isSettings || isDiagnostics;
  const navigationState = location.state as ProductNavigationState | null;
  const returnTo = settingsReturnPath(navigationState);

  useProductDeepLinks();

  async function handleLogout() {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      await onSignOut();
    } finally {
      setLogoutPending(false);
    }
  }

  function openSettings() {
    navigate("/settings", {
      state: { returnTo: tabPathForContext(location.pathname) },
    });
  }

  function goBack() {
    if (isDiagnostics) {
      navigate("/settings", { replace: true, state: { returnTo } });
      return;
    }
    navigate(returnTo, { replace: true });
  }

  return (
    <div className="product-app">
      <header className="product-header">
        {nested ? (
          <button
            aria-label={isDiagnostics ? "Volver a Ajustes" : "Volver"}
            className="header-action"
            onClick={goBack}
            type="button"
          >
            <ArrowLeft aria-hidden size={21} />
          </button>
        ) : (
          <span className="header-action-spacer" aria-hidden />
        )}
        <p className="product-brand">OWNLEVEL</p>
        {!nested ? (
          <button
            aria-label="Abrir Ajustes"
            className="header-action"
            onClick={openSettings}
            type="button"
          >
            <Settings aria-hidden size={20} />
          </button>
        ) : (
          <span className="header-action-spacer" aria-hidden />
        )}
      </header>

      <main className="product-content" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Navigate replace to="/home" />} />
          <Route
            path="/home"
            element={
              <PlaceholderScreen
                title="Inicio"
                description="Tu resumen diario de OWNLEVEL aparecerá acá."
              />
            }
          />
          <Route
            path="/train"
            element={
              <PlaceholderScreen
                title="Entrenar"
                description="Tus rutinas y sesiones aparecerán acá."
              />
            }
          />
          <Route
            path="/today"
            element={
              <PlaceholderScreen
                title="Nutrición"
                description="Tus comidas y objetivos del día aparecerán acá."
              />
            }
          />
          <Route
            path="/progress"
            element={
              <PlaceholderScreen
                title="Progreso"
                description="Tu evolución y comparaciones aparecerán acá."
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsScreen
                identity={identity}
                logoutPending={logoutPending}
                onOpenDiagnostics={() =>
                  navigate("/settings/diagnostics", {
                    state: { returnTo },
                  })
                }
                onSignOut={handleLogout}
              />
            }
          />
          <Route
            path="/settings/diagnostics"
            element={<DiagnosticsScreen nativeInfo={nativeInfo} />}
          />
          <Route path="*" element={<Navigate replace to="/home" />} />
        </Routes>
      </main>

      {!nested ? <ProductNavigation /> : null}
    </div>
  );
}

export function ProductApp(props: ProductAppProps) {
  return (
    <HashRouter>
      <ProductRouter {...props} />
    </HashRouter>
  );
}
