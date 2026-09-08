import { getLatestBodyMeasurement } from "@/lib/body-measurements";
import { getAuthedUser, getProfileForUser } from "@/lib/phase1/profile";
import { SettingsHeader } from "../settings-components";
import { ProfileOverview } from "./profile-overview";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await getAuthedUser();
  const [profile, latestMeasurement] = await Promise.all([
    getProfileForUser(user.id),
    getLatestBodyMeasurement(),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <SettingsHeader
        title="Perfil"
        description="Tus datos personales y físicos."
        backHref="/settings"
      />
      <ProfileOverview
        profile={profile}
        email={user.email ?? null}
        latestWaistCm={latestMeasurement?.waist_cm ?? null}
      />
    </div>
  );
}
