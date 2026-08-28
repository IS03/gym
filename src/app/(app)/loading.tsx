export default function AppLoading() {
  return (
    <div className="space-y-6" aria-label="Cargando" aria-busy="true">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
