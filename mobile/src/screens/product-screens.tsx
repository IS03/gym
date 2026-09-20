import { ChevronRight } from "lucide-react";

import type { AuthIdentity } from "../auth/state";

type PlaceholderScreenProps = {
  description: string;
  title: string;
};

export function PlaceholderScreen({
  description,
  title,
}: PlaceholderScreenProps) {
  return (
    <section className="product-screen" aria-labelledby="screen-title">
      <h1 id="screen-title">{title}</h1>
      <p className="screen-description">{description}</p>
    </section>
  );
}

type SettingsScreenProps = {
  identity: AuthIdentity;
  logoutPending: boolean;
  onOpenDiagnostics: () => void;
  onSignOut: () => Promise<void>;
};

export function SettingsScreen({
  identity,
  logoutPending,
  onOpenDiagnostics,
  onSignOut,
}: SettingsScreenProps) {
  return (
    <section
      className="product-screen settings-screen"
      aria-labelledby="screen-title"
    >
      <h1 id="screen-title">Ajustes</h1>
      <p className="screen-description">Configuración de OWNLEVEL.</p>

      <div className="settings-section" aria-labelledby="developer-title">
        <p className="section-label" id="developer-title">
          Desarrollo
        </p>
        <button
          className="settings-row"
          onClick={onOpenDiagnostics}
          type="button"
        >
          <span>
            <strong>Developer / Diagnostics</strong>
            <small>Foundation nativa y sincronización de datos.</small>
          </span>
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>

      <div className="settings-section" aria-labelledby="account-title">
        <p className="section-label" id="account-title">
          Cuenta
        </p>
        <div className="account-summary">
          <strong>
            {identity.displayName ?? identity.email ?? "Cuenta OWNLEVEL"}
          </strong>
          {identity.displayName && identity.email ? (
            <small>{identity.email}</small>
          ) : null}
        </div>
        <button
          className="secondary-action settings-logout"
          disabled={logoutPending}
          onClick={() => void onSignOut()}
          type="button"
        >
          {logoutPending ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </section>
  );
}
