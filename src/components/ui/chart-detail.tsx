type ChartDetailItem = { label: string; value: string };

export function ChartDetail({ title, items, description }: { title: string; items: ChartDetailItem[]; description?: string }) {
  return <div className="rounded-lg bg-muted/55 px-3 py-2 text-sm" role="status" aria-live="polite">
    <p className="font-medium">{title}</p>
    <div className="mt-1 grid gap-0.5 text-muted-foreground">{items.map((item) => <p key={item.label}><span>{item.label}: </span><span className="metric-number text-foreground">{item.value}</span></p>)}</div>
    {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
  </div>;
}
