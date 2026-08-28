import { BodyMeasurements } from "@/components/body/body-measurements";
import { WeightHistory } from "@/components/body/weight-history";
import { listBodyMeasurements } from "@/lib/body-measurements";
import { listWeightHistory } from "@/lib/phase1/day-log";
import { getMyProfile } from "@/lib/phase1/profile";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";

export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const [profile, weightHistory, measurements] = await Promise.all([
    getMyProfile(),
    listWeightHistory(),
    listBodyMeasurements(),
  ]);
  const today = todayInCordoba();

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Cuerpo</h1>
        <p className="text-sm text-muted-foreground">Seguí la evolución de tu peso y medidas.</p>
      </div>
      <WeightHistory
        initialEntries={weightHistory}
        initialCurrentWeightKg={profile?.current_weight_kg ?? null}
        today={today}
      />
      <BodyMeasurements initialEntries={measurements} today={today} />
    </div>
  );
}
