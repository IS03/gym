import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listRoutines } from "@/lib/phase2/training";
import { startFreeSessionAction, startSessionFromRoutineAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof sp.date === "string" ? sp.date : today;
  const routineId = typeof sp.routine_id === "string" ? sp.routine_id : "";

  const routines = await listRoutines({ includeArchived: false });

  async function startFree(formData: FormData) {
    "use server";
    const sessionId = await startFreeSessionAction(formData);
    redirect(`/train/session/${sessionId}`);
  }

  async function startFromRoutine(formData: FormData) {
    "use server";
    const sessionId = await startSessionFromRoutineAction(formData);
    redirect(`/train/session/${sessionId}`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva sesión</h1>
        <p className="text-sm text-muted-foreground">Crear para una fecha.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sesión libre</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={startFree} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" name="date" type="date" defaultValue={date} />
            </div>
            <Button className="h-11 w-full" type="submit">
              Iniciar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desde rutina</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={startFromRoutine} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="date2">Fecha</Label>
              <Input id="date2" name="date" type="date" defaultValue={date} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="routine_id">Rutina</Label>
              <select
                id="routine_id"
                name="routine_id"
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue={routineId || (routines[0]?.id ?? "")}
                required
              >
                {routines.length === 0 ? (
                  <option value="" disabled>
                    No tenés rutinas
                  </option>
                ) : (
                  routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))
                )}
              </select>
            </div>
            <Button className="h-11 w-full" type="submit" disabled={routines.length === 0}>
              Iniciar desde rutina
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

