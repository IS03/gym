import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthedUser, getProfileForUser } from "@/lib/phase1/profile";
import { ProfileForm } from "../profile-form";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await getAuthedUser();
  const profile = await getProfileForUser(user.id);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div className="space-y-2">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Ajustes
        </Link>
        <div className="flex items-center gap-2">
          <UserRound className="size-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Perfil</h1>
        </div>
        <p className="text-sm text-muted-foreground">Tus datos personales y referencia física.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información y referencia física</CardTitle>
          <p className="text-sm text-muted-foreground">Se usa para personalizar el seguimiento nutricional.</p>
        </CardHeader>
        <CardContent><ProfileForm profile={profile} /></CardContent>
      </Card>
    </div>
  );
}
