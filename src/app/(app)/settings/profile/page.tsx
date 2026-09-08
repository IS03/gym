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
    <div className="mx-auto h-[calc(100dvh-7.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-2xl space-y-5 overflow-y-auto overscroll-contain pb-16 [-webkit-overflow-scrolling:touch] lg:h-auto lg:overflow-visible lg:pb-0">
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
