import { useState } from "react";

import { ProductDataSync } from "../api/product-data-sync";
import { native } from "../native/bridge";
import {
  NATIVE_CAPABILITY_NAMES,
  type NativeInfo,
} from "../native/types";

type DiagnosticsScreenProps = {
  nativeInfo: NativeInfo | null;
};

export function DiagnosticsScreen({ nativeInfo }: DiagnosticsScreenProps) {
  const [hapticPending, setHapticPending] = useState<string | null>(null);

  async function handleHaptic(
    name: "selection" | "success" | "warning",
  ) {
    if (hapticPending) return;

    setHapticPending(name);
    try {
      await native.haptics[name]();
    } finally {
      setHapticPending(null);
    }
  }

  return (
    <section
      className="product-screen diagnostics-screen"
      aria-labelledby="screen-title"
    >
      <h1 id="screen-title">Diagnostics</h1>
      <p className="screen-description">
        Herramientas temporales de la foundation móvil.
      </p>

      {nativeInfo ? (
        <section
          className="foundation-diagnostics"
          aria-label="Diagnóstico de la foundation nativa"
        >
          <p className="diagnostics-title">Foundation</p>
          <dl className="diagnostics-grid">
            <div>
              <dt>Platform</dt>
              <dd>{nativeInfo.platform}</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{nativeInfo.runtime}</dd>
            </div>
            <div>
              <dt>App</dt>
              <dd>{nativeInfo.appVersion ?? "—"}</dd>
            </div>
            <div>
              <dt>Build</dt>
              <dd>{nativeInfo.buildNumber ?? "—"}</dd>
            </div>
            <div>
              <dt>Bridge</dt>
              <dd>{nativeInfo.bridgeVersion}</dd>
            </div>
          </dl>
          <ul className="capability-list">
            {NATIVE_CAPABILITY_NAMES.map((capability) => (
              <li key={capability}>
                <span>{capability}</span>
                <span>{nativeInfo.capabilities[capability]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="diagnostics-loading" role="status">
          Cargando diagnóstico…
        </p>
      )}

      {nativeInfo?.capabilities.haptics === "available" ? (
        <section className="haptics-qa" aria-labelledby="haptics-qa-title">
          <p className="diagnostics-title" id="haptics-qa-title">
            Haptics QA
          </p>
          <div className="haptics-actions">
            <button
              className="qa-action"
              disabled={hapticPending !== null}
              onClick={() => void handleHaptic("selection")}
              type="button"
            >
              Selección
            </button>
            <button
              className="qa-action"
              disabled={hapticPending !== null}
              onClick={() => void handleHaptic("success")}
              type="button"
            >
              Éxito
            </button>
            <button
              className="qa-action"
              disabled={hapticPending !== null}
              onClick={() => void handleHaptic("warning")}
              type="button"
            >
              Advertencia
            </button>
          </div>
        </section>
      ) : null}

      {nativeInfo ? <ProductDataSync /> : null}
    </section>
  );
}
