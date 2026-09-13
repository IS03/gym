export default function ProgressLoading() {
  return <div className="space-y-7 pb-16" aria-label="Cargando Progreso">
    <div className="space-y-4"><div className="h-8 w-32 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /></div>
    {["evolution", "changes", "relationships", "habits"].map((section) => <div key={section} className="space-y-3"><div className="h-6 w-40 animate-pulse rounded bg-muted" /><div className="h-28 animate-pulse rounded-xl bg-muted/70" /></div>)}
  </div>;
}
