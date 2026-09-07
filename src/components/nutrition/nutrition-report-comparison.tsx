import { normalizeDisplayZero } from "@/lib/chart-core";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import type { NutritionReportComparison, NutritionReportComparisonRow } from "@/lib/nutrition/reports-core";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const signedInteger = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0, signDisplay: "always" });
const signedDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, signDisplay: "always" });

function rowUnit(row: NutritionReportComparisonRow) {
  if (row.unit === "entrenamientos") return row.aggregation === "total" ? "total" : "promedio";
  return `${row.aggregation === "average" ? "promedio diario" : "total"} · ${row.unit}`;
}

function formatComparisonNumber(
  value: number | null,
  row: NutritionReportComparisonRow,
  signed = false,
) {
  if (value === null) return "—";
  const decimals = row.unit === "g" || row.unit === "L" ? 1 : 0;
  const normalized = normalizeDisplayZero(value, decimals);
  if (signed) return decimals === 0 ? signedInteger.format(normalized) : signedDecimal.format(normalized);
  return decimals === 0 ? integer.format(normalized) : decimal.format(normalized);
}

function Period({ label, range, current = false }: {
  label: string;
  range: NutritionReportComparison["currentRange"];
  current?: boolean;
}) {
  return <div className={current
    ? "rounded-lg border border-primary/30 bg-primary/8 px-3 py-2.5"
    : "rounded-lg border border-border bg-muted/25 px-3 py-2.5"
  }>
    <p className={current
      ? "text-[11px] font-semibold uppercase tracking-[0.1em] text-primary"
      : "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
    }>{label}</p>
    <p className="mt-1 text-sm font-medium">{formatNutritionReportRange(range.start, range.end)}</p>
  </div>;
}

export function NutritionReportComparisonSummary({ comparison }: { comparison: NutritionReportComparison }) {
  const rows = comparison.rows.filter((row) => row.metric !== "mate" || row.current !== null || row.previous !== null);
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      <Period label="Actual" range={comparison.currentRange} current />
      <Period label="Anterior" range={comparison.previousRange} />
    </div>
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[22%]" />
          <col className="w-[22%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead className="border-b bg-muted/35 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2.5 py-2" scope="col">Métrica</th>
            <th className="px-1.5 py-2 text-right" scope="col">Actual</th>
            <th className="px-1.5 py-2 text-right" scope="col">Anterior</th>
            <th className="px-2.5 py-2 text-right" scope="col">Cambio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row) => <tr key={row.metric}>
            <th className="px-2.5 py-2 text-xs font-medium" scope="row">
              <span className="block">{row.label}</span>
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{rowUnit(row)}</span>
            </th>
            <td className="metric-number px-1.5 py-2 text-right text-xs">{formatComparisonNumber(row.current, row)}</td>
            <td className="metric-number px-1.5 py-2 text-right text-xs">{formatComparisonNumber(row.previous, row)}</td>
            <td className="metric-number px-2.5 py-2 text-right text-xs font-medium">{formatComparisonNumber(row.delta, row, true)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
