import { useCallback, useEffect, useState } from "react";

import type { MobileDailyMetricDto } from "../../../src/lib/mobile-api/contracts";
import {
  fetchMobileDailyMetrics,
  type MobileDailyMetricsResult,
} from "./client";

type ProductDataSyncState =
  | { status: "loading" }
  | MobileDailyMetricsResult;

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 4,
});

function formatMetric(metric: MobileDailyMetricDto): string {
  if (metric.valueType === "duration") {
    const hours = Math.floor(metric.value / 60);
    const minutes = metric.value % 60;
    if (!hours) return `${minutes} min`;
    if (!minutes) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }

  return `${numberFormatter.format(metric.value)}${
    metric.unit ? ` ${metric.unit}` : ""
  }`;
}

export function ProductDataSync() {
  const [state, setState] = useState<ProductDataSyncState>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    setState(await fetchMobileDailyMetrics());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="product-data-sync" aria-labelledby="data-sync-title">
      <p className="diagnostics-title" id="data-sync-title">
        Product data sync
      </p>

      {state.status === "loading" ? (
        <p className="sync-message" role="status">
          Cargando datos…
        </p>
      ) : null}

      {state.status === "ok" ? (
        <>
          <p className="sync-date">Fecha: {state.data.date}</p>
          {state.data.metrics.length > 0 ? (
            <dl className="sync-metrics">
              {state.data.metrics.map((metric) => (
                <div key={metric.id}>
                  <dt>{metric.label}</dt>
                  <dd>{formatMetric(metric)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="sync-message">
              Sin métricas registradas para esta fecha.
            </p>
          )}
          <button
            className="qa-action sync-retry"
            onClick={() => void load()}
            type="button"
          >
            Actualizar
          </button>
        </>
      ) : null}

      {state.status === "unavailable" ? (
        <>
          <p className="sync-message" role="alert">
            No pudimos cargar los datos.
          </p>
          <button
            className="qa-action sync-retry"
            onClick={() => void load()}
            type="button"
          >
            Reintentar
          </button>
        </>
      ) : null}

      {state.status === "unauthorized" ? (
        <>
          <p className="sync-message" role="alert">
            No pudimos validar tu sesión.
          </p>
          <button
            className="qa-action sync-retry"
            onClick={() => void load()}
            type="button"
          >
            Reintentar
          </button>
        </>
      ) : null}
    </section>
  );
}
